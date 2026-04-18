// lib/db/events.ts
// Liest und schreibt ein Event-Objekt in/aus allen Supabase-Tabellen.
// Nutzt den Supabase JS-Client (anon key + Session für normale Operationen,
// service-role key für privilegierte Operationen wie event_members).

import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type {
  Event, Guest, Begleitperson, Hotel, HotelRoom, SubEvent,
  SeatingTable, BudgetItem, Vendor, Task, Reminder, TimelineEntry,
  CateringPlan, OrganizerSettings, DekoWish, GuestPhoto,
  DEFAULT_FEATURE_TOGGLES, FeatureKey,
} from '@/lib/store'
import { SEED_EVENT, DEFAULT_FEATURE_TOGGLES as DEFAULTS } from '@/lib/store'
import type { UserRole, EventDienstleister, TrauzeugePermissions } from '@/lib/types/roles'
import type { Conversation, Message } from '@/lib/types/messaging'
import type { PendingChange, ChangeArea, ChangeData } from '@/lib/types/approvals'
import type { AuditEntry } from '@/lib/types/audit'

// ── UUID-Hilfsfunktion ─────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(s: string) { return UUID_RE.test(s) }

// Wandelt beliebige String-IDs in deterministisch abgeleitete UUIDs um,
// damit alte localStorage-IDs wie "g1" stabil in UUIDs konvertiert werden.
export function toUUID(id: string): string {
  if (isUUID(id)) return id
  // Einfache, deterministische Hash-to-UUID-Konvertierung
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(31, hash) + id.charCodeAt(i) | 0
  }
  const h = Math.abs(hash).toString(16).padStart(8, '0')
  return `${h.slice(0,8)}-0000-4000-8000-${h.padEnd(12, '0').slice(0,12)}`
}

// ── Row-Builder (wiederverwendet von Bulk-Upsert + per-Guest-RSVP-API) ────────
export function toGuestRow(g: Guest, eventId: string) {
  return {
    id: toUUID(g.id),
    event_id: eventId,
    name: g.name,
    email: g.email ?? null,
    token: g.token || crypto.randomUUID(),
    status: g.status,
    phone: g.phone ?? null,
    address: g.address ?? null,
    trink_alkohol: g.trinkAlkohol ?? null,
    meal_choice: g.meal ?? null,
    allergy_tags: g.allergies ?? [],
    allergy_custom: g.allergyCustom ?? null,
    arrival_date: g.arrivalDate ?? null,
    arrival_time: g.arrivalTime ?? null,
    transport_mode: g.transport ?? null,
    hotel_room_id: g.hotelRoomId && g.hotelRoomId !== 'none' ? toUUID(g.hotelRoomId) : null,
    message: g.message ?? null,
    responded_at: g.respondedAt ?? null,
    sub_event_ids: g.subEventIds ?? [],
  }
}

export function toBegleitRow(b: Begleitperson, guestId: string) {
  return {
    id: toUUID(b.id),
    guest_id: guestId,
    name: b.name,
    age_category: b.ageCategory,
    trink_alkohol: b.trinkAlkohol ?? null,
    meal_choice: b.meal ?? null,
    allergy_tags: b.allergies ?? [],
    allergy_custom: b.allergyCustom ?? null,
  }
}

// ── Event aus Supabase laden ───────────────────────────────────────────────────
// Optionales eventId: wenn angegeben, wird genau dieses Event geladen (für Event-Switch).
export async function fetchEventFromDB(userId: string, specificEventId?: string): Promise<Event | null> {
  const supabase = createBrowserClient()

  // 1. Event-Member suchen
  let memberQuery = supabase
    .from('event_members')
    .select('event_id, role')
    .eq('user_id', userId)

  if (specificEventId) {
    memberQuery = memberQuery.eq('event_id', specificEventId)
  } else {
    memberQuery = memberQuery.limit(1)
  }

  const { data: member, error: memberErr } = await memberQuery.maybeSingle()

  if (memberErr || !member) return null
  const eventId = member.event_id

  // 2. Alle Tabellen parallel laden
  const [
    { data: ev },
    { data: guests },
    { data: begleit },
    { data: budgetItems },
    { data: vendorRows },
    { data: taskRows },
    { data: reminderRows },
    { data: hotelRows },
    { data: hotelRoomRows },
    { data: timelineRows },
    { data: subEventRows },
    { data: subEventGuestRows },
    { data: seatingTableRows },
    { data: seatingAssignmentRows },
    { data: cateringRow },
    { data: featureRows },
    { data: orgVendors },
    { data: orgHotels },
    { data: orgCatering },
    { data: dekoSuggRows },
    { data: dekoWishRows },
    { data: locationImageRows },
    { data: guestPhotoRows },
  ] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).maybeSingle(),
    supabase.from('guests').select('*').eq('event_id', eventId),
    supabase.from('begleitpersonen').select('*'),
    supabase.from('budget_items').select('*').eq('event_id', eventId),
    supabase.from('vendors').select('*').eq('event_id', eventId),
    supabase.from('tasks').select('*').eq('event_id', eventId),
    supabase.from('reminders').select('*').eq('event_id', eventId),
    supabase.from('hotels').select('*').eq('event_id', eventId),
    supabase.from('hotel_rooms').select('*'),
    supabase.from('timeline_entries').select('*').eq('event_id', eventId).order('sort_order'),
    supabase.from('sub_events').select('*').eq('event_id', eventId),
    supabase.from('sub_event_guests').select('*'),
    supabase.from('seating_tables').select('*').eq('event_id', eventId),
    supabase.from('seating_assignments').select('*'),
    supabase.from('catering_plans').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('feature_toggles').select('*').eq('event_id', eventId),
    supabase.from('organizer_vendor_suggestions').select('*').eq('event_id', eventId),
    supabase.from('organizer_hotel_suggestions').select('*').eq('event_id', eventId),
    supabase.from('organizer_catering_suggestions').select('*').eq('event_id', eventId),
    supabase.from('deko_suggestions').select('*').eq('event_id', eventId),
    supabase.from('deko_wishes').select('*').eq('event_id', eventId),
    supabase.from('location_images').select('*').eq('event_id', eventId),
    supabase.from('guest_photos').select('*').eq('event_id', eventId),
  ])

  if (!ev) return null

  // 3. Gäste mit Begleitpersonen zusammenführen
  const begleitMap: Record<string, Begleitperson[]> = {}
  for (const b of begleit ?? []) {
    if (!begleitMap[b.guest_id]) begleitMap[b.guest_id] = []
    begleitMap[b.guest_id].push({
      id: b.id, name: b.name ?? '', ageCategory: b.age_category ?? 'erwachsen',
      trinkAlkohol: b.trink_alkohol ?? undefined,
      meal: b.meal_choice ?? undefined,
      allergies: b.allergy_tags ?? [],
      allergyCustom: b.allergy_custom ?? undefined,
    })
  }

  const mappedGuests: Guest[] = (guests ?? []).map(g => ({
    id: g.id, name: g.name, email: g.email ?? '', token: g.token ?? '',
    status: g.status as Guest['status'],
    phone: g.phone ?? undefined, address: g.address ?? undefined,
    trinkAlkohol: g.trink_alkohol ?? undefined,
    meal: g.meal_choice as Guest['meal'] ?? undefined,
    allergies: g.allergy_tags ?? [],
    allergyCustom: g.allergy_custom ?? undefined,
    arrivalDate: g.arrival_date ?? undefined,
    arrivalTime: g.arrival_time ?? undefined,
    transport: g.transport_mode as Guest['transport'] ?? undefined,
    hotelRoomId: g.hotel_room_id ?? undefined,
    message: g.message ?? undefined,
    respondedAt: g.responded_at ?? undefined,
    subEventIds: g.sub_event_ids ?? [],
    begleitpersonen: begleitMap[g.id] ?? [],
  }))

  // 4. Sub-Events mit Gästen
  const subGuestMap: Record<string, string[]> = {}
  for (const sg of subEventGuestRows ?? []) {
    if (!subGuestMap[sg.sub_event_id]) subGuestMap[sg.sub_event_id] = []
    subGuestMap[sg.sub_event_id].push(sg.guest_id)
  }
  const mappedSubEvents: SubEvent[] = (subEventRows ?? []).map(se => ({
    id: se.id, name: se.name ?? '', date: se.date ?? '', time: se.time ?? undefined,
    venue: se.venue ?? '', description: se.description ?? undefined,
    guestIds: subGuestMap[se.id] ?? [],
  }))

  // 5. Seating mit Gästen
  const tableGuestMap: Record<string, string[]> = {}
  for (const sa of seatingAssignmentRows ?? []) {
    if (!tableGuestMap[sa.table_id]) tableGuestMap[sa.table_id] = []
    tableGuestMap[sa.table_id].push(sa.guest_id)
  }
  const mappedSeating: SeatingTable[] = (seatingTableRows ?? []).map(t => ({
    id: t.id, name: t.name ?? '', capacity: t.capacity ?? 8,
    shape: (t.shape as SeatingTable['shape']) ?? 'rectangular',
    x: t.pos_x ?? 0, y: t.pos_y ?? 0,
    tableLength: t.table_length ?? 2.0, tableWidth: t.table_width ?? 0.8,
    rotation: t.rotation ?? 0,
    guestIds: tableGuestMap[t.id] ?? [],
  }))

  // 6. Hotels mit Zimmern
  const roomMap: Record<string, HotelRoom[]> = {}
  for (const r of hotelRoomRows ?? []) {
    if (!roomMap[r.hotel_id]) roomMap[r.hotel_id] = []
    roomMap[r.hotel_id].push({
      id: r.id, type: r.room_type, totalRooms: r.total_rooms ?? 0,
      bookedRooms: r.booked_rooms ?? 0, pricePerNight: r.price_per_night ?? 0,
    })
  }
  const mappedHotels: Hotel[] = (hotelRows ?? []).map(h => ({
    id: h.id, name: h.name, address: h.address ?? '',
    rooms: roomMap[h.id] ?? [],
  }))

  // 7. Catering
  const catering: CateringPlan | undefined = cateringRow ? {
    serviceStyle: cateringRow.service_style as CateringPlan['serviceStyle'],
    locationHasKitchen: cateringRow.location_has_kitchen ?? false,
    midnightSnack: cateringRow.midnight_snack ?? false,
    midnightSnackNote: cateringRow.midnight_snack_note ?? '',
    drinksBilling: cateringRow.drinks_billing as CateringPlan['drinksBilling'],
    drinksSelection: cateringRow.drinks_selection ?? [],
    champagneFingerFood: cateringRow.champagne_finger_food ?? false,
    champagneFingerFoodNote: cateringRow.champagne_finger_food_note ?? '',
    serviceStaff: cateringRow.service_staff ?? false,
    equipmentNeeded: cateringRow.equipment_needed ?? [],
    budgetPerPerson: cateringRow.budget_per_person ?? 0,
    budgetIncludesDrinks: cateringRow.budget_includes_drinks ?? false,
    cateringNotes: cateringRow.catering_notes ?? '',
  } : undefined

  // 8. Feature-Toggles
  const featureToggles: Record<FeatureKey, boolean> = { ...DEFAULTS }
  for (const f of featureRows ?? []) {
    featureToggles[f.key as FeatureKey] = f.enabled ?? true
  }

  // 9. Organizer
  const organizer: OrganizerSettings = {
    featureToggles,
    locationImages: (locationImageRows ?? []).map(r => r.storage_url),
    vendorSuggestions: (orgVendors ?? []).map(v => ({
      id: v.id, name: v.name ?? '', category: v.category as any,
      description: v.description ?? '', priceEstimate: v.price_estimate ?? 0,
      contactEmail: v.contact_email ?? undefined, contactPhone: v.contact_phone ?? undefined,
      status: v.status as any,
    })),
    hotelSuggestions: (orgHotels ?? []).map(h => ({
      id: h.id, name: h.name ?? '', address: h.address ?? '',
      distanceKm: h.distance_km ?? 0, pricePerNight: h.price_per_night ?? 0,
      totalRooms: h.total_rooms ?? 0, description: h.description ?? '',
      status: h.status as any,
    })),
    cateringSuggestions: (orgCatering ?? []).map(c => ({
      id: c.id, name: c.name ?? '', style: c.style as any,
      pricePerPerson: c.price_per_person ?? 0, description: c.description ?? '',
      contactEmail: c.contact_email ?? undefined, status: c.status as any,
      lockedFields: c.locked_fields ? Object.fromEntries(c.locked_fields.map((f: string) => [f, true])) : {},
    })),
    dekoSuggestions: (dekoSuggRows ?? []).map(d => ({
      id: d.id, title: d.title ?? '', description: d.description ?? '',
      imageUrl: d.image_url ?? undefined, status: d.status as any,
    })),
  }

  // 10. Deko-Wünsche
  const dekoWishes: DekoWish[] = (dekoWishRows ?? []).map(d => ({
    id: d.id, title: d.title ?? '', notes: d.notes ?? '',
    imageUrl: d.image_url ?? undefined,
  }))

  // 11. Gäste-Fotos
  const guestPhotos: GuestPhoto[] = (guestPhotoRows ?? []).map(p => ({
    id: p.id, uploaderName: p.uploader_name ?? '',
    dataUrl: p.storage_url, uploadedAt: p.uploaded_at ?? new Date().toISOString(),
  }))

  // 12. Zusammenführen
  return {
    id: ev.id,
    coupleName: ev.couple_name || ev.title || '',
    date: ev.date ?? '',
    venue: ev.venue ?? '',
    venueAddress: ev.venue_address ?? '',
    dresscode: ev.dresscode ?? '',
    childrenAllowed: ev.children_allowed ?? true,
    childrenNote: ev.children_note ?? undefined,
    mealOptions: ev.meal_options ?? ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
    maxBegleitpersonen: ev.max_begleitpersonen ?? 2,
    roomLength: ev.room_length ?? 12,
    roomWidth: ev.room_width ?? 8,
    onboardingComplete: ev.onboarding_complete ?? false,
    dataFreezeAt: ev.data_freeze_at ?? undefined,
    createdAt: ev.created_at ?? new Date().toISOString(),
    guests: mappedGuests,
    hotels: mappedHotels,
    timeline: (timelineRows ?? []).map(t => ({
      time: t.time ?? '', title: t.title ?? '', location: t.location ?? '',
    })),
    subEvents: mappedSubEvents,
    seatingTables: mappedSeating,
    budget: (budgetItems ?? []).map(b => ({
      id: b.id, category: b.category as any, description: b.description ?? '',
      planned: b.planned ?? 0, actual: b.actual ?? 0,
      status: b.payment_status as any, notes: b.notes ?? undefined,
    })),
    vendors: (vendorRows ?? []).map(v => ({
      id: v.id, name: v.name ?? '', category: v.category as any,
      status: v.status as any,
      contactName: v.contact_name ?? undefined, phone: v.phone ?? undefined,
      email: v.email ?? undefined, price: v.price ?? undefined,
      notes: v.notes ?? undefined,
    })),
    tasks: (taskRows ?? []).map(t => ({
      id: t.id, title: t.title ?? '', phase: t.phase as any,
      done: t.done ?? false, notes: t.notes ?? undefined,
    })),
    reminders: (reminderRows ?? []).map(r => ({
      id: r.id, type: r.type as any, title: r.title ?? '',
      targetDate: r.target_date ?? undefined, sent: r.sent ?? false,
      notes: r.notes ?? undefined,
    })),
    catering,
    organizer,
    dekoWishes,
    guestPhotos,
  }
}

// ── Event in Supabase speichern ────────────────────────────────────────────────
export async function upsertEventToDB(event: Event, userId: string): Promise<void> {
  const supabase = createBrowserClient()

  const eventId = toUUID(event.id)

  // 1. Sicherstellen, dass event existiert und user Mitglied ist
  const { error: evErr } = await supabase.from('events').upsert({
    id: eventId,
    couple_name: event.coupleName,
    date: event.date,
    venue: event.venue,
    venue_address: event.venueAddress,
    dresscode: event.dresscode,
    children_allowed: event.childrenAllowed,
    children_note: event.childrenNote ?? null,
    meal_options: event.mealOptions,
    max_begleitpersonen: event.maxBegleitpersonen,
    room_length: event.roomLength ?? 12,
    room_width: event.roomWidth ?? 8,
    onboarding_complete: event.onboardingComplete,
  }, { onConflict: 'id' })

  if (evErr) throw evErr

  // 2. Event-Mitgliedschaft sicherstellen (insert-only, bestehende Rolle NICHT überschreiben)
  await supabase.from('event_members').upsert(
    { event_id: eventId, user_id: userId, role: 'brautpaar' },
    { onConflict: 'event_id,user_id', ignoreDuplicates: true }
  )
  // Note: ignoreDuplicates=true means if a row already exists, we don't overwrite the role

  // 3. Gäste (non-destruktiv: upsert + nur fehlende Ids löschen,
  //    damit parallele RSVP-Schreibvorgänge nicht überschrieben werden)
  const guestRows = event.guests.map(g => toGuestRow(g, eventId))
  const guestIds  = guestRows.map(r => r.id)

  const { data: existingGuests } = await supabase
    .from('guests').select('id').eq('event_id', eventId)
  const existingIds   = (existingGuests ?? []).map(r => r.id as string)
  const idsToDelete   = existingIds.filter(id => !guestIds.includes(id))
  if (idsToDelete.length > 0) {
    // CASCADE löscht zugehörige begleitpersonen/sub_event_guests/seating_assignments
    await supabase.from('guests').delete().in('id', idsToDelete)
  }
  if (guestRows.length > 0) {
    await supabase.from('guests').upsert(guestRows, { onConflict: 'id' })

    // Begleitpersonen pro Gast: delete-scoped + insert (kein event-weites Delete)
    for (const g of event.guests) {
      const gid = toUUID(g.id)
      await supabase.from('begleitpersonen').delete().eq('guest_id', gid)
      if (g.begleitpersonen.length > 0) {
        const rows = g.begleitpersonen.map(b => toBegleitRow(b, gid))
        await supabase.from('begleitpersonen').insert(rows)
      }
    }
  }

  // 4. Sub-Events
  await supabase.from('sub_events').delete().eq('event_id', eventId)
  if (event.subEvents.length > 0) {
    const seRows = event.subEvents.map(se => ({
      id: toUUID(se.id), event_id: eventId,
      name: se.name, date: se.date, time: se.time ?? null,
      venue: se.venue, description: se.description ?? null,
    }))
    await supabase.from('sub_events').insert(seRows)

    const segRows = event.subEvents.flatMap(se =>
      se.guestIds.map(gid => ({
        sub_event_id: toUUID(se.id), guest_id: toUUID(gid),
      }))
    ).filter(r => event.guests.some(g => toUUID(g.id) === r.guest_id))
    if (segRows.length > 0) await supabase.from('sub_event_guests').insert(segRows)
  }

  // 5. Sitzplan
  await supabase.from('seating_tables').delete().eq('event_id', eventId)
  if (event.seatingTables.length > 0) {
    const stRows = event.seatingTables.map(t => ({
      id: toUUID(t.id), event_id: eventId,
      name: t.name, capacity: t.capacity,
      shape: t.shape ?? 'rectangular',
      pos_x: t.x ?? 0, pos_y: t.y ?? 0,
      rotation: t.rotation ?? 0,
      table_length: t.tableLength ?? 2.0,
      table_width: t.tableWidth ?? 0.8,
    }))
    await supabase.from('seating_tables').insert(stRows)

    const saRows = event.seatingTables.flatMap(t =>
      t.guestIds.map(gid => ({
        table_id: toUUID(t.id), guest_id: toUUID(gid),
      }))
    ).filter(r => event.guests.some(g => toUUID(g.id) === r.guest_id))
    if (saRows.length > 0) await supabase.from('seating_assignments').insert(saRows)
  }

  // 6. Budget
  await supabase.from('budget_items').delete().eq('event_id', eventId)
  if (event.budget.length > 0) {
    await supabase.from('budget_items').insert(event.budget.map(b => ({
      id: toUUID(b.id), event_id: eventId,
      category: b.category, description: b.description,
      planned: b.planned, actual: b.actual,
      payment_status: b.status, notes: b.notes ?? null,
    })))
  }

  // 7. Dienstleister
  await supabase.from('vendors').delete().eq('event_id', eventId)
  if (event.vendors.length > 0) {
    await supabase.from('vendors').insert(event.vendors.map(v => ({
      id: toUUID(v.id), event_id: eventId,
      name: v.name, category: v.category, status: v.status,
      contact_name: v.contactName ?? null, phone: v.phone ?? null,
      email: v.email ?? null, price: v.price ?? null, notes: v.notes ?? null,
    })))
  }

  // 8. Aufgaben
  await supabase.from('tasks').delete().eq('event_id', eventId)
  if (event.tasks.length > 0) {
    await supabase.from('tasks').insert(event.tasks.map(t => ({
      id: toUUID(t.id), event_id: eventId,
      title: t.title, phase: t.phase, done: t.done, notes: t.notes ?? null,
    })))
  }

  // 9. Erinnerungen
  await supabase.from('reminders').delete().eq('event_id', eventId)
  if (event.reminders.length > 0) {
    await supabase.from('reminders').insert(event.reminders.map(r => ({
      id: toUUID(r.id), event_id: eventId,
      type: r.type, title: r.title,
      target_date: r.targetDate ?? null, sent: r.sent, notes: r.notes ?? null,
    })))
  }

  // 10. Hotels
  await supabase.from('hotels').delete().eq('event_id', eventId)
  if (event.hotels.length > 0) {
    await supabase.from('hotels').insert(event.hotels.map(h => ({
      id: toUUID(h.id), event_id: eventId, name: h.name, address: h.address,
    })))
    const roomRows = event.hotels.flatMap(h =>
      h.rooms.map(r => ({
        id: toUUID(r.id), hotel_id: toUUID(h.id),
        room_type: r.type, total_rooms: r.totalRooms,
        booked_rooms: r.bookedRooms, price_per_night: r.pricePerNight,
      }))
    )
    if (roomRows.length > 0) await supabase.from('hotel_rooms').insert(roomRows)
  }

  // 11. Timeline
  await supabase.from('timeline_entries').delete().eq('event_id', eventId)
  if (event.timeline.length > 0) {
    await supabase.from('timeline_entries').insert(event.timeline.map((t, i) => ({
      event_id: eventId, time: t.time, title: t.title, location: t.location, sort_order: i,
    })))
  }

  // 12. Catering
  if (event.catering) {
    const c = event.catering
    await supabase.from('catering_plans').upsert({
      event_id: eventId,
      service_style: c.serviceStyle, location_has_kitchen: c.locationHasKitchen,
      midnight_snack: c.midnightSnack, midnight_snack_note: c.midnightSnackNote,
      drinks_billing: c.drinksBilling, drinks_selection: c.drinksSelection,
      champagne_finger_food: c.champagneFingerFood,
      champagne_finger_food_note: c.champagneFingerFoodNote,
      service_staff: c.serviceStaff, equipment_needed: c.equipmentNeeded,
      budget_per_person: c.budgetPerPerson, budget_includes_drinks: c.budgetIncludesDrinks,
      catering_notes: c.cateringNotes,
      locked_fields: event.cateringLockedFields
        ? Object.keys(event.cateringLockedFields).filter(k => (event.cateringLockedFields as any)[k])
        : [],
    }, { onConflict: 'event_id' })
  }

  // 13. Feature-Toggles
  if (event.organizer?.featureToggles) {
    await supabase.from('feature_toggles').delete().eq('event_id', eventId)
    const ftRows = Object.entries(event.organizer.featureToggles).map(([key, enabled]) => ({
      event_id: eventId, key, enabled,
    }))
    if (ftRows.length > 0) await supabase.from('feature_toggles').insert(ftRows)
  }

  // 14. Organizer-Vorschläge
  if (event.organizer) {
    await supabase.from('organizer_vendor_suggestions').delete().eq('event_id', eventId)
    if (event.organizer.vendorSuggestions.length > 0) {
      await supabase.from('organizer_vendor_suggestions').insert(
        event.organizer.vendorSuggestions.map(v => ({
          id: toUUID(v.id), event_id: eventId, name: v.name, category: v.category,
          description: v.description, price_estimate: v.priceEstimate,
          contact_email: v.contactEmail ?? null, contact_phone: v.contactPhone ?? null,
          status: v.status,
        }))
      )
    }

    await supabase.from('organizer_hotel_suggestions').delete().eq('event_id', eventId)
    if (event.organizer.hotelSuggestions.length > 0) {
      await supabase.from('organizer_hotel_suggestions').insert(
        event.organizer.hotelSuggestions.map(h => ({
          id: toUUID(h.id), event_id: eventId, name: h.name, address: h.address,
          distance_km: h.distanceKm, price_per_night: h.pricePerNight,
          total_rooms: h.totalRooms, description: h.description, status: h.status,
        }))
      )
    }

    await supabase.from('organizer_catering_suggestions').delete().eq('event_id', eventId)
    if (event.organizer.cateringSuggestions.length > 0) {
      await supabase.from('organizer_catering_suggestions').insert(
        event.organizer.cateringSuggestions.map(c => ({
          id: toUUID(c.id), event_id: eventId, name: c.name, style: c.style,
          description: c.description, price_per_person: c.pricePerPerson,
          contact_email: c.contactEmail ?? null, status: c.status,
          locked_fields: c.lockedFields
            ? Object.keys(c.lockedFields).filter(k => (c.lockedFields as any)[k])
            : [],
        }))
      )
    }

    await supabase.from('deko_suggestions').delete().eq('event_id', eventId)
    if (event.organizer.dekoSuggestions.length > 0) {
      await supabase.from('deko_suggestions').insert(
        event.organizer.dekoSuggestions.map(d => ({
          id: toUUID(d.id), event_id: eventId, title: d.title,
          description: d.description, image_url: d.imageUrl ?? null, status: d.status,
        }))
      )
    }
  }

  // 15. Deko-Wünsche
  await supabase.from('deko_wishes').delete().eq('event_id', eventId)
  if (event.dekoWishes.length > 0) {
    await supabase.from('deko_wishes').insert(event.dekoWishes.map(d => ({
      id: toUUID(d.id), event_id: eventId,
      title: d.title, notes: d.notes, image_url: d.imageUrl ?? null,
    })))
  }

  // 16. Gäste-Fotos (nur Metadaten, keine base64-Daten)
  await supabase.from('guest_photos').delete().eq('event_id', eventId)
  const storagePhoots = event.guestPhotos.filter(p => !p.dataUrl.startsWith('data:'))
  if (storagePhoots.length > 0) {
    await supabase.from('guest_photos').insert(storagePhoots.map(p => ({
      id: toUUID(p.id), event_id: eventId,
      uploader_name: p.uploaderName, storage_url: p.dataUrl, uploaded_at: p.uploadedAt,
    })))
  }
}

// ── Neues Event anlegen + User als Veranstalter hinzufügen ───────────────────
export async function createNewEvent(userId: string): Promise<string> {
  const supabase = createBrowserClient()
  const eventId = crypto.randomUUID()

  await supabase.from('events').insert({
    id: eventId,
    created_by: userId,
    onboarding_complete: false,
  })

  await supabase.from('event_members').insert({
    event_id: eventId, user_id: userId, role: 'veranstalter',
  })

  return eventId
}

// ── Alle Events eines Veranstalters (lightweight) ─────────────────────────────
export type EventSummary = {
  id: string
  title: string
  coupleName: string | null
  displayName: string
  date: string | null
  venue: string | null
  onboardingComplete: boolean
  createdAt: string
}

// Einheitliche Namens-Auswahl für alle Dashboards.
export function eventDisplayName(ev: { couple_name?: string | null; title?: string | null }): string {
  return (ev.couple_name && ev.couple_name.trim())
    || (ev.title && ev.title.trim())
    || 'Unbenanntes Event'
}

export async function fetchEventSummariesForVeranstalter(userId: string): Promise<EventSummary[]> {
  const supabase = createBrowserClient()
  const { data, error } = await supabase
    .from('event_members')
    .select('event_id, events:event_id(id, title, couple_name, date, venue, onboarding_complete, created_at)')
    .eq('user_id', userId)
    .eq('role', 'veranstalter')
    .order('event_id')

  if (error || !data) return []

  return data
    .map((row: any) => {
      const ev = row.events
      if (!ev) return null
      const coupleName = ev.couple_name ?? null
      const title = ev.title ?? 'Unbenanntes Event'
      return {
        id: ev.id,
        title,
        coupleName,
        displayName: eventDisplayName(ev),
        date: ev.date ?? null,
        venue: ev.venue ?? null,
        onboardingComplete: ev.onboarding_complete ?? false,
        createdAt: ev.created_at,
      }
    })
    .filter(Boolean) as EventSummary[]
}


// ── Rolle des Users im Event abrufen ──────────────────────────────────────────
export async function fetchUserRole(eventId: string, userId: string): Promise<UserRole | null> {
  const supabase = createBrowserClient()
  const { data } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.role as UserRole) ?? null
}

// ── Event-Dienstleister ───────────────────────────────────────────────────────
export async function fetchEventDienstleister(eventId: string): Promise<EventDienstleister[]> {
  const supabase = createBrowserClient()
  const { data } = await supabase
    .from('event_dienstleister')
    .select('*, dienstleister_profiles(*)')
    .eq('event_id', eventId)
  return (data ?? []).map(row => ({
    id: row.id,
    eventId: row.event_id,
    dienstleisterId: row.dienstleister_id,
    userId: row.user_id ?? undefined,
    category: row.category,
    scopes: row.scopes ?? [],
    status: row.status as EventDienstleister['status'],
    invitedBy: row.invited_by ?? undefined,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at ?? undefined,
    profile: row.dienstleister_profiles ? {
      id: row.dienstleister_profiles.id,
      name: row.dienstleister_profiles.name,
      companyName: row.dienstleister_profiles.company_name ?? undefined,
      category: row.dienstleister_profiles.category,
      email: row.dienstleister_profiles.email ?? undefined,
      phone: row.dienstleister_profiles.phone ?? undefined,
      website: row.dienstleister_profiles.website ?? undefined,
      description: row.dienstleister_profiles.description ?? undefined,
    } : undefined,
  }))
}

export async function upsertEventDienstleister(data: EventDienstleister): Promise<void> {
  const supabase = createBrowserClient()
  await supabase.from('event_dienstleister').upsert({
    id: data.id,
    event_id: data.eventId,
    dienstleister_id: data.dienstleisterId,
    user_id: data.userId ?? null,
    category: data.category,
    scopes: data.scopes,
    status: data.status,
    invited_by: data.invitedBy ?? null,
    accepted_at: data.acceptedAt ?? null,
  }, { onConflict: 'id' })
}

export async function removeEventDienstleister(id: string): Promise<void> {
  const supabase = createBrowserClient()
  await supabase.from('event_dienstleister').delete().eq('id', id)
}

// ── Trauzeuge-Permissions ─────────────────────────────────────────────────────
export async function fetchTrauzeugePermissions(eventId: string, userId: string): Promise<TrauzeugePermissions | null> {
  const supabase = createBrowserClient()
  const { data } = await supabase
    .from('trauzeuge_permissions')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  return {
    eventId: data.event_id,
    userId: data.user_id,
    canViewGuests: data.can_view_guests ?? true,
    canEditGuests: data.can_edit_guests ?? false,
    canViewSeating: data.can_view_seating ?? true,
    canEditSeating: data.can_edit_seating ?? true,
    canViewBudget: data.can_view_budget ?? false,
    canViewCatering: data.can_view_catering ?? false,
    canViewTimeline: data.can_view_timeline ?? true,
    canEditTimeline: data.can_edit_timeline ?? false,
    canViewVendors: data.can_view_vendors ?? false,
    canManageDeko: data.can_manage_deko ?? true,
  }
}

export async function upsertTrauzeugePermissions(perms: TrauzeugePermissions): Promise<void> {
  const supabase = createBrowserClient()
  await supabase.from('trauzeuge_permissions').upsert({
    event_id: perms.eventId,
    user_id: perms.userId,
    can_view_guests: perms.canViewGuests,
    can_edit_guests: perms.canEditGuests,
    can_view_seating: perms.canViewSeating,
    can_edit_seating: perms.canEditSeating,
    can_view_budget: perms.canViewBudget,
    can_view_catering: perms.canViewCatering,
    can_view_timeline: perms.canViewTimeline,
    can_edit_timeline: perms.canEditTimeline,
    can_view_vendors: perms.canViewVendors,
    can_manage_deko: perms.canManageDeko,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'event_id,user_id' })
}

// ── Pending Changes (Freigabesystem) ──────────────────────────────────────────
export async function submitPendingChange(change: {
  eventId: string; area: ChangeArea; proposedBy: string
  proposerRole: string; changeData: ChangeData
}): Promise<string> {
  const supabase = createBrowserClient()
  const { data, error } = await supabase
    .from('pending_changes')
    .insert({
      event_id: change.eventId,
      area: change.area,
      proposed_by: change.proposedBy,
      proposer_role: change.proposerRole,
      change_data: change.changeData as any,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function fetchPendingChanges(eventId: string): Promise<PendingChange[]> {
  const supabase = createBrowserClient()
  const { data } = await supabase
    .from('pending_changes')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return (data ?? []).map(row => ({
    id: row.id,
    eventId: row.event_id,
    area: row.area as ChangeArea,
    proposedBy: row.proposed_by,
    proposerRole: row.proposer_role,
    changeData: row.change_data as ChangeData,
    status: row.status as PendingChange['status'],
    reviewedBy: row.reviewed_by ?? undefined,
    reviewNote: row.review_note ?? undefined,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  }))
}

export async function resolvePendingChange(
  id: string,
  status: 'approved' | 'rejected',
  note?: string
): Promise<void> {
  const supabase = createBrowserClient()
  await supabase.from('pending_changes').update({
    status,
    review_note: note ?? null,
    resolved_at: new Date().toISOString(),
  }).eq('id', id)
}

// ── Messaging ─────────────────────────────────────────────────────────────────
export async function fetchConversations(eventId: string): Promise<Conversation[]> {
  const supabase = createBrowserClient()
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  return (data ?? []).map(row => ({
    id: row.id,
    eventId: row.event_id,
    title: row.title ?? undefined,
    participantRoles: row.participant_roles ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at,
  }))
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const supabase = createBrowserClient()
  const { data } = await supabase
    .from('messages')
    .select('*, profiles(name)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  return (data ?? []).map(row => ({
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: (row.profiles as any)?.name ?? undefined,
    content: row.content,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
  }))
}

export async function sendMessage(conversationId: string, content: string): Promise<void> {
  const supabase = createBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content,
  })
}

export function subscribeToMessages(
  conversationId: string,
  callback: (msg: Message) => void
): () => void {
  const supabase = createBrowserClient()
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as any
        callback({
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          content: row.content,
          createdAt: row.created_at,
          editedAt: row.edited_at ?? undefined,
        })
      }
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

export async function createConversation(eventId: string, title: string, participantRoles: string[] = []): Promise<string> {
  const supabase = createBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      event_id: eventId,
      title,
      participant_roles: participantRoles,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

// ── Audit-Log ─────────────────────────────────────────────────────────────────
export async function fetchAuditLog(eventId: string): Promise<AuditEntry[]> {
  const supabase = createBrowserClient()
  const { data } = await supabase
    .from('audit_log')
    .select('*, profiles(name)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(200)
  return (data ?? []).map(row => ({
    id: row.id,
    eventId: row.event_id,
    actorId: row.actor_id,
    actorName: (row.profiles as any)?.name ?? undefined,
    actorRole: row.actor_role,
    action: row.action,
    tableName: row.table_name,
    recordId: row.record_id ?? undefined,
    oldData: row.old_data ?? undefined,
    newData: row.new_data ?? undefined,
    createdAt: row.created_at,
  }))
}
