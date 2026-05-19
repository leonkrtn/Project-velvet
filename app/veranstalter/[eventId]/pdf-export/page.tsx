import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PdfExportClient from './PdfExportClient'
import type { PdfEventData } from '@/components/pdf/PdfTypes'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function PdfExportPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'veranstalter') redirect('/veranstalter')

  // ── Step 1: Fetch guests first to obtain IDs for the begleitpersonen query.
  // This avoids an `await` inside the Promise.all array (which would serialise
  // every query that comes after it instead of running them in parallel).
  const { data: guestsRaw, error: guestsError } = await supabase
    .from('guests')
    .select('id, name, status, side, meal_choice, allergy_tags, allergy_custom, notes')
    .eq('event_id', eventId)
    .order('name')

  if (guestsError) redirect('/veranstalter')

  const guests  = guestsRaw ?? []
  const guestIds = guests.map((g: { id: string }) => g.id)

  // ── Step 2: All remaining queries in parallel ────────────────────────────
  const [
    eventRes,
    bpRes,
    orgCostsRes,
    begleitRes,
    roomConfigRes,
    tablesRes,
    assignmentsRes,
    entriesRes,
    daysRes,
    cateringRes,
    cateringCostsRes,
    budgetRes,
    songsRes,
    reqRes,
    areasRes,
    canvasesRes,
    catalogRes,
    flatRatesRes,
    patisserieRes,
    briefingRes,
    shotsRes,
    vendorsRes,
    getraenkeKatRes,
    getraenkeArtRes,
    getraenkeCocRes,
  ] = await Promise.all([
    supabase.from('events').select(`
      id, title, couple_name, date, ceremony_start,
      venue, venue_address,
      location_name, location_street, location_zip, location_city, location_website,
      max_begleitpersonen, children_allowed, children_note,
      budget_total, organizer_fee, organizer_fee_type,
      internal_notes, dresscode, projektphase, meal_options
    `).eq('id', eventId).single(),

    supabase.from('event_members')
      .select('profiles!user_id(name, email)')
      .eq('event_id', eventId)
      .eq('role', 'brautpaar'),

    supabase.from('event_organizer_costs')
      .select('category, amount, notes')
      .eq('event_id', eventId)
      .neq('source', 'catering')
      .order('created_at'),

    // Guard against empty guestIds — PostgREST behaviour with .in([]) is undefined
    guestIds.length > 0
      ? supabase.from('begleitpersonen')
          .select('id, guest_id, name, meal_choice, allergy_tags, allergy_custom')
          .in('guest_id', guestIds)
      : Promise.resolve({ data: [] as any[], error: null }),

    supabase.from('event_room_configs').select('points, elements').eq('event_id', eventId).maybeSingle(),

    supabase.from('seating_tables')
      .select('id, name, shape, capacity, pos_x, pos_y, rotation, table_length, table_width')
      .eq('event_id', eventId),

    supabase.from('seating_assignments')
      .select('id, table_id, guest_id, begleitperson_id, brautpaar_slot')
      .eq('event_id', eventId),

    supabase.from('timeline_entries')
      .select('*')
      .eq('event_id', eventId)
      .order('day_index').order('start_minutes', { nullsFirst: false }),

    supabase.from('ablaufplan_days')
      .select('*')
      .eq('event_id', eventId)
      .order('day_index'),

    supabase.from('catering_plans').select('*').eq('event_id', eventId).maybeSingle(),

    supabase.from('event_organizer_costs')
      .select('category, price_per_person, notes')
      .eq('event_id', eventId)
      .eq('source', 'catering'),

    supabase.from('budget_items')
      .select('id, category, description, planned, actual, payment_status, notes')
      .eq('event_id', eventId)
      .order('category').order('created_at'),

    supabase.from('music_songs').select('*').eq('event_id', eventId).order('sort_order'),

    supabase.from('music_requirements').select('*').eq('event_id', eventId).maybeSingle(),

    supabase.from('deko_areas').select('id, name, color, sort_order').eq('event_id', eventId).order('sort_order'),

    supabase.from('deko_canvases')
      .select('id, area_id, name, canvas_type, is_frozen, sort_order')
      .eq('event_id', eventId),

    supabase.from('deko_catalog_items')
      .select('id, item_type, name, price_per_unit, price_per_meter, is_free, notes')
      .eq('event_id', eventId),

    supabase.from('deko_flat_rates')
      .select('id, name, description, amount')
      .eq('event_id', eventId),

    supabase.from('patisserie_config').select('*').eq('event_id', eventId).maybeSingle(),

    supabase.from('media_briefing').select('*').eq('event_id', eventId).maybeSingle(),

    supabase.from('media_shot_items')
      .select('id, title, description, type, category, sort_order')
      .eq('event_id', eventId)
      .order('type').order('sort_order'),

    supabase.from('vendors')
      .select('id, name, category, status, contact_name, phone, email, price, notes')
      .eq('event_id', eventId)
      .order('category').order('name'),

    supabase.from('getraenke_kategorien')
      .select('id, name, color')
      .eq('event_id', eventId)
      .order('sort_order'),

    supabase.from('getraenke_artikel')
      .select('id, kategorie_id, name, unit, amount_per_person, total_planned, price_per_unit, kalkulationspreis')
      .eq('event_id', eventId)
      .order('sort_order'),

    supabase.from('getraenke_cocktails')
      .select('id, name, description, is_alcoholic, planned_count, price_per_unit, kalkulationspreis, ingredients')
      .eq('event_id', eventId)
      .order('sort_order'),
  ])

  if (!eventRes.data) redirect('/veranstalter')

  // ── Compute derived data ─────────────────────────────────────────────────
  const begleit    = begleitRes.data ?? []
  const confirmedIds = new Set(guests.filter((g: { status: string }) => g.status === 'zugesagt').map((g: { id: string }) => g.id))

  const mealCounts: Record<string, number>    = {}
  const allergyCounts: Record<string, number> = {}
  for (const g of guests.filter((g: { status: string }) => g.status === 'zugesagt')) {
    if (g.meal_choice) mealCounts[g.meal_choice] = (mealCounts[g.meal_choice] ?? 0) + 1
    for (const tag of (g.allergy_tags ?? [])) {
      allergyCounts[tag] = (allergyCounts[tag] ?? 0) + 1
    }
  }
  for (const b of begleit.filter((b: { guest_id: string }) => confirmedIds.has(b.guest_id))) {
    if (b.meal_choice) mealCounts[b.meal_choice] = (mealCounts[b.meal_choice] ?? 0) + 1
    for (const tag of (b.allergy_tags ?? [])) {
      allergyCounts[tag] = (allergyCounts[tag] ?? 0) + 1
    }
  }

  const confirmedGuestCount = guests.filter((g: { status: string }) => g.status === 'zugesagt').length
    + begleit.filter((b: { guest_id: string }) => confirmedIds.has(b.guest_id)).length

  // Deko items by canvas (second sequential query — needs canvas IDs from the parallel batch above)
  const canvases   = canvasesRes.data ?? []
  const canvasIds  = canvases.map((c: { id: string }) => c.id)
  let dekoItemsByCanvas: Record<string, PdfEventData['dekoItemsByCanvas'][string]> = {}
  if (canvasIds.length > 0) {
    const { data: itemsRaw } = await supabase
      .from('deko_items')
      .select('id, canvas_id, type, data, x, y, width, height')
      .in('canvas_id', canvasIds)
    for (const item of itemsRaw ?? []) {
      if (!dekoItemsByCanvas[item.canvas_id]) dekoItemsByCanvas[item.canvas_id] = []
      dekoItemsByCanvas[item.canvas_id].push(item)
    }
  }

  // Room points
  const roomPoints = (roomConfigRes.data?.points ?? []) as Array<{ x: number; y: number }>

  // Normalize brautpaar members
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bpMembers = (bpRes.data ?? []).map((m: any) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    return { name: p?.name ?? null, email: p?.email ?? null }
  })

  const pdfData: PdfEventData = {
    event: eventRes.data as PdfEventData['event'],
    bpMembers,
    organizerCosts: (orgCostsRes.data ?? []) as PdfEventData['organizerCosts'],

    guests:          guests as PdfEventData['guests'],
    begleitpersonen: begleit as PdfEventData['begleitpersonen'],

    roomPoints,
    seatingTables:      (tablesRes.data ?? []) as PdfEventData['seatingTables'],
    seatingAssignments: (assignmentsRes.data ?? []) as PdfEventData['seatingAssignments'],
    coupleName:         eventRes.data.couple_name ?? '',

    timelineEntries: ((entriesRes.data ?? []) as PdfEventData['timelineEntries']).map(e => ({
      ...e,
      assigned_staff:   (e as any).assigned_staff   ?? [],
      assigned_vendors: (e as any).assigned_vendors ?? [],
      assigned_members: (e as any).assigned_members ?? [],
      checklist:        (e as any).checklist        ?? [],
    })),
    ablaufplanDays: (daysRes.data ?? []) as PdfEventData['ablaufplanDays'],

    cateringPlan:        cateringRes.data ?? null,
    cateringCosts:       (cateringCostsRes.data ?? []) as PdfEventData['cateringCosts'],
    mealCounts,
    allergyCounts,
    confirmedGuestCount,

    budgetItems: (budgetRes.data ?? []) as PdfEventData['budgetItems'],
    budgetTotal: eventRes.data.budget_total ?? null,

    musicSongs:        (songsRes.data ?? []) as PdfEventData['musicSongs'],
    musicRequirements: reqRes.data ?? null,

    dekoAreas:          (areasRes.data ?? []) as PdfEventData['dekoAreas'],
    dekoCanvases:       canvases as PdfEventData['dekoCanvases'],
    dekoItemsByCanvas,
    dekoCatalogItems:   (catalogRes.data ?? []) as PdfEventData['dekoCatalogItems'],
    dekoFlatRates:      (flatRatesRes.data ?? []) as PdfEventData['dekoFlatRates'],

    patisserieConfig: patisserieRes.data ?? null,

    mediaBriefing:   briefingRes.data ?? null,
    mediaShotItems:  (shotsRes.data ?? []) as PdfEventData['mediaShotItems'],

    vendors: (vendorsRes.data ?? []) as PdfEventData['vendors'],

    getraenkeKategorien: (getraenkeKatRes.data ?? []) as PdfEventData['getraenkeKategorien'],
    getraenkeArtikel:    (getraenkeArtRes.data ?? []) as PdfEventData['getraenkeArtikel'],
    getraenkeCocktails:  (getraenkeCocRes.data ?? []) as PdfEventData['getraenkeCocktails'],
  }

  return <PdfExportClient eventId={eventId} data={pdfData} />
}
