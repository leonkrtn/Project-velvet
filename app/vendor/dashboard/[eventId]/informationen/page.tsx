import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InformationenClient from './InformationenClient'

interface Props { params: Promise<{ eventId: string }> }

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function VendorInformationenPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/vendor/dashboard/${eventId}/informationen`)

  const [eventRes, guestRes, membersRes] = await Promise.all([
    supabase.from('events').select('title, date, couple_name, venue, venue_address, event_type').eq('id', eventId).single(),
    supabase.from('v_event_guest_counts').select('confirmed_guests, pending_guests, confirmed_plus_ones').eq('event_id', eventId).maybeSingle(),
    supabase.from('event_members').select('role, profiles!user_id(name, email, phone)').eq('event_id', eventId).in('role', ['veranstalter', 'brautpaar', 'brautpaar_solo']),
  ])

  const event = eventRes.data
  const guests = guestRes.data
  const members = membersRes.data ?? []

  const flat = (role: string) => members
    .filter((m: any) => m.role === role || (role === 'brautpaar' && m.role === 'brautpaar_solo'))
    .map((m: any) => (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles))
    .filter(Boolean)

  return (
    <InformationenClient
      eventId={eventId}
      event={{
        title: event?.title ?? 'Veranstaltung',
        date: event?.date ?? null,
        couple_name: event?.couple_name ?? null,
        venue: event?.venue ?? null,
        venue_address: event?.venue_address ?? null,
        event_type: event?.event_type ?? null,
      }}
      confirmed={(guests?.confirmed_guests ?? 0) + (guests?.confirmed_plus_ones ?? 0)}
      pending={guests?.pending_guests ?? 0}
      veranstalter={flat('veranstalter')}
      brautpaar={flat('brautpaar')}
    />
  )
}
