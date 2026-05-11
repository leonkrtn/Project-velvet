'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { RaumPoint, RaumElement, RaumTablePool } from '@/components/room/RaumKonfigurator'

const SitzplanEditor = dynamic(() => import('@/components/sitzplan/SitzplanEditor'), { ssr: false })

const EMPTY_POOL: RaumTablePool = { types: [] }

function normalizePool(raw: unknown): RaumTablePool {
  if (!raw || typeof raw !== 'object') return EMPTY_POOL
  const r = raw as Record<string, unknown>
  if (Array.isArray(r.types)) return { types: r.types as RaumTablePool['types'] }
  return EMPTY_POOL
}

export default function BrautpaarSitzplanPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [loading, setLoading]       = useState(true)
  const [coupleName, setCoupleName] = useState('')
  const [roomPoints, setRoomPoints] = useState<RaumPoint[]>([])
  const [roomElements, setRoomElements] = useState<RaumElement[]>([])
  const [tablePool, setTablePool]   = useState<RaumTablePool>(EMPTY_POOL)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [{ data: globalRow }, { data: eventRow }, { data: eventData }] = await Promise.all([
          supabase.from('organizer_room_configs').select('*').eq('user_id', user.id).single(),
          supabase.from('event_room_configs').select('*').eq('event_id', eventId).single(),
          supabase.from('events').select('couple_name').eq('id', eventId).single(),
        ])

        const hasEvent = Boolean(eventRow)
        const pts      = hasEvent ? (eventRow!.points ?? []) : (globalRow?.points ?? [])
        const elms     = hasEvent ? (eventRow!.elements ?? []) : (globalRow?.elements ?? [])
        const pool     = hasEvent ? normalizePool(eventRow!.table_pool) : EMPTY_POOL

        setRoomPoints(pts)
        setRoomElements(elms)
        setTablePool(pool)
        if (eventData) setCoupleName(eventData.couple_name ?? '')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventId]) // eslint-disable-line

  if (loading) return (
    <div className="bp-page">
      <div className="bp-skeleton" style={{ height: 400, borderRadius: 'var(--bp-r-md)' }} />
    </div>
  )

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Sitzplan</h1>
        <p className="bp-page-subtitle">Tischpositionen festlegen und Gäste zuweisen</p>
      </div>
      <SitzplanEditor
        eventId={eventId}
        canEditRoom={false}
        roomPoints={roomPoints}
        roomElements={roomElements}
        tablePool={tablePool}
        coupleName={coupleName}
      />
    </div>
  )
}
