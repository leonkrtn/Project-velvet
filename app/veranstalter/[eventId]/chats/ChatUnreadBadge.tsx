'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ChatUnreadBadge({ eventId }: { eventId: string }) {
  const [count, setCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
  }, [supabase])

  useEffect(() => {
    if (!userId) return

    // Initial total unread count via DB function
    supabase
      .rpc('get_chat_unread_count', { p_event_id: eventId, p_user_id: userId })
      .then(({ data }) => setCount(data ?? 0))

    // Increment when new messages arrive
    const msgChannel = supabase
      .channel(`sidebar-unread:${eventId}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${eventId}` }, (payload) => {
        const p = payload.new as { sender_id: string | null }
        if (p.sender_id !== userId) setCount(prev => prev + 1)
      })
      .subscribe()

    // Decrement (or recompute) when a conversation is marked read
    const readChannel = supabase
      .channel(`sidebar-read-state:${eventId}:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_read_state' }, () => {
        supabase
          .rpc('get_chat_unread_count', { p_event_id: eventId, p_user_id: userId })
          .then(({ data }) => setCount(data ?? 0))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(readChannel)
    }
  }, [supabase, eventId, userId])

  if (count === 0) return null

  return (
    <span style={{
      background: 'var(--accent)', color: '#fff',
      borderRadius: 10, fontSize: 10, fontWeight: 700,
      padding: '1px 6px', minWidth: 18, textAlign: 'center',
      lineHeight: '16px', marginLeft: 'auto', flexShrink: 0,
    }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
