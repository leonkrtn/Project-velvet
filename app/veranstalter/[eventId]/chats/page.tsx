import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ChatsClient from './ChatsClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function ChatsPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [conversationsRes, membersRes] = await Promise.all([
    supabase
      .from('conversations')
      .select(`
        id, name, created_by, created_at, updated_at, is_staff_chat,
        conversation_participants(user_id, profiles(id, name))
      `)
      .eq('event_id', eventId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false }),
    admin
      .from('event_members')
      .select('id, user_id, role, profiles!user_id(id, name, email)')
      .eq('event_id', eventId),
  ])

  const membersRaw = (membersRes.data ?? []).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))

  // Fetch invitation categories for dienstleister members
  const dlUserIds = membersRaw
    .filter(m => m.role === 'dienstleister')
    .map(m => m.user_id)
    .filter(Boolean) as string[]

  const categoryByUserId: Record<string, string> = {}
  if (dlUserIds.length > 0) {
    const { data: invitations } = await admin
      .from('event_invitations')
      .select('accepted_by, metadata')
      .eq('event_id', eventId)
      .eq('status', 'accepted')
      .in('accepted_by', dlUserIds)

    for (const inv of (invitations ?? [])) {
      if (inv.accepted_by) {
        const meta = inv.metadata as Record<string, string> | null
        if (meta?.category) categoryByUserId[inv.accepted_by] = meta.category
      }
    }
  }

  const membersNormalized = membersRaw.map(m => ({
    ...m,
    category: m.role === 'dienstleister' && m.user_id
      ? (categoryByUserId[m.user_id] ?? null)
      : null,
  }))

  // Normalize conversation_participants nested profiles
  const conversationsRaw = (conversationsRes.data ?? []).map(conv => ({
    ...conv,
    conversation_participants: (conv.conversation_participants ?? []).map((p: { user_id: string; profiles: { id: string; name: string }[] | { id: string; name: string } | null }) => ({
      ...p,
      profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : p.profiles,
    })),
  }))

  // Hide staff chats that have no messages yet — they're created lazily and
  // only become useful once communication starts.
  const staffChatIds = conversationsRaw
    .filter(c => c.is_staff_chat)
    .map(c => c.id)

  let staffChatsWithMessages = new Set<string>()
  if (staffChatIds.length > 0) {
    const { data: msgRows } = await admin
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', staffChatIds)
    staffChatsWithMessages = new Set(msgRows?.map(m => m.conversation_id) ?? [])
  }

  const conversations = conversationsRaw.filter(c =>
    !c.is_staff_chat || staffChatsWithMessages.has(c.id)
  )

  return (
    <ChatsClient
      eventId={eventId}
      currentUserId={user?.id ?? ''}
      initialConversations={conversations}
      members={membersNormalized}
    />
  )
}
