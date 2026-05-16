'use client'
import React, { useRef, useState, useEffect, useCallback } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────
export const HOUR_HEIGHT = 80   // px per hour
const SNAP_MIN          = 15   // minute snap grid
const DRAG_THRESHOLD_PX = 6    // min pixels movement before "drag" starts

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CalendarEntry {
  id: string
  title: string | null
  location: string | null
  start_minutes: number | null
  duration_minutes: number | null
  category: string | null
  day_index: number
  checklist: { text: string; done: boolean }[]
}

interface LayoutEntry extends CalendarEntry {
  top: number
  height: number
  left: string
  width: string
}

type DragState =
  | { type: 'create'; startMin: number; endMin: number; movedEnough: boolean }
  | { type: 'move';   entryId: string; offsetMin: number; currentMin: number; movedEnough: boolean }

// ─── Colors ───────────────────────────────────────────────────────────────────
export const CATEGORY_COLORS: Record<string, string> = {
  Zeremonie: '#AF52DE',
  Empfang:   '#FF9500',
  Feier:     '#007AFF',
  Logistik:  '#34C759',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function snap(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN
}

// Convert stored start_minutes to display minutes.
// Events stored before midnight (start_minutes < startHour*60) but visible in
// an overnight window (end_hour > 24) are shifted +24h for layout purposes.
function toDisplayMin(storedMin: number, startHour: number, endHour: number): number {
  if (endHour > 24 && storedMin < (endHour - 24) * 60 && storedMin < startHour * 60) {
    return storedMin + 24 * 60
  }
  return storedMin
}

// Convert display minutes back to stored minutes (inverse of above).
function toStoredMin(displayMin: number): number {
  return displayMin >= 24 * 60 ? displayMin - 24 * 60 : displayMin
}

function formatMin(m: number): string {
  const h   = Math.floor(m / 60) % 24
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function formatHourLabel(h: number): string {
  const hour = h >= 24 ? h - 24 : h
  return `${String(hour).padStart(2, '0')}:00`
}

// ─── Overlap layout ───────────────────────────────────────────────────────────
// Groups overlapping events and assigns columns (Apple Calendar style).
function buildLayout(
  entries: CalendarEntry[],
  startHour: number,
  endHour: number,
  movingId?: string,
  movingMin?: number,
): LayoutEntry[] {
  const totalStart = startHour * 60
  const totalEnd   = endHour   * 60

  // Only show entries with valid times
  const visible = entries.filter(e => e.start_minutes != null).map(e => {
    const dm = movingId === e.id && movingMin != null
      ? movingMin
      : toDisplayMin(e.start_minutes!, startHour, endHour)
    return { entry: e, dm }
  }).filter(({ dm, entry }) => {
    const end = dm + (entry.duration_minutes ?? 60)
    return dm < totalEnd && end > totalStart
  })

  // Sort by display start
  visible.sort((a, b) => a.dm - b.dm)

  if (visible.length === 0) return []

  // Group overlapping entries
  type Group = { items: typeof visible; maxEnd: number }
  const groups: Group[] = []
  let cur: Group = { items: [visible[0]], maxEnd: visible[0].dm + (visible[0].entry.duration_minutes ?? 60) }

  for (let i = 1; i < visible.length; i++) {
    const { dm, entry } = visible[i]
    const end = dm + (entry.duration_minutes ?? 60)
    if (dm < cur.maxEnd) {
      cur.items.push(visible[i])
      cur.maxEnd = Math.max(cur.maxEnd, end)
    } else {
      groups.push(cur)
      cur = { items: [visible[i]], maxEnd: end }
    }
  }
  groups.push(cur)

  // Assign columns with greedy interval coloring
  const result: LayoutEntry[] = []
  for (const grp of groups) {
    const colEnds: number[] = []
    const colAssign: number[] = []

    for (const { entry, dm } of grp.items) {
      const end = dm + (entry.duration_minutes ?? 60)
      let col = colEnds.findIndex(e => e <= dm)
      if (col === -1) { col = colEnds.length; colEnds.push(0) }
      colEnds[col] = end
      colAssign.push(col)
    }

    const numCols = colEnds.length
    grp.items.forEach(({ entry, dm }, i) => {
      const col = colAssign[i]
      const topPx  = (dm - totalStart) * (HOUR_HEIGHT / 60)
      const durMin = entry.duration_minutes ?? 60
      const hPx    = Math.max(durMin * (HOUR_HEIGHT / 60), 24)
      const GAP    = 2
      result.push({
        ...entry,
        top:    topPx,
        height: hPx,
        left:   `calc(${(col / numCols) * 100}% + ${GAP}px)`,
        width:  `calc(${(1 / numCols) * 100}% - ${GAP * 2}px)`,
      })
    })
  }

  return result
}

// ─── Current-time indicator ───────────────────────────────────────────────────
function NowLine({ startHour, endHour }: { startHour: number; endHour: number }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const curMin = now.getHours() * 60 + now.getMinutes()
  const dispMin = toDisplayMin(curMin, startHour, endHour)
  const totalStart = startHour * 60
  const totalEnd   = endHour   * 60
  if (dispMin < totalStart || dispMin >= totalEnd) return null

  const top = (dispMin - totalStart) * (HOUR_HEIGHT / 60)
  return (
    <div style={{ position: 'absolute', top, left: 0, right: 0, pointerEvents: 'none', zIndex: 20 }}>
      <div style={{ position: 'absolute', left: -5, top: -4, width: 10, height: 10, borderRadius: '50%', background: '#FF3B30' }} />
      <div style={{ marginLeft: 5, height: 2, background: '#FF3B30' }} />
    </div>
  )
}

// ─── Single event block ───────────────────────────────────────────────────────
interface BlockProps {
  item: LayoutEntry
  isDragging: boolean
  readOnly: boolean
  'data-entry-id': string
}

const EventBlock = React.memo(function EventBlock({ item, isDragging, readOnly }: BlockProps) {
  const color   = CATEGORY_COLORS[item.category ?? ''] ?? '#888'
  const checked = (item.checklist ?? []).filter(c => c.done).length
  const total   = (item.checklist ?? []).length
  const h       = item.height

  return (
    <div
      data-entry-id={item.id}
      style={{
        position:    'absolute',
        top:         item.top,
        height:      item.height,
        left:        item.left,
        width:       item.width,
        background:  color + '1A',
        borderLeft:  `3px solid ${color}`,
        borderRadius: 6,
        padding:     '4px 8px',
        cursor:      readOnly ? 'default' : isDragging ? 'grabbing' : 'grab',
        overflow:    'hidden',
        opacity:     isDragging ? 0.6 : 1,
        boxSizing:   'border-box',
        userSelect:  'none',
        zIndex:      isDragging ? 15 : 5,
        transition:  isDragging ? 'none' : 'opacity 0.1s',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.title ?? 'Unbenannt'}
      </div>
      {h >= 38 && (
        <div style={{ fontSize: 10.5, color: color + 'CC', marginTop: 1 }}>
          {formatMin(item.start_minutes ?? 0)}
          {item.duration_minutes ? ` · ${item.duration_minutes} min` : ''}
        </div>
      )}
      {h >= 52 && item.location && (
        <div style={{ fontSize: 10, color: color + '99', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📍 {item.location}
        </div>
      )}
      {h >= 62 && total > 0 && (
        <div style={{ fontSize: 10, color: color + '80', marginTop: 1 }}>
          ✓ {checked}/{total}
        </div>
      )}
    </div>
  )
})

// ─── Main DayCalendar ─────────────────────────────────────────────────────────
export interface DayCalendarProps {
  entries: CalendarEntry[]
  startHour: number
  endHour: number
  readOnly?: boolean
  onEventClick:   (entry: CalendarEntry) => void
  onEmptyClick:   (startMinutes: number) => void
  onDragCreate:   (startMinutes: number, duration: number) => void
  onEventMove:    (id: string, newStartMinutes: number) => void
}

export default function DayCalendar({
  entries,
  startHour,
  endHour,
  readOnly,
  onEventClick,
  onEmptyClick,
  onDragCreate,
  onEventMove,
}: DayCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef      = useRef<DragState | null>(null)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)

  const totalHours  = endHour - startHour
  const totalHeight = totalHours * HOUR_HEIGHT
  const hours       = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i)

  // Keep dragRef in sync with dragState for handlers
  useEffect(() => { dragRef.current = dragState }, [dragState])

  function getMinFromClientY(clientY: number): number {
    const rect   = containerRef.current!.getBoundingClientRect()
    const relY   = clientY - rect.top
    const rawMin = (relY / HOUR_HEIGHT) * 60 + startHour * 60
    return snap(Math.max(startHour * 60, Math.min(rawMin, endHour * 60 - SNAP_MIN)))
  }

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly) return

    pointerDownPos.current = { x: e.clientX, y: e.clientY }

    // Check if we clicked directly on an event block
    const target     = e.target as HTMLElement
    const blockEl    = target.closest('[data-entry-id]') as HTMLElement | null
    const entryId    = blockEl?.dataset.entryId

    if (entryId) {
      // Drag-to-move
      const blockRect  = blockEl!.getBoundingClientRect()
      const offsetY    = e.clientY - blockRect.top
      const offsetMin  = (offsetY / HOUR_HEIGHT) * 60
      const entry      = entries.find(x => x.id === entryId)
      if (!entry || entry.start_minutes == null) return
      const displayStart = toDisplayMin(entry.start_minutes, startHour, endHour)
      const newState: DragState = {
        type: 'move', entryId, offsetMin, currentMin: displayStart, movedEnough: false,
      }
      setDragState(newState)
    } else {
      // Drag-to-create on empty grid
      const startMin = getMinFromClientY(e.clientY)
      const newState: DragState = {
        type: 'create', startMin, endMin: startMin + 60, movedEnough: false,
      }
      setDragState(newState)
    }

    containerRef.current!.setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [readOnly, entries, startHour, endHour])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragRef.current
    if (!ds || !pointerDownPos.current) return

    const dx = Math.abs(e.clientX - pointerDownPos.current.x)
    const dy = Math.abs(e.clientY - pointerDownPos.current.y)
    const movedEnough = dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX

    if (ds.type === 'create') {
      const curMin = getMinFromClientY(e.clientY)
      const endMin = Math.max(curMin, ds.startMin + SNAP_MIN)
      setDragState({ ...ds, endMin, movedEnough })
    } else {
      const rawMin  = getMinFromClientY(e.clientY) - ds.offsetMin
      const clamped = Math.max(startHour * 60, Math.min(snap(rawMin), endHour * 60 - SNAP_MIN))
      setDragState({ ...ds, currentMin: clamped, movedEnough })
    }
  }, [startHour, endHour])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragRef.current
    setDragState(null)
    pointerDownPos.current = null

    if (!ds) return

    if (ds.type === 'create') {
      if (ds.movedEnough) {
        onDragCreate(toStoredMin(ds.startMin), ds.endMin - ds.startMin)
      } else {
        onEmptyClick(toStoredMin(ds.startMin))
      }
    } else if (ds.type === 'move' && ds.movedEnough) {
      onEventMove(ds.entryId, toStoredMin(ds.currentMin))
    }
  }, [onDragCreate, onEmptyClick, onEventMove])

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle event-block clicks (grid clicks handled by pointerup)
    const target  = e.target as HTMLElement
    const blockEl = target.closest('[data-entry-id]') as HTMLElement | null
    if (!blockEl) return
    const entryId = blockEl.dataset.entryId
    const entry   = entries.find(x => x.id === entryId)
    if (entry) onEventClick(entry)
  }, [entries, onEventClick])

  // Build layout — if dragging a move, show at current position
  const movingId  = dragState?.type === 'move' ? dragState.entryId  : undefined
  const movingMin = dragState?.type === 'move' ? dragState.currentMin : undefined
  const layout    = buildLayout(entries, startHour, endHour, movingId, movingMin)

  // Drag-create ghost bounds
  const ghostTop    = dragState?.type === 'create' && dragState.movedEnough
    ? (dragState.startMin - startHour * 60) * (HOUR_HEIGHT / 60) : null
  const ghostHeight = dragState?.type === 'create' && dragState.movedEnough
    ? (dragState.endMin - dragState.startMin) * (HOUR_HEIGHT / 60) : null

  return (
    <div style={{ display: 'flex', minHeight: totalHeight }}>
      {/* ── Hour labels ── */}
      <div style={{ width: 52, flexShrink: 0, position: 'relative', height: totalHeight, pointerEvents: 'none' }}>
        {hours.map(h => (
          <div
            key={h}
            style={{
              position: 'absolute',
              top:      (h - startHour) * HOUR_HEIGHT - 8,
              right:    8,
              fontSize: 11,
              fontWeight: 500,
              color:    'var(--text-tertiary)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {formatHourLabel(h)}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div
        ref={containerRef}
        style={{
          flex:     1,
          position: 'relative',
          height:   totalHeight,
          borderLeft: '1px solid var(--border)',
          cursor:   readOnly ? 'default' : 'crosshair',
          userSelect: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDragState(null)}
        onClick={handleClick}
      >
        {/* Hour lines */}
        {hours.map(h => (
          <div
            key={h}
            style={{
              position:   'absolute',
              top:        (h - startHour) * HOUR_HEIGHT,
              left:       0, right: 0,
              borderTop:  '1px solid var(--border)',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Half-hour lines */}
        {hours.slice(0, -1).map(h => (
          <div
            key={`${h}h`}
            style={{
              position:   'absolute',
              top:        (h - startHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2,
              left:       0, right: 0,
              borderTop:  '1px dashed',
              borderColor: 'color-mix(in srgb, var(--border) 60%, transparent)',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Event blocks */}
        {layout.map(item => (
          <EventBlock
            key={item.id}
            item={item}
            isDragging={movingId === item.id}
            readOnly={!!readOnly}
            data-entry-id={item.id}
          />
        ))}

        {/* Drag-create ghost */}
        {ghostTop !== null && ghostHeight !== null && dragState?.type === 'create' && (
          <div
            style={{
              position:     'absolute',
              top:          ghostTop,
              height:       Math.max(ghostHeight, HOUR_HEIGHT / 4),
              left:         4,
              right:        4,
              background:   'var(--accent)',
              opacity:      0.18,
              borderRadius: 6,
              border:       '2px dashed var(--accent)',
              pointerEvents: 'none',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              zIndex:       10,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, opacity: 1 / 0.18 }}>
              {formatMin(dragState.startMin)} – {formatMin(dragState.endMin)}
            </span>
          </div>
        )}

        {/* Current-time indicator */}
        <NowLine startHour={startHour} endHour={endHour} />
      </div>
    </div>
  )
}
