// Server-only: builds a ModuleSnapshot for a given event + module.
// Used both for snapshot shares (captured once) and live shares (rebuilt on read).
// Pass an admin (service-role) Supabase client — all reads bypass RLS, so callers
// MUST authorise before invoking.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SHARE_MODULE_LABELS,
  type ModuleSnapshot,
  type ShareModule,
  type SnapshotBlock,
} from './shares'

/* eslint-disable @typescript-eslint/no-explicit-any */

function str(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nein'
  return String(v)
}

function minutesToTime(min: unknown): string {
  if (typeof min !== 'number' || Number.isNaN(min)) return ''
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Legacy timeline_entries.time can hold a full ISO timestamp (e.g.
// "2026-09-12T11:30:00+00:00") or already be an "HH:MM" string. Normalise to HH:MM.
function clockFromTimeStr(v: unknown): string {
  if (typeof v !== 'string' || !v) return ''
  const hm = v.match(/(\d{1,2}):(\d{2})/)
  if (hm) return `${hm[1].padStart(2, '0')}:${hm[2]}`
  const d = new Date(v)
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  }
  return ''
}

// Build a keyvalue block from a row, only including fields that are present + non-null.
function kvFromRow(row: Record<string, any>, fields: [string, string][]): SnapshotBlock | null {
  const items = fields
    .filter(([key]) => row[key] !== null && row[key] !== undefined && row[key] !== '')
    .map(([key, label]) => ({ label, value: str(row[key]) }))
  return items.length ? { kind: 'keyvalue', items } : null
}

async function buildBlocks(admin: SupabaseClient, eventId: string, module: ShareModule): Promise<SnapshotBlock[]> {
  const blocks: SnapshotBlock[] = []
  const byEvent = (t: string, order?: string) =>
    admin.from(t).select('*').eq('event_id', eventId).order(order ?? 'created_at', { ascending: true })

  switch (module) {
    case 'ablaufplan': {
      const { data: days } = await byEvent('ablaufplan_days', 'day_index')
      const { data: entries } = await byEvent('timeline_entries', 'day_index')
      const sorted = (entries ?? []).sort((a: any, b: any) =>
        (a.day_index ?? 0) - (b.day_index ?? 0) || (a.start_minutes ?? 0) - (b.start_minutes ?? 0))

      blocks.push({
        kind: 'stats',
        items: [
          { label: 'Tage', value: String((days?.length ?? 0) || 1) },
          { label: 'Programmpunkte', value: String(sorted.length) },
        ],
      })

      // One timeline block per day, so the vendor reads it like an agenda.
      const dayList = (days?.length ? days : [{ day_index: 0, name: null }]) as any[]
      for (const d of dayList) {
        const di = d.day_index ?? 0
        const dayEntries = sorted.filter((e: any) => (e.day_index ?? 0) === di)
        if (!dayEntries.length) continue
        const range = (d.start_hour != null && d.end_hour != null)
          ? ` · ${String(d.start_hour).padStart(2, '0')}:00–${String((d.end_hour) % 24).padStart(2, '0')}:00`
          : ''
        blocks.push({
          kind: 'timeline',
          heading: `${d.name ?? `Tag ${di + 1}`}${range}`,
          items: dayEntries.map((e: any) => ({
            time: minutesToTime(e.start_minutes) || clockFromTimeStr(e.time) || '—',
            title: str(e.title),
            meta: e.location ? str(e.location) : undefined,
            category: e.category ? str(e.category) : undefined,
          })),
        })
      }
      break
    }
    case 'sitzplan': {
      const { data: evTables } = await admin.from('seating_tables').select('*').eq('event_id', eventId)
      if (evTables && evTables.length) {
        const seats = evTables.reduce((sum: number, t: any) => sum + (t.capacity ?? 0), 0)
        blocks.push({
          kind: 'stats',
          items: [
            { label: 'Tische', value: String(evTables.length) },
            { label: 'Plätze gesamt', value: String(seats) },
          ],
        })
        blocks.push({
          kind: 'table',
          heading: 'Tische',
          columns: ['Tisch', 'Plätze', 'Form'],
          rows: evTables.map((t: any) => [str(t.name), str(t.capacity), str(t.shape)]),
        })
      }
      break
    }
    case 'gaesteliste': {
      const { data: counts } = await admin
        .from('v_event_guest_counts')
        .select('confirmed_guests, pending_guests, confirmed_plus_ones, declined_guests')
        .eq('event_id', eventId).maybeSingle()
      const { data: guests } = await byEvent('guests', 'name')
      const confirmedGuests = (guests ?? []).filter((g: any) => g.status === 'zugesagt')
      if (counts) {
        const confirmed = (counts.confirmed_guests ?? 0) + (counts.confirmed_plus_ones ?? 0)
        const statItems = [
          { label: 'Bestätigt', value: String(confirmed), sub: 'inkl. Begleitung' },
          { label: 'Ausstehend', value: String(counts.pending_guests ?? 0) },
        ]
        if (counts.declined_guests != null) statItems.push({ label: 'Abgesagt', value: String(counts.declined_guests) })
        blocks.push({ kind: 'stats', items: statItems })
      }
      // Aggregate allergies/diet across confirmed guests → quick chips for the caterer.
      const allergySet = new Set<string>()
      for (const g of confirmedGuests) {
        if (Array.isArray(g.allergy_tags)) g.allergy_tags.forEach((t: string) => t && allergySet.add(t))
        if (g.allergy_custom) allergySet.add(g.allergy_custom)
      }
      if (allergySet.size) {
        blocks.push({ kind: 'tags', heading: 'Allergien & Diäten', items: Array.from(allergySet) })
      }
      if (confirmedGuests.length) {
        blocks.push({
          kind: 'table',
          heading: 'Bestätigte Gäste',
          columns: ['Name', 'Essen', 'Allergien'],
          rows: confirmedGuests.slice(0, 300).map((g: any) => [
            str(g.name),
            str(g.meal_choice),
            Array.isArray(g.allergy_tags) && g.allergy_tags.length ? g.allergy_tags.join(', ') : (g.allergy_custom || '—'),
          ]),
        })
      }
      break
    }
    case 'catering': {
      const { data: plan } = await admin.from('catering_plans').select('*').eq('event_id', eventId).maybeSingle()
      if (plan) {
        const kv = kvFromRow(plan, [
          ['service_style', 'Service-Art'],
          ['plan_guest_count', 'Geplante Personen'],
          ['budget_per_person', 'Budget pro Person'],
          ['sektempfang', 'Sektempfang'],
          ['midnight_snack', 'Mitternachtssnack'],
          ['weinbegleitung', 'Weinbegleitung'],
          ['drinks_billing', 'Getränke-Abrechnung'],
          ['service_staff', 'Service-Personal'],
          ['equipment_needed', 'Equipment'],
          ['catering_notes', 'Notizen'],
        ])
        if (kv) blocks.push(kv)
        const courses = (plan as any).menu_courses
        if (Array.isArray(courses) && courses.length) {
          blocks.push({
            kind: 'menu',
            heading: 'Menügänge',
            items: courses.map((c: any) => ({
              name: str(c?.name),
              note: c?.description || c?.note || c?.details || undefined,
            })),
          })
        }
      }
      break
    }
    case 'getraenke': {
      const { data: kats } = await byEvent('getraenke_kategorien', 'sort_order')
      const { data: artikel } = await byEvent('getraenke_artikel', 'sort_order')
      if (artikel?.length) {
        const katName = (id: string) => (kats ?? []).find((k: any) => k.id === id)?.name ?? '—'
        blocks.push({
          kind: 'table',
          heading: 'Getränke',
          columns: ['Kategorie', 'Artikel', 'pro Person', 'geplant'],
          rows: artikel.map((a: any) => [katName(a.kategorie_id), str(a.name), str(a.amount_per_person), str(a.total_planned)]),
        })
      }
      const { data: cocktails } = await byEvent('getraenke_cocktails', 'name')
      if (cocktails?.length) {
        blocks.push({
          kind: 'menu',
          heading: 'Cocktails',
          items: cocktails.map((c: any) => {
            const ings = Array.isArray(c.ingredients)
              ? c.ingredients.map((i: any) => i?.name).filter(Boolean).join(', ')
              : ''
            const tone = c.is_alcoholic === false ? 'alkoholfrei' : ''
            const note = [tone, ings].filter(Boolean).join(' · ')
            return { name: str(c.name), note: note || undefined }
          }),
        })
      }
      break
    }
    case 'musik': {
      const { data: songs } = await byEvent('music_songs', 'sort_order')
      const wishes = (songs ?? []).filter((s: any) => s.type === 'wish')
      const noGos = (songs ?? []).filter((s: any) => s.type === 'no_go')
      if (wishes.length) {
        blocks.push({ kind: 'songs', tone: 'wish', heading: 'Musikwünsche', items: wishes.map((s: any) => ({ title: str(s.title), artist: s.artist || undefined })) })
      }
      if (noGos.length) {
        blocks.push({ kind: 'songs', tone: 'nogo', heading: 'No-Gos', items: noGos.map((s: any) => ({ title: str(s.title), artist: s.artist || undefined })) })
      }
      const { data: playlists } = await byEvent('musik_playlisten', 'sort_order')
      if (playlists?.length) {
        blocks.push({ kind: 'list', heading: 'Playlists', items: playlists.map((p: any) => `${str(p.title)} (${str(p.url)})`) })
      }
      const { data: req } = await admin.from('music_requirements').select('*').eq('event_id', eventId).maybeSingle()
      if (req) {
        const kv = kvFromRow(req, [
          ['soundcheck_date', 'Soundcheck Datum'],
          ['soundcheck_time', 'Soundcheck Uhrzeit'],
          ['stage_dimensions', 'Bühnenmaße'],
          ['microphone_count', 'Mikrofone'],
          ['pa_notes', 'PA-Notizen'],
          ['notes', 'Notizen'],
        ])
        if (kv) blocks.push({ ...kv, heading: 'Technik' } as SnapshotBlock)
      }
      break
    }
    case 'patisserie': {
      const { data: cfg } = await admin.from('patisserie_config').select('*').eq('event_id', eventId).maybeSingle()
      if (cfg) {
        const kv = kvFromRow(cfg, [
          ['cake_description', 'Torte'],
          ['layers', 'Etagen'],
          ['flavors', 'Geschmack'],
          ['dietary_notes', 'Diät-Hinweise'],
          ['delivery_date', 'Lieferdatum'],
          ['delivery_time', 'Lieferzeit'],
          ['setup_location', 'Aufbauort'],
          ['dessert_buffet', 'Dessertbuffet'],
          ['price', 'Preis'],
        ])
        if (kv) blocks.push(kv)
      }
      break
    }
    case 'dekoration': {
      const { data: areas } = await byEvent('deko_areas', 'sort_order')
      if (areas?.length) {
        blocks.push({ kind: 'tags', heading: 'Deko-Bereiche', items: areas.map((a: any) => str(a.name)) })
      }
      // Pull visual cues straight from the canvas items: color swatches/palettes (stable
      // hex) and external image URLs. R2-keyed uploads are skipped — their presigned
      // URLs would expire inside a frozen snapshot.
      const { data: items } = await admin
        .from('deko_items')
        .select('type, data')
        .eq('event_id', eventId)
        .in('type', ['color_swatch', 'color_palette', 'image_url'])
      const swatches: { hex: string; name?: string }[] = []
      const images: { url: string; caption?: string }[] = []
      for (const it of (items ?? []) as any[]) {
        const d = it.data ?? {}
        if (it.type === 'color_swatch' && d.hex) swatches.push({ hex: d.hex, name: d.name || undefined })
        if (it.type === 'color_palette' && Array.isArray(d.colors)) {
          for (const c of d.colors) if (c?.hex) swatches.push({ hex: c.hex, name: c.name || undefined })
        }
        if (it.type === 'image_url' && d.url) images.push({ url: d.url, caption: d.caption || undefined })
      }
      if (swatches.length) blocks.push({ kind: 'swatches', heading: 'Farbwelt', items: swatches.slice(0, 40) })
      if (images.length) blocks.push({ kind: 'images', heading: 'Inspiration', items: images.slice(0, 24) })
      const { data: catalog } = await byEvent('deko_catalog_items', 'created_at')
      if (catalog?.length) {
        blocks.push({
          kind: 'table',
          heading: 'Artikel-Katalog',
          columns: ['Artikel', 'Typ'],
          rows: catalog.slice(0, 200).map((c: any) => [str(c.name ?? c.title), str(c.type ?? c.kind)]),
        })
      }
      break
    }
    case 'medien': {
      const { data: briefing } = await admin.from('media_briefing').select('*').eq('event_id', eventId).maybeSingle()
      if (briefing) {
        const kv = kvFromRow(briefing, [
          ['photo_briefing', 'Foto-Briefing'],
          ['video_briefing', 'Video-Briefing'],
          ['photo_restrictions', 'Einschränkungen'],
          ['delivery_deadline', 'Lieferfrist'],
        ])
        if (kv) blocks.push(kv)
      }
      const { data: shots } = await byEvent('media_shot_items', 'sort_order')
      if (shots?.length) {
        blocks.push({
          kind: 'table',
          heading: 'Shotlist',
          columns: ['Motiv', 'Typ', 'Kategorie'],
          rows: shots.slice(0, 300).map((s: any) => [str(s.title), str(s.type), str(s.category)]),
        })
      }
      break
    }
  }

  return blocks
}

export async function buildModuleSnapshot(
  admin: SupabaseClient,
  eventId: string,
  module: ShareModule,
): Promise<ModuleSnapshot> {
  const blocks = await buildBlocks(admin, eventId, module)
  return {
    module,
    label: SHARE_MODULE_LABELS[module],
    generatedAt: new Date().toISOString(),
    empty: blocks.length === 0,
    blocks,
  }
}
