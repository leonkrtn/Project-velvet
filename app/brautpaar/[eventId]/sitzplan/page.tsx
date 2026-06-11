'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { Monitor, LayoutGrid, Armchair } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RaumPoint, RaumElement, RaumTablePool, PlacedTablePreview, ConceptPlacedTable } from '@/components/room/RaumKonfigurator'

const SitzplanEditor   = dynamicImport(() => import('@/components/sitzplan/SitzplanEditor'), { ssr: false })
const RaumKonfigurator = dynamicImport(() => import('@/components/room/RaumKonfigurator'), { ssr: false })

const EMPTY_POOL: RaumTablePool = { types: [] }

// Synthetische Standard-Fläche (16 × 12 m) für den einfachen Modus ohne
// konkreten Raumplan — dient nur als Begrenzung/Skalierung im Editor.
const SIMPLE_AREA: RaumPoint[] = [
  { x: -8, y: -6 }, { x: 8, y: -6 }, { x: 8, y: 6 }, { x: -8, y: 6 },
]

// feature_toggles-Key für den einfachen Sitzplan-Modus
const SIMPLE_TOGGLE_KEY = 'sitzplan-simple'

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
  // Einfacher Modus ohne Raumplan (persistiert in feature_toggles)
  const [simpleMode, setSimpleMode] = useState(false)
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

        const [{ data: globalRow }, { data: eventRow }, { data: eventData }, { data: memberRow }, { data: tablesData }, { data: toggleRow }] = await Promise.all([
          supabase.from('organizer_room_configs').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('event_room_configs').select('*').eq('event_id', eventId).maybeSingle(),
          supabase.from('events').select('couple_name').eq('id', eventId).single(),
          supabase.from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).maybeSingle(),
          supabase.from('seating_tables').select('pos_x,pos_y,rotation,shape,table_length,table_width,name').eq('event_id', eventId),
          supabase.from('feature_toggles').select('enabled').eq('event_id', eventId).eq('key', SIMPLE_TOGGLE_KEY).maybeSingle(),
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
        setSimpleMode(toggleRow?.enabled === true)
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

  const saveSimpleToggle = useCallback(async (enabled: boolean) => {
    setSimpleMode(enabled)
    await supabase.from('feature_toggles').upsert(
      { event_id: eventId, key: SIMPLE_TOGGLE_KEY, enabled },
      { onConflict: 'event_id,key' }
    )
  }, [eventId, supabase])

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
      // Echter Raumplan gespeichert → einfacher Modus endet; Tische und
      // Zuordnungen bleiben erhalten (seating_tables sind davon unabhängig).
      // Tische, die außerhalb des neuen Grundriss-Ausschnitts liegen (z.B.
      // aus der einfachen 16×12m-Fläche), werden in den Raum geholt, damit
      // sie im Detail-Editor sichtbar und greifbar bleiben.
      if (points.length >= 3) {
        if (simpleMode) await saveSimpleToggle(false)

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (const p of points) {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
        }

        const { data: allTables } = await supabase
          .from('seating_tables')
          .select('id, pos_x, pos_y, shape, table_length, table_width')
          .eq('event_id', eventId)

        const PADDING = 0.3
        for (const t of allTables ?? []) {
          const halfL = Number(t.table_length) / 2
          const halfW = t.shape === 'round' ? halfL : Number(t.table_width) / 2
          const cx = Math.min(Math.max(Number(t.pos_x), minX + halfL + PADDING), maxX - halfL - PADDING)
          const cy = Math.min(Math.max(Number(t.pos_y), minY + halfW + PADDING), maxY - halfW - PADDING)
          if (cx !== Number(t.pos_x) || cy !== Number(t.pos_y)) {
            await supabase.from('seating_tables').update({ pos_x: cx, pos_y: cy }).eq('id', t.id)
          }
        }

        // Vorschau-Overlay im Konfigurator aktualisieren
        const { data: refreshed } = await supabase
          .from('seating_tables')
          .select('pos_x,pos_y,rotation,shape,table_length,table_width,name')
          .eq('event_id', eventId)
        if (refreshed) setPlacedTables(refreshed as PlacedTablePreview[])
      }
      setConfigSaved(true); setTimeout(() => setConfigSaved(false), 3000)
      setShowConfigurator(false)
    } finally {
      setConfigSaving(false)
    }
  }, [userId, eventId, supabase, simpleMode, saveSimpleToggle])

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
      ) : isSolo && roomPoints.length < 3 && !simpleMode ? (
        /* Start-Wahl: einfach (ohne Raumplan) oder detaillierter Raumplan */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', maxWidth: 720 }}>
          <button
            type="button"
            onClick={() => saveSimpleToggle(true)}
            className="bp-card"
            style={{ padding: '2rem 1.75rem', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid var(--bp-gold, #B89968)' }}
          >
            <Armchair size={24} style={{ color: 'var(--bp-gold-deep, #9C7F4F)', marginBottom: 12 }} />
            <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 6px', color: 'var(--bp-ink)' }}>Einfach starten</p>
            <p className="bp-caption" style={{ margin: 0, lineHeight: 1.6 }}>
              Tische direkt anlegen und Gäste zuweisen — ganz ohne Grundriss.
              Einen Raumplan könnt ihr später jederzeit ergänzen.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setShowConfigurator(true)}
            className="bp-card"
            style={{ padding: '2rem 1.75rem', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <LayoutGrid size={24} style={{ color: 'var(--bp-ink-3)', marginBottom: 12 }} />
            <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 6px', color: 'var(--bp-ink)' }}>Raum detailliert planen</p>
            <p className="bp-caption" style={{ margin: 0, lineHeight: 1.6 }}>
              Grundriss eurer Location zeichnen, Raumelemente und Tischpool
              festlegen — für die maßstabsgetreue Planung.
            </p>
          </button>
        </div>
      ) : (
        <SitzplanEditor
          eventId={eventId}
          canEditRoom={isSolo}
          roomPoints={roomPoints.length >= 3 ? roomPoints : simpleMode ? SIMPLE_AREA : roomPoints}
          roomElements={roomPoints.length >= 3 ? roomElements : []}
          tablePool={tablePool}
          coupleName={coupleName}
          simpleMode={roomPoints.length < 3 && simpleMode}
        />
      )}
    </div>
  )
}
