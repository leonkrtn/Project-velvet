'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { Monitor, LayoutGrid } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RaumPoint, RaumElement, RaumTablePool, PlacedTablePreview, ConceptPlacedTable } from '@/components/room/RaumKonfigurator'

const SitzplanEditor   = dynamicImport(() => import('@/components/sitzplan/SitzplanEditor'), { ssr: false })
const RaumKonfigurator = dynamicImport(() => import('@/components/room/RaumKonfigurator'), { ssr: false })

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

  // Solo-Brautpaar: darf die Raumkonfiguration selbst bearbeiten
  // (RLS via Migration 0090: event_room_configs über is_event_member)
  const [isSolo, setIsSolo]   = useState(false)
  const [userId, setUserId]   = useState<string | null>(null)
  const [showConfigurator, setShowConfigurator] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved,  setConfigSaved]  = useState(false)
  const [placedTables, setPlacedTables] = useState<PlacedTablePreview[]>([])

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
        setUserId(user.id)

        const [{ data: globalRow }, { data: eventRow }, { data: eventData }, { data: memberRow }, { data: tablesData }] = await Promise.all([
          supabase.from('organizer_room_configs').select('*').eq('user_id', user.id).single(),
          supabase.from('event_room_configs').select('*').eq('event_id', eventId).single(),
          supabase.from('events').select('couple_name').eq('id', eventId).single(),
          supabase.from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).maybeSingle(),
          supabase.from('seating_tables').select('pos_x,pos_y,rotation,shape,table_length,table_width,name').eq('event_id', eventId),
        ])

        const hasEvent = Boolean(eventRow)
        const pts      = hasEvent ? (eventRow!.points ?? []) : (globalRow?.points ?? [])
        const elms     = hasEvent ? (eventRow!.elements ?? []) : (globalRow?.elements ?? [])
        const pool     = hasEvent ? normalizePool(eventRow!.table_pool) : EMPTY_POOL

        setRoomPoints(pts)
        setRoomElements(elms)
        setTablePool(pool)
        if (eventData) setCoupleName(eventData.couple_name ?? '')
        setIsSolo(memberRow?.role === 'brautpaar_solo')
        if (tablesData) setPlacedTables(tablesData as PlacedTablePreview[])

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

  const handleSaveRoomConfig = useCallback(async (
    points: RaumPoint[], elements: RaumElement[], pool: RaumTablePool, _placed: ConceptPlacedTable[]
  ) => {
    if (!userId) return
    setConfigSaving(true)
    try {
      await supabase.from('event_room_configs').upsert(
        { event_id: eventId, user_id: userId, points, elements, table_pool: pool, updated_at: new Date().toISOString() },
        { onConflict: 'event_id' }
      )
      setRoomPoints(points)
      setRoomElements(elements)
      setTablePool(pool)
      setConfigSaved(true); setTimeout(() => setConfigSaved(false), 3000)
      setShowConfigurator(false)
    } finally {
      setConfigSaving(false)
    }
  }, [userId, eventId, supabase])

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
      <div className="bp-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="bp-page-title">Sitzplan</h1>
          <p className="bp-page-subtitle">Tischpositionen festlegen und Gäste zuweisen</p>
        </div>
        {isSolo && !isMobile && (
          <button
            type="button"
            className="bp-btn"
            onClick={() => setShowConfigurator(v => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <LayoutGrid size={14} />
            {showConfigurator ? 'Zum Sitzplan' : 'Raum konfigurieren'}
          </button>
        )}
      </div>
      {isMobile ? (
        <MobileSitzplanView data={sitzplanData} />
      ) : isSolo && showConfigurator ? (
        <div className="bp-card" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>Raumkonfiguration</p>
            <p style={{ fontSize: 12, margin: 0, opacity: 0.65 }}>
              Legt den Grundriss eurer Location, Raumelemente und euren Tischpool fest — danach könnt ihr im Sitzplan Tische platzieren und Gäste zuweisen.
            </p>
          </div>
          <RaumKonfigurator
            initialPoints={roomPoints}
            initialElements={roomElements}
            initialTablePool={tablePool}
            placedTables={placedTables}
            onSave={handleSaveRoomConfig}
            saving={configSaving}
            saved={configSaved}
          />
        </div>
      ) : (
        <>
          {isSolo && roomPoints.length === 0 && (
            <div style={{
              background: 'var(--bp-gold-pale, #faf5ea)', border: '1px solid var(--bp-rule-gold, #e5d5b5)',
              borderRadius: 'var(--bp-r-md, 12px)', padding: '0.875rem 1rem', marginBottom: '1.5rem',
              display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
            }}>
              <LayoutGrid size={16} style={{ color: 'var(--bp-gold-deep, #8a6d3b)', flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--bp-gold-deep, #8a6d3b)', lineHeight: 1.5 }}>
                Noch kein Raum eingerichtet. Klickt oben auf „Raum konfigurieren", um Grundriss und Tischpool anzulegen.
              </p>
            </div>
          )}
          <SitzplanEditor
            eventId={eventId}
            canEditRoom={isSolo}
            roomPoints={roomPoints}
            roomElements={roomElements}
            tablePool={tablePool}
            coupleName={coupleName}
          />
        </>
      )}
    </div>
  )
}
