'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { Monitor, LayoutGrid, Armchair, Plus, X, Search, UserPlus2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RaumPoint, RaumElement, RaumTablePool, RaumTableType, PlacedTablePreview, ConceptPlacedTable } from '@/components/room/RaumKonfigurator'

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

interface MTable { id: string; name: string; capacity: number }
interface MAssignment {
  id: string
  table_id: string
  guest_id: string | null
  begleitperson_id: string | null
  brautpaar_slot: 1 | 2 | null
  seat_index: number | null
}
interface MGuest { id: string; name: string; status: string }
interface MBegleit { id: string; name: string; guest_id: string; guest_name: string }
interface MPerson { type: 'guest' | 'begleitperson' | 'brautpaar'; id: string; name: string; subtitle?: string }

const STATUS_LABELS_MOBILE: Record<string, string> = {
  zugesagt: 'Zugesagt', abgesagt: 'Abgesagt', eingeladen: 'Eingeladen',
  angelegt: 'Angelegt', vielleicht: 'Vielleicht',
}

function splitCouple(coupleName: string): [string, string] {
  const parts = (coupleName || '').split(/[&+,]/).map(s => s.trim()).filter(Boolean)
  return [parts[0] ?? 'Partner 1', parts[1] ?? 'Partner 2']
}

// ── MobileSitzplanView ────────────────────────────────────────────────────────
//
// Auf dem Mobile ist der maßstabsgetreue Sitzplan-Editor (Anordnung, Raumplan,
// Drag&Drop) nicht verfügbar — wohl aber das Befüllen der Tische mit Gästen.
// Tische anlegen/positionieren bleibt dem Desktop vorbehalten.

function MobileSitzplanView({ eventId, coupleName }: { eventId: string; coupleName: string }) {
  const supabase = createClient()
  const [loading, setLoading]         = useState(true)
  const [tables, setTables]           = useState<MTable[]>([])
  const [assignments, setAssignments] = useState<MAssignment[]>([])
  const [guests, setGuests]           = useState<MGuest[]>([])
  const [begleit, setBegleit]         = useState<MBegleit[]>([])
  const [pickerTableId, setPickerTableId] = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [busy, setBusy]               = useState(false)

  const [partner1, partner2] = splitCouple(coupleName)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const [{ data: t }, { data: a }, { data: g }, { data: b }] = await Promise.all([
        supabase.from('seating_tables').select('id, name, capacity').eq('event_id', eventId).order('created_at'),
        supabase.from('seating_assignments').select('id, table_id, guest_id, begleitperson_id, brautpaar_slot, seat_index').eq('event_id', eventId),
        supabase.from('guests').select('id, name, status').eq('event_id', eventId).order('name'),
        supabase.from('begleitpersonen').select('id, name, guest_id, guests!inner(name, event_id)').eq('guests.event_id', eventId).order('name'),
      ])
      if (!active) return
      setTables((t ?? []) as MTable[])
      setAssignments((a ?? []) as MAssignment[])
      setGuests((g ?? []) as MGuest[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setBegleit(((b ?? []) as any[]).map(x => ({
        id: x.id, name: x.name ?? '–', guest_id: x.guest_id,
        guest_name: Array.isArray(x.guests) ? (x.guests[0]?.name ?? '') : (x.guests?.name ?? ''),
      })))
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [eventId]) // eslint-disable-line

  const assignedGuestIds   = new Set(assignments.map(a => a.guest_id).filter(Boolean) as string[])
  const assignedBegleitIds = new Set(assignments.map(a => a.begleitperson_id).filter(Boolean) as string[])
  const assignedBrautpaar  = new Set(assignments.map(a => a.brautpaar_slot).filter(Boolean) as number[])

  const assignmentsForTable = (id: string) =>
    assignments.filter(a => a.table_id === id).sort((x, y) => (x.seat_index ?? 0) - (y.seat_index ?? 0))

  function personLabel(a: MAssignment): { name: string; sub?: string } {
    if (a.guest_id) return { name: guests.find(g => g.id === a.guest_id)?.name ?? '–' }
    if (a.begleitperson_id) {
      const bp = begleit.find(x => x.id === a.begleitperson_id)
      return { name: bp?.name ?? '–', sub: bp ? `Begl. ${bp.guest_name}` : undefined }
    }
    if (a.brautpaar_slot === 1) return { name: partner1, sub: 'Brautpaar' }
    if (a.brautpaar_slot === 2) return { name: partner2, sub: 'Brautpaar' }
    return { name: '–' }
  }

  const availablePersons: MPerson[] = [
    ...(assignedBrautpaar.has(1) ? [] : [{ type: 'brautpaar' as const, id: 'bp1', name: partner1, subtitle: 'Brautpaar' }]),
    ...(assignedBrautpaar.has(2) ? [] : [{ type: 'brautpaar' as const, id: 'bp2', name: partner2, subtitle: 'Brautpaar' }]),
    ...guests.filter(g => !assignedGuestIds.has(g.id)).map(g => ({ type: 'guest' as const, id: g.id, name: g.name, subtitle: STATUS_LABELS_MOBILE[g.status] ?? g.status })),
    ...begleit.filter(b => !assignedBegleitIds.has(b.id)).map(b => ({ type: 'begleitperson' as const, id: b.id, name: b.name, subtitle: `Begl. ${b.guest_name}` })),
  ]
  const filteredAvailable = availablePersons.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.subtitle ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function assignPerson(tableId: string, person: MPerson) {
    setBusy(true)
    const used = new Set(assignmentsForTable(tableId).map(a => a.seat_index).filter(i => i != null) as number[])
    let seat = 0; while (used.has(seat)) seat++
    const payload: Record<string, unknown> = { table_id: tableId, event_id: eventId, seat_index: seat }
    if (person.type === 'guest') payload.guest_id = person.id
    else if (person.type === 'begleitperson') payload.begleitperson_id = person.id
    else if (person.id === 'bp1') payload.brautpaar_slot = 1
    else payload.brautpaar_slot = 2
    const { data, error } = await supabase
      .from('seating_assignments')
      .insert(payload)
      .select('id, table_id, guest_id, begleitperson_id, brautpaar_slot, seat_index')
      .single()
    if (!error && data) setAssignments(prev => [...prev, data as MAssignment])
    setBusy(false)
  }

  async function removeAssignment(id: string) {
    setAssignments(prev => prev.filter(a => a.id !== id))
    await supabase.from('seating_assignments').delete().eq('id', id)
  }

  const pickerTable = tables.find(t => t.id === pickerTableId) ?? null
  const pickerCount = pickerTableId ? assignmentsForTable(pickerTableId).length : 0
  const pickerFull  = pickerTable ? pickerCount >= pickerTable.capacity : false
  const unassignedCount = availablePersons.length

  return (
    <div>
      <div style={{
        background: 'var(--bp-gold-pale)', border: '1px solid var(--bp-rule-gold)',
        borderRadius: 'var(--bp-r-md)', padding: '0.875rem 1rem', marginBottom: '1rem',
        display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
      }}>
        <Monitor size={16} style={{ color: 'var(--bp-gold-deep)', flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--bp-gold-deep)', lineHeight: 1.5 }}>
          Tische anlegen und anordnen geht nur am Desktop. Hier kannst du die vorhandenen Tische schon mit Gästen befüllen.
        </p>
      </div>

      {loading ? (
        <p className="bp-caption">Wird geladen…</p>
      ) : tables.length === 0 ? (
        <div className="bp-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <Armchair size={28} style={{ color: 'var(--bp-ink-3)', marginBottom: 8 }} />
          <p className="bp-caption" style={{ margin: 0 }}>Noch keine Tische angelegt. Lege die Tische am Desktop an — danach kannst du sie hier mit Gästen befüllen.</p>
        </div>
      ) : (
        <>
          {unassignedCount > 0 && (
            <p className="bp-caption" style={{ margin: '0 0 0.75rem' }}>
              {unassignedCount} {unassignedCount === 1 ? 'Person hat' : 'Personen haben'} noch keinen Platz.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {tables.map(table => {
              const tas = assignmentsForTable(table.id)
              const full = tas.length >= table.capacity
              return (
                <div key={table.id} className="bp-card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--bp-ink)', fontSize: '0.9375rem' }}>{table.name}</span>
                    <span className={`bp-badge ${full ? 'bp-badge-gold' : 'bp-badge-neutral'}`}>{tas.length} / {table.capacity}</span>
                  </div>

                  {tas.length === 0 ? (
                    <p className="bp-caption" style={{ fontStyle: 'italic', margin: '0 0 0.75rem' }}>Noch keine Gäste zugewiesen</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
                      {tas.map(a => {
                        const { name, sub } = personLabel(a)
                        return (
                          <div key={a.id} style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            background: 'var(--bp-bg)', border: '1px solid var(--bp-rule)',
                            borderRadius: 'var(--bp-r-sm)', padding: '0.375rem 0.5rem 0.375rem 0.75rem',
                          }}>
                            <span style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', color: 'var(--bp-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {name}
                              {sub && <span style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)', marginLeft: '0.375rem' }}>{sub}</span>}
                            </span>
                            <button
                              className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon"
                              onClick={() => removeAssignment(a.id)}
                              aria-label="Vom Tisch entfernen"
                              title="Entfernen"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <button
                    className="bp-btn bp-btn-secondary bp-btn-sm"
                    onClick={() => { setSearch(''); setPickerTableId(table.id) }}
                    disabled={full}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', width: '100%', justifyContent: 'center' }}
                  >
                    <Plus size={14} /> {full ? 'Tisch voll' : 'Gast hinzufügen'}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Bottom-Sheet: Person zu Tisch zuweisen */}
      {pickerTableId && pickerTable && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(44,40,37,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setPickerTableId(null) }}
        >
          <div style={{
            background: 'var(--bp-paper)', width: '100%', maxWidth: 560,
            maxHeight: '82vh', display: 'flex', flexDirection: 'column',
            borderTopLeftRadius: 'var(--bp-r-lg)', borderTopRightRadius: 'var(--bp-r-lg)',
            boxShadow: 'var(--bp-shadow-elevated)',
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--bp-rule)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, color: 'var(--bp-ink)', margin: 0, fontSize: '1rem' }}>{pickerTable.name}</p>
                <p className="bp-caption" style={{ margin: '2px 0 0' }}>{pickerCount} / {pickerTable.capacity} belegt</p>
              </div>
              <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={() => setPickerTableId(null)} aria-label="Schließen"><X size={18} /></button>
            </div>

            <div style={{ padding: '0.875rem 1.25rem 0.625rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--bp-ink-3)', pointerEvents: 'none' }} />
                <input
                  className="bp-input"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Person suchen…"
                  autoFocus
                  style={{ paddingLeft: '2rem' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.25rem 1.25rem' }}>
              {pickerFull ? (
                <p className="bp-caption" style={{ textAlign: 'center', padding: '1.5rem 0', margin: 0 }}>
                  Dieser Tisch ist voll. Entferne erst jemanden, um weitere Gäste zu setzen.
                </p>
              ) : filteredAvailable.length === 0 ? (
                <p className="bp-caption" style={{ textAlign: 'center', padding: '1.5rem 0', margin: 0 }}>
                  {availablePersons.length === 0 ? 'Alle Personen sind bereits zugewiesen.' : 'Keine Person gefunden.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {filteredAvailable.map(p => (
                    <button
                      key={`${p.type}-${p.id}`}
                      onClick={() => assignPerson(pickerTableId, p)}
                      disabled={busy}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem', textAlign: 'left',
                        background: 'var(--bp-bg)', border: '1px solid var(--bp-rule)',
                        borderRadius: 'var(--bp-r-md)', padding: '0.625rem 0.875rem',
                        cursor: 'pointer', fontFamily: 'inherit', width: '100%',
                      }}
                    >
                      <UserPlus2 size={15} style={{ color: 'var(--bp-gold-deep)', flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, color: 'var(--bp-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        {p.subtitle && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--bp-ink-3)' }}>{p.subtitle}</span>}
                      </span>
                      <Plus size={15} style={{ color: 'var(--bp-ink-3)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
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
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventId]) // eslint-disable-line

  const saveSimpleToggle = useCallback(async (enabled: boolean) => {
    setSimpleMode(enabled)
    await supabase.from('feature_toggles').upsert(
      { event_id: eventId, key: SIMPLE_TOGGLE_KEY, enabled },
      { onConflict: 'event_id,key' }
    )
  }, [eventId, supabase])

  // Konfigurator öffnen: schnell angelegte Tische (einfacher Modus, ohne
  // Pool-Typ) vorher in den Tischpool übernehmen, damit die Tischauswahl in
  // Schritt 3 vorausgewählt ist. Gruppiert nach Form/Plätzen/Maßen; die
  // Tische bekommen den erzeugten Pool-Typ zugewiesen, damit die
  // Verfügbarkeits-Zählung im Editor stimmt.
  const openConfigurator = useCallback(async () => {
    const { data: tbls } = await supabase
      .from('seating_tables')
      .select('id, shape, capacity, table_length, table_width, pool_type_id')
      .eq('event_id', eventId)

    const quickTables = (tbls ?? []).filter(t => !t.pool_type_id || String(t.pool_type_id).startsWith('quick-'))
    if (quickTables.length > 0) {
      interface Group { ids: string[]; toAssign: string[]; shape: 'round' | 'rectangular'; len: number; wid: number; seats: number }
      const groups = new Map<string, Group>()
      for (const t of quickTables) {
        const len = Number(t.table_length), wid = Number(t.table_width)
        const key = `quick-${t.shape}-${t.capacity}-${String(len).replace('.', '_')}-${String(wid).replace('.', '_')}`
        if (!groups.has(key)) {
          groups.set(key, { ids: [], toAssign: [], shape: t.shape as 'round' | 'rectangular', len, wid, seats: t.capacity })
        }
        const g = groups.get(key)!
        g.ids.push(t.id)
        if (t.pool_type_id !== key) g.toAssign.push(t.id)
      }

      const quickTypes: RaumTableType[] = []
      for (const [typeId, g] of Array.from(groups.entries())) {
        quickTypes.push({
          id: typeId,
          shape: g.shape,
          count: g.ids.length,
          diameter: g.shape === 'round' ? g.len : 1.5,
          length: g.len,
          width: g.wid,
          seats: g.seats,
        })
        if (g.toAssign.length > 0) {
          await supabase.from('seating_tables').update({ pool_type_id: typeId }).in('id', g.toAssign)
        }
      }

      setTablePool(prev => ({
        types: [
          ...prev.types.filter(t => !quickTypes.some(q => q.id === t.id)),
          ...quickTypes,
        ],
      }))
    }
    setShowConfigurator(true)
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
            onClick={() => { if (showConfigurator) setShowConfigurator(false); else void openConfigurator() }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <LayoutGrid size={14} />
            {showConfigurator ? 'Zum Sitzplan' : 'Raum konfigurieren'}
          </button>
        )}
      </div>
      {isMobile ? (
        <MobileSitzplanView eventId={eventId} coupleName={coupleName} />
      ) : isSolo && showConfigurator ? (
        <div className="bp-card" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>Raumkonfiguration</p>
            <p style={{ fontSize: 12, margin: 0, opacity: 0.65 }}>
              Legt den Grundriss eurer Location, Raumelemente und euren Tischpool fest — danach könnt ihr im Sitzplan Tische platzieren und Gäste zuweisen.
            </p>
          </div>
          {/* Scroll-Container: der Konfigurator-Canvas ist 780px breit und darf
              die Seite auf schmalen Viewports nicht horizontal sprengen */}
          <div className="bp-scroll-x">
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
            onClick={() => void openConfigurator()}
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
