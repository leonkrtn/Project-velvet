'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { Monitor } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RaumPoint, RaumElement, RaumTablePool } from '@/components/room/RaumKonfigurator'

const SitzplanEditor = dynamicImport(() => import('@/components/sitzplan/SitzplanEditor'), { ssr: false })

const EMPTY_POOL: RaumTablePool = { types: [] }

function normalizePool(raw: unknown): RaumTablePool {
  if (!raw || typeof raw !== 'object') return EMPTY_POOL
  const r = raw as Record<string, unknown>
  if (Array.isArray(r.types)) return { types: r.types as RaumTablePool['types'] }
  return EMPTY_POOL
}

// ── Mobile view interfaces ────────────────────────────────────────────────────

interface SitzTable {
  id: string
  name: string
  capacity: number
}
interface SitzAssignment {
  id: string
  table_id: string
  guest_id: string | null
  begleitperson_id: string | null
}
interface SitzGuest {
  id: string
  name: string
  is_begleit?: boolean
  guest_name?: string  // parent guest name, only for Begleitpersonen
}

// ── MobileSitzplanView ────────────────────────────────────────────────────────

function MobileSitzplanView({ data }: { data: { tables: SitzTable[], assignments: SitzAssignment[], guests: SitzGuest[] } | null }) {
  return (
    <div>
      <div style={{
        background: 'var(--bp-gold-pale)', border: '1px solid var(--bp-rule-gold)',
        borderRadius: 'var(--bp-r-md)', padding: '0.875rem 1rem', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
      }}>
        <Monitor size={16} style={{ color: 'var(--bp-gold-deep)', flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--bp-gold-deep)', lineHeight: 1.5 }}>
          Der interaktive Sitzplan ist nur auf größeren Bildschirmen verfügbar. Hier siehst du eine Übersicht der Tischbelegung.
        </p>
      </div>
      {!data ? (
        <p className="bp-caption">Wird geladen…</p>
      ) : data.tables.length === 0 ? (
        <div className="bp-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="bp-caption">Noch keine Tische angelegt.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {data.tables.map(table => {
            const assigned = data.assignments
              .filter(a => a.table_id === table.id)
              .map(a => {
                if (a.guest_id) return data.guests.find(g => g.id === a.guest_id && !g.is_begleit)
                if (a.begleitperson_id) return data.guests.find(g => g.id === a.begleitperson_id && g.is_begleit)
                return undefined
              })
              .filter(Boolean) as SitzGuest[]
            return (
              <div key={table.id} className="bp-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: assigned.length > 0 ? '0.75rem' : 0 }}>
                  <span style={{ fontWeight: 600, color: 'var(--bp-ink)', fontSize: '0.9375rem' }}>{table.name}</span>
                  <span className="bp-badge bp-badge-neutral">{assigned.length} / {table.capacity}</span>
                </div>
                {assigned.length === 0 ? (
                  <p className="bp-caption" style={{ fontStyle: 'italic', margin: 0 }}>Noch keine Gäste zugewiesen</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {assigned.map(g => (
                      <div key={g.id} style={{ fontSize: '0.875rem', color: 'var(--bp-ink-2)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span>{g.name}</span>
                        {g.is_begleit && g.guest_name && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)' }}>(Begl. {g.guest_name})</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrautpaarSitzplanPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [loading, setLoading]       = useState(true)
  const [coupleName, setCoupleName] = useState('')
  const [roomPoints, setRoomPoints] = useState<RaumPoint[]>([])
  const [roomElements, setRoomElements] = useState<RaumElement[]>([])
  const [tablePool, setTablePool]   = useState<RaumTablePool>(EMPTY_POOL)

  const [isMobile, setIsMobile]         = useState(false)
  const [sitzplanData, setSitzplanData] = useState<{ tables: SitzTable[], assignments: SitzAssignment[], guests: SitzGuest[] } | null>(null)

  // Resize listener
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 900)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

        // Mobile-only: load seating data
        if (isMobile) {
          const [{ data: tables }, { data: assignments }, { data: guests }] = await Promise.all([
            supabase.from('seating_tables').select('id, name, capacity').eq('event_id', eventId).order('created_at'),
            supabase.from('seating_assignments').select('id, table_id, guest_id, begleitperson_id').eq('event_id', eventId),
            supabase.from('guests').select('id, name').eq('event_id', eventId),
          ])
          // Begleitpersonen die assigned sind
          const begleitIds = (assignments ?? []).map(a => a.begleitperson_id).filter(Boolean) as string[]
          let begleitpersonen: { id: string; name: string | null; guest_id: string }[] = []
          if (begleitIds.length > 0) {
            const { data: bData } = await supabase.from('begleitpersonen').select('id, name, guest_id').in('id', begleitIds)
            begleitpersonen = bData ?? []
          }
          // Merge into SitzGuest[]
          const allGuests: SitzGuest[] = [
            ...(guests ?? []).map(g => ({ id: g.id, name: g.name })),
            ...begleitpersonen.map(b => ({
              id: b.id,
              name: b.name ?? '–',
              is_begleit: true,
              guest_name: (guests ?? []).find(g => g.id === b.guest_id)?.name,
            })),
          ]
          setSitzplanData({ tables: tables ?? [], assignments: assignments ?? [], guests: allGuests })
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventId, isMobile]) // eslint-disable-line

  if (loading) return (
    <div className="bp-page">
      {/* Page header: title + subtitle */}
      <div className="bp-page-header">
        <div className="bp-skeleton" style={{ height: 28, width: 120, marginBottom: 8, borderRadius: 8 }} />
        <div className="bp-skeleton" style={{ height: 16, width: 300, borderRadius: 6 }} />
      </div>
      {/* Canvas area */}
      <div className="bp-skeleton" style={{ height: 'calc(100vh - 260px)', minHeight: 400, borderRadius: 'var(--bp-r-md)' }} />
    </div>
  )

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Sitzplan</h1>
        <p className="bp-page-subtitle">Tischpositionen festlegen und Gäste zuweisen</p>
      </div>
      {isMobile ? (
        <MobileSitzplanView data={sitzplanData} />
      ) : (
        <SitzplanEditor
          eventId={eventId}
          canEditRoom={false}
          roomPoints={roomPoints}
          roomElements={roomElements}
          tablePool={tablePool}
          coupleName={coupleName}
        />
      )}
    </div>
  )
}
