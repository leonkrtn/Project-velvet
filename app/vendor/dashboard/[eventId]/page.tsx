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

  const [permsRes, eventRes, membersRes] = await Promise.all([
    supabase
      .from('permissions')
      .select('permission')
      .eq('event_id', eventId)
      .eq('user_id', user!.id),
    supabase
      .from('events')
      .select('title, date, couple_name, event_code')
      .eq('id', eventId)
      .single(),
    supabase
      .from('event_members')
      .select('user_id, role, profiles!user_id(name)')
      .eq('event_id', eventId)
      .in('role', ['veranstalter', 'brautpaar']),
  ])

  const permissions = (permsRes.data ?? []).map(p => p.permission)
  const event       = eventRes.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recipients = (membersRes.data ?? []).map((m: any) => ({
    userId: m.user_id as string,
    role: m.role as 'veranstalter' | 'brautpaar',
    label: m.role === 'veranstalter' ? 'Veranstalter' : ((Array.isArray(m.profiles) ? m.profiles[0]?.name : m.profiles?.name) ?? 'Brautpaar'),
  }))

  return (
    <VendorDashboardClient
      eventId={eventId}
      permissions={permissions}
      eventTitle={event?.title ?? 'Event'}
      eventDate={event?.date ?? null}
      eventCode={event?.event_code ?? null}
      initialTab={tab ?? null}
      proposalRecipients={recipients}
    />
  )
}
