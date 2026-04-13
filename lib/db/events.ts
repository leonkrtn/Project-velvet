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

// ── UUID-Hilfsfunktion ─────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(s: string) { return UUID_RE.test(s) }

// Wandelt beliebige String-IDs in deterministisch abgeleitete UUIDs um,
// damit alte localStorage-IDs wie "g1" stabil in UUIDs konvertiert werden.
function toUUID(id: string): string {
  if (isUUID(id)) return id
  // Einfache, deterministische Hash-to-UUID-Konvertierung
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(31, hash) + id.charCodeAt(i) | 0
  }
  const h = Math.abs(hash).toString(16).padStart(8, '0')
  return `${h.slice(0,8)}-0000-4000-8000-${h.padEnd(12, '0').slice(0,12)}`
}

// ── Event aus Supabase laden ───────────────────────────────────────────────────
export async function fetchEventFromDB(userId: string): Promise<Event | null> {
  const supabase = createBrowserClient()

  // 1. Event-Member suchen
  const { data: member, error: memberErr } = await supabase
    .from('event_members')
    .select('event_id, role')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

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
    coupleName: ev.couple_name ?? '',
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

  // 2. Event-Mitgliedschaft sicherstellen (insert-only, ignoriert Duplikate)
  await supabase.from('event_members').upsert(
    { event_id: eventId, user_id: userId, role: 'brautpaar' },
    { onConflict: 'event_id,user_id', ignoreDuplicates: true }
  )

  // 3. Gäste (delete + insert, CASCADE löscht begleitpersonen/sub_event_guests/seating_assignments)
  await supabase.from('guests').delete().eq('event_id', eventId)
  if (event.guests.length > 0) {
    const guestRows = event.guests.map(g => ({
      id: toUUID(g.id),
      event_id: eventId,
      name: g.name, email: g.email ?? null, token: g.token || crypto.randomUUID(),
      status: g.status,
      phone: g.phone ?? null, address: g.address ?? null,
      trink_alkohol: g.trinkAlkohol ?? null,
      meal_choice: g.meal ?? null,
      allergy_tags: g.allergies ?? [],
      allergy_custom: g.allergyCustom ?? null,
      arrival_date: g.arrivalDate ?? null,
      arrival_time: g.arrivalTime ?? null,
      transport_mode: g.transport ?? null,
      hotel_room_id: g.hotelRoomId ? toUUID(g.hotelRoomId) : null,
      message: g.message ?? null,
      responded_at: g.respondedAt ?? null,
      sub_event_ids: g.subEventIds ?? [],
    }))
    await supabase.from('guests').insert(guestRows)

    // Begleitpersonen
    const begleitRows = event.guests.flatMap(g =>
      g.begleitpersonen.map(b => ({
        id: toUUID(b.id),
        guest_id: toUUID(g.id),
        name: b.name, age_category: b.ageCategory,
        trink_alkohol: b.trinkAlkohol ?? null,
        meal_choice: b.meal ?? null,
        allergy_tags: b.allergies ?? [],
        allergy_custom: b.allergyCustom ?? null,
      }))
    )
    if (begleitRows.length > 0) await supabase.from('begleitpersonen').insert(begleitRows)
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

// ── Neues Event anlegen + User als Mitglied hinzufügen ────────────────────────
export async function createNewEvent(userId: string): Promise<string> {
  const supabase = createBrowserClient()
  const eventId = crypto.randomUUID()

  await supabase.from('events').insert({
    id: eventId,
    onboarding_complete: false,
  })

  await supabase.from('event_members').insert({
    event_id: eventId, user_id: userId, role: 'brautpaar',
  })

  return eventId
}
