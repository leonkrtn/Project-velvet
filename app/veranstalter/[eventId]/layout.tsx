import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SidebarLayout from './SidebarLayout'

interface Props {
  children: React.ReactNode
  params: Promise<{ eventId: string }>
}

export default async function EventLayout({ children, params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify membership + role
  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'veranstalter') redirect('/veranstalter')

  // Load event name for sidebar header
  const { data: event } = await supabase
    .from('events')
    .select('id, title, date')
    .eq('id', eventId)
    .single()

  if (!event) redirect('/veranstalter')

  return (
    <SidebarLayout eventId={eventId} eventTitle={event.title} eventDate={event.date}>
      {children}
    </SidebarLayout>
  )
}
