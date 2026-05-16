import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requestDownloadUrl } from '@/lib/files/worker-client'
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

  // Load event + user profile in parallel
  const [eventRes, profileRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, date, event_code')
      .eq('id', eventId)
      .single(),
    supabase
      .from('profiles')
      .select('name, avatar_r2_key')
      .eq('id', user.id)
      .single(),
  ])

  if (!eventRes.data) redirect('/veranstalter')

  const profile = profileRes.data as { name: string | null; avatar_r2_key?: string | null } | null

  // Generate a fresh presigned download URL (1h TTL) from the stored R2 key
  let userAvatarUrl: string | null = null
  if (profile?.avatar_r2_key) {
    try {
      userAvatarUrl = await requestDownloadUrl(profile.avatar_r2_key)
    } catch {
      // Non-fatal — sidebar just shows initials instead
    }
  }

  return (
    <SidebarLayout
      eventId={eventId}
      eventTitle={eventRes.data.title}
      eventDate={eventRes.data.date}
      eventCode={eventRes.data.event_code ?? null}
      userName={profile?.name ?? null}
      userAvatarUrl={userAvatarUrl}
    >
      {children}
    </SidebarLayout>
  )
}
