'use client'
import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DekoItem, PresenceUser } from '@/lib/deko/types'

interface UseDekoRealtimeOptions {
  canvasId: string
  userId: string
  userName: string
  onItemInserted: (item: DekoItem) => void
  onItemUpdated: (item: DekoItem) => void
  onItemDeleted: (id: string) => void
  onPresenceSync: (users: PresenceUser[]) => void
}

// Stable color from user id
function userColor(userId: string): string {
  const palette = ['#E06C75', '#61AFEF', '#98C379', '#E5C07B', '#C678DD', '#56B6C2', '#D19A66']
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

export function useDekoRealtime(opts: UseDekoRealtimeOptions) {
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const lastCursor = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    const channel = supabase.channel(`deko-canvas-${opts.canvasId}`, {
      config: { presence: { key: opts.userId } },
    })

    // ── Item changes ──────────────────────────────────────────────────────────
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'deko_items',
      filter: `canvas_id=eq.${opts.canvasId}`,
    }, payload => {
      opts.onItemInserted(payload.new as DekoItem)
    })

    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'deko_items',
      filter: `canvas_id=eq.${opts.canvasId}`,
    }, payload => {
      opts.onItemUpdated(payload.new as DekoItem)
    })

    channel.on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'deko_items',
      filter: `canvas_id=eq.${opts.canvasId}`,
    }, payload => {
      opts.onItemDeleted((payload.old as { id: string }).id)
    })

    // ── Presence ──────────────────────────────────────────────────────────────
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const users: PresenceUser[] = Object.values(state).flatMap(arr =>
        (arr as unknown as PresenceUser[]).filter(u => u.user_id)
      )
      opts.onPresenceSync(users)
    })

    channel.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: opts.userId,
          user_name: opts.userName,
          color: userColor(opts.userId),
          cursor_x: 0,
          cursor_y: 0,
        } satisfies PresenceUser)
      }
    })

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.canvasId, opts.userId])

  // Broadcast cursor position (throttled to ~20fps)
  const lastBroadcast = useRef(0)
  const broadcastCursor = useCallback((x: number, y: number, draggingItemId?: string) => {
    const now = Date.now()
    if (now - lastBroadcast.current < 50) return
    lastBroadcast.current = now
    lastCursor.current = { x, y }
    channelRef.current?.track({
      user_id: opts.userId,
      user_name: opts.userName,
      color: userColor(opts.userId),
      cursor_x: x,
      cursor_y: y,
      dragging_item_id: draggingItemId,
    } satisfies PresenceUser)
  }, [opts.userId, opts.userName])

  return { broadcastCursor }
}
