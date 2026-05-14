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

    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .neq('sender_id', userId)
      .is('read_at', null)
      .then(({ count: c }) => setCount(c ?? 0))

    const channel = supabase
      .channel(`sidebar-unread:${eventId}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${eventId}` }, (payload) => {
        const p = payload.new as { sender_id: string | null }
        if (p.sender_id !== userId) setCount(prev => prev + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `event_id=eq.${eventId}` }, (payload) => {
        const p = payload.new as { read_at: string | null; sender_id: string | null }
        const old = payload.old as { read_at: string | null }
        if (!old.read_at && p.read_at && p.sender_id !== userId) setCount(prev => Math.max(0, prev - 1))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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
