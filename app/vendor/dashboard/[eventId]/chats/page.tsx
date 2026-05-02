import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ChatsClient from '@/app/veranstalter/[eventId]/chats/ChatsClient'

interface Props { params: Promise<{ eventId: string }> }

export default async function VendorChatsPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tabPerm } = await supabase
    .from('dienstleister_permissions')
    .select('access')
    .eq('event_id', eventId)
    .eq('dienstleister_user_id', user.id)
    .eq('tab_key', 'chats')
    .is('item_id', null)
    .single()

  const tabAccess = (tabPerm?.access ?? 'none') as 'none' | 'read' | 'write'
  if (tabAccess === 'none') redirect(`/vendor/dashboard/${eventId}/uebersicht`)

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
  }))

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

  const conversations = (conversationsRes.data ?? []).map(conv => ({
    ...conv,
    conversation_participants: (conv.conversation_participants ?? []).map((p: { user_id: string; profiles: { id: string; name: string }[] | { id: string; name: string } | null }) => ({
      ...p,
      profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : p.profiles,
    })),
  }))

  return (
    <ChatsClient
      eventId={eventId}
      currentUserId={user.id}
      initialConversations={conversations}
      members={membersNormalized}
    />
  )
}
