'use client'
import React, { useState, useEffect, useRef } from 'react'
import { type Event, type SeatingTable, type Guest } from '@/lib/store'
import { useEvent } from '@/lib/event-context'
import { Toast } from '@/components/ui'
import { Plus, Trash2, RefreshCw, SlidersHorizontal, X } from 'lucide-react'
import { useFeatureEnabled, FeatureDisabledScreen } from '@/components/FeatureGate'

function uid() { return Math.random().toString(36).slice(2, 9) }

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_SCALE = 72   // max px per meter
const MIN_SCALE = 34   // minimum before "too small" message
const SEAT_R    = 14   // seat circle radius px
const SEAT_GAP  = 5    // gap from table edge to seat center px

// ── Seat position computation ──────────────────────────────────────────────
function computeSeats(
  shape: 'rectangular' | 'round',
  tableWpx: number,
  tableHpx: number,
  n: number,
): { x: number; y: number }[] {
  if (n <= 0) return []

  if (shape === 'round') {
    const r = tableWpx / 2 + SEAT_R + SEAT_GAP
    return Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i / n) - Math.PI / 2
      return { x: r * Math.cos(a), y: r * Math.sin(a) }
    })
  }

  // Rectangular: distribute evenly around perimeter, offset by half-spacing so seats
  // are centred on each edge rather than starting at a corner
  const W = tableWpx, H = tableHpx
  const perim = 2 * (W + H)
  const spacing = perim / n
  const offset  = spacing / 2

  return Array.from({ length: n }, (_, i) => {
    const p = (offset + i * spacing) % perim
    if (p < W) {
      return { x: -W / 2 + p,               y: -H / 2 - SEAT_R - SEAT_GAP }
    } else if (p < W + H) {
      return { x:  W / 2 + SEAT_R + SEAT_GAP, y: -H / 2 + (p - W) }
    } else if (p < 2 * W + H) {
      return { x:  W / 2 - (p - W - H),       y:  H / 2 + SEAT_R + SEAT_GAP }
    } else {
      return { x: -W / 2 - SEAT_R - SEAT_GAP, y:  H / 2 - (p - 2 * W - H) }
    }
  })
}

// ── Table defaults ─────────────────────────────────────────────────────────
function withDefaults(t: SeatingTable, i: number): Required<SeatingTable> {
  return {
    x:           2 + (i % 3) * 3.5,
    y:           2.5 + Math.floor(i / 3) * 3.5,
    tableLength: 2.0,
    tableWidth:  0.8,
    rotation:    0,
    shape:       'rectangular',
    ...t,
  } as Required<SeatingTable>
}

// ── Component ──────────────────────────────────────────────────────────────
export default function SeatingPage() {
  const { event: ctxEvent, updateEvent } = useEvent()
  const [event,       setEvent]       = useState<Event | null>(null)
  const [toast,       setToast]       = useState<string | null>(null)
  const [sideNames,   setSideNames]   = useState<Record<string, string>>({})
  const [seatPopup,   setSeatPopup]   = useState<{
    tableId: string; seatIndex: number; x: number; y: number
  } | null>(null)
  const [viewportW,   setViewportW]   = useState(1200)
  const [viewportH,   setViewportH]   = useState(800)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [popupSearch, setPopupSearch] = useState('')

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      setViewportW(w)
      setViewportH(window.innerHeight)
      setSidebarOpen(w >= 700)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const isNarrow = viewportW < 700
  // scaleRef lets drag handlers always use the current scale without re-creating
  const scaleRef = useRef(MAX_SCALE)

  // Drag refs (DOM-direct for smoothness)
  const tableRefs   = useRef<Record<string, HTMLDivElement | null>>({})
  const dragRef     = useRef<{ tableId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const wasDragged  = useRef(false)

  // Rotate refs
  const rotateRef   = useRef<{ tableId: string; cx: number; cy: number; startAngle: number; startRot: number } | null>(null)
  const liveRot     = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!ctxEvent) return
    const tables = ctxEvent.seatingTables.map((t, i) => withDefaults(t, i))
    setEvent({ ...ctxEvent, seatingTables: tables })
    const names: Record<string, string> = {}
    tables.forEach(t => { names[t.id] = t.name })
    setSideNames(names)
  }, [ctxEvent === null])  // only run on initial load

  const enabled = useFeatureEnabled('seating')
  const persist = (e: Event) => { setEvent(e); updateEvent(e) }
  const closePopup = () => { setSeatPopup(null); setPopupSearch('') }
  if (!event) return null
  if (!enabled) return <div style={{maxWidth:600,margin:'0 auto',padding:'24px 16px'}}><FeatureDisabledScreen /></div>

  const roomL    = event.roomLength  ?? 12
  const roomW    = event.roomWidth   ?? 8

  // Dynamic scale: shrink room to fit available canvas, capped at MAX_SCALE
  const sidebarW   = isNarrow ? 0 : 268
  const availW     = Math.max(1, viewportW - sidebarW - 80)   // 80 = canvas padding L+R
  const availH     = Math.max(1, viewportH - 80 - 80)          // header + canvas padding T+B
  const fitScale   = Math.min(availW / roomL, availH / roomW)
  const scale      = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fitScale))
  const tooSmall   = fitScale < MIN_SCALE
  scaleRef.current = scale

  const roomPxW  = roomL * scale
  const roomPxH  = roomW * scale

  const confirmed   = event.guests.filter(g => g.status === 'zugesagt')
  const assignedSet = new Set(event.seatingTables.flatMap(t => t.guestIds.filter(Boolean)))
  const unassigned  = confirmed.filter(g => !assignedSet.has(g.id))

  // Couple as virtual placeable persons (parsed from coupleName, e.g. "Julia & Thomas")
  const coupleParts = (event.coupleName ?? '').split(/\s*&\s*|\s+und\s+/i).map(s => s.trim()).filter(Boolean)
  const couplePersons = coupleParts.length >= 2
    ? [{ id: 'couple-1', name: coupleParts[0] }, { id: 'couple-2', name: coupleParts[1] }]
    : coupleParts.length === 1 ? [{ id: 'couple-1', name: coupleParts[0] }] : []
  const unassignedCouple = couplePersons.filter(p => !assignedSet.has(p.id))

  // Companions (Begleitpersonen) from confirmed guests
  const allCompanions = confirmed.flatMap(g =>
    g.begleitpersonen.map(bp => ({ id: bp.id, name: bp.name, hostName: g.name.split(' ')[0] }))
  )
  const unassignedCompanions = allCompanions.filter(bp => !assignedSet.has(bp.id))
  const totalAttendees  = confirmed.length + allCompanions.length
  const seatedAttendees = assignedSet.size - couplePersons.filter(p => assignedSet.has(p.id)).length

  const guestById = (id: string): { name: string } | undefined => {
    const cp = couplePersons.find(p => p.id === id)
    if (cp) return cp
    const g = event.guests.find(g => g.id === id)
    if (g) return g
    return allCompanions.find(bp => bp.id === id)
  }

  // ── Drag ────────────────────────────────────────────────────────────────
  const onTableDown = (e: React.PointerEvent<HTMLDivElement>, tableId: string) => {
    if (e.defaultPrevented) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    wasDragged.current = false
    const t = event.seatingTables.find(t => t.id === tableId)!
    dragRef.current = { tableId, startX: e.clientX, startY: e.clientY, origX: t.x!, origY: t.y! }
  }

  const onTableMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragRef.current
    if (!ds) return
    const sc = scaleRef.current
    const dx = (e.clientX - ds.startX) / sc
    const dy = (e.clientY - ds.startY) / sc
    if (Math.abs(dx) > 0.04 || Math.abs(dy) > 0.04) wasDragged.current = true
    if (!wasDragged.current) return
    const t = event.seatingTables.find(t => t.id === ds.tableId)!
    const tl = t.tableLength ?? 2; const tw = t.tableWidth ?? 0.8
    const halfW = tl / 2; const halfH = (t.shape === 'round' ? tl : tw) / 2
    const nx = Math.max(halfW, Math.min(roomL - halfW, ds.origX + dx))
    const ny = Math.max(halfH, Math.min(roomW - halfH, ds.origY + dy))
    const el = tableRefs.current[ds.tableId]
    if (el) { el.style.left = `${nx * sc - (tl * sc) / 2}px`; el.style.top = `${ny * sc - ((t.shape === 'round' ? tl : tw) * sc) / 2}px` }
  }

  const onTableUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragRef.current
    if (!ds) { return }
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (!wasDragged.current) { dragRef.current = null; return }
    const sc = scaleRef.current
    const dx = (e.clientX - ds.startX) / sc
    const dy = (e.clientY - ds.startY) / sc
    const t = event.seatingTables.find(t => t.id === ds.tableId)!
    const tl = t.tableLength ?? 2; const tw = t.tableWidth ?? 0.8
    const halfW = tl / 2; const halfH = (t.shape === 'round' ? tl : tw) / 2
    const nx = Math.max(halfW, Math.min(roomL - halfW, ds.origX + dx))
    const ny = Math.max(halfH, Math.min(roomW - halfH, ds.origY + dy))
    dragRef.current = null
    persist({ ...event, seatingTables: event.seatingTables.map(t => t.id === ds.tableId ? { ...t, x: nx, y: ny } : t) })
  }

  // ── Rotate ───────────────────────────────────────────────────────────────
  const onRotateDown = (e: React.PointerEvent, tableId: string) => {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const el = tableRefs.current[tableId]
    if (!el) return
    const r  = el.getBoundingClientRect()
    const cx = r.left + r.width  / 2
    const cy = r.top  + r.height / 2
    const t  = event.seatingTables.find(t => t.id === tableId)!
    rotateRef.current = {
      tableId, cx, cy,
      startAngle: Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI,
      startRot:   t.rotation ?? 0,
    }
  }

  const onRotateMove = (e: React.PointerEvent) => {
    const rs = rotateRef.current
    if (!rs) return
    const a   = Math.atan2(e.clientY - rs.cy, e.clientX - rs.cx) * 180 / Math.PI
    const rot = ((rs.startRot + a - rs.startAngle) % 360 + 360) % 360
    liveRot.current[rs.tableId] = rot
    const el = tableRefs.current[rs.tableId]
    if (el) el.style.transform = `rotate(${rot}deg)`
  }

  const onRotateUp = (e: React.PointerEvent) => {
    const rs = rotateRef.current
    if (!rs) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    const rot = liveRot.current[rs.tableId] ?? rs.startRot
    rotateRef.current = null
    persist({ ...event, seatingTables: event.seatingTables.map(t => t.id === rs.tableId ? { ...t, rotation: rot } : t) })
  }

  // ── Table operations ─────────────────────────────────────────────────────
  const addTable = (shape: 'rectangular' | 'round') => {
    const id = uid()
    const name = `Tisch ${event.seatingTables.length + 1}`
    const t: SeatingTable = {
      id, name, capacity: shape === 'round' ? 6 : 8, guestIds: [],
      x: roomL / 2, y: roomW / 2,
      tableLength: shape === 'round' ? 1.4 : 2.0,
      tableWidth: 0.8, rotation: 0, shape,
    }
    setSideNames(n => ({ ...n, [id]: name }))
    persist({ ...event, seatingTables: [...event.seatingTables, t] })
    setToast(`${name} hinzugefügt`)
  }

  const removeTable = (id: string) => {
    persist({ ...event, seatingTables: event.seatingTables.filter(t => t.id !== id) })
    setToast('Tisch entfernt')
  }

  const commitName = (id: string) => {
    const name = sideNames[id]?.trim() || 'Tisch'
    setSideNames(n => ({ ...n, [id]: name }))
    persist({ ...event, seatingTables: event.seatingTables.map(t => t.id === id ? { ...t, name } : t) })
  }

  const setProp = <K extends keyof SeatingTable>(id: string, prop: K, val: SeatingTable[K]) =>
    persist({ ...event, seatingTables: event.seatingTables.map(t => t.id === id ? { ...t, [prop]: val } : t) })

  const setRoomProp = (prop: 'roomLength' | 'roomWidth', val: number) =>
    persist({ ...event, [prop]: val })

  // ── Seat operations ──────────────────────────────────────────────────────
  const assignToSeat = (tableId: string, seatIndex: number, guestId: string) => {
    const tables = event.seatingTables.map(t => {
      const ids = t.guestIds.map(g => g === guestId ? '' : g)
      if (t.id === tableId) {
        while (ids.length <= seatIndex) ids.push('')
        ids[seatIndex] = guestId
      }
      return { ...t, guestIds: ids }
    })
    persist({ ...event, seatingTables: tables })
    closePopup()
  }

  const removeFromSeat = (tableId: string, seatIndex: number) => {
    persist({
      ...event,
      seatingTables: event.seatingTables.map(t => {
        if (t.id !== tableId) return t
        const ids = [...t.guestIds]
        ids[seatIndex] = ''
        while (ids.length > 0 && !ids[ids.length - 1]) ids.pop()
        return { ...t, guestIds: ids }
      }),
    })
  }

  const onSeatClick = (tableId: string, seatIndex: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (wasDragged.current) return
    const t = event.seatingTables.find(t => t.id === tableId)!
    if (t.guestIds[seatIndex]) {
      removeFromSeat(tableId, seatIndex)
    } else {
      setSeatPopup({ tableId, seatIndex, x: e.clientX, y: e.clientY })
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{ display: 'flex', height: 'calc(100dvh - 80px)', overflow: 'hidden', background: 'var(--bg)' }}
      onClick={closePopup}
    >

      {/* ══ BACKDROP (mobile) ════════════════════════════════════════════ */}
      {isNarrow && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 49, backdropFilter: 'blur(1px)' }}
        />
      )}

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════ */}
      <aside onClick={e => e.stopPropagation()} style={{
        width: 268, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        // On narrow: fixed overlay that slides in/out
        ...(isNarrow ? {
          position:   'fixed',
          top:        80,
          left:       0,
          bottom:     0,
          zIndex:     50,
          width:      Math.min(300, viewportW - 40),
          transform:  sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          boxShadow:  sidebarOpen ? '4px 0 24px rgba(0,0,0,0.12)' : 'none',
        } : {}),
      }}>
        {/* Mobile header with close button */}
        {isNarrow && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>Sitzplan</span>
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        )}

        {/* Stats */}
        <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {[
              { v: totalAttendees,                              l: 'Personen'   },
              { v: seatedAttendees,                             l: 'Platziert'  },
              { v: unassigned.length + unassignedCompanions.length, l: 'Ohne Platz' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 500, color: 'var(--gold)', lineHeight: 1 }}>{s.v}</p>
                <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginTop: 3 }}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 16px' }}>

          {/* ── Room ── */}
          <p style={labelStyle}>Raum</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
            {([
              { label: 'Länge (m)', prop: 'roomLength' as const, val: roomL },
              { label: 'Breite (m)', prop: 'roomWidth' as const, val: roomW },
            ] as const).map(({ label, prop, val }) => (
              <div key={prop}>
                <p style={subLabelStyle}>{label}</p>
                <input type="number" min={3} max={50} step={0.5} value={val}
                  onChange={e => setRoomProp(prop, parseFloat(e.target.value) || 3)}
                  style={numInputStyle}
                />
              </div>
            ))}
          </div>

          {/* ── Tables ── */}
          <p style={labelStyle}>Tische ({event.seatingTables.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            {event.seatingTables.map(table => {
              const shape  = table.shape ?? 'rectangular'
              const tl     = table.tableLength ?? 2.0
              const tw     = table.tableWidth  ?? 0.8
              const seated = table.guestIds.filter(Boolean).length
              const fill   = table.capacity > 0 ? (seated / table.capacity) * 100 : 0
              const isFull = seated >= table.capacity

              return (
                <div key={table.id} style={{
                  background: 'var(--bg)',
                  border: `1px solid ${isFull ? 'rgba(201,168,76,0.4)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '10px 10px 9px',
                }}>
                  {/* Name row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <input
                      value={sideNames[table.id] ?? table.name}
                      onChange={e => setSideNames(n => ({ ...n, [table.id]: e.target.value }))}
                      onBlur={() => commitName(table.id)}
                      style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: "'Playfair Display',serif", fontSize: 13, fontWeight: 500, color: 'var(--text)', padding: 0, minWidth: 0 }}
                    />
                    {/* Shape toggle */}
                    <button
                      onClick={() => setProp(table.id, 'shape', shape === 'round' ? 'rectangular' : 'round')}
                      title={shape === 'round' ? 'Zu rechteckig wechseln' : 'Zu rund wechseln'}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', fontSize: 13, color: 'var(--text-dim)', flexShrink: 0, lineHeight: 1.4 }}
                    >
                      {shape === 'round' ? '●' : '▬'}
                    </button>
                    <button onClick={() => removeTable(table.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 2, flexShrink: 0 }}>
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {/* Dimension inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: shape === 'round' ? '1fr 1fr' : '1fr 1fr 1fr', gap: 4, marginBottom: 8 }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={subLabelStyle}>{shape === 'round' ? 'Ø (m)' : 'Länge (m)'}</p>
                      <input type="number" min={0.5} max={10} step={0.1} value={tl}
                        onChange={e => setProp(table.id, 'tableLength', parseFloat(e.target.value) || 0.5)}
                        style={numInputStyle}
                      />
                    </div>
                    {shape === 'rectangular' && (
                      <div style={{ textAlign: 'center' }}>
                        <p style={subLabelStyle}>Breite (m)</p>
                        <input type="number" min={0.3} max={5} step={0.1} value={tw}
                          onChange={e => setProp(table.id, 'tableWidth', parseFloat(e.target.value) || 0.3)}
                          style={numInputStyle}
                        />
                      </div>
                    )}
                    <div style={{ textAlign: 'center' }}>
                      <p style={subLabelStyle}>Plätze</p>
                      <input type="number" min={1} max={30} value={table.capacity}
                        onChange={e => setProp(table.id, 'capacity', parseInt(e.target.value) || 1)}
                        style={numInputStyle}
                      />
                    </div>
                  </div>

                  {/* Fill bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, fill)}%`, background: isFull ? 'var(--gold)' : 'rgba(201,168,76,0.5)', borderRadius: 100 }} />
                    </div>
                    <span style={{ fontSize: 10, color: isFull ? 'var(--gold)' : 'var(--text-dim)', flexShrink: 0 }}>{seated}/{table.capacity}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add table buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
            <button onClick={() => addTable('rectangular')} style={addBtnStyle}>
              <Plus size={11} /> Rechteckig
            </button>
            <button onClick={() => addTable('round')} style={addBtnStyle}>
              <Plus size={11} /> Rund
            </button>
          </div>

          {/* Brautpaar */}
          {couplePersons.length > 0 && (
            <>
              <p style={labelStyle}>Brautpaar</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                {couplePersons.map(p => {
                  const seated = assignedSet.has(p.id)
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px',
                      background: seated ? 'rgba(201,168,76,0.08)' : 'var(--bg)',
                      border: `1px solid ${seated ? 'rgba(201,168,76,0.5)' : 'var(--border)'}`,
                      borderRadius: 8,
                    }}>
                      <CoupleBadge name={p.name} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-mid)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      {seated && <span style={{ fontSize: 9, color: 'var(--gold)', fontWeight: 700 }}>✓</span>}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Unassigned guests */}
          {(unassigned.length > 0 || unassignedCompanions.length > 0) && (
            <>
              <p style={labelStyle}>Ohne Platz ({unassigned.length + unassignedCompanions.length})</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {unassigned.map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <InitialsBadge name={g.name} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-mid)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                  </div>
                ))}
                {unassignedCompanions.map(bp => (
                  <div key={bp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <InitialsBadge name={bp.name} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-mid)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {bp.name} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-dim)' }}>· {bp.hostName}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          {unassigned.length === 0 && unassignedCompanions.length === 0 && event.seatingTables.length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--gold)', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>Alle Gäste platziert ✓</p>
          )}
        </div>
      </aside>

      {/* ══ CANVAS ═══════════════════════════════════════════════════════ */}
      {/* Mobile sidebar toggle */}
      {isNarrow && (
        <button
          onClick={e => { e.stopPropagation(); setSidebarOpen(o => !o) }}
          style={{
            position: 'fixed', bottom: 24, right: 20, zIndex: 48,
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Tische & Raum bearbeiten"
        >
          <SlidersHorizontal size={18} color="var(--gold)" />
        </button>
      )}

      <div style={{ flex: 1, overflow: 'auto', background: 'var(--surface2)', position: 'relative' }}>

        {/* ── Too-small overlay ── */}
        {tooSmall && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'var(--surface2)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: 32, textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, lineHeight: 1 }}>🖥️</div>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>
              Bildschirm zu klein
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 240, lineHeight: 1.6 }}>
              Für den Sitzplan bitte ein größeres Gerät oder Querformat verwenden.
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', opacity: 0.6 }}>
              Raum: {roomL} m × {roomW} m
            </p>
          </div>
        )}

        <div style={{ padding: 40, minWidth: roomPxW + 80, minHeight: roomPxH + 80, boxSizing: 'border-box' }}>

          {/* Room */}
          <div style={{
            position: 'relative',
            width: roomPxW, height: roomPxH,
            background: 'var(--surface)',
            border: '1.5px solid var(--border2)',
            borderRadius: 4,
            boxShadow: '0 2px 20px rgba(0,0,0,0.07)',
            // Subtle grid
            backgroundImage: [
              'repeating-linear-gradient(0deg, transparent, transparent 71px, rgba(0,0,0,0.03) 72px)',
              'repeating-linear-gradient(90deg, transparent, transparent 71px, rgba(0,0,0,0.03) 72px)',
            ].join(','),
          }}>
            {/* Room scale label */}
            <span style={{ position: 'absolute', top: 8, left: 10, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)', userSelect: 'none', pointerEvents: 'none' }}>
              {roomL} m × {roomW} m
            </span>

            {/* Empty state */}
            {event.seatingTables.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
                <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--text-dim)' }}>Raum leer</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', opacity: 0.5 }}>Tische links hinzufügen</p>
              </div>
            )}

            {/* Tables */}
            {event.seatingTables.map(table => {
              const shape    = table.shape      ?? 'rectangular'
              const tl       = table.tableLength ?? 2.0
              const tw       = table.tableWidth  ?? 0.8
              const rotation = table.rotation   ?? 0
              const x        = table.x          ?? roomL / 2
              const y        = table.y          ?? roomW / 2

              const tableWpx = tl * scale
              const tableHpx = (shape === 'round' ? tl : tw) * scale
              const posLeft  = x * scale - tableWpx / 2
              const posTop   = y * scale - tableHpx / 2

              const seatPositions = computeSeats(shape, tableWpx, tableHpx, table.capacity)
              const seated        = table.guestIds.filter(Boolean).length
              const isFull        = seated >= table.capacity

              return (
                <div
                  key={table.id}
                  ref={el => { tableRefs.current[table.id] = el }}
                  onPointerDown={e => onTableDown(e, table.id)}
                  onPointerMove={onTableMove}
                  onPointerUp={onTableUp}
                  style={{
                    position:        'absolute',
                    left:            posLeft,
                    top:             posTop,
                    width:           tableWpx,
                    height:          tableHpx,
                    transform:       `rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    cursor:          'grab',
                    userSelect:      'none',
                    touchAction:     'none',
                    zIndex:          1,
                  }}
                >
                  {/* ── Table surface ── */}
                  <div style={{
                    position:     'absolute', inset: 0,
                    background:   'var(--gold-pale)',
                    borderRadius: shape === 'round' ? '50%' : 7,
                    border:       `1.5px solid ${isFull ? 'var(--gold)' : 'rgba(201,168,76,0.35)'}`,
                    boxShadow:    '0 2px 8px rgba(0,0,0,0.08)',
                    display:      'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex:       2,
                    pointerEvents: 'none',
                  }}>
                    <span style={{
                      fontSize: Math.max(9, Math.min(13, tableWpx / 14)),
                      fontFamily: "'Playfair Display',serif",
                      fontWeight: 500,
                      color: 'var(--text-mid)',
                      userSelect: 'none',
                      maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {sideNames[table.id] ?? table.name}
                    </span>
                  </div>

                  {/* ── Seats ── */}
                  {seatPositions.map((pos, i) => {
                    const guestId  = table.guestIds[i] ?? ''
                    const guest    = guestId ? guestById(guestId) : null
                    const isCouple = guestId === 'couple-1' || guestId === 'couple-2'
                    return (
                      <div key={i}
                        style={{
                          position:     'absolute',
                          left:         `calc(50% + ${pos.x - SEAT_R}px)`,
                          top:          `calc(50% + ${pos.y - SEAT_R}px)`,
                          width:        SEAT_R * 2, height: SEAT_R * 2,
                          borderRadius: '50%',
                          background:   guest ? (isCouple ? 'rgba(201,168,76,0.22)' : 'var(--gold-pale)') : 'var(--surface)',
                          border:       guest
                            ? `${isCouple ? '2px' : '1.5px'} solid var(--gold)`
                            : '1.5px dashed var(--border2)',
                          display:      'flex', alignItems: 'center', justifyContent: 'center',
                          cursor:       'pointer',
                          zIndex:       3,
                          boxShadow:    isCouple ? '0 0 0 2px rgba(201,168,76,0.2), 0 1px 3px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.08)',
                          transition:   'background 0.12s, border-color 0.12s',
                        }}
                        onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
                        onClick={e => onSeatClick(table.id, i, e)}
                        title={guest ? `${guest.name} — klicken zum Entfernen` : 'Leer — klicken zum Zuweisen'}
                        onMouseEnter={e => {
                          if (guest) return
                          const el = e.currentTarget as HTMLDivElement
                          el.style.background = 'var(--gold-pale2)'
                          el.style.borderColor = 'var(--gold)'
                        }}
                        onMouseLeave={e => {
                          const el = e.currentTarget as HTMLDivElement
                          el.style.background = guest ? (isCouple ? 'rgba(201,168,76,0.22)' : 'var(--gold-pale)') : 'var(--surface)'
                          el.style.borderColor = guest ? 'var(--gold)' : 'var(--border2)'
                        }}
                      >
                        {guest && (
                          <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--gold)', userSelect: 'none', letterSpacing: '0.02em' }}>
                            {guest.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        )}
                      </div>
                    )
                  })}

                  {/* ── Rotation handle ── */}
                  <div
                    style={{
                      position:  'absolute',
                      top:       -(SEAT_R + SEAT_GAP + 26),
                      left:      '50%',
                      transform: 'translateX(-50%)',
                      width:     20, height: 20,
                      borderRadius: '50%',
                      border:    '1.5px solid rgba(201,168,76,0.5)',
                      background: 'var(--surface)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                      cursor:    'grab',
                      zIndex:    4,
                      display:   'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    onPointerDown={e => onRotateDown(e, table.id)}
                    onPointerMove={onRotateMove}
                    onPointerUp={onRotateUp}
                    title="Tisch drehen"
                  >
                    <RefreshCw size={10} color="var(--gold)" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══ SEAT POPUP ════════════════════════════════════════════════════ */}
      {seatPopup && (() => {
        const q = popupSearch.toLowerCase()
        const filteredCouple     = unassignedCouple.filter(p => p.name.toLowerCase().includes(q))
        const filteredGuests     = unassigned.filter(g => g.name.toLowerCase().includes(q))
        const filteredCompanions = unassignedCompanions.filter(bp => bp.name.toLowerCase().includes(q) || bp.hostName.toLowerCase().includes(q))
        const hasResults = filteredCouple.length > 0 || filteredGuests.length > 0 || filteredCompanions.length > 0
        return (
          <div onClick={e => e.stopPropagation()} style={{
            position:     'fixed',
            left:         Math.min(seatPopup.x + 12, (typeof window !== 'undefined' ? window.innerWidth : 800) - 216),
            top:          Math.min(seatPopup.y + 12, (typeof window !== 'undefined' ? window.innerHeight : 600) - 340),
            width:        204,
            background:   'var(--surface)',
            border:       '1px solid var(--border)',
            borderRadius: 10,
            boxShadow:    '0 10px 30px rgba(0,0,0,0.5)',
            zIndex:       200,
            display:      'flex',
            flexDirection:'column',
            maxHeight:    320,
            overflow:     'hidden',
          }}>
            {/* Header + search — non-scrolling */}
            <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 6 }}>Gast zuweisen</p>
              <input
                autoFocus
                type="text"
                placeholder="Suchen…"
                value={popupSearch}
                onChange={e => setPopupSearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '5px 8px', fontSize: 12,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text)', fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>

            {/* Scrollable list */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '6px 10px' }}>
              {filteredCouple.length > 0 && (
                <>
                  <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gold)', marginBottom: 4 }}>Brautpaar</p>
                  {filteredCouple.map(p => (
                    <button key={p.id}
                      onClick={() => assignToSeat(seatPopup.tableId, seatPopup.seatIndex, p.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                    >
                      <CoupleBadge name={p.name} />
                      <span style={{ fontSize: 12, color: 'var(--text)' }}>{p.name}</span>
                    </button>
                  ))}
                  {filteredGuests.length > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />}
                </>
              )}
              {filteredGuests.map(g => (
                <button key={g.id}
                  onClick={() => assignToSeat(seatPopup.tableId, seatPopup.seatIndex, g.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                >
                  <InitialsBadge name={g.name} />
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{g.name}</span>
                </button>
              ))}
              {filteredCompanions.length > 0 && (
                <>
                  {(filteredCouple.length > 0 || filteredGuests.length > 0) && <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />}
                  <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Begleitpersonen</p>
                  {filteredCompanions.map(bp => (
                    <button key={bp.id}
                      onClick={() => assignToSeat(seatPopup.tableId, seatPopup.seatIndex, bp.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                    >
                      <InitialsBadge name={bp.name} />
                      <div>
                        <span style={{ fontSize: 12, color: 'var(--text)', display: 'block' }}>{bp.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>mit {bp.hostName}</span>
                      </div>
                    </button>
                  ))}
                </>
              )}
              {!hasResults && (
                <p style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', padding: '4px 0' }}>
                  {unassigned.length === 0 && unassignedCouple.length === 0 && unassignedCompanions.length === 0 ? 'Alle Gäste platziert' : 'Keine Treffer'}
                </p>
              )}
            </div>

            {/* Footer — non-scrolling */}
            <div style={{ borderTop: '1px solid var(--border)', padding: '6px 10px' }}>
              <button onClick={closePopup} style={{ width: '100%', padding: '4px', fontSize: 10, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Abbrechen
              </button>
            </div>
          </div>
        )
      })()}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

// ── Small reusable pieces ──────────────────────────────────────────────────
function CoupleBadge({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('')
  return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(201,168,76,0.15)', border: '1.5px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--gold)' }}>{initials}</span>
    </div>
  )
}

function InitialsBadge({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('')
  return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--gold-pale)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--gold)' }}>{initials}</span>
    </div>
  )
}

// ── Shared micro-styles ────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.12em', color: 'var(--text-dim)',
  marginBottom: 8, paddingLeft: 2,
}
const subLabelStyle: React.CSSProperties = {
  fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 3,
}
const numInputStyle: React.CSSProperties = {
  width: '100%', textAlign: 'center', padding: '5px 2px',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 6, fontSize: 12, color: 'var(--text)',
  fontFamily: 'inherit', outline: 'none',
}
const addBtnStyle: React.CSSProperties = {
  padding: '8px 4px', borderRadius: 8,
  border: '1px dashed var(--border)', background: 'none',
  fontSize: 10, fontWeight: 600, color: 'var(--text-dim)',
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
}
