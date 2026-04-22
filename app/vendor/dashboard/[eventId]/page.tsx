import { createClient } from '@/lib/supabase/server'
import VendorDashboardClient from './VendorDashboardClient'

interface Props {
  params:      Promise<{ eventId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function VendorDashboardPage({ params, searchParams }: Props) {
  const { eventId } = await params
  const { tab }     = await searchParams
  const supabase    = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Berechtigungen laden
  const { data: perms } = await supabase
    .from('permissions')
    .select('permission')
    .eq('event_id', eventId)
    .eq('user_id', user!.id)

  const permissions = (perms ?? []).map(p => p.permission)

  // Event-Basisdaten
  const { data: event } = await supabase
    .from('events')
    .select('title, date, couple_name, event_code')
    .eq('id', eventId)
    .single()

  return (
    <VendorDashboardClient
      eventId={eventId}
      permissions={permissions}
      eventTitle={event?.title ?? 'Event'}
      eventDate={event?.date ?? null}
      eventCode={event?.event_code ?? null}
      initialTab={tab ?? null}
    />
  )
}
