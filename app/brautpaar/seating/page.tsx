'use client'
import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useEvent } from '@/lib/event-context'
import type { RaumPoint, RaumElement, RaumTablePool } from '@/components/room/RaumKonfigurator'

function normalizePool(raw: unknown): RaumTablePool {
  if (!raw || typeof raw !== 'object') return { types: [] }
  const r = raw as Record<string, unknown>
  if (Array.isArray(r.types)) return { types: r.types as RaumTablePool['types'] }
  const types: RaumTablePool['types'] = []
  const round = r.round as Record<string, number> | undefined
  const rect  = r.rect  as Record<string, number> | undefined
  if (round?.count) types.push({ id: 'legacy-round', shape: 'round',        count: round.count, diameter: round.diameter ?? 1.5, length: round.diameter ?? 1.5, width: round.diameter ?? 1.5 })
  if (rect?.count)  types.push({ id: 'legacy-rect',  shape: 'rectangular', count: rect.count,  diameter: 1.5, length: rect.length ?? 2.0, width: rect.width ?? 0.8 })
  return { types }
}

const SitzplanEditor = dynamic(() => import('@/components/sitzplan/SitzplanEditor'), { ssr: false })

export default function BrautpaarSeatingPage() {
  const { event } = useEvent()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [roomPoints,   setRoomPoints]   = useState<RaumPoint[]>([])
  const [roomElements, setRoomElements] = useState<RaumElement[]>([])
  const [tablePool,    setTablePool]    = useState<RaumTablePool>({ types: [] })

  useEffect(() => {
    if (!event?.id) return
    load(event.id)
  }, [event?.id]) // eslint-disable-line

  async function load(eventId: string) {
    setLoading(true)
    try {
      // Fetch the event's organizer to load their room config
      const { data: eventRow } = await supabase.from('events').select('created_by, couple_name').eq('id', eventId).single()
      const organizerUserId = eventRow?.created_by

      const [{ data: globalRow }, { data: evConfigRow }] = await Promise.all([
        organizerUserId
          ? supabase.from('organizer_room_configs').select('points, elements').eq('user_id', organizerUserId).single()
          : Promise.resolve({ data: null }),
        supabase.from('event_room_configs').select('points, elements, table_pool').eq('event_id', eventId).single(),
      ])

      const points: RaumPoint[]   = evConfigRow?.points   ?? globalRow?.points   ?? []
      const elems:  RaumElement[] = evConfigRow?.elements ?? globalRow?.elements ?? []
      const pool:   RaumTablePool = normalizePool(evConfigRow?.table_pool)

      setRoomPoints(points)
      setRoomElements(elems)
      setTablePool(pool)
    } finally {
      setLoading(false)
    }
  }

  if (!event?.id) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
      Kein Event geladen.
    </div>
  )

  if (loading) return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ height: 400, borderRadius: 'var(--radius)', background: 'var(--surface)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 4 }}>Sitzplan</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Tische platzieren und Gäste zuordnen.</p>
      </div>
      <SitzplanEditor
        eventId={event.id}
        canEditRoom={false}
        roomPoints={roomPoints}
        roomElements={roomElements}
        tablePool={tablePool}
        coupleName={event.coupleName}
      />
    </div>
  )
}
