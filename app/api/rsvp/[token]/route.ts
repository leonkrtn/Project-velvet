// app/api/rsvp/[token]/route.ts
// Token-basierte, unauthentifizierte RSVP-API für Gäste.
// GET:  liefert Event-Basisdaten + Gast-Row zur Anzeige und Vorbefüllung.
// POST: speichert die Gast-Antwort, ersetzt die Begleitpersonen nur für diesen Gast
//       und passt hotel_rooms.booked_rooms atomar an (Delta).
// Nutzt den Service-Role-Client, weil RLS auf `guests` kein anon-Insert/Update erlaubt.
// Freeze (events.data_freeze_at) wird serverseitig geprüft und führt zu 409.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type MealChoice = 'fleisch' | 'fisch' | 'vegetarisch' | 'vegan'
type AltersKategorie = 'erwachsen' | '13-17' | '6-12' | '0-6'
type TransportMode = 'auto' | 'bahn' | 'flugzeug' | 'andere'

interface BegleitpersonPayload {
  id?: string
  name: string
  ageCategory: AltersKategorie
  trinkAlkohol?: boolean | null
  meal?: MealChoice | null
  allergies?: string[]
  allergyCustom?: string | null
}

interface RSVPPayload {
  attending: boolean
  trinkAlkohol?: boolean | null
  meal?: MealChoice | null
  allergies?: string[]
  allergyCustom?: string | null
  begleitpersonen?: BegleitpersonPayload[]
  arrivalDate?: string | null
  arrivalTime?: string | null
  transport?: TransportMode | '' | null
  hotelRoomId?: string | null   // 'none' | room uuid | ''
  message?: string | null
}

function toNullIfEmpty(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null
  const t = String(v).trim()
  return t === '' ? null : t
}

// ── GET ──────────────────────────────────────────────────────────────────────
// Liefert minimale Public-Event-Daten + die Gast-Row anhand des Tokens.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })

  const admin = createAdminClient()

  const { data: guest, error: guestErr } = await admin
    .from('guests')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (guestErr) return NextResponse.json({ error: guestErr.message }, { status: 500 })
  if (!guest)   return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })

  const [
    { data: event, error: evErr },
    { data: begleit },
    { data: hotels },
    { data: wishes },
    { data: beitraege },
  ] = await Promise.all([
    admin.from('events')
      .select('id, title, couple_name, date, venue, venue_address, dresscode, children_allowed, children_note, meal_options, max_begleitpersonen, data_freeze_at')
      .eq('id', guest.event_id).maybeSingle(),
    admin.from('begleitpersonen').select('*').eq('guest_id', guest.id),
    admin.from('hotels').select('id, name, address, hotel_rooms(id, room_type, total_rooms, booked_rooms, price_per_night)').eq('event_id', guest.event_id),
    admin.from('geschenk_wuensche')
      .select('id, title, description, price, priority, link, is_money_wish, money_target, status, claimed_by_token, sort_order')
      .eq('event_id', guest.event_id)
      .order('sort_order'),
    admin.from('geschenk_beitraege')
      .select('wish_id, guest_token, amount'),
  ])

  if (evErr || !event) {
    return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })
  }

  const coupleName = (event.couple_name && event.couple_name.trim())
    || (event.title && event.title.trim())
    || ''

  const allBeitraege = beitraege ?? []
  const wishlist = (wishes ?? []).map((w: any) => {
    const wishBeitraege = allBeitraege.filter((b: any) => b.wish_id === w.id)
    const totalContributed = wishBeitraege.reduce((sum: number, b: any) => sum + (b.amount ?? 0), 0)
    const myContrib = allBeitraege.find((b: any) => b.wish_id === w.id && b.guest_token === guest.token)
    return {
      id: w.id,
      title: w.title,
      description: w.description ?? null,
      price: w.price ?? null,
      priority: w.priority ?? 'mittel',
      link: w.link ?? null,
      is_money_wish: w.is_money_wish ?? false,
      money_target: w.money_target ?? null,
      status: w.status ?? 'verfuegbar',
      is_claimed_by_me: w.claimed_by_token === guest.token,
      total_contributed: totalContributed,
      my_contribution: myContrib?.amount ?? 0,
    }
  })

  return NextResponse.json({
    event: {
      id: event.id,
      coupleName,
      date: event.date,
      venue: event.venue,
      venueAddress: event.venue_address,
      dresscode: event.dresscode,
      childrenAllowed: event.children_allowed ?? true,
      childrenNote: event.children_note ?? null,
      mealOptions: event.meal_options ?? ['fleisch','fisch','vegetarisch','vegan'],
      maxBegleitpersonen: event.max_begleitpersonen ?? 2,
      isFrozen: event.data_freeze_at ? new Date(event.data_freeze_at) < new Date() : false,
      hotels: (hotels ?? []).map((h: any) => ({
        id: h.id,
        name: h.name,
        address: h.address,
        rooms: (h.hotel_rooms ?? []).map((r: any) => ({
          id: r.id,
          type: r.room_type,
          totalRooms: r.total_rooms ?? 0,
          bookedRooms: r.booked_rooms ?? 0,
          pricePerNight: r.price_per_night ?? 0,
        })),
      })),
    },
    wishlist,
    guest: {
      id: guest.id,
      name: guest.name,
      email: guest.email ?? null,
      token: guest.token,
      status: guest.status,
      trinkAlkohol: guest.trink_alkohol,
      meal: guest.meal_choice,
      allergies: guest.allergy_tags ?? [],
      allergyCustom: guest.allergy_custom ?? null,
      arrivalDate: guest.arrival_date ?? null,
      arrivalTime: guest.arrival_time ?? null,
      transport: guest.transport_mode ?? null,
      hotelRoomId: guest.hotel_room_id ?? null,
      message: guest.message ?? null,
      respondedAt: guest.responded_at ?? null,
      begleitpersonen: (begleit ?? []).map((b: any) => ({
        id: b.id,
        name: b.name ?? '',
        ageCategory: b.age_category ?? 'erwachsen',
        trinkAlkohol: b.trink_alkohol,
        meal: b.meal_choice,
        allergies: b.allergy_tags ?? [],
        allergyCustom: b.allergy_custom ?? null,
      })),
    },
  })
}


// ── POST ─────────────────────────────────────────────────────────────────────
// Speichert Gast-Antwort. Begleitpersonen werden nur für diesen Gast ersetzt.
// Hotel-Room-Delta wird atomar adjustiert.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })

  let body: RSVPPayload
  try {
    body = await request.json() as RSVPPayload
  } catch {
    return NextResponse.json({ error: 'Ungültiger Payload' }, { status: 400 })
  }

  if (typeof body.attending !== 'boolean') {
    return NextResponse.json({ error: '`attending` erforderlich' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Gast via Token laden
  const { data: guest, error: gErr } = await admin
    .from('guests')
    .select('id, event_id, hotel_room_id')
    .eq('token', token)
    .maybeSingle()

  if (gErr)  return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!guest) return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })

  // 2. Event laden (Freeze + meal_options)
  const { data: ev } = await admin
    .from('events').select('data_freeze_at, meal_options').eq('id', guest.event_id).maybeSingle()
  if (ev?.data_freeze_at && new Date(ev.data_freeze_at) < new Date()) {
    return NextResponse.json({ error: 'Event ist gesperrt' }, { status: 409 })
  }

  // 3a. Menü-Validierung gegen konfigurierte Optionen
  const validMeals: MealChoice[] = (ev?.meal_options as MealChoice[] | null) ?? ['fleisch', 'fisch', 'vegetarisch', 'vegan']
  if (body.attending && body.meal && !validMeals.includes(body.meal)) {
    return NextResponse.json({ error: 'Ungültige Menüwahl' }, { status: 400 })
  }
  if (body.attending && body.begleitpersonen) {
    for (const b of body.begleitpersonen) {
      if (b.meal && !validMeals.includes(b.meal)) {
        return NextResponse.json({ error: 'Ungültige Menüwahl für Begleitperson' }, { status: 400 })
      }
    }
  }

  const attending = body.attending

  // 3. Neue Hotel-Room-Zuordnung bestimmen
  const prevRoom = guest.hotel_room_id as string | null
  let nextRoom: string | null = null
  if (attending && body.hotelRoomId && body.hotelRoomId !== 'none' && body.hotelRoomId !== '') {
    nextRoom = body.hotelRoomId
  }

  // 4. Guest-Update-Payload
  const updatePayload: Record<string, any> = {
    status: attending ? 'zugesagt' : 'abgesagt',
    trink_alkohol: attending ? (body.trinkAlkohol ?? null) : null,
    meal_choice:   attending ? (body.meal ?? null) : null,
    allergy_tags:  attending ? (body.allergies ?? []) : [],
    allergy_custom: attending ? toNullIfEmpty(body.allergyCustom) : null,
    arrival_date:  attending ? toNullIfEmpty(body.arrivalDate) : null,
    arrival_time:  attending ? toNullIfEmpty(body.arrivalTime) : null,
    transport_mode: attending ? (toNullIfEmpty(body.transport as string | null)) : null,
    hotel_room_id: nextRoom,
    message: toNullIfEmpty(body.message),
    responded_at: new Date().toISOString(),
  }

  const { data: updatedGuest, error: updErr } = await admin
    .from('guests')
    .update(updatePayload)
    .eq('id', guest.id)
    .select('*')
    .single()

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // 5. Begleitpersonen ersetzen (nur für diesen Gast)
  await admin.from('begleitpersonen').delete().eq('guest_id', guest.id)

  if (attending && body.begleitpersonen && body.begleitpersonen.length > 0) {
    const rows = body.begleitpersonen.map(b => ({
      guest_id: guest.id,
      name: b.name ?? '',
      age_category: b.ageCategory ?? 'erwachsen',
      trink_alkohol: b.ageCategory === 'erwachsen' ? (b.trinkAlkohol ?? null) : null,
      meal_choice:   b.meal ?? null,
      allergy_tags:  b.allergies ?? [],
      allergy_custom: toNullIfEmpty(b.allergyCustom),
    }))
    const { error: bErr } = await admin.from('begleitpersonen').insert(rows)
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
  }

  // 6. Hotel-Room-Delta atomar anpassen (RPC serialisiert via FOR UPDATE-Lock)
  if (prevRoom !== nextRoom) {
    const { data: bookingResult, error: bookingErr } = await admin.rpc('adjust_hotel_booking', {
      p_prev_room: prevRoom ?? null,
      p_next_room: nextRoom ?? null,
    })
    if (bookingErr) return NextResponse.json({ error: bookingErr.message }, { status: 500 })
    if (bookingResult?.error) {
      const status = bookingResult.error === 'Zimmer nicht gefunden' ? 404 : 409
      return NextResponse.json({ error: bookingResult.error }, { status })
    }
  }

  // 7. Rückgabe (rehydriert den Client)
  const { data: begleit } = await admin
    .from('begleitpersonen').select('*').eq('guest_id', guest.id)

  return NextResponse.json({
    guest: {
      id: updatedGuest.id,
      name: updatedGuest.name,
      email: updatedGuest.email ?? null,
      token: updatedGuest.token,
      status: updatedGuest.status,
      trinkAlkohol: updatedGuest.trink_alkohol,
      meal: updatedGuest.meal_choice,
      allergies: updatedGuest.allergy_tags ?? [],
      allergyCustom: updatedGuest.allergy_custom ?? null,
      arrivalDate: updatedGuest.arrival_date ?? null,
      arrivalTime: updatedGuest.arrival_time ?? null,
      transport: updatedGuest.transport_mode ?? null,
      hotelRoomId: updatedGuest.hotel_room_id ?? null,
      message: updatedGuest.message ?? null,
      respondedAt: updatedGuest.responded_at ?? null,
      begleitpersonen: (begleit ?? []).map((b: any) => ({
        id: b.id,
        name: b.name ?? '',
        ageCategory: b.age_category ?? 'erwachsen',
        trinkAlkohol: b.trink_alkohol,
        meal: b.meal_choice,
        allergies: b.allergy_tags ?? [],
        allergyCustom: b.allergy_custom ?? null,
      })),
    },
  })
}
