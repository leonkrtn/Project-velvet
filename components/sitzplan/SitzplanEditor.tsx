'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RaumPoint, RaumTablePool } from '@/components/room/RaumKonfigurator'

// ── Types ──────────────────────────────────────────────────────────────────

interface SitzTable {
  id: string
  event_id: string
  name: string
  shape: 'round' | 'rectangular'
  capacity: number
  pos_x: number
  pos_y: number
  rotation: number
  table_length: number
  table_width: number
}

interface SitzAssignment {
  id: string
  table_id: string
  event_id: string
  guest_id: string | null
  begleitperson_id: string | null
  brautpaar_slot: 1 | 2 | null
}

interface PersonEntry {
  type: 'guest' | 'begleitperson' | 'brautpaar'
  id: string
  name: string
  subtitle?: string
}

export interface SitzplanEditorProps {
  eventId: string
  canEditRoom: boolean
  roomPoints: RaumPoint[]
  tablePool: RaumTablePool
  coupleName?: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const CANVAS_W = 680
const CANVAS_H = 480
const PAD = 2.0 // meters of padding around room

// ── Helpers ─────────────────────────────────────────────────────────────────

function roomBounds(points: RaumPoint[]) {
  if (points.length === 0) return { minX: -5, maxX: 5, minY: -4, maxY: 4 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  return { minX, maxX, minY, maxY }
}

function computeScale(points: RaumPoint[]): { scale: number; offX: number; offY: number } {
  const { minX, maxX, minY, maxY } = roomBounds(points)
  const w = maxX - minX + PAD * 2
  const h = maxY - minY + PAD * 2
  const scale = Math.min(CANVAS_W / w, CANVAS_H / h)
  const offX = CANVAS_W / 2 - (minX + maxX) / 2 * scale
  const offY = CANVAS_H / 2 - (minY + maxY) / 2 * scale
  return { scale, offX, offY }
}

function m2px(mx: number, my: number, scale: number, offX: number, offY: number) {
  return { x: mx * scale + offX, y: my * scale + offY }
}

function px2m(px: number, py: number, scale: number, offX: number, offY: number) {
  return { x: (px - offX) / scale, y: (py - offY) / scale }
}

function coupleNames(coupleName?: string): [string, string] {
  if (!coupleName) return ['Partner 1', 'Partner 2']
  const parts = coupleName.split(/[&+,]/).map(s => s.trim()).filter(Boolean)
  return [parts[0] ?? 'Partner 1', parts[1] ?? 'Partner 2']
}

// ── Sub-components ──────────────────────────────────────────────────────────

function TableShape({
  table, scale, offX, offY, selected, onClick,
  onMouseDown,
}: {
  table: SitzTable
  scale: number; offX: number; offY: number
  selected: boolean
  onClick: () => void
  onMouseDown: (e: React.MouseEvent) => void
}) {
  const cx = table.pos_x * scale + offX
  const cy = table.pos_y * scale + offY
  const len = table.table_length * scale
  const wid = table.table_width * scale
  const rot = table.rotation

  return (
    <g
      transform={`rotate(${rot}, ${cx}, ${cy})`}
      onClick={e => { e.stopPropagation(); onClick() }}
      onMouseDown={onMouseDown}
      style={{ cursor: 'grab' }}
    >
      {table.shape === 'round' ? (
        <ellipse
          cx={cx} cy={cy}
          rx={len / 2} ry={len / 2}
          fill={selected ? '#EEF2FF' : '#F5F5F7'}
          stroke={selected ? '#6366F1' : '#1D1D1F'}
          strokeWidth={selected ? 2.5 : 1.5}
        />
      ) : (
        <rect
          x={cx - len / 2} y={cy - wid / 2}
          width={len} height={wid}
          rx={4}
          fill={selected ? '#EEF2FF' : '#F5F5F7'}
          stroke={selected ? '#6366F1' : '#1D1D1F'}
          strokeWidth={selected ? 2.5 : 1.5}
        />
      )}
      <text
        x={cx} y={cy}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={Math.max(9, Math.min(13, len * 0.14))}
        fontFamily="-apple-system,Helvetica,sans-serif"
        fontWeight="600"
        fill={selected ? '#4338CA' : '#1D1D1F'}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {table.name}
      </text>
    </g>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function SitzplanEditor({
  eventId, canEditRoom, roomPoints, tablePool, coupleName,
}: SitzplanEditorProps) {
  const supabase = createClient()

  const [tables, setTables] = useState<SitzTable[]>([])
  const [assignments, setAssignments] = useState<SitzAssignment[]>([])
  const [guests, setGuests] = useState<{ id: string; name: string; status: string }[]>([])
  const [begleit, setBegleit] = useState<{ id: string; name: string; guest_id: string; guest_name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')

  // Drag state
  const svgRef = useRef<SVGSVGElement>(null)
  const dragState = useRef<{
    tableId: string
    startMx: number; startMy: number
    startPosX: number; startPosY: number
  } | null>(null)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panState = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null)

  const { scale: baseScale, offX: baseOffX, offY: baseOffY } = computeScale(roomPoints)
  const scale = baseScale * zoom
  const offX = baseOffX * zoom + pan.x
  const offY = baseOffY * zoom + pan.y

  const [partner1, partner2] = coupleNames(coupleName)

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => { loadAll() }, [eventId]) // eslint-disable-line

  async function loadAll() {
    setLoading(true)
    try {
      const [
        { data: tablesData },
        { data: assignmentsData },
        { data: guestsData },
        { data: begleitData },
      ] = await Promise.all([
        supabase.from('seating_tables').select('*').eq('event_id', eventId).order('created_at'),
        supabase.from('seating_assignments').select('*').eq('event_id', eventId),
        supabase.from('guests').select('id, name, status').eq('event_id', eventId).order('name'),
        supabase.from('begleitpersonen').select('id, name, guest_id, guests!inner(name)').eq('guests.event_id', eventId).order('name'),
      ])
      setTables(tablesData ?? [])
      setAssignments(assignmentsData ?? [])
      setGuests(guestsData ?? [])
      const mapped = (begleitData ?? []).map((b: { id: string; name: string; guest_id: string; guests: { name: string } | { name: string }[] }) => ({
        id: b.id,
        name: b.name,
        guest_id: b.guest_id,
        guest_name: Array.isArray(b.guests) ? (b.guests[0]?.name ?? '') : (b.guests?.name ?? ''),
      }))
      setBegleit(mapped)
    } finally {
      setLoading(false)
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const placedRound = tables.filter(t => t.shape === 'round').length
  const placedRect  = tables.filter(t => t.shape === 'rectangular').length
  const availRound  = Math.max(0, tablePool.round.count - placedRound)
  const availRect   = Math.max(0, tablePool.rect.count - placedRect)

  const assignedGuestIds      = new Set(assignments.map(a => a.guest_id).filter(Boolean) as string[])
  const assignedBegleitIds    = new Set(assignments.map(a => a.begleitperson_id).filter(Boolean) as string[])
  const assignedBrautpaar     = new Set(assignments.map(a => a.brautpaar_slot).filter(Boolean) as number[])

  const assignmentsForTable = (tableId: string) => assignments.filter(a => a.table_id === tableId)

  const personName = (a: SitzAssignment): string => {
    if (a.guest_id) return guests.find(g => g.id === a.guest_id)?.name ?? '–'
    if (a.begleitperson_id) {
      const b = begleit.find(b => b.id === a.begleitperson_id)
      return b ? `${b.name} (Begl. ${b.guest_name})` : '–'
    }
    if (a.brautpaar_slot === 1) return partner1
    if (a.brautpaar_slot === 2) return partner2
    return '–'
  }

  const selectedTable = tables.find(t => t.id === selectedTableId) ?? null
  const selectedAssignments = selectedTableId ? assignmentsForTable(selectedTableId) : []
  const selectedCount = selectedAssignments.length

  // Persons available to assign (not yet assigned)
  const allPersons: PersonEntry[] = [
    ...(assignedBrautpaar.has(1) ? [] : [{ type: 'brautpaar' as const, id: 'bp1', name: partner1, subtitle: 'Brautpaar' }]),
    ...(assignedBrautpaar.has(2) ? [] : [{ type: 'brautpaar' as const, id: 'bp2', name: partner2, subtitle: 'Brautpaar' }]),
    ...guests.filter(g => !assignedGuestIds.has(g.id)).map(g => ({
      type: 'guest' as const, id: g.id, name: g.name, subtitle: g.status,
    })),
    ...begleit.filter(b => !assignedBegleitIds.has(b.id)).map(b => ({
      type: 'begleitperson' as const, id: b.id, name: b.name, subtitle: `Begl. ${b.guest_name}`,
    })),
  ]

  const filteredPersons = allPersons.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.subtitle ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // ── Actions ────────────────────────────────────────────────────────────────

  async function addTable(shape: 'round' | 'rectangular') {
    const num = tables.filter(t => t.shape === shape).length + 1
    const name = shape === 'round' ? `Runder Tisch ${num}` : `Tisch ${num}`
    const defaultLen = shape === 'round' ? tablePool.round.diameter : tablePool.rect.length
    const defaultWid = shape === 'round' ? tablePool.round.diameter : tablePool.rect.width
    const defaultCap = shape === 'round' ? Math.max(2, Math.round(tablePool.round.diameter * 4)) : Math.max(2, Math.round(tablePool.rect.length * 2))

    // Place near center of room
    const bounds = roomBounds(roomPoints)
    const cx = (bounds.minX + bounds.maxX) / 2 + (Math.random() - 0.5) * 2
    const cy = (bounds.minY + bounds.maxY) / 2 + (Math.random() - 0.5) * 2

    const { data, error } = await supabase.from('seating_tables').insert({
      event_id: eventId, name, shape, capacity: defaultCap,
      pos_x: cx, pos_y: cy, rotation: 0,
      table_length: defaultLen, table_width: defaultWid,
    }).select().single()
    if (!error && data) setTables(prev => [...prev, data])
  }

  async function deleteTable(tableId: string) {
    await supabase.from('seating_tables').delete().eq('id', tableId)
    setTables(prev => prev.filter(t => t.id !== tableId))
    setAssignments(prev => prev.filter(a => a.table_id !== tableId))
    if (selectedTableId === tableId) setSelectedTableId(null)
  }

  async function updateTablePos(tableId: string, pos_x: number, pos_y: number) {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, pos_x, pos_y } : t))
    await supabase.from('seating_tables').update({ pos_x, pos_y }).eq('id', tableId)
  }

  async function updateTableName(tableId: string, name: string) {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, name } : t))
    await supabase.from('seating_tables').update({ name }).eq('id', tableId)
  }

  async function updateTableProp(tableId: string, field: string, value: number) {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, [field]: value } : t))
    await supabase.from('seating_tables').update({ [field]: value }).eq('id', tableId)
  }

  async function assignPerson(person: PersonEntry) {
    if (!selectedTableId) return
    const payload: Record<string, unknown> = { table_id: selectedTableId, event_id: eventId }
    if (person.type === 'guest') payload.guest_id = person.id
    else if (person.type === 'begleitperson') payload.begleitperson_id = person.id
    else if (person.id === 'bp1') payload.brautpaar_slot = 1
    else payload.brautpaar_slot = 2

    const { data, error } = await supabase.from('seating_assignments').insert(payload).select().single()
    if (!error && data) setAssignments(prev => [...prev, data])
  }

  async function removeAssignment(assignmentId: string) {
    await supabase.from('seating_assignments').delete().eq('id', assignmentId)
    setAssignments(prev => prev.filter(a => a.id !== assignmentId))
  }

  // ── SVG drag handling ──────────────────────────────────────────────────────

  const onTableMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = (e.clientX - rect.left) * (CANVAS_W / rect.width)
    const py = (e.clientY - rect.top) * (CANVAS_H / rect.height)
    const { x: mx, y: my } = px2m(px, py, scale, offX, offY)
    const table = tables.find(t => t.id === tableId)
    if (!table) return
    dragState.current = { tableId, startMx: mx, startMy: my, startPosX: table.pos_x, startPosY: table.pos_y }
  }, [tables, scale, offX, offY])

  const onSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = (e.clientX - rect.left) * (CANVAS_W / rect.width)
    const py = (e.clientY - rect.top) * (CANVAS_H / rect.height)
    const { x: mx, y: my } = px2m(px, py, scale, offX, offY)
    const dx = mx - dragState.current.startMx
    const dy = my - dragState.current.startMy
    const newX = dragState.current.startPosX + dx
    const newY = dragState.current.startPosY + dy
    setTables(prev => prev.map(t => t.id === dragState.current!.tableId ? { ...t, pos_x: newX, pos_y: newY } : t))
  }, [scale, offX, offY])

  const onSvgMouseUp = useCallback(async () => {
    if (!dragState.current) return
    const ds = dragState.current
    dragState.current = null
    const table = tables.find(t => t.id === ds.tableId)
    if (table) await supabase.from('seating_tables').update({ pos_x: table.pos_x, pos_y: table.pos_y }).eq('id', ds.tableId)
  }, [tables, supabase])

  // Pan with middle-mouse or empty-space drag
  const onSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1 && e.button !== 0) return
    if ((e.target as SVGElement).closest('g')) return // clicking a table
    panState.current = { startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y }
  }, [pan])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!panState.current) return
      const dx = e.clientX - panState.current.startX
      const dy = e.clientY - panState.current.startY
      setPan({ x: panState.current.startPanX + dx, y: panState.current.startPanY + dy })
    }
    function onUp() { panState.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    setZoom(z => Math.max(0.4, Math.min(4, z - e.deltaY * 0.001)))
  }

  // ── Inline name editing ────────────────────────────────────────────────────

  function startEditing(table: SitzTable) {
    setEditingName(table.id)
    setNameInput(table.name)
  }

  async function commitName() {
    if (editingName && nameInput.trim()) await updateTableName(editingName, nameInput.trim())
    setEditingName(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
      Lade Sitzplan…
    </div>
  )

  if (roomPoints.length < 3) return (
    <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>Kein Raum konfiguriert</p>
      <p style={{ fontSize: 13 }}>Bitte zuerst den Raum im Raumkonfigurator anlegen.</p>
    </div>
  )

  const noPool = tablePool.round.count === 0 && tablePool.rect.count === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Editor area ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Table pool */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
              Verfügbare Tische
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {noPool ? (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  Noch keine Tische konfiguriert. Bitte zuerst den Raum in Schritt 3 einrichten.
                </p>
              ) : (
                <>
                  {tablePool.round.count > 0 && (
                    <button
                      onClick={() => availRound > 0 && addTable('round')}
                      disabled={availRound === 0}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderRadius: 8, border: '1px solid var(--border)',
                        background: availRound === 0 ? '#F5F5F7' : 'var(--surface)',
                        cursor: availRound === 0 ? 'not-allowed' : 'pointer',
                        opacity: availRound === 0 ? 0.5 : 1,
                        fontFamily: 'inherit',
                      }}
                    >
                      <svg width="32" height="32" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="13" fill="#EEF2FF" stroke="#6366F1" strokeWidth="1.5"/>
                      </svg>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Runder Tisch</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {availRound === 0 ? 'Alle platziert' : `${availRound} verfügbar`}
                        </div>
                      </div>
                      {availRound > 0 && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, background: '#6366F1', color: '#fff', borderRadius: 10, padding: '2px 7px', fontWeight: 600 }}>+</span>
                      )}
                    </button>
                  )}
                  {tablePool.rect.count > 0 && (
                    <button
                      onClick={() => availRect > 0 && addTable('rectangular')}
                      disabled={availRect === 0}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderRadius: 8, border: '1px solid var(--border)',
                        background: availRect === 0 ? '#F5F5F7' : 'var(--surface)',
                        cursor: availRect === 0 ? 'not-allowed' : 'pointer',
                        opacity: availRect === 0 ? 0.5 : 1,
                        fontFamily: 'inherit',
                      }}
                    >
                      <svg width="32" height="32" viewBox="0 0 32 32">
                        <rect x="3" y="10" width="26" height="12" rx="3" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.5"/>
                      </svg>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Eckiger Tisch</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {availRect === 0 ? 'Alle platziert' : `${availRect} verfügbar`}
                        </div>
                      </div>
                      {availRect > 0 && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, background: '#22C55E', color: '#fff', borderRadius: 10, padding: '2px 7px', fontWeight: 600 }}>+</span>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Selected table panel OR guest list */}
          {selectedTable ? (
            <div style={{ background: 'var(--surface)', border: '2px solid #6366F1', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {editingName === selectedTable.id ? (
                  <input
                    autoFocus value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(null) }}
                    style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '3px 6px', borderRadius: 6, border: '1px solid #6366F1', fontFamily: 'inherit', outline: 'none' }}
                  />
                ) : (
                  <button
                    onClick={() => startEditing(selectedTable)}
                    style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                    title="Klicken zum Umbenennen"
                  >
                    {selectedTable.name}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 5, opacity: 0.4, verticalAlign: 'middle' }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                )}
                <span style={{ fontSize: 11, color: selectedCount >= selectedTable.capacity ? '#FF3B30' : 'var(--text-tertiary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {selectedCount}/{selectedTable.capacity}
                </span>
                <button
                  onClick={() => setSelectedTableId(null)}
                  style={{ padding: '2px 6px', borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.06)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1 }}
                >✕</button>
              </div>

              {/* Table properties */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Plätze</span>
                  <input type="number" min={1} max={50} value={selectedTable.capacity}
                    onChange={e => updateTableProp(selectedTable.id, 'capacity', Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: 56, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', textAlign: 'center' }}
                  />
                </label>
                {selectedTable.shape === 'round' ? (
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>⌀ (m)</span>
                    <input type="number" min={0.5} max={6} step={0.1} value={selectedTable.table_length}
                      onChange={e => updateTableProp(selectedTable.id, 'table_length', Math.max(0.5, parseFloat(e.target.value) || 1.5))}
                      style={{ width: 56, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', textAlign: 'center' }}
                    />
                  </label>
                ) : (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Länge (m)</span>
                      <input type="number" min={0.5} max={10} step={0.1} value={selectedTable.table_length}
                        onChange={e => updateTableProp(selectedTable.id, 'table_length', Math.max(0.5, parseFloat(e.target.value) || 2))}
                        style={{ width: 56, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', textAlign: 'center' }}
                      />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Breite (m)</span>
                      <input type="number" min={0.3} max={5} step={0.1} value={selectedTable.table_width}
                        onChange={e => updateTableProp(selectedTable.id, 'table_width', Math.max(0.3, parseFloat(e.target.value) || 0.8))}
                        style={{ width: 56, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', textAlign: 'center' }}
                      />
                    </label>
                  </>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => updateTableProp(selectedTable.id, 'rotation', (selectedTable.rotation - 15 + 360) % 360)} style={{ flex: 1, padding: '4px 0', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>↺ -15°</button>
                  <button onClick={() => updateTableProp(selectedTable.id, 'rotation', (selectedTable.rotation + 15) % 360)} style={{ flex: 1, padding: '4px 0', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>↻ +15°</button>
                </div>
              </div>

              {/* Assigned persons */}
              {selectedAssignments.length > 0 && (
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {selectedAssignments.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{personName(a)}</span>
                      <button onClick={() => removeAssignment(a.id)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search to add */}
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  placeholder="Gast suchen…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selectedCount >= selectedTable.capacity ? (
                    <p style={{ fontSize: 11, color: '#FF3B30', textAlign: 'center', padding: '4px 0' }}>Tisch ist voll</p>
                  ) : filteredPersons.length === 0 ? (
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '4px 0' }}>Keine weiteren Personen</p>
                  ) : (
                    filteredPersons.map(p => (
                      <button
                        key={`${p.type}-${p.id}`}
                        onClick={() => assignPerson(p)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '5px 8px',
                          borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)',
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{p.name}</span>
                        {p.subtitle && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.subtitle}</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Delete table */}
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => { if (confirm(`"${selectedTable.name}" löschen?`)) deleteTable(selectedTable.id) }}
                  style={{ width: '100%', padding: '6px 0', borderRadius: 7, border: '1px solid rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.06)', color: '#FF3B30', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }}
                >
                  Tisch löschen
                </button>
              </div>
            </div>
          ) : (
            /* Guest overview when no table selected */
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Personen</div>
                <input
                  placeholder="Suchen…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredPersons.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
                    {allPersons.length === 0 ? 'Alle Personen sitzen' : 'Kein Treffer'}
                  </p>
                ) : (
                  filteredPersons.map(p => (
                    <div key={`${p.type}-${p.id}`} style={{ display: 'flex', flexDirection: 'column', padding: '5px 8px', borderRadius: 6, background: '#F5F5F7', fontSize: 12 }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      {p.subtitle && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.subtitle}</span>}
                    </div>
                  ))
                )}
              </div>
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                {allPersons.length} noch nicht platziert · Tisch anklicken zum Zuordnen
              </div>
            </div>
          )}
        </div>

        {/* ── SVG Canvas ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
            <span>{tables.length} Tische platziert · {guests.length + begleit.length + 2} Personen gesamt</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--text-secondary)' }}>Ansicht zurücksetzen</button>
            </div>
          </div>

          {/* SVG */}
          <div style={{ background: '#F5F5F7', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg
              ref={svgRef}
              width={CANVAS_W} height={CANVAS_H}
              style={{ display: 'block', cursor: dragState.current ? 'grabbing' : 'default' }}
              onMouseDown={onSvgMouseDown}
              onMouseMove={onSvgMouseMove}
              onMouseUp={onSvgMouseUp}
              onMouseLeave={onSvgMouseUp}
              onWheel={onWheel}
              onClick={() => setSelectedTableId(null)}
            >
              {/* Room polygon */}
              {roomPoints.length >= 3 && (
                <polygon
                  points={roomPoints.map(p => {
                    const c = m2px(p.x, p.y, scale, offX, offY)
                    return `${c.x},${c.y}`
                  }).join(' ')}
                  fill="rgba(29,29,31,0.04)"
                  stroke="#1D1D1F"
                  strokeWidth="2"
                />
              )}

              {/* Tables */}
              {tables.map(table => (
                <TableShape
                  key={table.id}
                  table={table}
                  scale={scale} offX={offX} offY={offY}
                  selected={selectedTableId === table.id}
                  onClick={() => { setSelectedTableId(table.id); setSearch('') }}
                  onMouseDown={e => onTableMouseDown(e, table.id)}
                />
              ))}
            </svg>
          </div>

          {/* Status bar */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)' }}>
            Tisch anklicken = auswählen · Ziehen = verschieben · Scroll = zoom
          </div>
        </div>
      </div>

      {/* ── List view ── */}
      {tables.length > 0 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, letterSpacing: '-0.3px' }}>Tischbelegung</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {tables.map(table => {
              const tas = assignmentsForTable(table.id)
              return (
                <div
                  key={table.id}
                  onClick={() => { setSelectedTableId(table.id); setSearch(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  style={{
                    background: selectedTableId === table.id ? '#EEF2FF' : 'var(--surface)',
                    border: selectedTableId === table.id ? '1.5px solid #6366F1' : '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{table.name}</span>
                    <span style={{ fontSize: 11, color: tas.length >= table.capacity ? '#FF3B30' : 'var(--text-tertiary)', fontWeight: 500 }}>
                      {tas.length}/{table.capacity}
                    </span>
                  </div>
                  {tas.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Noch niemand zugeordnet</p>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {tas.map(a => (
                        <li key={a.id} style={{ fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-tertiary)', flexShrink: 0 }}/>
                          {personName(a)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
