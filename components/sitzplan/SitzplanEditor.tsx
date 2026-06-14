'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RaumPoint, RaumElement, RaumTablePool, RaumTableType } from '@/components/room/RaumKonfigurator'

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
  pool_type_id: string | null
}

interface SitzAssignment {
  id: string
  table_id: string
  event_id: string
  guest_id: string | null
  begleitperson_id: string | null
  brautpaar_slot: 1 | 2 | null
  seat_index: number | null
}

interface GuestFull {
  id: string
  event_id: string
  name: string
  email: string | null
  status: string
  phone: string | null
  address: string | null
  trink_alkohol: boolean | null
  meal_choice: string | null
  allergy_tags: string[] | null
  allergy_custom: string | null
  side: string | null
  arrival_date: string | null
  arrival_time: string | null
  departure_date: string | null
  transport_mode: string | null
  message: string | null
  notes: string | null
  responded_at: string | null
}

interface BegleitFull {
  id: string
  guest_id: string
  name: string
  age_category: string | null
  trink_alkohol: boolean | null
  meal_choice: string | null
  allergy_tags: string[] | null
  allergy_custom: string | null
  guest_name: string
}

type LightboxEntry =
  | { type: 'guest'; data: GuestFull }
  | { type: 'begleit'; data: BegleitFull }

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
  roomElements?: RaumElement[]
  tablePool: RaumTablePool
  coupleName?: string
  /** Einfacher Modus ohne konkreten Raumplan (Solo-Paare): die übergebenen
      roomPoints sind eine synthetische Standard-Fläche, die nur als dezente
      gestrichelte Begrenzung gezeichnet wird; Tische entstehen per
      Schnell-Anlage (Form + Plätze) statt aus dem Tisch-Pool. */
  simpleMode?: boolean
}

// ── Constants ────────────────────────────────────────────────────────────────

const CANVAS_W = 680
const CANVAS_H = 480
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

const STATUS_LABELS: Record<string, string> = {
  attending: 'Zugesagt', declined: 'Abgesagt', pending: 'Ausstehend', maybe: 'Vielleicht',
}
const SIDE_LABELS: Record<string, string> = {
  braut: 'Brautseite', braeutigam: 'Bräutigamseite', both: 'Beide Seiten',
}
const TRANSPORT_LABELS: Record<string, string> = {
  car: 'Auto', train: 'Bahn', plane: 'Flugzeug', bus: 'Bus', taxi: 'Taxi', other: 'Sonstiges',
}
const AGE_LABELS: Record<string, string> = {
  erwachsen: 'Erwachsen', kind: 'Kind', baby: 'Baby',
}

// ── Field config for lightbox ────────────────────────────────────────────────

type FieldConfig = { key: string; label: string; format?: (v: unknown) => string }
type SectionConfig = { section: string; fields: FieldConfig[] }

const GUEST_SECTIONS: SectionConfig[] = [
  {
    section: 'Allgemein',
    fields: [
      { key: 'status', label: 'Status', format: v => STATUS_LABELS[v as string] ?? String(v) },
      { key: 'side', label: 'Seite', format: v => SIDE_LABELS[v as string] ?? String(v) },
      { key: 'responded_at', label: 'Geantwortet', format: v => new Date(v as string).toLocaleDateString('de-DE') },
    ],
  },
  {
    section: 'Kontakt',
    fields: [
      { key: 'email', label: 'E-Mail' },
      { key: 'phone', label: 'Telefon' },
      { key: 'address', label: 'Adresse' },
    ],
  },
  {
    section: 'Catering',
    fields: [
      { key: 'meal_choice', label: 'Menüwahl' },
      { key: 'trink_alkohol', label: 'Alkohol', format: v => (v as boolean) ? 'Ja' : 'Nein' },
      { key: 'allergy_tags', label: 'Allergien', format: v => (v as string[]).join(', ') },
      { key: 'allergy_custom', label: 'Weitere Allergien' },
    ],
  },
  {
    section: 'Logistik',
    fields: [
      { key: 'arrival_date', label: 'Anreise', format: v => new Date(v as string).toLocaleDateString('de-DE') },
      { key: 'arrival_time', label: 'Ankunft' },
      { key: 'departure_date', label: 'Abreise', format: v => new Date(v as string).toLocaleDateString('de-DE') },
      { key: 'transport_mode', label: 'Transport', format: v => TRANSPORT_LABELS[v as string] ?? String(v) },
    ],
  },
  {
    section: 'Sonstiges',
    fields: [
      { key: 'message', label: 'Nachricht' },
      { key: 'notes', label: 'Notizen' },
    ],
  },
]

const BEGLEIT_SECTIONS: SectionConfig[] = [
  {
    section: 'Person',
    fields: [
      { key: 'age_category', label: 'Alterskategorie', format: v => AGE_LABELS[v as string] ?? String(v) },
    ],
  },
  {
    section: 'Catering',
    fields: [
      { key: 'meal_choice', label: 'Menüwahl' },
      { key: 'trink_alkohol', label: 'Alkohol', format: v => (v as boolean) ? 'Ja' : 'Nein' },
      { key: 'allergy_tags', label: 'Allergien', format: v => (v as string[]).join(', ') },
      { key: 'allergy_custom', label: 'Weitere Allergien' },
    ],
  },
]

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false
  if (Array.isArray(v) && v.length === 0) return false
  return true
}

function formatField(fc: FieldConfig, obj: Record<string, unknown>): string | null {
  const v = obj[fc.key]
  if (!hasValue(v)) return null
  if (fc.format) return fc.format(v)
  return String(v)
}

// ── GuestLightbox ─────────────────────────────────────────────────────────────

function GuestLightbox({ entry, onClose }: { entry: LightboxEntry; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isGuest = entry.type === 'guest'
  const data = entry.data as unknown as Record<string, unknown>
  const sections = isGuest ? GUEST_SECTIONS : BEGLEIT_SECTIONS
  const typeLabel = isGuest ? 'Gast' : 'Begleitperson'
  const typeColor = isGuest ? '#6366F1' : '#9CA3AF'
  const typeBg = isGuest ? '#EEF2FF' : '#F3F4F6'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          width: '100%', maxWidth: 480, maxHeight: '80vh',
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: typeColor, background: typeBg, padding: '2px 8px', borderRadius: 20 }}>
                {typeLabel}
              </span>
              {entry.type === 'begleit' && (
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Begl. von <strong>{(entry.data as BegleitFull).guest_name}</strong>
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>{String(data.name ?? '')}</h2>
          </div>
          <button onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* Sections */}
        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sections.map(({ section, fields }) => {
            const rows = fields
              .map(fc => ({ label: fc.label, value: formatField(fc, data) }))
              .filter(r => r.value !== null)
            if (rows.length === 0) return null
            return (
              <div key={section}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  {section}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {rows.map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 120, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, lineHeight: 1.4 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {sections.every(({ fields }) => fields.every(fc => !hasValue(data[fc.key]))) && (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 0' }}>
              Keine weiteren Informationen vorhanden.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── SVG coordinate helper ────────────────────────────────────────────────────

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = pt.matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function roomBounds(points: RaumPoint[]) {
  if (points.length === 0) return { minX: -5, maxX: 5, minY: -4, maxY: 4 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  return { minX, maxX, minY, maxY }
}

function computeScale(points: RaumPoint[], canvasW: number, canvasH: number): { scale: number; offX: number; offY: number } {
  const { minX, maxX, minY, maxY } = roomBounds(points)
  const w = maxX - minX + PAD * 2
  const h = maxY - minY + PAD * 2
  const scale = Math.min(canvasW / w, canvasH / h)
  const offX = canvasW / 2 - (minX + maxX) / 2 * scale
  const offY = canvasH / 2 - (minY + maxY) / 2 * scale
  return { scale, offX, offY }
}

function m2px(mx: number, my: number, scale: number, offX: number, offY: number) {
  return { x: mx * scale + offX, y: my * scale + offY }
}

function px2m(px: number, py: number, scale: number, offX: number, offY: number) {
  return { x: (px - offX) / scale, y: (py - offY) / scale }
}

// Initialen (max. 2 Buchstaben) aus einem Namen
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '–'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Sitzpositionen (in Metern, relativ zum Tischzentrum, VOR Rotation) für n Plätze.
function seatLocalPositions(table: SitzTable, n: number): { dx: number; dy: number }[] {
  const out: { dx: number; dy: number }[] = []
  if (n <= 0) return out
  if (table.shape === 'round') {
    const r = table.table_length / 2 + CHAIR_PAD * 0.6
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n
      out.push({ dx: Math.cos(ang) * r, dy: Math.sin(ang) * r })
    }
  } else {
    const L = table.table_length
    const W = table.table_width
    const off = W / 2 + CHAIR_PAD * 0.6
    const nTop = Math.ceil(n / 2)
    const nBot = n - nTop
    for (let i = 0; i < nTop; i++) {
      out.push({ dx: -L / 2 + ((i + 0.5) * L) / nTop, dy: -off })
    }
    for (let i = 0; i < nBot; i++) {
      out.push({ dx: -L / 2 + ((i + 0.5) * L) / nBot, dy: off })
    }
  }
  return out
}

function rotatePt(dx: number, dy: number, deg: number): { dx: number; dy: number } {
  const r = (deg * Math.PI) / 180
  return { dx: dx * Math.cos(r) - dy * Math.sin(r), dy: dx * Math.sin(r) + dy * Math.cos(r) }
}

function coupleNames(coupleName?: string): [string, string] {
  if (!coupleName) return ['Partner 1', 'Partner 2']
  const parts = coupleName.split(/[&+,]/).map(s => s.trim()).filter(Boolean)
  return [parts[0] ?? 'Partner 1', parts[1] ?? 'Partner 2']
}

interface ElemGroup {
  type: string
  cells: RaumElement[]
  minX: number; minY: number; maxX: number; maxY: number
}

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
    const queue = [el]
    visited.add(k)
    while (queue.length) {
      const cur = queue.shift()!
      cells.push(cur)
      const neighbors = [
        byPos[key(cur.x + GRID_SIZE, cur.y)],
        byPos[key(cur.x - GRID_SIZE, cur.y)],
        byPos[key(cur.x, cur.y + GRID_SIZE)],
        byPos[key(cur.x, cur.y - GRID_SIZE)],
      ]
      for (const nb of neighbors) {
        if (nb && nb.type === el.type && !visited.has(key(nb.x, nb.y))) {
          visited.add(key(nb.x, nb.y)); queue.push(nb)
        }
      }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    cells.forEach(c => { minX = Math.min(minX, c.x); minY = Math.min(minY, c.y); maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y) })
    groups.push({ type: el.type, cells, minX, minY, maxX, maxY })
  }
  return groups
}

// ── Table shape SVG component ─────────────────────────────────────────────────

function TableShape({
  table, scale, offX, offY, selected, onClick, onMouseDown,
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
  const wid = (table.shape === 'round' ? table.table_length : table.table_width) * scale
  const chairLen = (table.table_length + CHAIR_PAD * 2) * scale
  const chairWid = ((table.shape === 'round' ? table.table_length : table.table_width) + CHAIR_PAD * 2) * scale
  const rot = table.rotation

  return (
    <g transform={`rotate(${rot}, ${cx}, ${cy})`} onClick={e => { e.stopPropagation(); onClick() }} onMouseDown={onMouseDown} style={{ cursor: 'grab' }}>
      {table.shape === 'round' ? (
        <ellipse cx={cx} cy={cy} rx={chairLen / 2} ry={chairLen / 2}
          fill="none" stroke={selected ? '#6366F1' : '#AEAEB2'} strokeWidth={1} strokeDasharray="4 3" />
      ) : (
        <rect x={cx - chairLen / 2} y={cy - chairWid / 2} width={chairLen} height={chairWid} rx={6}
          fill="none" stroke={selected ? '#6366F1' : '#AEAEB2'} strokeWidth={1} strokeDasharray="4 3" />
      )}
      {table.shape === 'round' ? (
        <ellipse cx={cx} cy={cy} rx={len / 2} ry={len / 2}
          fill={selected ? '#EEF2FF' : '#F5F5F7'}
          stroke={selected ? '#6366F1' : '#1D1D1F'}
          strokeWidth={selected ? 2.5 : 1.5} />
      ) : (
        <rect x={cx - len / 2} y={cy - wid / 2} width={len} height={wid} rx={4}
          fill={selected ? '#EEF2FF' : '#F5F5F7'}
          stroke={selected ? '#6366F1' : '#1D1D1F'}
          strokeWidth={selected ? 2.5 : 1.5} />
      )}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontSize={Math.max(9, Math.min(13, len * 0.14))}
        fontFamily="-apple-system,Helvetica,sans-serif" fontWeight="600"
        fill={selected ? '#4338CA' : '#1D1D1F'}
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {table.name}
      </text>
    </g>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SitzplanEditor({
  eventId, canEditRoom: _canEditRoom, roomPoints, roomElements = [], tablePool, coupleName, simpleMode = false,
}: SitzplanEditorProps) {
  const supabase = createClient()

  const [tables, setTables] = useState<SitzTable[]>([])
  const [assignments, setAssignments] = useState<SitzAssignment[]>([])
  const [guests, setGuests] = useState<GuestFull[]>([])
  const [begleit, setBegleit] = useState<BegleitFull[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxEntry, setLightboxEntry] = useState<LightboxEntry | null>(null)

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // Schnell-Anlage (nur simpleMode)
  const [quickShape, setQuickShape] = useState<'round' | 'rectangular'>('round')
  const [quickSeats, setQuickSeats] = useState(8)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')

  // Sitz-Tausch: ausgewählter Sitz (Tippen) + Drag-Status
  const [selectedSeat, setSelectedSeat] = useState<{ tableId: string; index: number } | null>(null)
  const seatDrag = useRef<{ tableId: string; index: number; x: number; y: number; moved: boolean } | null>(null)
  const suppressSeatClick = useRef(false)
  const seatPointerUpRef = useRef<(e: PointerEvent) => void>(() => {})

  const svgRef = useRef<SVGSVGElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [canvasW, setCanvasW] = useState(CANVAS_W)

  useEffect(() => {
    const div = canvasContainerRef.current; if (!div) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setCanvasW(w)
    })
    ro.observe(div)
    return () => ro.disconnect()
  }, [loading]) // re-attach after loading completes

  const dragState = useRef<{
    tableId: string
    startMx: number; startMy: number
    startPosX: number; startPosY: number
  } | null>(null)
  const dragOccurred = useRef(false)

  // Flat transform: (scale, offX, offY) — null means "fit to canvas"
  const [tx, setTx] = useState<{ scale: number; offX: number; offY: number } | null>(null)
  const panState = useRef<{ startX: number; startY: number; startOffX: number; startOffY: number } | null>(null)

  const fit = computeScale(roomPoints, canvasW, CANVAS_H)
  const fitRef = useRef(fit)
  fitRef.current = fit

  // Reset transform when canvas is resized
  useEffect(() => { setTx(null) }, [canvasW])

  const scale = tx?.scale ?? fit.scale
  const offX  = tx?.offX  ?? fit.offX
  const offY  = tx?.offY  ?? fit.offY

  const [partner1, partner2] = coupleNames(coupleName)

  const elemGroups = groupElements(roomElements)

  // ── Load ────────────────────────────────────────────────────────────────────

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
        supabase.from('guests').select('*').eq('event_id', eventId).order('name'),
        supabase.from('begleitpersonen')
          .select('id, guest_id, name, age_category, trink_alkohol, meal_choice, allergy_tags, allergy_custom, guests!inner(name, event_id)')
          .eq('guests.event_id', eventId)
          .order('name'),
      ])
      // Sitzpositionen normalisieren: Zuweisungen ohne seat_index bekommen den
      // nächsten freien Platz an ihrem Tisch (einmalig, persistiert).
      const asg = (assignmentsData ?? []) as SitzAssignment[]
      const pendingSeat: { id: string; seat_index: number }[] = []
      const byTable = new Map<string, SitzAssignment[]>()
      for (const a of asg) {
        const list = byTable.get(a.table_id) ?? []
        list.push(a); byTable.set(a.table_id, list)
      }
      for (const list of byTable.values()) {
        const used = new Set(list.map(a => a.seat_index).filter(i => i != null) as number[])
        for (const a of list) {
          if (a.seat_index == null) {
            let s = 0; while (used.has(s)) s++
            a.seat_index = s; used.add(s)
            pendingSeat.push({ id: a.id, seat_index: s })
          }
        }
      }
      if (pendingSeat.length) {
        void Promise.all(pendingSeat.map(p =>
          supabase.from('seating_assignments').update({ seat_index: p.seat_index }).eq('id', p.id)
        ))
      }
      setTables(tablesData ?? [])
      setAssignments(asg)
      setGuests((guestsData ?? []) as GuestFull[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (begleitData ?? []).map((b: any) => ({
        id: b.id, guest_id: b.guest_id, name: b.name,
        age_category: b.age_category, trink_alkohol: b.trink_alkohol,
        meal_choice: b.meal_choice, allergy_tags: b.allergy_tags, allergy_custom: b.allergy_custom,
        guest_name: Array.isArray(b.guests) ? (b.guests[0]?.name ?? '') : (b.guests?.name ?? ''),
      })) as BegleitFull[]
      setBegleit(mapped)
    } finally {
      setLoading(false)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const placedByType = (typeId: string) => tables.filter(t => t.pool_type_id === typeId).length

  const assignedGuestIds   = new Set(assignments.map(a => a.guest_id).filter(Boolean) as string[])
  const assignedBegleitIds = new Set(assignments.map(a => a.begleitperson_id).filter(Boolean) as string[])
  const assignedBrautpaar  = new Set(assignments.map(a => a.brautpaar_slot).filter(Boolean) as number[])

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

  const poolTypes = tablePool?.types ?? []

  const selectedType: RaumTableType | undefined = selectedTable?.pool_type_id
    ? poolTypes.find(t => t.id === selectedTable.pool_type_id)
    : undefined

  const allPersons: PersonEntry[] = [
    ...(assignedBrautpaar.has(1) ? [] : [{ type: 'brautpaar' as const, id: 'bp1', name: partner1, subtitle: 'Brautpaar' }]),
    ...(assignedBrautpaar.has(2) ? [] : [{ type: 'brautpaar' as const, id: 'bp2', name: partner2, subtitle: 'Brautpaar' }]),
    ...guests.filter(g => !assignedGuestIds.has(g.id)).map(g => ({ type: 'guest' as const, id: g.id, name: g.name, subtitle: STATUS_LABELS[g.status] ?? g.status })),
    ...begleit.filter(b => !assignedBegleitIds.has(b.id)).map(b => ({ type: 'begleitperson' as const, id: b.id, name: b.name, subtitle: `Begl. ${b.guest_name}` })),
  ]
  const filteredPersons = allPersons.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.subtitle ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function addTable(poolType: RaumTableType) {
    const num = tables.filter(t => t.pool_type_id === poolType.id).length + 1
    const globalNum = tables.length + 1
    const name = `Tisch ${globalNum}`
    const len = poolType.shape === 'round' ? poolType.diameter : poolType.length
    const wid = poolType.shape === 'round' ? poolType.diameter : poolType.width
    const cap = poolType.seats
      ?? (poolType.shape === 'round'
        ? Math.max(2, Math.round(poolType.diameter * Math.PI))
        : Math.max(2, Math.round(poolType.length * 2)))

    const bounds = roomBounds(roomPoints)
    const cx = (bounds.minX + bounds.maxX) / 2 + (num % 3 - 1) * (len + 0.5)
    const cy = (bounds.minY + bounds.maxY) / 2 + Math.floor(num / 3) * (wid + 0.5)

    const { data, error } = await supabase.from('seating_tables').insert({
      event_id: eventId, name, shape: poolType.shape,
      capacity: cap, pos_x: cx, pos_y: cy, rotation: 0,
      table_length: len, table_width: wid, pool_type_id: poolType.id,
    }).select().single()
    if (!error && data) setTables(prev => [...prev, data])
  }

  // Schnell-Anlage im einfachen Modus: Form + Plätze, Größe wird hergeleitet
  async function addQuickTable(shape: 'round' | 'rectangular', capacity: number) {
    const name = `Tisch ${tables.length + 1}`
    let len: number, wid: number
    if (shape === 'round') {
      // Durchmesser grob nach Personenzahl (60 cm Platz pro Person am Umfang)
      len = Math.max(1.2, Math.round((capacity * 0.6) / Math.PI * 10) / 10)
      wid = len
    } else {
      // Tafel: Personen je zur Hälfte auf beiden Längsseiten, 60 cm pro Platz
      len = Math.max(1.2, Math.ceil(capacity / 2) * 0.6)
      wid = 0.9
    }

    const num = tables.length
    const bounds = roomBounds(roomPoints)
    const cx = (bounds.minX + bounds.maxX) / 2 + (num % 3 - 1) * (len + 1.0)
    const cy = (bounds.minY + bounds.maxY) / 2 + (Math.floor(num / 3) % 3 - 1) * (wid + 1.0)

    const { data, error } = await supabase.from('seating_tables').insert({
      event_id: eventId, name, shape,
      capacity, pos_x: cx, pos_y: cy, rotation: 0,
      table_length: len, table_width: wid, pool_type_id: null,
    }).select().single()
    if (!error && data) setTables(prev => [...prev, data])
  }

  async function deleteTable(tableId: string) {
    await supabase.from('seating_tables').delete().eq('id', tableId)
    setTables(prev => prev.filter(t => t.id !== tableId))
    setAssignments(prev => prev.filter(a => a.table_id !== tableId))
    if (selectedTableId === tableId) setSelectedTableId(null)
  }

  async function updateTableName(tableId: string, name: string) {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, name } : t))
    await supabase.from('seating_tables').update({ name }).eq('id', tableId)
  }

  async function updateTableProp(tableId: string, field: string, value: number) {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, [field]: value } : t))
    await supabase.from('seating_tables').update({ [field]: value }).eq('id', tableId)
  }

  // Klartext-Name (ohne "Begl."-Zusatz) für Initialen
  const personBaseName = (a: SitzAssignment): string => {
    if (a.guest_id) return guests.find(g => g.id === a.guest_id)?.name ?? ''
    if (a.begleitperson_id) return begleit.find(b => b.id === a.begleitperson_id)?.name ?? ''
    if (a.brautpaar_slot === 1) return partner1
    if (a.brautpaar_slot === 2) return partner2
    return ''
  }

  async function assignPerson(person: PersonEntry) {
    if (!selectedTableId) return
    // nächsten freien Platz am Tisch bestimmen
    const used = new Set(assignmentsForTable(selectedTableId).map(a => a.seat_index).filter(i => i != null) as number[])
    let seat = 0; while (used.has(seat)) seat++

    const payload: Record<string, unknown> = { table_id: selectedTableId, event_id: eventId, seat_index: seat }
    if (person.type === 'guest') payload.guest_id = person.id
    else if (person.type === 'begleitperson') payload.begleitperson_id = person.id
    else if (person.id === 'bp1') payload.brautpaar_slot = 1
    else payload.brautpaar_slot = 2

    const { data, error } = await supabase.from('seating_assignments').insert(payload).select().single()
    if (!error && data) setAssignments(prev => [...prev, data])
  }

  // Zwei Plätze am selben Tisch tauschen (Tausch der seat_index-Werte)
  async function swapSeats(a: { tableId: string; index: number }, b: { tableId: string; index: number }) {
    if (a.tableId !== b.tableId || a.index === b.index) return
    const occA = assignments.find(x => x.table_id === a.tableId && (x.seat_index ?? -1) === a.index)
    const occB = assignments.find(x => x.table_id === b.tableId && (x.seat_index ?? -1) === b.index)
    if (!occA && !occB) return
    const changes: { id: string; seat_index: number }[] = []
    if (occA) changes.push({ id: occA.id, seat_index: b.index })
    if (occB) changes.push({ id: occB.id, seat_index: a.index })
    setAssignments(prev => prev.map(x => {
      const c = changes.find(c => c.id === x.id)
      return c ? { ...x, seat_index: c.seat_index } : x
    }))
    await Promise.all(changes.map(c =>
      supabase.from('seating_assignments').update({ seat_index: c.seat_index }).eq('id', c.id)
    ))
  }

  // Tippen: ersten Sitz markieren, zweiten am selben Tisch → tauschen
  function handleSeatTap(tableId: string, index: number) {
    if (suppressSeatClick.current) { suppressSeatClick.current = false; return }
    if (!selectedSeat) { setSelectedSeat({ tableId, index }); return }
    if (selectedSeat.tableId === tableId && selectedSeat.index === index) { setSelectedSeat(null); return }
    if (selectedSeat.tableId === tableId) { void swapSeats(selectedSeat, { tableId, index }); setSelectedSeat(null); return }
    setSelectedSeat({ tableId, index })
  }

  function onSeatPointerDown(e: React.PointerEvent, tableId: string, index: number) {
    e.stopPropagation()
    seatDrag.current = { tableId, index, x: e.clientX, y: e.clientY, moved: false }
  }

  // Drag-Ende: Sitz unter dem Zeiger ermitteln und tauschen
  seatPointerUpRef.current = (e: PointerEvent) => {
    const sd = seatDrag.current; seatDrag.current = null
    if (!sd || !sd.moved) return
    const el = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-seat]')
    if (!el) return
    const tt = el.getAttribute('data-tableid')
    const ti = Number(el.getAttribute('data-seat'))
    if (tt === sd.tableId && ti !== sd.index) {
      void swapSeats({ tableId: sd.tableId, index: sd.index }, { tableId: tt, index: ti })
      suppressSeatClick.current = true
      setSelectedSeat(null)
    }
  }

  async function removeAssignment(assignmentId: string) {
    await supabase.from('seating_assignments').delete().eq('id', assignmentId)
    setAssignments(prev => prev.filter(a => a.id !== assignmentId))
  }

  // ── SVG drag ────────────────────────────────────────────────────────────────

  const onTableMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    const svg = svgRef.current; if (!svg) return
    const { x: px, y: py } = clientToSvg(svg, e.clientX, e.clientY)
    const { x: mx, y: my } = px2m(px, py, scale, offX, offY)
    const table = tables.find(t => t.id === tableId); if (!table) return
    dragOccurred.current = false
    dragState.current = { tableId, startMx: mx, startMy: my, startPosX: table.pos_x, startPosY: table.pos_y }
  }, [tables, scale, offX, offY])

  const onSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current) return
    const svg = svgRef.current; if (!svg) return
    const { x: px, y: py } = clientToSvg(svg, e.clientX, e.clientY)
    const { x: mx, y: my } = px2m(px, py, scale, offX, offY)
    const dx = mx - dragState.current.startMx
    const dy = my - dragState.current.startMy
    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) dragOccurred.current = true
    setTables(prev => prev.map(t =>
      t.id === dragState.current!.tableId
        ? { ...t, pos_x: dragState.current!.startPosX + dx, pos_y: dragState.current!.startPosY + dy }
        : t
    ))
  }, [scale, offX, offY])

  const onSvgMouseUp = useCallback(async () => {
    if (!dragState.current) return
    const ds = dragState.current; dragState.current = null
    if (!dragOccurred.current) return
    dragOccurred.current = false
    const table = tables.find(t => t.id === ds.tableId)
    if (table) await supabase.from('seating_tables').update({ pos_x: table.pos_x, pos_y: table.pos_y }).eq('id', ds.tableId)
  }, [tables, supabase])

  const onSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest('g')) return
    panState.current = { startX: e.clientX, startY: e.clientY, startOffX: offX, startOffY: offY }
  }, [offX, offY])

  // Seat-Drag (Tausch per Ziehen) — global, da der Zeiger über andere Sitze geht
  useEffect(() => {
    function mv(e: PointerEvent) {
      const sd = seatDrag.current; if (!sd) return
      if (Math.hypot(e.clientX - sd.x, e.clientY - sd.y) > 6) sd.moved = true
    }
    function up(e: PointerEvent) { seatPointerUpRef.current(e) }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up) }
  }, [])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!panState.current) return
      const dx = e.clientX - panState.current.startX
      const dy = e.clientY - panState.current.startY
      setTx(prev => ({
        scale: prev?.scale ?? fitRef.current.scale,
        offX: panState.current!.startOffX + dx,
        offY: panState.current!.startOffY + dy,
      }))
    }
    function onUp() { panState.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => {
    const div = canvasContainerRef.current; if (!div) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = div.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setTx(prev => {
        const fit = fitRef.current
        const curScale = prev?.scale ?? fit.scale
        const curOffX  = prev?.offX  ?? fit.offX
        const curOffY  = prev?.offY  ?? fit.offY
        const newScale = Math.max(fit.scale * 0.25, Math.min(fit.scale * 8, curScale * (1 - e.deltaY * 0.001)))
        const f = newScale / curScale
        return { scale: newScale, offX: cx - (cx - curOffX) * f, offY: cy - (cy - curOffY) * f }
      })
    }
    div.addEventListener('wheel', handler, { passive: false })
    return () => div.removeEventListener('wheel', handler)
  }, [loading])

  // ── Name editing ────────────────────────────────────────────────────────────

  function startEditing(table: SitzTable) { setEditingName(table.id); setNameInput(table.name) }

  async function commitName() {
    if (editingName && nameInput.trim()) await updateTableName(editingName, nameInput.trim())
    setEditingName(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Lade Sitzplan…</div>
  )

  if (roomPoints.length < 3) return (
    <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>Kein Raum konfiguriert</p>
      <p style={{ fontSize: 13 }}>Bitte zuerst den Raum im Raumkonfigurator anlegen.</p>
    </div>
  )

  const hasPool = poolTypes.length > 0

  return (
    <>
      {lightboxEntry && (
        <GuestLightbox entry={lightboxEntry} onClose={() => setLightboxEntry(null)} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Table pool / Schnell-Anlage */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
              {simpleMode ? 'Tisch hinzufügen' : 'Verfügbare Tische'}
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {simpleMode ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {(['round', 'rectangular'] as const).map(s => (
                      <button key={s} onClick={() => setQuickShape(s)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          padding: '8px 4px', borderRadius: 8, fontFamily: 'inherit', cursor: 'pointer',
                          border: `1.5px solid ${quickShape === s ? '#6366F1' : 'var(--border)'}`,
                          background: quickShape === s ? '#EEF2FF' : 'var(--surface)',
                        }}>
                        <svg width="26" height="26" viewBox="0 0 28 28">
                          {s === 'round'
                            ? <ellipse cx="14" cy="14" rx="10" ry="10" fill="none" stroke={quickShape === s ? '#6366F1' : '#9CA3AF'} strokeWidth="1.5"/>
                            : <rect x="4" y="9" width="20" height="11" rx="2" fill="none" stroke={quickShape === s ? '#6366F1' : '#9CA3AF'} strokeWidth="1.5"/>
                          }
                        </svg>
                        <span style={{ fontSize: 11, fontWeight: 600, color: quickShape === s ? '#6366F1' : 'var(--text-secondary)' }}>
                          {s === 'round' ? 'Rund' : 'Eckig'}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Plätze</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => setQuickSeats(v => Math.max(2, v - 1))}
                        style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 14, lineHeight: 1, fontFamily: 'inherit' }}>−</button>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{quickSeats}</span>
                      <button onClick={() => setQuickSeats(v => Math.min(24, v + 1))}
                        style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 14, lineHeight: 1, fontFamily: 'inherit' }}>+</button>
                    </div>
                  </div>
                  <button onClick={() => addQuickTable(quickShape, quickSeats)}
                    style={{
                      padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: '#6366F1', color: '#fff', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                    }}>
                    + Tisch hinzufügen
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, margin: 0 }}>
                    Ohne Raumplan — Tische frei anordnen. Einen Grundriss könnt ihr später jederzeit ergänzen.
                  </p>
                </>
              ) : !hasPool ? (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  Noch keine Tische konfiguriert (Raum → Schritt 3).
                </p>
              ) : poolTypes.map(pt => {
                const placed = placedByType(pt.id)
                const avail = Math.max(0, pt.count - placed)
                const isRound = pt.shape === 'round'
                const accentColor = isRound ? '#6366F1' : '#22C55E'
                const bgColor = isRound ? '#EEF2FF' : '#F0FDF4'
                return (
                  <button key={pt.id} onClick={() => avail > 0 && addTable(pt)} disabled={avail === 0}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      borderRadius: 8, border: `1px solid ${avail === 0 ? 'var(--border)' : accentColor + '66'}`,
                      background: avail === 0 ? '#F5F5F7' : bgColor,
                      cursor: avail === 0 ? 'not-allowed' : 'pointer',
                      opacity: avail === 0 ? 0.55 : 1, fontFamily: 'inherit',
                    }}>
                    <svg width="28" height="28" viewBox="0 0 28 28" style={{ flexShrink: 0 }}>
                      {isRound
                        ? <ellipse cx="14" cy="14" rx="11" ry="11" fill={bgColor} stroke={accentColor} strokeWidth="1.5"/>
                        : <rect x="3" y="8" width="22" height="12" rx="3" fill={bgColor} stroke={accentColor} strokeWidth="1.5"/>
                      }
                    </svg>
                    <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isRound ? `Rund ⌀${pt.diameter}m` : `Eckig ${pt.length}×${pt.width}m`}
                      </div>
                      <div style={{ fontSize: 10, color: avail === 0 ? '#FF3B30' : 'var(--text-tertiary)' }}>
                        {avail === 0 ? 'Alle platziert' : `${avail} von ${pt.count} verfügbar`}
                      </div>
                    </div>
                    {avail > 0 && (
                      <span style={{ flexShrink: 0, fontSize: 16, color: accentColor, fontWeight: 700, lineHeight: 1 }}>+</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected table panel OR guest overview */}
          {selectedTable ? (
            <div style={{ background: 'var(--surface)', border: '2px solid #6366F1', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {editingName === selectedTable.id ? (
                  <input autoFocus value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(null) }}
                    style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '3px 6px', borderRadius: 6, border: '1px solid #6366F1', fontFamily: 'inherit', outline: 'none' }}
                  />
                ) : (
                  <button onClick={() => startEditing(selectedTable)}
                    style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                    title="Klicken zum Umbenennen">
                    {selectedTable.name}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 5, opacity: 0.4, verticalAlign: 'middle' }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                )}
                <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', color: selectedCount >= selectedTable.capacity ? '#FF3B30' : 'var(--text-tertiary)' }}>
                  {selectedCount}/{selectedTable.capacity}
                </span>
                <button onClick={() => setSelectedTableId(null)}
                  style={{ padding: '2px 6px', borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.06)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1 }}>
                  ✕
                </button>
              </div>

              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {selectedType && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', background: '#F5F5F7', borderRadius: 6, padding: '5px 8px' }}>
                    {selectedType.shape === 'round'
                      ? `Runder Tisch · ⌀ ${selectedType.diameter} m`
                      : `Eckiger Tisch · ${selectedType.length} × ${selectedType.width} m`}
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Plätze</span>
                  <input type="number" min={1} max={50} value={selectedTable.capacity}
                    onChange={e => updateTableProp(selectedTable.id, 'capacity', Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: 56, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', textAlign: 'center' }}
                  />
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => updateTableProp(selectedTable.id, 'rotation', (selectedTable.rotation - 15 + 360) % 360)}
                    style={{ flex: 1, padding: '4px 0', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                    ↺ −15°
                  </button>
                  <button onClick={() => updateTableProp(selectedTable.id, 'rotation', (selectedTable.rotation + 15) % 360)}
                    style={{ flex: 1, padding: '4px 0', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                    ↻ +15°
                  </button>
                </div>
              </div>

              {selectedAssignments.length > 0 && (
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 140, overflowY: 'auto' }}>
                  {selectedAssignments.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{personName(a)}</span>
                      <button onClick={() => removeAssignment(a.id)}
                        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input placeholder="Gast suchen…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selectedCount >= selectedTable.capacity
                    ? <p style={{ fontSize: 11, color: '#FF3B30', textAlign: 'center', padding: '4px 0' }}>Tisch ist voll</p>
                    : filteredPersons.length === 0
                      ? <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '4px 0' }}>Keine weiteren Personen</p>
                      : filteredPersons.map(p => (
                        <button key={`${p.type}-${p.id}`} onClick={() => assignPerson(p)}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                          <span style={{ fontSize: 12, fontWeight: 500 }}>{p.name}</span>
                          {p.subtitle && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.subtitle}</span>}
                        </button>
                      ))
                  }
                </div>
              </div>

              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => { if (confirm(`"${selectedTable.name}" löschen?`)) deleteTable(selectedTable.id) }}
                  style={{ width: '100%', padding: '6px 0', borderRadius: 7, border: '1px solid rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.06)', color: '#FF3B30', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }}>
                  Tisch löschen
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Personen</div>
                <input placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredPersons.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
                    {allPersons.length === 0 ? 'Alle Personen sitzen' : 'Kein Treffer'}
                  </p>
                ) : filteredPersons.map(p => (
                  <div key={`${p.type}-${p.id}`} style={{ display: 'flex', flexDirection: 'column', padding: '5px 8px', borderRadius: 6, background: '#F5F5F7', fontSize: 12 }}>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    {p.subtitle && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.subtitle}</span>}
                  </div>
                ))}
              </div>
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                {allPersons.length} noch nicht platziert · Tisch anklicken
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: canvas + table list ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Canvas */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>{tables.length} Tische · {guests.length + begleit.length + 2} Personen</span>
              <button onClick={() => setTx(null)}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
                Ansicht zurücksetzen
              </button>
            </div>

            <div ref={canvasContainerRef} style={{ background: '#F5F5F7', width: '100%' }}>
              <svg ref={svgRef} width="100%" height={CANVAS_H} style={{ display: 'block' }}
                onMouseDown={onSvgMouseDown}
                onMouseMove={onSvgMouseMove}
                onMouseUp={onSvgMouseUp}
                onMouseLeave={onSvgMouseUp}
                onClick={() => setSelectedTableId(null)}>

                {roomPoints.length >= 3 && (
                  <polygon
                    points={roomPoints.map(p => { const c = m2px(p.x, p.y, scale, offX, offY); return `${c.x},${c.y}` }).join(' ')}
                    fill={simpleMode ? 'rgba(29,29,31,0.02)' : 'rgba(29,29,31,0.04)'}
                    stroke={simpleMode ? '#C9C2B6' : '#1D1D1F'}
                    strokeWidth={simpleMode ? 1.5 : 2}
                    strokeDasharray={simpleMode ? '8 6' : undefined}
                  />
                )}

                {elemGroups.map((group, gi) => {
                  const style = ELEM_STYLE[group.type]
                  if (!style) return null
                  const tl = m2px(group.minX, group.minY, scale, offX, offY)
                  const br = m2px(group.maxX + GRID_SIZE, group.maxY + GRID_SIZE, scale, offX, offY)
                  const gw = br.x - tl.x; const gh = br.y - tl.y
                  return (
                    <rect key={gi} x={tl.x} y={tl.y} width={gw} height={gh} rx={3}
                      fill={style.fill} stroke={style.stroke} strokeWidth={1.2} />
                  )
                })}

                {tables.map(table => (
                  <TableShape key={table.id} table={table} scale={scale} offX={offX} offY={offY}
                    selected={selectedTableId === table.id}
                    onClick={() => { setSelectedTableId(table.id); setSearch('') }}
                    onMouseDown={e => onTableMouseDown(e, table.id)}
                  />
                ))}

                {/* Sitz-Kreise um jeden Tisch (ein Kreis pro Platz, Initialen) */}
                {tables.map(table => {
                  const tas = assignmentsForTable(table.id)
                  const maxOcc = tas.reduce((m, a) => Math.max(m, (a.seat_index ?? -1) + 1), 0)
                  const seatCount = Math.max(table.capacity, maxOcc)
                  const locals = seatLocalPositions(table, seatCount)
                  const rad = Math.max(8, scale * 0.2)
                  return (
                    <g key={`seats-${table.id}`}>
                      {locals.map((loc, idx) => {
                        const rp = rotatePt(loc.dx, loc.dy, table.rotation)
                        const c = m2px(table.pos_x + rp.dx, table.pos_y + rp.dy, scale, offX, offY)
                        const occ = tas.find(a => (a.seat_index ?? -1) === idx)
                        const isSel = selectedSeat?.tableId === table.id && selectedSeat.index === idx
                        const fill = occ
                          ? (occ.brautpaar_slot ? '#FEF3C7' : occ.begleitperson_id ? '#F3F4F6' : '#EEF2FF')
                          : '#FFFFFF'
                        const stroke = isSel ? '#4338CA' : occ
                          ? (occ.brautpaar_slot ? '#F59E0B' : occ.begleitperson_id ? '#9CA3AF' : '#6366F1')
                          : '#C7C7CC'
                        const txtColor = occ
                          ? (occ.brautpaar_slot ? '#92400E' : occ.begleitperson_id ? '#4B5563' : '#4338CA')
                          : '#C7C7CC'
                        return (
                          <g key={idx}
                            data-seat={idx} data-tableid={table.id}
                            onClick={e => { e.stopPropagation(); handleSeatTap(table.id, idx) }}
                            onPointerDown={e => onSeatPointerDown(e, table.id, idx)}
                            style={{ cursor: occ ? 'grab' : 'pointer' }}>
                            <circle cx={c.x} cy={c.y} r={rad}
                              fill={fill} stroke={stroke}
                              strokeWidth={isSel ? 2.5 : 1.3}
                              strokeDasharray={occ ? undefined : '3 2'} />
                            {occ && (
                              <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central"
                                fontSize={Math.max(7, rad * 0.85)} fontWeight="700"
                                fontFamily="-apple-system,Helvetica,sans-serif" fill={txtColor}
                                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                                {initialsOf(personBaseName(occ))}
                              </text>
                            )}
                          </g>
                        )
                      })}
                    </g>
                  )
                })}
              </svg>
            </div>

            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: selectedSeat ? '#4338CA' : 'var(--text-tertiary)' }}>
              {selectedSeat
                ? 'Sitz markiert — anderen Sitz am selben Tisch antippen zum Tauschen (oder Sitz ziehen).'
                : 'Tisch: anklicken = auswählen, ziehen = verschieben · Sitz: tippen oder ziehen zum Tauschen · Scroll = zoom'}
            </div>

            {elemGroups.length > 0 && (() => {
              const seen = new Map<string, typeof ELEM_STYLE[string]>()
              elemGroups.forEach(g => { if (ELEM_STYLE[g.type] && !seen.has(g.type)) seen.set(g.type, ELEM_STYLE[g.type]) })
              return (
                <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)' }}>Legende</span>
                  {Array.from(seen.entries()).map(([type, s]) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: s.fill, border: `1.5px solid ${s.stroke}`, flexShrink: 0, display: 'inline-block' }}/>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* ── Table list (collapsible) ── */}
          {tables.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>Tischbelegung</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {assignments.length} von {tables.reduce((s, t) => s + t.capacity, 0)} Plätzen belegt
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {tables.map((table, i) => {
                  const tas = assignmentsForTable(table.id)
                  const isOpen = selectedTableId === table.id
                  const isFull = tas.length >= table.capacity

                  return (
                    <div key={table.id} style={{ borderBottom: i < tables.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      {/* Card header */}
                      <button
                        onClick={() => { setSelectedTableId(isOpen ? null : table.id); setSearch('') }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '13px 16px', background: isOpen ? '#F5F4FF' : 'transparent',
                          border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                          transition: 'background 0.1s',
                        }}>
                        {/* Table shape icon */}
                        <div style={{ width: 28, height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24">
                            {table.shape === 'round'
                              ? <ellipse cx="12" cy="12" rx="10" ry="10" fill={isOpen ? '#EEF2FF' : '#F5F5F7'} stroke={isOpen ? '#6366F1' : '#9CA3AF'} strokeWidth="1.5"/>
                              : <rect x="2" y="7" width="20" height="10" rx="3" fill={isOpen ? '#EEF2FF' : '#F5F5F7'} stroke={isOpen ? '#6366F1' : '#9CA3AF'} strokeWidth="1.5"/>
                            }
                          </svg>
                        </div>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isOpen ? '#4338CA' : 'var(--text)' }}>
                          {table.name}
                        </span>
                        <span style={{
                          fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                          background: isFull ? 'rgba(255,59,48,0.1)' : tas.length === 0 ? '#F5F5F7' : '#F0FDF4',
                          color: isFull ? '#FF3B30' : tas.length === 0 ? 'var(--text-tertiary)' : '#15803D',
                        }}>
                          {tas.length}/{table.capacity}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          style={{ flexShrink: 0, opacity: 0.35, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>

                      {/* Expanded persons */}
                      {isOpen && (
                        <div style={{ padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {tas.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 0', margin: 0 }}>
                              Noch niemand zugeordnet.
                            </p>
                          ) : tas.map(a => {
                            const isBraut = !!a.brautpaar_slot
                            const guestFull = a.guest_id ? guests.find(g => g.id === a.guest_id) ?? null : null
                            const begleitFull = a.begleitperson_id ? begleit.find(b => b.id === a.begleitperson_id) ?? null : null
                            const clickable = !isBraut

                            const dotColor = isBraut ? '#F59E0B' : begleitFull ? '#9CA3AF' : '#6366F1'

                            return (
                              <div
                                key={a.id}
                                onClick={clickable ? () => {
                                  if (guestFull) setLightboxEntry({ type: 'guest', data: guestFull })
                                  else if (begleitFull) setLightboxEntry({ type: 'begleit', data: begleitFull })
                                } : undefined}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '8px 12px', borderRadius: 8,
                                  background: clickable ? 'var(--surface)' : '#FAFAFA',
                                  border: '1px solid var(--border)',
                                  cursor: clickable ? 'pointer' : 'default',
                                  transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLElement).style.background = '#F5F4FF' }}
                                onMouseLeave={e => { if (clickable) (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor }} />
                                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{personName(a)}</span>
                                {clickable && (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.25, flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                  </svg>
                                )}
                              </div>
                            )
                          })}

                          {/* Legend row */}
                          <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-tertiary)' }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366F1', display: 'inline-block' }}/>Gast
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-tertiary)' }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#9CA3AF', display: 'inline-block' }}/>Begleitperson
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-tertiary)' }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }}/>Brautpaar
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
