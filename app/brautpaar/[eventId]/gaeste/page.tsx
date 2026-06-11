import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BrautpaarGaeste from './BrautpaarGaeste'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function GaestePage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [guestsRes, eventRes, hotelsRes, rsvpSettingsRes, begleitRes] = await Promise.all([
    supabase
      .from('guests')
      .select('id, name, status, side, meal_choice, allergy_tags, allergy_custom, email, phone, hotel_room_id, notes, token, trink_alkohol, arrival_date, arrival_time, transport_mode, responded_at, message, invited_at, pending_approval')
      .eq('event_id', eventId)
      .order('name'),
    supabase
      .from('events')
      .select('id, meal_options, children_allowed, open_invite_token, open_invite_enabled')
      .eq('id', eventId)
      .single(),
    supabase
      .from('hotels')
      .select('id, name, address, stars, website, notes, hotel_rooms(id, hotel_id, room_type, room_number, max_occupancy, total_rooms, booked_rooms, price_per_night, description)')
      .eq('event_id', eventId)
      .order('name'),
    supabase
      .from('rsvp_settings')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle(),
    // Begleitpersonen aller Gäste dieses Events (Join-Filter über guests)
    supabase
      .from('begleitpersonen')
      .select('id, guest_id, name, age_category, meal_choice, allergy_tags, guests!inner(event_id)')
      .eq('guests.event_id', eventId),
  ])

  return (
    <BrautpaarGaeste
      eventId={eventId}
      userId={user.id}
      initialGuests={guestsRes.data ?? []}
      initialBegleitpersonen={(begleitRes.data ?? []).map(b => ({
        id: b.id,
        guest_id: b.guest_id,
        name: b.name,
        age_category: b.age_category,
        meal_choice: b.meal_choice,
        allergy_tags: b.allergy_tags,
      }))}
      mealOptions={eventRes.data?.meal_options ?? []}
      childrenAllowed={eventRes.data?.children_allowed ?? false}
      hotels={hotelsRes.data ?? []}
      rsvpSettings={rsvpSettingsRes.data ?? null}
      openInviteToken={eventRes.data?.open_invite_token ?? null}
      openInviteEnabled={eventRes.data?.open_invite_enabled ?? false}
    />
  )
}
