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

  const [guestsRes, eventRes, hotelsRes, inviteCodesRes, rsvpSettingsRes] = await Promise.all([
    supabase
      .from('guests')
      .select('id, name, attending, side, meal_choice, allergy_tags, allergy_custom, email, phone, hotel_room_id, plus_one_allowed, notes, invite_code_id')
      .eq('event_id', eventId)
      .order('name'),
    supabase
      .from('events')
      .select('id, meal_options, max_begleitpersonen, children_allowed, dresscode')
      .eq('id', eventId)
      .single(),
    supabase
      .from('hotels')
      .select('id, name, hotel_rooms(id, room_type, room_number, max_occupancy)')
      .eq('event_id', eventId)
      .order('name'),
    supabase
      .from('invite_codes')
      .select('id, code, role, expires_at, max_uses, use_count, created_at')
      .eq('event_id', eventId)
      .eq('role', 'guest')
      .order('created_at', { ascending: false }),
    supabase
      .from('rsvp_settings')
      .select('*')
      .eq('event_id', eventId)
      .single(),
  ])

  return (
    <BrautpaarGaeste
      eventId={eventId}
      userId={user.id}
      initialGuests={guestsRes.data ?? []}
      mealOptions={eventRes.data?.meal_options ?? []}
      childrenAllowed={eventRes.data?.children_allowed ?? false}
      hotels={hotelsRes.data ?? []}
      inviteCodes={inviteCodesRes.data ?? []}
      rsvpSettings={rsvpSettingsRes.data ?? null}
    />
  )
}
