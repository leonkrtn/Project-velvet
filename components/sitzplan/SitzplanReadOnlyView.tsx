'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RaumPoint, RaumElement } from '@/components/room/RaumKonfigurator'

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_W = 560
const CANVAS_H = 400
const PAD = 2.0
const CHAIR_PAD = 0.5
const GRID_SIZE = 0.5
const HIDDEN_ELEM_TYPES = new Set(['strom', 'wasser', 'netzwerk'])

const ELEM_STYLE: Record<string, { fill: string; stroke: string; label: string }> = {
  heizung:    { fill: '#FFF7ED', stroke: '#F97316', label: 'Heizung' },
  saeule:     { fill: '#D1D5DB', stroke: '#374151', label: 'Säule' },
  tuer:       { fill: '#FEF9C3', stroke: '#CA8A04', label: 'Tür' },
  fenster:    { fill: '#DBEAFE', stroke: '#3B82F6', label: 'Fenster' },
  notausgang: { fill: '#DCFCE7', stroke: '#16A34A', label: 'Notausgang' },
  treppe:     { fill: '#F3F4F6', stroke: '#6B7280', label: 'Treppe' },
  buehne:     { fill: '#FAF5FF', stroke: '#9333EA', label: 'Bühne' },
  pflanze:    { fill: '#DCFCE7', stroke: '#22C55E', label: 'Pflanze' },
  baum:       { fill: '#DCFCE7', stroke: '#15803D', label: 'Baum' },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SitzTable {
  id: string; name: string
  shape: 'round' | 'rectangular'
  pos_x: number; pos_y: number; rotation: number
  table_length: number; table_width: number; capacity: number
}

interface SitzAssignment {
  id: string; table_id: string
  guest_id: string | null
  begleitperson_id: string | null
  brautpaar_slot: 1 | 2 | null
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

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

function coupleNames(name?: string): [string, string] {
  if (!name) return ['Partner 1', 'Partner 2']
  const parts = name.split(/[&+,]/).map(s => s.trim()).filter(Boolean)
  return [parts[0] ?? 'Partner 1', parts[1] ?? 'Partner 2']
}

interface ElemGroup { type: string; minX: number; minY: number; maxX: number; maxY: number }

function groupElements(elements: RaumElement[]): ElemGroup[] {
  const visible = elements.filter(e => !HIDDEN_ELEM_TYPES.has(e.type))
  const visited = new Set<string>()
  const key = (x: number, y: number) => `${Math.round(x * 100)}_${Math.round(y * 100)}`
  const byPos: Record<string, RaumElement> = {}
  visible.forEach(e => { byPos[key(e.x, e.y)] = e })
  const groups: ElemGroup[] = []
  for (const el of visible) {
    const k = key(el.x, el.y)
    if (visited.has(k)) continue
    const cells: RaumElement[] = []
    const queue = [el]; visited.add(k)
    while (queue.length) {
      const cur = queue.shift()!; cells.push(cur)
      const neighbors = [
        byPos[key(cur.x + GRID_SIZE, cur.y)], byPos[key(cur.x - GRID_SIZE, cur.y)],
        byPos[key(cur.x, cur.y + GRID_SIZE)], byPos[key(cur.x, cur.y - GRID_SIZE)],
      ]
      for (const nb of neighbors) {
        if (nb && nb.type === el.type && !visited.has(key(nb.x, nb.y))) {
          visited.add(key(nb.x, nb.y)); queue.push(nb)
        }
      }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    cells.forEach(c => { minX = Math.min(minX, c.x); minY = Math.min(minY, c.y); maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y) })
    groups.push({ type: el.type, minX, minY, maxX, maxY })
  }
  return groups
}

// ── Static table shape (no mouse handlers) ────────────────────────────────────

function TableShapeRO({ table, scale, offX, offY }: {
  table: SitzTable; scale: number; offX: number; offY: number
}) {
  const cx = table.pos_x * scale + offX
  const cy = table.pos_y * scale + offY
  const len = table.table_length * scale
  const wid = (table.shape === 'round' ? table.table_length : table.table_width) * scale
  const chairLen = (table.table_length + CHAIR_PAD * 2) * scale
  const chairWid = ((table.shape === 'round' ? table.table_length : table.table_width) + CHAIR_PAD * 2) * scale

  return (
    <g transform={`rotate(${table.rotation}, ${cx}, ${cy})`} style={{ pointerEvents: 'none' }}>
      {table.shape === 'round' ? (
        <ellipse cx={cx} cy={cy} rx={chairLen / 2} ry={chairLen / 2}
          fill="none" stroke="#AEAEB2" strokeWidth={1} strokeDasharray="4 3" />
      ) : (
        <rect x={cx - chairLen / 2} y={cy - chairWid / 2} width={chairLen} height={chairWid} rx={6}
          fill="none" stroke="#AEAEB2" strokeWidth={1} strokeDasharray="4 3" />
      )}
      {table.shape === 'round' ? (
        <ellipse cx={cx} cy={cy} rx={len / 2} ry={len / 2}
          fill="#F5F5F7" stroke="#1D1D1F" strokeWidth={1.5} />
      ) : (
        <rect x={cx - len / 2} y={cy - wid / 2} width={len} height={wid} rx={4}
          fill="#F5F5F7" stroke="#1D1D1F" strokeWidth={1.5} />
      )}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontSize={Math.max(9, Math.min(13, len * 0.14))}
        fontFamily="-apple-system,Helvetica,sans-serif" fontWeight="600" fill="#1D1D1F"
        style={{ userSelect: 'none' }}>
        {table.name}
      </text>
    </g>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SitzplanReadOnlyView({ eventId }: { eventId: string }) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [roomPoints, setRoomPoints] = useState<RaumPoint[]>([])
  const [roomElements, setRoomElements] = useState<RaumElement[]>([])
  const [tables, setTables] = useState<SitzTable[]>([])
  const [assignments, setAssignments] = useState<SitzAssignment[]>([])
  const [guests, setGuests] = useState<{ id: string; name: string }[]>([])
  const [begleit, setBegleit] = useState<{ id: string; name: string; guest_id: string; guest_name: string }[]>([])
  const [coupleName, setCoupleName] = useState('')
  const [hasGaesteliste, setHasGaesteliste] = useState(false)

  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panState = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null)

  const { scale: baseScale, offX: baseOffX, offY: baseOffY } = computeScale(roomPoints)
  const scale = baseScale * zoom
  const offX = baseOffX * zoom + pan.x
  const offY = baseOffY * zoom + pan.y

  const [partner1, partner2] = coupleNames(coupleName)
  const elemGroups = groupElements(roomElements)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: eventData } = await supabase
          .from('events').select('created_by, couple_name').eq('id', eventId).single()
        const organizerUserId = eventData?.created_by

        const [
          { data: globalRow },
          { data: evConfigRow },
          { data: tablesData },
          { data: assignmentsData },
          { data: guestsData },
          { data: begleitData },
          { data: gaestePerm },
        ] = await Promise.all([
          organizerUserId
            ? supabase.from('organizer_room_configs').select('points, elements').eq('user_id', organizerUserId).single()
            : Promise.resolve({ data: null }),
          supabase.from('event_room_configs').select('points, elements').eq('event_id', eventId).single(),
          supabase.from('seating_tables').select('*').eq('event_id', eventId).order('created_at'),
          supabase.from('seating_assignments').select('*').eq('event_id', eventId),
          supabase.from('guests').select('id, name').eq('event_id', eventId).order('name'),
          supabase.from('begleitpersonen')
            .select('id, name, guest_id, guests!inner(name)')
            .eq('guests.event_id', eventId)
            .order('name'),
          supabase.from('dienstleister_permissions')
            .select('access')
            .eq('event_id', eventId)
            .eq('dienstleister_user_id', user.id)
            .eq('tab_key', 'gaesteliste')
            .is('item_id', null)
            .maybeSingle(),
        ])

        setRoomPoints(evConfigRow?.points ?? globalRow?.points ?? [])
        setRoomElements(evConfigRow?.elements ?? globalRow?.elements ?? [])
        setCoupleName(eventData?.couple_name ?? '')
        setTables(tablesData ?? [])
        setAssignments(assignmentsData ?? [])
        setGuests(guestsData ?? [])
        setBegleit(
          (begleitData ?? []).map((b: { id: string; name: string; guest_id: string; guests: { name: string } | { name: string }[] }) => ({
            id: b.id, name: b.name, guest_id: b.guest_id,
            guest_name: Array.isArray(b.guests) ? (b.guests[0]?.name ?? '') : ((b.guests as { name: string })?.name ?? ''),
          }))
        )
        setHasGaesteliste((gaestePerm?.access ?? 'none') !== 'none')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventId]) // eslint-disable-line

  // ── Pan / zoom ──────────────────────────────────────────────────────────────

  const onSvgMouseDown = (e: React.MouseEvent) => {
    panState.current = { startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y }
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!panState.current) return
      setPan({ x: panState.current.startPanX + e.clientX - panState.current.startX, y: panState.current.startPanY + e.clientY - panState.current.startY })
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

  // ── Person resolver ─────────────────────────────────────────────────────────

  function personInfo(a: SitzAssignment): { name: string; subtitle: string; isGuest: boolean; isBrautpaar: boolean } {
    if (a.guest_id) {
      return { name: guests.find(g => g.id === a.guest_id)?.name ?? '–', subtitle: 'Gast', isGuest: true, isBrautpaar: false }
    }
    if (a.begleitperson_id) {
      const b = begleit.find(b => b.id === a.begleitperson_id)
      return { name: b?.name ?? '–', subtitle: b ? `Begl. von ${b.guest_name}` : '', isGuest: false, isBrautpaar: false }
    }
    return {
      name: a.brautpaar_slot === 1 ? partner1 : partner2,
      subtitle: 'Brautpaar', isGuest: false, isBrautpaar: true,
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ height: 400, borderRadius: 'var(--radius)', background: 'var(--surface)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )

  // Legend: unique element types in the room
  const legendEntries: [string, { fill: string; stroke: string; label: string }][] = []
  const seenTypes = new Set<string>()
  for (const g of elemGroups) {
    if (!seenTypes.has(g.type) && ELEM_STYLE[g.type]) {
      seenTypes.add(g.type)
      legendEntries.push([g.type, ELEM_STYLE[g.type]])
    }
  }

  const noRoom = roomPoints.length < 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 4 }}>Sitzplan</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
          {tables.length} Tische · {assignments.length} Personen platziert
        </p>
      </div>

      {noRoom ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>Kein Raum konfiguriert</p>
          <p style={{ fontSize: 13 }}>Der Veranstalter hat noch keinen Raum eingerichtet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* ── SVG Canvas ── */}
          <div style={{ flex: '1 1 480px', minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 500 }}>Grafische Ansicht</span>
              <button
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
                Ansicht zurücksetzen
              </button>
            </div>

            {/* SVG */}
            <div style={{ background: '#F5F5F7', overflowX: 'auto' }}>
              <svg
                ref={svgRef}
                width={CANVAS_W} height={CANVAS_H}
                style={{ display: 'block', cursor: 'grab' }}
                onMouseDown={onSvgMouseDown}
                onWheel={onWheel}>

                {/* Room polygon */}
                <polygon
                  points={roomPoints.map(p => { const c = m2px(p.x, p.y, scale, offX, offY); return `${c.x},${c.y}` }).join(' ')}
                  fill="rgba(29,29,31,0.04)" stroke="#1D1D1F" strokeWidth="2"
                />

                {/* Room elements */}
                {elemGroups.map((group, gi) => {
                  const st = ELEM_STYLE[group.type]; if (!st) return null
                  const tl = m2px(group.minX, group.minY, scale, offX, offY)
                  const br = m2px(group.maxX + GRID_SIZE, group.maxY + GRID_SIZE, scale, offX, offY)
                  return (
                    <rect key={gi} x={tl.x} y={tl.y} width={br.x - tl.x} height={br.y - tl.y} rx={3}
                      fill={st.fill} stroke={st.stroke} strokeWidth={1.2} />
                  )
                })}

                {/* Tables */}
                {tables.map(t => (
                  <TableShapeRO key={t.id} table={t} scale={scale} offX={offX} offY={offY} />
                ))}
              </svg>
            </div>

            {/* Legend */}
            {legendEntries.length > 0 && (
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px' }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)' }}>Legende</span>
                {legendEntries.map(([type, st]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: st!.fill, border: `1.5px solid ${st!.stroke}`, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{st!.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Hint */}
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              Ziehen = verschieben · Scroll = zoom
            </div>
          </div>

          {/* ── Table cards list ── */}
          <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tables.length === 0 ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '28px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                Noch keine Tische angelegt.
              </div>
            ) : tables.map(table => {
              const tas = assignments.filter(a => a.table_id === table.id)
              const isFull = tas.length >= table.capacity
              return (
                <div key={table.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  {/* Card header */}
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: tas.length > 0 ? '1px solid var(--border)' : 'none', background: '#F9F9FB' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{table.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: isFull ? '#FDEAEA' : '#F0F0F5', color: isFull ? '#A04040' : 'var(--text-tertiary)' }}>
                      {tas.length}/{table.capacity}
                    </span>
                  </div>

                  {/* Person list */}
                  {tas.length === 0 ? (
                    <div style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Noch niemand zugeordnet</span>
                    </div>
                  ) : (
                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {tas.map(a => {
                        const info = personInfo(a)
                        return (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            {/* indicator */}
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                              background: info.isBrautpaar ? '#F59E0B' : info.isGuest ? '#6366F1' : '#AEAEB2',
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {info.isGuest && hasGaesteliste ? (
                                <a
                                  href={`/vendor/dashboard/${eventId}/gaesteliste`}
                                  style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                                  {info.name}
                                </a>
                              ) : (
                                <span style={{ fontSize: 13, fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.name}</span>
                              )}
                              {info.subtitle && (
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{info.subtitle}</span>
                              )}
                            </div>
                            {info.isBrautpaar && (
                              <span style={{ flexShrink: 0, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#FEF9C3', color: '#B45309', fontWeight: 600 }}>
                                Brautpaar
                              </span>
                            )}
                            {info.isGuest && hasGaesteliste && (
                              <a
                                href={`/vendor/dashboard/${eventId}/gaesteliste`}
                                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)', textDecoration: 'none', marginTop: 2 }}
                                title="Zur Gästeliste"
                                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text)')}
                                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-tertiary)')}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
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
