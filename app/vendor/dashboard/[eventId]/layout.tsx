import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VendorSidebarLayout from './VendorSidebarLayout'

interface Props {
  children: React.ReactNode
  params:   Promise<{ eventId: string }>
}

export default async function VendorDashboardLayout({ children, params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/vendor/dashboard/${eventId}`)

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'dienstleister') redirect('/vendor/join')

  const [eventRes, permsRes] = await Promise.all([
    supabase
      .from('events')
      .select('title, date')
      .eq('id', eventId)
      .single(),
    supabase
      .from('dienstleister_permissions')
      .select('tab_key, access')
      .eq('event_id', eventId)
      .eq('dienstleister_user_id', user.id)
      .is('item_id', null),
  ])

  if (!eventRes.data) redirect('/vendor/dashboard')

  const tabPerms: Record<string, 'none' | 'read' | 'write'> = {}
  for (const row of permsRes.data ?? []) {
    tabPerms[row.tab_key] = row.access as 'none' | 'read' | 'write'
  }

  return (
    <VendorSidebarLayout
      eventId={eventId}
      eventTitle={eventRes.data.title}
      eventDate={eventRes.data.date ?? null}
      initialTabPerms={tabPerms}
    >
      {children}
    </VendorSidebarLayout>
  )
}
