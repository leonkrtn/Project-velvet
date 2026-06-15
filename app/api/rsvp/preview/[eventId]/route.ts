import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeSettings, DEFAULT_DISPLAY_SETTINGS } from '@/lib/display-settings'

const ADMIN_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

// GET — RSVP-Vorschau für Event-Admins. Liefert dieselbe Struktur wie die
// echte RSVP-API, aber mit einem Beispiel-Gast und ohne Persistenz.
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).maybeSingle()
  if (!member || !ADMIN_ROLES.includes(member.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const [
    { data: event },
    { data: hotels },
    { data: rsvpSettings },
    { data: cateringPlan },
    { data: featureRows },
    { data: displayRow },
  ] = await Promise.all([
    admin.from('events')
      .select('id, title, couple_name, date, venue, venue_address, dresscode, children_allowed, children_note, meal_options, max_begleitpersonen')
      .eq('id', eventId).maybeSingle(),
    admin.from('hotels').select('id, name, address, hotel_rooms(id, room_type, total_rooms, booked_rooms, price_per_night)').eq('event_id', eventId),
    admin.from('rsvp_settings').select('invitation_text, rsvp_deadline, show_meal_choice, show_plus_one, phone_contact').eq('event_id', eventId).maybeSingle(),
    admin.from('catering_plans').select('menu_courses').eq('event_id', eventId).maybeSingle(),
    admin.from('feature_toggles').select('key, enabled').eq('event_id', eventId)
      .in('key', ['rsvp-musikwunsch', 'rsvp-geschenke', 'rsvp-hotel', 'rsvp-begleitpersonen', 'rsvp-menu']),
    admin.from('event_display_settings').select('settings').eq('event_id', eventId).maybeSingle(),
  ])

  if (!event) return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })

  const tg = Object.fromEntries((featureRows ?? []).map((r: { key: string; enabled: boolean }) => [r.key, r.enabled]))

  return NextResponse.json({
    preview: true,
    display: displayRow?.settings ? normalizeSettings(displayRow.settings) : DEFAULT_DISPLAY_SETTINGS,
    event: {
      id: event.id,
      coupleName: event.couple_name ?? event.title ?? '',
      date: event.date,
      venue: event.venue,
      venueAddress: event.venue_address,
      dresscode: event.dresscode,
      childrenAllowed: event.children_allowed ?? true,
      childrenNote: event.children_note ?? null,
      mealOptions: event.meal_options ?? ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
      maxBegleitpersonen: event.max_begleitpersonen ?? 2,
      isFrozen: false,
      isDeadlinePassed: false,
      hotels: (hotels ?? []).map((h: any) => ({
        id: h.id, name: h.name, address: h.address,
        rooms: (h.hotel_rooms ?? []).map((r: any) => ({
          id: r.id, type: r.room_type, totalRooms: r.total_rooms ?? 0, bookedRooms: r.booked_rooms ?? 0, pricePerNight: r.price_per_night ?? 0,
        })),
      })),
      showMealChoice: rsvpSettings?.show_meal_choice ?? true,
      showPlusOne: rsvpSettings?.show_plus_one ?? true,
      rsvpDeadline: rsvpSettings?.rsvp_deadline ?? null,
      invitationText: rsvpSettings?.invitation_text ?? '',
      phoneContact: rsvpSettings?.phone_contact ?? null,
      menuCourses: (cateringPlan as any)?.menu_courses ?? null,
      rsvpShowMusikwunsch:     tg['rsvp-musikwunsch']     ?? true,
      rsvpShowGeschenke:       tg['rsvp-geschenke']       ?? true,
      rsvpShowHotel:           tg['rsvp-hotel']           ?? true,
      rsvpShowBegleitpersonen: tg['rsvp-begleitpersonen'] ?? true,
      rsvpShowMenu:            tg['rsvp-menu']            ?? true,
    },
    wishlist: [],
    guest: {
      id: 'preview', name: 'Beispiel Gast', email: null, token: '_preview',
      status: 'eingeladen', trinkAlkohol: undefined, meal: undefined,
      allergies: [], allergyCustom: null, arrivalDate: null, arrivalTime: null,
      transport: null, hotelRoomId: null, message: null, respondedAt: null,
      begleitpersonen: [],
    },
  })
}
