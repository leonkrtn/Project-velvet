import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ChatsClient from '@/app/veranstalter/[eventId]/chats/ChatsClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function NachrichtenPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [conversationsRes, membersRes] = await Promise.all([
    supabase
      .from('conversations')
      .select(`
        id, name, created_by, created_at, updated_at,
        conversation_participants(user_id, profiles(id, name))
      `)
      .eq('event_id', eventId)
      .order('updated_at', { ascending: false }),
    admin
      .from('event_members')
      .select('id, user_id, role, profiles!user_id(id, name, email)')
      .eq('event_id', eventId),
  ])

  const membersRaw = (membersRes.data ?? []).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
    category: null,
  }))

  const conversations = (conversationsRes.data ?? []).map(conv => ({
    ...conv,
    conversation_participants: (conv.conversation_participants ?? []).map((p: { user_id: string; profiles: { id: string; name: string }[] | { id: string; name: string } | null }) => ({
      ...p,
      profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : p.profiles,
    })),
  }))

  return (
    <div className="bp-page" style={{ padding: 0, maxWidth: '100%' }}>
      <ChatsClient
        eventId={eventId}
        currentUserId={user.id}
        initialConversations={conversations}
        members={membersRaw}
      />
    </div>
  )
}
