// app/api/wedding/[eventId]/route.ts
// Editor-API der Hochzeitswebsite (authentifiziert, Event-Mitglied).
//   GET  → lädt (oder erstellt) die Site inkl. Entwurfsinhalt + Event-Eckdaten.
//   PUT  → speichert Template, Slug, Inhalt (Entwurf) und SEO/OG.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEventRole } from '@/lib/files/permissions'
import { normalizeContent, defaultContent, isValidSlug, slugify } from '@/lib/wedding/content'
import { getTemplate } from '@/lib/wedding/templates'
import { WEDDING_LIMITS } from '@/lib/wedding/types'

const EDIT_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

async function authEditor(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) }
  const role = await getEventRole(supabase, user.id, eventId)
  if (!role || !EDIT_ROLES.includes(role)) {
    return { error: NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 }) }
  }
  return { userId: user.id }
}

async function loadEvent(admin: ReturnType<typeof createAdminClient>, eventId: string) {
  const { data: ev } = await admin
    .from('events')
    .select('id, title, couple_name, date, venue, venue_address, meal_options, max_begleitpersonen')
    .eq('id', eventId)
    .maybeSingle()
  return ev
}

const RSVP_TOGGLE_KEYS = ['rsvp-menu', 'rsvp-begleitpersonen', 'rsvp-musikwunsch', 'rsvp-geschenke', 'rsvp-hotel'] as const

async function loadRsvpSettings(admin: ReturnType<typeof createAdminClient>, eventId: string, ev: any) {
  const [{ data: rs }, { data: toggles }] = await Promise.all([
    admin.from('rsvp_settings').select('*').eq('event_id', eventId).maybeSingle(),
    admin.from('feature_toggles').select('key, enabled').eq('event_id', eventId).in('key', RSVP_TOGGLE_KEYS as unknown as string[]),
  ])
  const tmap = Object.fromEntries((toggles ?? []).map((t: any) => [t.key, t.enabled]))
  return {
    invitationText: rs?.invitation_text ?? '',
    deadline: rs?.rsvp_deadline ?? null,
    phoneContact: rs?.phone_contact ?? '',
    showMealChoice: rs?.show_meal_choice ?? true,
    showPlusOne: rs?.show_plus_one ?? true,
    maxBegleitpersonen: ev?.max_begleitpersonen ?? 2,
    mealOptions: ev?.meal_options ?? ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
    toggles: {
      menu: tmap['rsvp-menu'] ?? true,
      begleitpersonen: tmap['rsvp-begleitpersonen'] ?? true,
      musikwunsch: tmap['rsvp-musikwunsch'] ?? true,
      geschenke: tmap['rsvp-geschenke'] ?? true,
      hotel: tmap['rsvp-hotel'] ?? true,
    },
  }
}

function coupleNameOf(ev: any): string {
  return (ev?.couple_name && ev.couple_name.trim()) || (ev?.title && ev.title.trim()) || ''
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const auth = await authEditor(eventId)
  if (auth.error) return auth.error

  const admin = createAdminClient()
  const ev = await loadEvent(admin, eventId)
  if (!ev) return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })
  const coupleName = coupleNameOf(ev)

  let { data: site } = await admin.from('wedding_sites').select('*').eq('event_id', eventId).maybeSingle()

  if (!site) {
    // Erstanlage mit Default-Inhalt + Vorschlag-Slug aus den Paarnamen.
    const draft = defaultContent(coupleName)
    let suggested = slugify(coupleName) || `hochzeit-${eventId.slice(0, 6)}`
    // Slug-Kollision vermeiden
    const { data: clash } = await admin.from('wedding_sites').select('id').eq('slug', suggested).maybeSingle()
    if (clash) suggested = `${suggested}-${eventId.slice(0, 4)}`
    const { data: created, error } = await admin
      .from('wedding_sites')
      .insert({ event_id: eventId, slug: suggested, draft_content: draft })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    site = created
  }

  const rsvpSettings = await loadRsvpSettings(admin, eventId, ev)

  return NextResponse.json({
    site: {
      slug: site.slug,
      templateId: site.template_id,
      status: site.status,
      isOnline: site.is_online,
      content: normalizeContent(site.draft_content, coupleName),
      hasPublished: !!site.published_content,
      publishedAt: site.published_at,
      og: { title: site.og_title ?? '', description: site.og_description ?? '', imageKey: site.og_image_r2_key ?? null },
    },
    rsvpSettings,
    event: {
      id: ev.id, coupleName, date: ev.date ?? null,
      venue: ev.venue ?? null, venueAddress: ev.venue_address ?? null,
    },
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const auth = await authEditor(eventId)
  if (auth.error) return auth.error

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungültiger Payload' }, { status: 400 }) }

  const admin = createAdminClient()
  const ev = await loadEvent(admin, eventId)
  if (!ev) return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })
  const coupleName = coupleNameOf(ev)

  const patch: Record<string, unknown> = {}

  // Template
  if (typeof body.templateId === 'string') {
    patch.template_id = getTemplate(body.templateId).id // validiert gegen Registry
  }

  // Slug
  if (body.slug !== undefined) {
    const slug = String(body.slug ?? '').trim().toLowerCase()
    if (slug && !isValidSlug(slug)) {
      return NextResponse.json({ error: 'Ungültiger Link. Erlaubt: 3–60 Zeichen, Kleinbuchstaben, Zahlen, Bindestriche.' }, { status: 400 })
    }
    if (slug) {
      const { data: clash } = await admin
        .from('wedding_sites').select('event_id').eq('slug', slug).maybeSingle()
      if (clash && clash.event_id !== eventId) {
        return NextResponse.json({ error: 'Dieser Link ist bereits vergeben.', field: 'slug' }, { status: 409 })
      }
    }
    patch.slug = slug || null
  }

  // Inhalt (Entwurf) — serverseitig hart auf Limits geklemmt
  if (body.content !== undefined) {
    patch.draft_content = normalizeContent(body.content, coupleName)
  }

  // SEO/OG
  if (body.og && typeof body.og === 'object') {
    patch.og_title = String(body.og.title ?? '').slice(0, WEDDING_LIMITS.ogTitle) || null
    patch.og_description = String(body.og.description ?? '').slice(0, WEDDING_LIMITS.ogDescription) || null
    if ('imageKey' in body.og) patch.og_image_r2_key = body.og.imageKey || null
  }

  if (typeof body.isOnline === 'boolean') patch.is_online = body.isOnline

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nichts zu speichern' }, { status: 400 })
  }

  // Upsert (Zeile existiert i.d.R. schon nach GET)
  const { data: updated, error } = await admin
    .from('wedding_sites')
    .upsert({ event_id: eventId, ...patch }, { onConflict: 'event_id' })
    .select('slug, template_id, status, is_online, og_title, og_description, og_image_r2_key')
    .single()

  if (error) {
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'Dieser Link ist bereits vergeben.', field: 'slug' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, slug: updated.slug })
}
