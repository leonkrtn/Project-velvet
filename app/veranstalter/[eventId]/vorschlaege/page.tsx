import { createClient } from '@/lib/supabase/server'
import VorschlaegeClient from './VorschlaegeClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function VorschlaegePage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const [vendorsRes, hotelsRes, dekoRes] = await Promise.all([
    supabase
      .from('organizer_vendor_suggestions')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
    supabase
      .from('organizer_hotel_suggestions')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
    supabase
      .from('deko_suggestions')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
  ])

  return (
    <VorschlaegeClient
      eventId={eventId}
      initialVendors={vendorsRes.data ?? []}
      initialHotels={hotelsRes.data ?? []}
      initialDeko={dekoRes.data ?? []}
    />
  )
}
