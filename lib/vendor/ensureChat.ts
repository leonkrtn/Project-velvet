// Server-only: ensures a conversation exists between a vendor and the
// couple/organizer of an event. Idempotent — returns an existing conversation
// the vendor already participates in, otherwise creates one.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

const COUPLE_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

export async function ensureVendorConversation(
  admin: SupabaseClient,
  eventId: string,
  vendorUserId: string,
): Promise<string | null> {
  // 1. Already a participant in some conversation of this event?
  const { data: parts } = await admin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', vendorUserId)
  const partIds = (parts ?? []).map(p => p.conversation_id)
  if (partIds.length) {
    const { data: existing } = await admin
      .from('conversations')
      .select('id')
      .eq('event_id', eventId)
      .eq('is_archived', false)
      .in('id', partIds)
      .order('created_at', { ascending: true })
      .limit(1)
    if (existing && existing.length) return existing[0].id
  }

  // 2. Gather the couple/organizer members to chat with.
  const { data: members } = await admin
    .from('event_members')
    .select('user_id, role')
    .eq('event_id', eventId)
    .in('role', COUPLE_ROLES)
  const coupleIds = Array.from(new Set((members ?? []).map(m => m.user_id).filter(Boolean)))
  if (coupleIds.length === 0) return null

  // 3. Create the conversation + add all participants.
  const { data: conv, error } = await admin
    .from('conversations')
    .insert({ event_id: eventId, created_by: vendorUserId, name: null })
    .select('id')
    .single()
  if (error || !conv) return null

  const participantIds = Array.from(new Set([vendorUserId, ...coupleIds]))
  await admin.from('conversation_participants').insert(
    participantIds.map(uid => ({ conversation_id: conv.id, user_id: uid })),
  )
  return conv.id
}

// Makes sure every vendor conversation of an event is visible to the whole
// couple/organizer side: adds all couple/organizer members as participants to
// any non-archived conversation that has a dienstleister participant.
// Idempotent — only inserts missing rows. Called lazily on chat/overview load.
export async function backfillVendorChatParticipants(
  admin: SupabaseClient,
  eventId: string,
): Promise<void> {
  const { data: members } = await admin
    .from('event_members')
    .select('user_id, role')
    .eq('event_id', eventId)
  const coupleIds = (members ?? []).filter(m => COUPLE_ROLES.includes(m.role as string)).map(m => m.user_id)
  const vendorIds = new Set((members ?? []).filter(m => m.role === 'dienstleister').map(m => m.user_id))
  if (coupleIds.length === 0 || vendorIds.size === 0) return

  const { data: convs } = await admin
    .from('conversations')
    .select('id, is_staff_chat, conversation_participants(user_id)')
    .eq('event_id', eventId)
    .eq('is_archived', false)

  const toInsert: { conversation_id: string; user_id: string }[] = []
  for (const c of (convs ?? []) as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (c.is_staff_chat) continue
    const partIds: string[] = (c.conversation_participants ?? []).map((p: { user_id: string }) => p.user_id)
    const hasVendor = partIds.some(id => vendorIds.has(id))
    if (!hasVendor) continue
    for (const cid of coupleIds) {
      if (!partIds.includes(cid)) toInsert.push({ conversation_id: c.id, user_id: cid })
    }
  }
  if (toInsert.length) {
    await admin.from('conversation_participants').upsert(toInsert, { onConflict: 'conversation_id,user_id' })
  }
}
