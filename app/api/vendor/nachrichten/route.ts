import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get all events where user is vendor
  const { data: memberships } = await admin
    .from('event_members')
    .select('event_id, events(id, title, date, event_code)')
    .eq('user_id', user.id)
    .eq('role', 'dienstleister')
    .order('joined_at', { ascending: false })

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  const eventIds = memberships.map(m => m.event_id)

  // Get conversations where user is a participant, for these events
  const { data: convParticipants } = await admin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user.id)

  if (!convParticipants || convParticipants.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  const convIds = convParticipants.map(p => p.conversation_id)

  // Get conversations with last message, filtered to vendor events
  const { data: convs } = await admin
    .from('conversations')
    .select('id, event_id, title, created_at')
    .in('id', convIds)
    .in('event_id', eventIds)
    .order('created_at', { ascending: false })

  if (!convs || convs.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  // Get last message for each conversation
  const convWithMessages = await Promise.all(
    convs.map(async conv => {
      const { data: lastMsg } = await admin
        .from('messages')
        .select('content, created_at, sender_id, message_type')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const ev = memberships.find(m => m.event_id === conv.event_id)
      const eventData = Array.isArray(ev?.events) ? ev?.events[0] : ev?.events

      return {
        id: conv.id,
        event_id: conv.event_id,
        title: conv.title,
        event_title: eventData?.title ?? null,
        event_date: eventData?.date ?? null,
        event_code: eventData?.event_code ?? null,
        last_message: lastMsg ? {
          content: lastMsg.content,
          created_at: lastMsg.created_at,
          is_own: lastMsg.sender_id === user.id,
          message_type: lastMsg.message_type,
        } : null,
      }
    })
  )

  // Sort by last message time
  convWithMessages.sort((a, b) => {
    const ta = a.last_message?.created_at ?? a.event_date ?? ''
    const tb = b.last_message?.created_at ?? b.event_date ?? ''
    return tb.localeCompare(ta)
  })

  return NextResponse.json({ conversations: convWithMessages })
}
