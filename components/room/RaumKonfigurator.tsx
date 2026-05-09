'use client'
import React, { useRef, useEffect, useState, useCallback } from 'react'

/* ── Types ── */
export interface RaumPoint { x: number; y: number }
export interface RaumElement { id: number; type: string; x: number; y: number }

export interface RaumTableType {
  id: string
  shape: 'round' | 'rectangular'
  count: number
  diameter: number   // used for round (length = width = diameter)
  length: number     // used for rectangular
  width: number      // used for rectangular
  seats?: number     // suggested capacity per table (overrides auto-calculation)
}

export interface RaumTablePool {
  types: RaumTableType[]
}

const DEFAULT_TABLE_POOL: RaumTablePool = { types: [] }

function makeTypeId() { return Math.random().toString(36).slice(2, 9) }

/** Placed table preview passed in from the parent (loaded from seating_tables DB). */
export interface PlacedTablePreview {
  pos_x: number; pos_y: number
  rotation: number
  shape: 'round' | 'rectangular'
  table_length: number; table_width: number
  name: string
}

export interface RaumKonfiguratorProps {
  initialPoints?: RaumPoint[]
  initialElements?: RaumElement[]
  initialTablePool?: RaumTablePool
  placedTables?: PlacedTablePreview[]
  onSave?: (points: RaumPoint[], elements: RaumElement[], tablePool: RaumTablePool) => Promise<void> | void
  saving?: boolean
  saved?: boolean
}

/* ── Constants ── */
const GRID_SIZE  = 0.5   // 0.5 m per element cell
const ROOM_SNAP  = 0.5   // polygon snap grid
const MIN_ZOOM   = 16
const MAX_ZOOM   = 100
const DEFAULT_M2PX = 40

function makeRect(w: number, h: number): RaumPoint[] {
  return [{ x: -w/2, y: -h/2 }, { x: w/2, y: -h/2 }, { x: w/2, y: h/2 }, { x: -w/2, y: h/2 }]
}
function roomSnap(v: number) { return Math.round(v / ROOM_SNAP) * ROOM_SNAP }
function elemSnap(v: number) { return Math.floor(v / GRID_SIZE) * GRID_SIZE }
function eKey(x: number, y: number) { return `${Math.round(x * 100)}_${Math.round(y * 100)}` }

/* ── Element draw definitions ── */
const ELEM_DEFS: Record<string, {
  label: string
  bg: string
  drawCell: (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => void
  drawGroup?: (ctx: CanvasRenderingContext2D, gx: number, gy: number, gw: number, gh: number) => void
}> = {
  strom: {
    label: 'Stromstelle', bg: '#FFFFFF',
    drawCell(ctx, cx, cy, s) {
      const r = s * 0.36
      ctx.beginPath(); ctx.arc(cx, cy - s*0.04, r, 0, Math.PI*2)
      ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=Math.max(1,s*0.04); ctx.stroke()
      ctx.fillStyle='#1D1D1F'
      ;[[cx-s*0.1, cy-s*0.27],[cx+s*0.03, cy-s*0.27]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.roundRect(x,y,s*0.07,s*0.2,1); ctx.fill()
      })
      ctx.beginPath(); ctx.arc(cx, cy+s*0.2, s*0.07, 0, Math.PI*2); ctx.fill()
    },
  },
  wasser: {
    label: 'Wasseranschluss', bg: '#EFF6FF',
    drawCell(ctx, cx, cy, s) {
      ctx.beginPath()
      ctx.moveTo(cx, cy-s*0.38)
      ctx.bezierCurveTo(cx+s*0.32,cy-s*0.1, cx+s*0.28,cy+s*0.22, cx,cy+s*0.36)
      ctx.bezierCurveTo(cx-s*0.28,cy+s*0.22, cx-s*0.32,cy-s*0.1, cx,cy-s*0.38)
      ctx.fillStyle='#BFDBFE'; ctx.fill()
      ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=Math.max(1,s*0.04); ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx-s*0.14, cy+s*0.1)
      ctx.quadraticCurveTo(cx-s*0.1,cy+s*0.24, cx-s*0.02,cy+s*0.27)
      ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=s*0.05; ctx.stroke()
    },
  },
  netzwerk: {
    label: 'Netzwerk / LAN', bg: '#FFFFFF',
    drawCell(ctx, cx, cy, s) {
      const hs = s*0.38
      ctx.fillStyle='#fff'; ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=Math.max(1,s*0.04)
      ctx.beginPath(); ctx.roundRect(cx-hs,cy-hs,hs*2,hs*2,2); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx,cy,s*0.1,0,Math.PI*2); ctx.fillStyle='#1D1D1F'; ctx.fill()
      ctx.lineWidth=Math.max(1,s*0.04); ctx.strokeStyle='#1D1D1F'
      ;[[0,-hs*0.85],[0,hs*0.85],[-hs*0.85,0],[hs*0.85,0]].forEach(([dx,dy]) => {
        ctx.beginPath(); ctx.moveTo(cx+dx*0.35,cy+dy*0.35); ctx.lineTo(cx+dx,cy+dy); ctx.stroke()
      })
    },
  },
  heizung: {
    label: 'Heizung', bg: '#FFFFFF',
    drawCell(ctx, cx, cy, s) {
      const hw=s*0.46, hh=s*0.22
      ctx.fillStyle='#fff'; ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=Math.max(1,s*0.04)
      ctx.beginPath(); ctx.rect(cx-hw,cy-hh,hw*2,hh*2); ctx.fill(); ctx.stroke()
      ctx.lineWidth=Math.max(0.8,s*0.03)
      ;[-hw*0.55,-hw*0.2,hw*0.15,hw*0.5].forEach(dx => {
        ctx.beginPath(); ctx.moveTo(cx+dx,cy-hh); ctx.lineTo(cx+dx,cy+hh); ctx.stroke()
      })
    },
    drawGroup(ctx, gx, gy, gw, gh) {
      const numFins = Math.max(2, Math.round(gw / 15))
      const gap = gw / (numFins + 1)
      ctx.lineWidth=1; ctx.strokeStyle='#1D1D1F'
      for (let i=1; i<=numFins; i++) {
        ctx.beginPath(); ctx.moveTo(gx+i*gap, gy+3); ctx.lineTo(gx+i*gap, gy+gh-3); ctx.stroke()
      }
    },
  },
  saeule: {
    label: 'Säule', bg: '#F1F5F9',
    drawCell(ctx, cx, cy, s) {
      const os=s*0.38, is=s*0.24
      ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=Math.max(1,s*0.04)
      ctx.strokeRect(cx-os,cy-os,os*2,os*2)
      ctx.fillStyle='#1D1D1F'; ctx.fillRect(cx-is,cy-is,is*2,is*2)
    },
  },
  tuer: {
    label: 'Tür', bg: '#FFFFFF',
    drawCell(ctx, cx, cy, s) {
      const W=s*0.42, T=s*0.12
      const ox=cx-s*0.22, oy=cy-s*0.22
      ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=T; ctx.lineCap='butt'
      ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ox,oy+W*2); ctx.stroke()
      ctx.lineWidth=Math.max(1,s*0.04)
      ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ox+W*2,oy); ctx.stroke()
      ctx.setLineDash([s*0.06,s*0.05]); ctx.lineWidth=Math.max(0.8,s*0.03)
      ctx.beginPath(); ctx.arc(ox,oy,W*2,0,Math.PI/2); ctx.stroke(); ctx.setLineDash([])
    },
  },
  fenster: {
    label: 'Fenster', bg: '#FFFFFF',
    drawCell(ctx, cx, cy, s) {
      const hw=s*0.46, hh=s*0.16
      ctx.fillStyle='#fff'; ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=Math.max(1,s*0.04)
      ctx.beginPath(); ctx.rect(cx-hw,cy-hh,hw*2,hh*2); ctx.fill(); ctx.stroke()
      ctx.lineWidth=Math.max(0.8,s*0.03)
      ctx.beginPath(); ctx.moveTo(cx-hw,cy); ctx.lineTo(cx+hw,cy); ctx.stroke()
      ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=0.8
      ;[cy-hh*0.55, cy+hh*0.55].forEach(y => {
        ctx.beginPath(); ctx.moveTo(cx-hw+3,y); ctx.lineTo(cx+hw-3,y); ctx.stroke()
      })
    },
    drawGroup(ctx, gx, gy, gw, gh) {
      const mcy=gy+gh/2
      ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=1
      ctx.beginPath(); ctx.moveTo(gx+2,mcy); ctx.lineTo(gx+gw-2,mcy); ctx.stroke()
      ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.lineWidth=0.7
      ;[0.28,0.72].forEach(t => {
        const y=gy+gh*t
        ctx.beginPath(); ctx.moveTo(gx+4,y); ctx.lineTo(gx+gw-4,y); ctx.stroke()
      })
    },
  },
  notausgang: {
    label: 'Notausgang', bg: '#DCFCE7',
    drawCell(ctx, cx, cy, s) {
      ctx.strokeStyle='#16A34A'; ctx.lineWidth=s*0.06; ctx.lineCap='round'
      ctx.beginPath(); ctx.moveTo(cx-s*0.2,cy); ctx.lineTo(cx+s*0.18,cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx+s*0.06,cy-s*0.14); ctx.lineTo(cx+s*0.2,cy); ctx.lineTo(cx+s*0.06,cy+s*0.14); ctx.stroke()
      ctx.lineCap='butt'
      ctx.font=`bold ${Math.max(7,s*0.15)}px -apple-system,Helvetica,sans-serif`
      ctx.textAlign='center'; ctx.textBaseline='bottom'
      ctx.fillStyle='#16A34A'; ctx.fillText('EXIT',cx,cy+s*0.38)
    },
  },
  treppe: {
    label: 'Treppe', bg: '#FFFFFF',
    drawCell(ctx, cx, cy, s) {
      const hw=s*0.46, hh=s*0.46
      ctx.fillStyle='#fff'; ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=Math.max(1,s*0.04)
      ctx.beginPath(); ctx.rect(cx-hw,cy-hh,hw*2,hh*2); ctx.fill(); ctx.stroke()
      ctx.lineWidth=Math.max(0.8,s*0.03); ctx.strokeStyle='#1D1D1F'
      ;[-hh*0.5,-hh*0.17,hh*0.17,hh*0.5].forEach(dy => {
        ctx.beginPath(); ctx.moveTo(cx-hw+3,cy+dy); ctx.lineTo(cx+hw-3,cy+dy); ctx.stroke()
      })
      ctx.fillStyle='#1D1D1F'
      ctx.beginPath(); ctx.moveTo(cx+hw-3,cy-hh); ctx.lineTo(cx+hw+3,cy-hh+7); ctx.lineTo(cx+hw-9,cy-hh+7); ctx.closePath(); ctx.fill()
    },
    drawGroup(ctx, gx, gy, gw, gh) {
      const numSteps=Math.max(3,Math.round(gh/12))
      const stepH=gh/numSteps
      ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=1
      for (let i=1; i<numSteps; i++) {
        const y=gy+i*stepH
        ctx.beginPath(); ctx.moveTo(gx+3,y); ctx.lineTo(gx+gw-3,y); ctx.stroke()
      }
    },
  },
  buehne: {
    label: 'Bühne', bg: '#FAFAFA',
    drawCell(ctx, cx, cy, s) {
      ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.8
      ctx.beginPath(); ctx.moveTo(cx-s*0.42,cy); ctx.lineTo(cx+s*0.42,cy); ctx.stroke()
      ctx.font=`bold ${Math.max(7,s*0.14)}px -apple-system,Helvetica,sans-serif`
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillText('BÜHNE',cx,cy-s*0.1)
    },
    drawGroup(ctx, gx, gy, gw, gh) {
      const mcy=gy+gh/2
      ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=0.8
      ctx.beginPath(); ctx.moveTo(gx+4,mcy); ctx.lineTo(gx+gw-4,mcy); ctx.stroke()
      ctx.font=`bold ${Math.min(12,gh*0.25)}px -apple-system,Helvetica,sans-serif`
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillText('BÜHNE',gx+gw/2,mcy-gh*0.15)
    },
  },
  pflanze: {
    label: 'Pflanze', bg: '#F0FDF4',
    drawCell(ctx, cx, cy, s) {
      const r=s*0.32, pR=s*0.19
      for (let i=0; i<6; i++) {
        const a=(i/6)*Math.PI*2-Math.PI/2
        ctx.beginPath(); ctx.arc(cx+r*Math.cos(a),cy+r*Math.sin(a),pR,0,Math.PI*2)
        ctx.fillStyle='#4ADE80'; ctx.fill()
      }
      ctx.beginPath(); ctx.arc(cx,cy,s*0.13,0,Math.PI*2)
      ctx.fillStyle='#15803D'; ctx.fill()
    },
  },
  baum: {
    label: 'Baum', bg: '#DCFCE7',
    drawCell(ctx, cx, cy, s) {
      ctx.beginPath(); ctx.arc(cx,cy,s*0.42,0,Math.PI*2)
      ctx.fillStyle='#DCFCE7'; ctx.fill()
      ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=Math.max(1,s*0.04); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx,cy,s*0.15,0,Math.PI*2)
      ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=Math.max(0.8,s*0.03); ctx.stroke()
      ctx.lineWidth=Math.max(0.8,s*0.03); ctx.strokeStyle='#1D1D1F'
      for (let i=0; i<8; i++) {
        const a=(i/8)*Math.PI*2
        ctx.beginPath()
        ctx.moveTo(cx+s*0.16*Math.cos(a),cy+s*0.16*Math.sin(a))
        ctx.lineTo(cx+s*0.38*Math.cos(a),cy+s*0.38*Math.sin(a))
        ctx.stroke()
      }
    },
  },
}

const ELEM_CATEGORIES = [
  {
    title: 'Infrastruktur',
    items: ['strom','wasser','netzwerk','heizung'],
  },
  {
    title: 'Architektur',
    items: ['saeule','tuer','fenster','notausgang','treppe','buehne'],
  },
  {
    title: 'Natur & Deko',
    items: ['pflanze','baum'],
  },
]

/* ── SVG icons for palette tiles ── */
const ELEM_ICONS: Record<string, React.ReactNode> = {
  strom: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="2" y="2" width="40" height="40" fill="white" stroke="#1D1D1F" strokeWidth="1.5"/><circle cx="22" cy="20" r="12" fill="white" stroke="#1D1D1F" strokeWidth="1.5"/><rect x="17.5" y="13" width="3" height="7" rx="1" fill="#1D1D1F"/><rect x="23.5" y="13" width="3" height="7" rx="1" fill="#1D1D1F"/><circle cx="22" cy="27" r="2.5" fill="#1D1D1F"/></svg>,
  wasser: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="2" y="2" width="40" height="40" fill="white" stroke="#1D1D1F" strokeWidth="1.5"/><path d="M22 9C22 9 31 19 31 25.5C31 30.2 27 34 22 34C17 34 13 30.2 13 25.5C13 19 22 9 22 9Z" fill="#BFDBFE" stroke="#1D1D1F" strokeWidth="1.5"/><path d="M17 28C17 28 18.5 31 21 31" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  netzwerk: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="2" y="2" width="40" height="40" fill="white" stroke="#1D1D1F" strokeWidth="1.5"/><rect x="9" y="9" width="26" height="26" rx="2" fill="white" stroke="#1D1D1F" strokeWidth="1.5"/><circle cx="22" cy="22" r="3.5" fill="#1D1D1F"/><line x1="22" y1="11" x2="22" y2="18.5" stroke="#1D1D1F" strokeWidth="1.5"/><line x1="22" y1="25.5" x2="22" y2="33" stroke="#1D1D1F" strokeWidth="1.5"/><line x1="11" y1="22" x2="18.5" y2="22" stroke="#1D1D1F" strokeWidth="1.5"/><line x1="25.5" y1="22" x2="33" y2="22" stroke="#1D1D1F" strokeWidth="1.5"/></svg>,
  heizung: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="2" y="2" width="40" height="40" fill="white" stroke="#1D1D1F" strokeWidth="1.5"/><rect x="4" y="16" width="36" height="12" fill="white" stroke="#1D1D1F" strokeWidth="1.5"/><line x1="11" y1="16" x2="11" y2="28" stroke="#1D1D1F" strokeWidth="1.2"/><line x1="17" y1="16" x2="17" y2="28" stroke="#1D1D1F" strokeWidth="1.2"/><line x1="23" y1="16" x2="23" y2="28" stroke="#1D1D1F" strokeWidth="1.2"/><line x1="29" y1="16" x2="29" y2="28" stroke="#1D1D1F" strokeWidth="1.2"/><line x1="35" y1="16" x2="35" y2="28" stroke="#1D1D1F" strokeWidth="1.2"/></svg>,
  saeule: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="2" y="2" width="40" height="40" fill="white" stroke="#1D1D1F" strokeWidth="1.5"/><rect x="8" y="8" width="28" height="28" fill="none" stroke="#1D1D1F" strokeWidth="1.5"/><rect x="14" y="14" width="16" height="16" fill="#1D1D1F"/></svg>,
  tuer: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="2" y="2" width="40" height="40" fill="white" stroke="#1D1D1F" strokeWidth="1.5"/><line x1="10" y1="8" x2="10" y2="36" stroke="#1D1D1F" strokeWidth="4"/><line x1="10" y1="8" x2="36" y2="8" stroke="#1D1D1F" strokeWidth="1.5"/><path d="M10 36 A26 26 0 0 1 36 8" fill="none" stroke="#1D1D1F" strokeWidth="1" strokeDasharray="2.5 2"/></svg>,
  fenster: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="2" y="2" width="40" height="40" fill="white" stroke="#1D1D1F" strokeWidth="1.5"/><rect x="2" y="18" width="40" height="8" fill="white" stroke="#1D1D1F" strokeWidth="1.5"/><line x1="2" y1="22" x2="42" y2="22" stroke="#1D1D1F" strokeWidth="1"/></svg>,
  notausgang: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="2" y="2" width="40" height="40" fill="#DCFCE7" stroke="#16A34A" strokeWidth="1.5"/><polyline points="14,22 26,22" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"/><polyline points="22,16 28,22 22,28" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><text x="22" y="38" fontSize="7" textAnchor="middle" fill="#16A34A" fontWeight="700" fontFamily="system-ui">EXIT</text></svg>,
  treppe: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="2" y="2" width="40" height="40" fill="white" stroke="#1D1D1F" strokeWidth="1.5"/><line x1="2" y1="10" x2="42" y2="10" stroke="#1D1D1F" strokeWidth="1"/><line x1="2" y1="18" x2="42" y2="18" stroke="#1D1D1F" strokeWidth="1"/><line x1="2" y1="26" x2="42" y2="26" stroke="#1D1D1F" strokeWidth="1"/><line x1="2" y1="34" x2="42" y2="34" stroke="#1D1D1F" strokeWidth="1"/></svg>,
  buehne: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="2" y="2" width="40" height="40" fill="white" stroke="#1D1D1F" strokeWidth="1.5" strokeDasharray="4 2"/><line x1="2" y1="22" x2="42" y2="22" stroke="#1D1D1F" strokeWidth="0.8"/><text x="22" y="17" fontSize="7.5" textAnchor="middle" fill="#6E6E73" fontWeight="600" fontFamily="system-ui">BÜHNE</text></svg>,
  pflanze: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="2" y="2" width="40" height="40" fill="#F0FDF4" stroke="#1D1D1F" strokeWidth="1.5"/><circle cx="22" cy="13" r="5.5" fill="#4ADE80"/><circle cx="29.7" cy="18" r="5.5" fill="#4ADE80"/><circle cx="29.7" cy="27" r="5.5" fill="#4ADE80"/><circle cx="22" cy="32" r="5.5" fill="#4ADE80"/><circle cx="14.3" cy="27" r="5.5" fill="#4ADE80"/><circle cx="14.3" cy="18" r="5.5" fill="#4ADE80"/><circle cx="22" cy="22" r="5" fill="#16A34A"/></svg>,
  baum: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="2" y="2" width="40" height="40" fill="#DCFCE7" stroke="#1D1D1F" strokeWidth="1.5"/><circle cx="22" cy="22" r="16" fill="#DCFCE7" stroke="#1D1D1F" strokeWidth="1.5"/><circle cx="22" cy="22" r="6" fill="white" stroke="#1D1D1F" strokeWidth="1"/></svg>,
}

/* ════════════════════════════════════════════════════════════════════════════ */
export default function RaumKonfigurator({
  initialPoints,
  initialElements = [],
  initialTablePool,
  placedTables = [],
  onSave,
  saving,
  saved,
}: RaumKonfiguratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /* ── Canvas state (mutable refs, not React state, for perf) ── */
  const stateRef = useRef({
    points:       initialPoints && initialPoints.length >= 3 ? [...initialPoints] : makeRect(10, 10),
    elements:     [...initialElements] as RaumElement[],
    meterToPx:    DEFAULT_M2PX,
    panOffsetX:   0,
    panOffsetY:   0,
    showDimensions: true,
    showCorners:    true,
    step:           1 as 1 | 2,
    showPlacedTables: false,
    selectedElemType: null as string | null,
    selectedElemId:   null as number | null,
    draggedPtIdx:     null as number | null,
    dragStartPoints:  null as RaumPoint[] | null,
    dragStartMM:      null as { x: number; y: number } | null,
    draggedElemId:    null as number | null,
    dragElemStart:    null as { x: number; y: number } | null,
    dragElemMouse:    null as { x: number; y: number } | null,
    isPanning:        false,
    panStartX:        0,
    panStartY:        0,
    panStartOffX:     0,
    panStartOffY:     0,
    mouseDownTarget:  null as string | null,
    elemIdCounter:    initialElements.length > 0
      ? Math.max(...initialElements.map(e => e.id)) + 1
      : 1,
  })

  /* ── React state for panel / UI ── */
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [showDimensions, setShowDimensions] = useState(true)
  const [showCorners, setShowCorners] = useState(true)
  const [selectedElemType, setSelectedElemType] = useState<string | null>(null)
  const [selectedElemId, setSelectedElemIdState] = useState<number | null>(null)
  const [dimLabel, setDimLabel] = useState('10,00 m × 10,00 m')
  const [elemCount, setElemCount] = useState(0)
  const [tablePool, setTablePool] = useState<RaumTablePool>(
    initialTablePool ?? DEFAULT_TABLE_POOL
  )
  const [showPlacedTables, setShowPlacedTables] = useState(false)
  const placedTablesRef = useRef<PlacedTablePreview[]>(placedTables)
  useEffect(() => { placedTablesRef.current = placedTables }, [placedTables])

  /* ── Canvas helpers ── */
  const m2c = useCallback((x: number, y: number) => {
    const s = stateRef.current
    const canvas = canvasRef.current!
    return { x: canvas.width/2 + s.panOffsetX + x*s.meterToPx, y: canvas.height/2 + s.panOffsetY + y*s.meterToPx }
  }, [])
  const c2m = useCallback((px: number, py: number) => {
    const s = stateRef.current
    const canvas = canvasRef.current!
    return { x: (px-canvas.width/2-s.panOffsetX)/s.meterToPx, y: (py-canvas.height/2-s.panOffsetY)/s.meterToPx }
  }, [])
  const mousePos = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    return { x: (e.clientX-r.left)*(canvas.width/r.width), y: (e.clientY-r.top)*(canvas.height/r.height) }
  }, [])
  const cellPx = () => GRID_SIZE * stateRef.current.meterToPx
  const cellTL = (el: RaumElement) => m2c(el.x, el.y)
  const cellCenter = (el: RaumElement) => m2c(el.x + GRID_SIZE/2, el.y + GRID_SIZE/2)

  /* ── Grouping ── */
  function findGroups(elements: RaumElement[]) {
    const visited = new Set<string>()
    const posMap: Record<string, RaumElement> = {}
    elements.forEach(e => { posMap[eKey(e.x, e.y)] = e })
    const groups: { type: string; elements: RaumElement[]; posSet: Set<string>; bbox: { minX: number; minY: number; maxX: number; maxY: number } }[] = []
    for (const el of elements) {
      const k = eKey(el.x, el.y)
      if (visited.has(k)) continue
      const group = { type: el.type, elements: [] as RaumElement[], posSet: new Set<string>() }
      const queue = [el]
      visited.add(k)
      while (queue.length) {
        const cur = queue.shift()!
        group.elements.push(cur)
        group.posSet.add(eKey(cur.x, cur.y))
        const neighbors = [
          posMap[eKey(cur.x + GRID_SIZE, cur.y)],
          posMap[eKey(cur.x - GRID_SIZE, cur.y)],
          posMap[eKey(cur.x, cur.y + GRID_SIZE)],
          posMap[eKey(cur.x, cur.y - GRID_SIZE)],
        ]
        for (const nb of neighbors) {
          if (nb && nb.type === el.type && !visited.has(eKey(nb.x, nb.y))) {
            visited.add(eKey(nb.x, nb.y)); queue.push(nb)
          }
        }
      }
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
      group.elements.forEach(e => { minX=Math.min(minX,e.x); minY=Math.min(minY,e.y); maxX=Math.max(maxX,e.x); maxY=Math.max(maxY,e.y) })
      groups.push({ ...group, bbox: { minX, minY, maxX, maxY } })
    }
    return groups
  }

  /* ── Draw ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const s = stateRef.current
    const { points, elements, meterToPx, showDimensions: dim, showCorners: corners, step: currentStep, selectedElemId: selElemId } = s

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Grid
    ctx.save(); ctx.strokeStyle='rgba(0,0,0,0.05)'; ctx.lineWidth=1
    const g = GRID_SIZE * meterToPx
    const ox=(canvas.width/2+s.panOffsetX)%g, oy=(canvas.height/2+s.panOffsetY)%g
    for (let x=ox; x<canvas.width; x+=g) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke() }
    for (let y=oy; y<canvas.height; y+=g) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke() }
    ctx.restore()

    // Room polygon
    if (points.length >= 3) {
      ctx.beginPath()
      const f = m2c(points[0].x, points[0].y); ctx.moveTo(f.x, f.y)
      for (let i=1; i<points.length; i++) { const p=m2c(points[i].x,points[i].y); ctx.lineTo(p.x,p.y) }
      ctx.closePath()
      ctx.fillStyle='rgba(29,29,31,0.04)'; ctx.fill()
      ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=2; ctx.stroke()

      if (currentStep===1 && dim) {
        ctx.save()
        for (let i=0; i<points.length; i++) {
          const p1=points[i], p2=points[(i+1)%points.length]
          const len=Math.hypot(p2.x-p1.x,p2.y-p1.y).toFixed(2).replace('.',',')
          const mid=m2c((p1.x+p2.x)/2,(p1.y+p2.y)/2)
          ctx.font='600 11px -apple-system,Helvetica,sans-serif'
          const tw=ctx.measureText(`${len} m`).width, pad=6
          ctx.fillStyle='#1D1D1F'
          ctx.beginPath(); ctx.roundRect(mid.x-tw/2-pad,mid.y-9,tw+pad*2,18,4); ctx.fill()
          ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'
          ctx.fillText(`${len} m`,mid.x,mid.y)
        }
        ctx.restore()
      }
      if (currentStep===1 && corners) {
        for (let i=0; i<points.length; i++) {
          const pC=m2c(points[i].x,points[i].y)
          ctx.beginPath(); ctx.arc(pC.x,pC.y,7,0,2*Math.PI)
          ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=2; ctx.stroke()
          ctx.beginPath(); ctx.arc(pC.x,pC.y,2.5,0,2*Math.PI); ctx.fillStyle='#1D1D1F'; ctx.fill()
        }
      }
    }

    // Elements (step 2)
    if (currentStep===2 && elements.length > 0) {
      const groups = findGroups(elements)
      const cs = cellPx()
      for (const group of groups) {
        const def = ELEM_DEFS[group.type]
        if (!def) continue
        const { posSet } = group
        const isSelected = group.elements.some(e => e.id === selElemId)

        ctx.fillStyle = def.bg || '#fff'
        group.elements.forEach(el => { const tl=cellTL(el); ctx.fillRect(tl.x,tl.y,cs,cs) })

        ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=isSelected?2:1.5
        group.elements.forEach(el => {
          const tl=cellTL(el); const x=tl.x,y=tl.y
          if (!posSet.has(eKey(el.x,el.y-GRID_SIZE))) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+cs,y); ctx.stroke() }
          if (!posSet.has(eKey(el.x+GRID_SIZE,el.y))) { ctx.beginPath(); ctx.moveTo(x+cs,y); ctx.lineTo(x+cs,y+cs); ctx.stroke() }
          if (!posSet.has(eKey(el.x,el.y+GRID_SIZE))) { ctx.beginPath(); ctx.moveTo(x,y+cs); ctx.lineTo(x+cs,y+cs); ctx.stroke() }
          if (!posSet.has(eKey(el.x-GRID_SIZE,el.y))) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+cs); ctx.stroke() }
        })

        if (isSelected) {
          const minX=group.bbox.minX,minY=group.bbox.minY,maxX=group.bbox.maxX,maxY=group.bbox.maxY
          const tl=m2c(minX,minY), br=m2c(maxX+GRID_SIZE,maxY+GRID_SIZE)
          ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=1.5
          ctx.setLineDash([5,4])
          ctx.beginPath(); ctx.rect(tl.x-3,tl.y-3,br.x-tl.x+6,br.y-tl.y+6); ctx.stroke()
          ctx.setLineDash([])
        }

        const minX=group.bbox.minX,minY=group.bbox.minY,maxX=group.bbox.maxX,maxY=group.bbox.maxY
        const bpTL=m2c(minX,minY), bpBR=m2c(maxX+GRID_SIZE,maxY+GRID_SIZE)
        const bpW=bpBR.x-bpTL.x, bpH=bpBR.y-bpTL.y

        if (def.drawGroup && group.elements.length > 1) {
          ctx.save()
          ctx.beginPath(); ctx.rect(bpTL.x+2,bpTL.y+2,bpW-4,bpH-4); ctx.clip()
          def.drawGroup(ctx, bpTL.x, bpTL.y, bpW, bpH)
          ctx.restore()
        } else {
          group.elements.forEach(el => {
            const cc=cellCenter(el)
            ctx.save()
            const tl=cellTL(el)
            ctx.beginPath(); ctx.rect(tl.x+1,tl.y+1,cs-2,cs-2); ctx.clip()
            def.drawCell(ctx, cc.x, cc.y, cs)
            ctx.restore()
          })
        }

        ctx.save()
        const labelSize=Math.max(9,Math.min(11,cs*0.3))
        ctx.font=`500 ${labelSize}px -apple-system,Helvetica,sans-serif`
        ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillStyle='#6E6E73'
        ctx.fillText(def.label, bpTL.x+bpW/2, bpTL.y+bpH+3)
        ctx.restore()
      }
    }

    // Placed seating tables overlay
    if (s.showPlacedTables && placedTablesRef.current.length > 0) {
      for (const t of placedTablesRef.current) {
        const cx2 = m2c(t.pos_x, t.pos_y)
        const len = t.table_length * s.meterToPx
        const wid = t.table_width * s.meterToPx
        ctx.save()
        ctx.translate(cx2.x, cx2.y)
        ctx.rotate((t.rotation * Math.PI) / 180)
        ctx.strokeStyle = '#6366F1'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.fillStyle = 'rgba(99,102,241,0.10)'
        if (t.shape === 'round') {
          ctx.beginPath(); ctx.arc(0, 0, len / 2, 0, Math.PI * 2)
          ctx.fill(); ctx.stroke()
        } else {
          ctx.beginPath(); ctx.roundRect(-len / 2, -wid / 2, len, wid, 3)
          ctx.fill(); ctx.stroke()
        }
        ctx.setLineDash([])
        ctx.fillStyle = '#4338CA'
        ctx.font = `600 ${Math.max(9, Math.min(11, len * 0.15))}px -apple-system,Helvetica,sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(t.name, 0, 0)
        ctx.restore()
      }
    }

    // Update info labels
    if (points.length >= 2) {
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
      points.forEach(p => { minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y) })
      setDimLabel(`${(maxX-minX).toFixed(2).replace('.',',')} m × ${(maxY-minY).toFixed(2).replace('.',',')} m`)
    }
    setElemCount(elements.length)
  }, [m2c, cellTL, cellCenter]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Mouse event handlers ── */
  useEffect(() => {
    if (!canvasRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const canvas = canvasRef.current!
    const s = stateRef.current

    function getPointAtPx(px: number, py: number) {
      if (!s.showCorners) return null
      for (let i=0; i<s.points.length; i++) {
        const pC=m2c(s.points[i].x,s.points[i].y)
        if (Math.hypot(pC.x-px,pC.y-py)<12) return i
      }
      return null
    }

    function addOnEdge(meter: { x: number; y: number }) {
      if (!s.showCorners) return
      let best: { i: number; t: number; a: RaumPoint; b: RaumPoint } | null = null
      let bestD = 0.4
      for (let i=0; i<s.points.length; i++) {
        const a=s.points[i],b=s.points[(i+1)%s.points.length]
        const ax=meter.x-a.x,ay=meter.y-a.y,bx=b.x-a.x,by=b.y-a.y,l2=bx*bx+by*by
        if(!l2) continue
        const t=Math.max(0,Math.min(1,(ax*bx+ay*by)/l2))
        const d=Math.hypot(meter.x-(a.x+t*bx),meter.y-(a.y+t*by))
        if(d<bestD){bestD=d;best={i,t,a,b}}
      }
      if(best){
        const np={x:roomSnap(best.a.x+best.t*(best.b.x-best.a.x)),y:roomSnap(best.a.y+best.t*(best.b.y-best.a.y))}
        const np2:RaumPoint[]=[]
        for(let i=0;i<s.points.length;i++){np2.push(s.points[i]);if(i===best.i)np2.push(np)}
        s.points=np2
        draw()
      }
    }

    function getElemAtPx(px: number, py: number) {
      const cs=cellPx()
      for (let i=s.elements.length-1;i>=0;i--) {
        const tl=cellTL(s.elements[i])
        if(px>=tl.x&&px<=tl.x+cs&&py>=tl.y&&py<=tl.y+cs) return s.elements[i]
      }
      return null
    }

    function onMouseDown(e: MouseEvent) {
      e.preventDefault()
      const {x:mx,y:my}=mousePos(e)
      if(e.button===1){
        s.isPanning=true;s.panStartX=mx;s.panStartY=my;s.panStartOffX=s.panOffsetX;s.panStartOffY=s.panOffsetY
        canvas.style.cursor='grabbing';s.mouseDownTarget='pan';return
      }
      if(e.button===0){
        const meter=c2m(mx,my)
        if(s.step===1){
          const idx=getPointAtPx(mx,my)
          if(idx!==null){
            s.mouseDownTarget='point';s.draggedPtIdx=idx
            s.dragStartPoints=s.points.map(p=>({...p}));s.dragStartMM=meter
            canvas.style.cursor='grabbing'
          } else {s.mouseDownTarget='canvas'}
        } else {
          const el=getElemAtPx(mx,my)
          if(el){
            s.mouseDownTarget='elem';s.draggedElemId=el.id
            s.dragElemStart={x:el.x,y:el.y};s.dragElemMouse=meter
            s.selectedElemId=el.id
            setSelectedElemIdState(el.id)
            canvas.style.cursor='grabbing'
          } else {
            s.mouseDownTarget='canvas2'
            s.selectedElemId=null
            setSelectedElemIdState(null)
          }
        }
      }
    }

    function onMouseMove(e: MouseEvent) {
      const {x:mx,y:my}=mousePos(e)
      if(s.isPanning&&s.mouseDownTarget==='pan'){
        s.panOffsetX=s.panStartOffX+mx-s.panStartX;s.panOffsetY=s.panStartOffY+my-s.panStartY
        draw();return
      }
      if(s.step===1){
        if(s.mouseDownTarget==='point'&&s.draggedPtIdx!==null&&s.dragStartPoints&&s.dragStartMM){
          const meter=c2m(mx,my); const dx=meter.x-s.dragStartMM.x,dy=meter.y-s.dragStartMM.y
          s.points=s.dragStartPoints.map(p=>({...p}))
          s.points[s.draggedPtIdx].x=roomSnap(s.dragStartPoints[s.draggedPtIdx].x+dx)
          s.points[s.draggedPtIdx].y=roomSnap(s.dragStartPoints[s.draggedPtIdx].y+dy)
          draw()
        } else if(s.mouseDownTarget!=='pan'){
          canvas.style.cursor=getPointAtPx(mx,my)!==null?'grab':'crosshair'
        }
      } else {
        if(s.mouseDownTarget==='elem'&&s.draggedElemId!==null&&s.dragElemStart&&s.dragElemMouse){
          const meter=c2m(mx,my); const el=s.elements.find(e=>e.id===s.draggedElemId)
          if(el){
            el.x=elemSnap(s.dragElemStart.x+(meter.x-s.dragElemMouse.x))
            el.y=elemSnap(s.dragElemStart.y+(meter.y-s.dragElemMouse.y))
            draw()
          }
        } else if(s.mouseDownTarget!=='pan'){
          canvas.style.cursor=getElemAtPx(mx,my)?'grab':(s.selectedElemType?'cell':'default')
        }
      }
    }

    function onMouseUp(e: MouseEvent) {
      if(s.step===1){
        if(s.mouseDownTarget==='canvas'&&s.draggedPtIdx===null&&!s.isPanning){
          const {x:mx,y:my}=mousePos(e); addOnEdge(c2m(mx,my))
        }
        s.draggedPtIdx=null;s.dragStartPoints=null
      } else {
        if(s.mouseDownTarget==='canvas2'&&!s.isPanning&&s.selectedElemType){
          const {x:mx,y:my}=mousePos(e)
          const meter=c2m(mx,my)
          const x=elemSnap(meter.x),y=elemSnap(meter.y)
          if(!s.elements.some(e=>Math.abs(e.x-x)<0.01&&Math.abs(e.y-y)<0.01)){
            s.elements.push({id:s.elemIdCounter++,type:s.selectedElemType,x,y})
          }
        }
        s.draggedElemId=null;s.dragElemStart=null;s.dragElemMouse=null
        draw()
      }
      s.isPanning=false;s.mouseDownTarget=null
      canvas.style.cursor=s.step===1?'crosshair':(s.selectedElemType?'cell':'default')
    }

    function onDblClick(e: MouseEvent) {
      const {x:mx,y:my}=mousePos(e)
      if(s.step===1){
        const idx=getPointAtPx(mx,my)
        if(idx!==null&&s.points.length>3){s.points=s.points.filter((_,i)=>i!==idx);draw()}
      } else {
        const el=getElemAtPx(mx,my)
        if(el){
          s.elements=s.elements.filter(e=>e.id!==el.id)
          if(s.selectedElemId===el.id){s.selectedElemId=null;setSelectedElemIdState(null)}
          draw()
        }
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      s.meterToPx=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,s.meterToPx+(e.deltaY>0?-3:3)))
      draw()
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('dblclick', onDblClick)
    canvas.addEventListener('wheel', onWheel, {passive:false})
    canvas.addEventListener('contextmenu', e=>e.preventDefault())

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('dblclick', onDblClick)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [draw, m2c, c2m, mousePos]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Sync React state ↔ stateRef ── */
  useEffect(() => { stateRef.current.showDimensions = showDimensions; draw() }, [showDimensions, draw])
  useEffect(() => { stateRef.current.showCorners = showCorners; draw() }, [showCorners, draw])
  useEffect(() => { stateRef.current.step = Math.min(step, 2) as 1 | 2; draw() }, [step, draw])
  useEffect(() => { stateRef.current.showPlacedTables = showPlacedTables; draw() }, [showPlacedTables, draw])
  useEffect(() => { stateRef.current.selectedElemType = selectedElemType }, [selectedElemType])
  useEffect(() => { stateRef.current.selectedElemId = selectedElemId; draw() }, [selectedElemId, draw])

  /* ── Initial draw ── */
  useEffect(() => { draw() }, [draw])

  /* ── Handlers ── */
  function handleGoToStep2() {
    setStep(2)
    const canvas = canvasRef.current
    if (canvas) canvas.style.cursor = 'default'
    setSelectedElemType(null)
    stateRef.current.selectedElemType = null
    setSelectedElemIdState(null)
    stateRef.current.selectedElemId = null
  }
  function handleGoToStep1() { setStep(1); const canvas=canvasRef.current; if(canvas) canvas.style.cursor='crosshair' }
  function handleReset() {
    stateRef.current.points = makeRect(10, 10)
    stateRef.current.panOffsetX = 0; stateRef.current.panOffsetY = 0
    stateRef.current.meterToPx = DEFAULT_M2PX
    draw()
  }
  function handleZoomReset() { stateRef.current.meterToPx = DEFAULT_M2PX; draw() }
  function handlePanReset() { stateRef.current.panOffsetX = 0; stateRef.current.panOffsetY = 0; draw() }
  function handleSelectElemType(type: string) {
    setSelectedElemType(type)
    stateRef.current.selectedElemType = type
    const canvas = canvasRef.current; if (canvas) canvas.style.cursor = 'cell'
  }
  function handleDeleteSelected() {
    const s = stateRef.current
    if (!s.selectedElemId) return
    s.elements = s.elements.filter(e => e.id !== s.selectedElemId)
    s.selectedElemId = null
    setSelectedElemIdState(null)
    draw()
  }
  function handleGoToStep3() { setStep(3) }
  function handleSave() {
    onSave?.(stateRef.current.points, stateRef.current.elements, tablePool)
  }

  const selectedElem = stateRef.current.elements.find(e => e.id === selectedElemId)

  /* ── Styles ── */
  const btnXs: React.CSSProperties = {
    display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px',
    borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer',
    border:'1px solid rgba(0,0,0,0.14)', background:'#fff',
    color:'#6E6E73', transition:'all 0.12s', fontFamily:'inherit',
  }
  const switchTrack = (checked: boolean): React.CSSProperties => ({
    position:'relative', display:'inline-block', width:40, height:22,
    background: checked ? '#1D1D1F' : '#AEAEB2', borderRadius:11, cursor:'pointer',
    transition:'background 0.2s', flexShrink:0,
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Step bar */}
      <div style={{ display:'flex', alignItems:'center', background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:10, padding:4, width:'fit-content', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
        {[{n:1,label:'Grundriss'},{n:2,label:'Raumdetails'},{n:3,label:'Tische'}].map((s,i) => (
          <React.Fragment key={s.n}>
            {i>0 && <div style={{width:1,height:20,background:'rgba(0,0,0,0.08)',margin:'0 2px'}}/>}
            <button
              onClick={s.n===1?handleGoToStep1:s.n===2?handleGoToStep2:handleGoToStep3}
              style={{
                display:'flex', alignItems:'center', gap:7, padding:'6px 14px',
                borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer',
                border:'none', whiteSpace:'nowrap', transition:'all 0.15s',
                background: step===s.n ? '#1D1D1F' : 'none',
                color: step===s.n ? '#fff' : '#6E6E73',
                fontFamily:'inherit',
              }}>
              <span style={{
                width:18, height:18, borderRadius:'50%', fontSize:11, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                background: step===s.n ? 'rgba(255,255,255,0.2)' : step>s.n ? '#34C759' : 'rgba(0,0,0,0.08)',
                color: step===s.n ? '#fff' : step>s.n ? '#fff' : '#6E6E73',
              }}>
                {step>s.n ? '✓' : s.n}
              </span>
              {s.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Body grid */}
      <div style={{ display:'grid', gridTemplateColumns:'248px 1fr', gap:20, alignItems:'start' }}>

        {/* Left panel */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.08)', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', overflow:'hidden' }}>

          {/* Step 1: toggles */}
          {step===1 && (
            <div style={{ padding:'16px 16px 14px' }}>
              <p style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.09em', color:'#AEAEB2', marginBottom:12 }}>Anzeige</p>
              {[
                { label:'Kantenlängen', checked:showDimensions, onChange:setShowDimensions },
                { label:'Eckpunkte',    checked:showCorners,    onChange:setShowCorners },
              ].map(({ label, checked, onChange }) => (
                <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0' }}>
                  <span style={{ fontSize:13, color:'#1D1D1F' }}>{label}</span>
                  <div style={switchTrack(checked)} onClick={() => onChange(!checked)}>
                    <div style={{
                      position:'absolute', top:3, left:3, width:16, height:16,
                      background:'#fff', borderRadius:'50%', transition:'transform 0.2s',
                      transform: checked ? 'translateX(18px)' : 'translateX(0)',
                      boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                    }}/>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 2: element palette */}
          {step===2 && (
            <div style={{ maxHeight:'calc(100vh - 260px)', overflowY:'auto' }}>
              {selectedElemId && selectedElem && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'rgba(29,29,31,0.06)', borderBottom:'1px solid rgba(0,0,0,0.08)', fontSize:12, fontWeight:500 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#1D1D1F', flexShrink:0 }}/>
                  <span>{ELEM_DEFS[selectedElem.type]?.label ?? selectedElem.type} ausgewählt</span>
                  <button onClick={handleDeleteSelected} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', border:'1px solid rgba(255,59,48,0.3)', background:'rgba(255,59,48,0.08)', color:'#FF3B30' }}>
                    ✕ Entfernen
                  </button>
                </div>
              )}
              {ELEM_CATEGORIES.map(cat => (
                <div key={cat.title} style={{ padding:'16px 16px 14px', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
                  <p style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.09em', color:'#AEAEB2', marginBottom:10 }}>{cat.title}</p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    {cat.items.map(type => {
                      const def = ELEM_DEFS[type]
                      if (!def) return null
                      return (
                        <div key={type}
                          onClick={() => handleSelectElemType(type)}
                          style={{
                            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                            gap:5, padding:'10px 6px 9px', borderRadius:10, cursor:'pointer',
                            border: selectedElemType===type ? '1.5px solid #1D1D1F' : '1.5px solid rgba(0,0,0,0.08)',
                            background: selectedElemType===type ? '#fff' : '#F5F5F7',
                            boxShadow: selectedElemType===type ? '0 0 0 2px #1D1D1F' : 'none',
                            textAlign:'center', transition:'all 0.12s',
                          }}>
                          <div style={{ width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {ELEM_ICONS[type]}
                          </div>
                          <span style={{ fontSize:11, fontWeight:500, color:'#1D1D1F', lineHeight:1.2 }}>{def.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div style={{ padding:'12px 16px' }}>
                <p style={{ fontSize:12, color:'#AEAEB2', lineHeight:1.5 }}>Element wählen → Zelle klicken. Gleiche angrenzende Elemente verschmelzen. Doppelklick = löschen.</p>
              </div>
            </div>
          )}
          {/* Step 3: table pool config — multi-type */}
          {step===3 && (
            <div style={{ overflowY:'auto', maxHeight:'calc(100vh - 260px)' }}>
              {tablePool.types.length === 0 && (
                <p style={{ padding:'16px', fontSize:12, color:'#AEAEB2', lineHeight:1.5 }}>
                  Noch keine Tischtypen. Unten hinzufügen.
                </p>
              )}
              {tablePool.types.map((type, idx) => (
                <div key={type.id} style={{ padding:'12px 14px', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                    <div style={{ width:20, height:20, flexShrink:0 }}>
                      {type.shape==='round'
                        ? <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#EEF2FF" stroke="#6366F1" strokeWidth="1.5"/></svg>
                        : <svg viewBox="0 0 20 20"><rect x="2" y="5" width="16" height="10" rx="2" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.5"/></svg>
                      }
                    </div>
                    <span style={{ fontSize:12, fontWeight:600, flex:1 }}>
                      {type.shape==='round' ? 'Rund' : 'Eckig'} #{idx+1}
                    </span>
                    <button
                      onClick={() => setTablePool(p => ({ types: p.types.filter(t => t.id !== type.id) }))}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#FF3B30', fontSize:16, lineHeight:1, padding:'0 2px' }}
                    >×</button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                      <span style={{ fontSize:11, color:'#6E6E73' }}>Anzahl</span>
                      <input type="number" min={0} max={50} value={type.count}
                        onChange={e => setTablePool(p => ({ types: p.types.map(t => t.id===type.id ? { ...t, count: Math.max(0, parseInt(e.target.value)||0) } : t) }))}
                        style={{ width:56, padding:'4px 7px', borderRadius:6, border:'1px solid rgba(0,0,0,0.14)', fontSize:12, fontFamily:'inherit', textAlign:'center' }}
                      />
                    </label>
                    {type.shape==='round' ? (
                      <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                        <span style={{ fontSize:11, color:'#6E6E73' }}>⌀ (m)</span>
                        <input type="number" min={0.5} max={6} step={0.1} value={type.diameter}
                          onChange={e => setTablePool(p => ({ types: p.types.map(t => t.id===type.id ? { ...t, diameter: Math.max(0.5, parseFloat(e.target.value)||1.5) } : t) }))}
                          style={{ width:56, padding:'4px 7px', borderRadius:6, border:'1px solid rgba(0,0,0,0.14)', fontSize:12, fontFamily:'inherit', textAlign:'center' }}
                        />
                      </label>
                    ) : (
                      <>
                        <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                          <span style={{ fontSize:11, color:'#6E6E73' }}>Länge (m)</span>
                          <input type="number" min={0.5} max={10} step={0.1} value={type.length}
                            onChange={e => setTablePool(p => ({ types: p.types.map(t => t.id===type.id ? { ...t, length: Math.max(0.5, parseFloat(e.target.value)||2) } : t) }))}
                            style={{ width:56, padding:'4px 7px', borderRadius:6, border:'1px solid rgba(0,0,0,0.14)', fontSize:12, fontFamily:'inherit', textAlign:'center' }}
                          />
                        </label>
                        <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                          <span style={{ fontSize:11, color:'#6E6E73' }}>Breite (m)</span>
                          <input type="number" min={0.3} max={5} step={0.1} value={type.width}
                            onChange={e => setTablePool(p => ({ types: p.types.map(t => t.id===type.id ? { ...t, width: Math.max(0.3, parseFloat(e.target.value)||0.8) } : t) }))}
                            style={{ width:56, padding:'4px 7px', borderRadius:6, border:'1px solid rgba(0,0,0,0.14)', fontSize:12, fontFamily:'inherit', textAlign:'center' }}
                          />
                        </label>
                      </>
                    )}
                    <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                      <span style={{ fontSize:11, color:'#6E6E73' }}>Plätze</span>
                      <input type="number" min={1} max={50} value={type.seats ?? ''}
                        placeholder="auto"
                        onChange={e => {
                          const v = parseInt(e.target.value)
                          setTablePool(p => ({ types: p.types.map(t => t.id===type.id ? { ...t, seats: isNaN(v) || v < 1 ? undefined : Math.min(50, v) } : t) }))
                        }}
                        style={{ width:56, padding:'4px 7px', borderRadius:6, border:'1px solid rgba(0,0,0,0.14)', fontSize:12, fontFamily:'inherit', textAlign:'center' }}
                      />
                    </label>
                  </div>
                </div>
              ))}
              <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:6 }}>
                <button
                  onClick={() => setTablePool(p => ({ types: [...p.types, { id: makeTypeId(), shape:'round', count:1, diameter:1.5, length:1.5, width:1.5 }] }))}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 10px', borderRadius:8, border:'1px dashed rgba(99,102,241,0.5)', background:'rgba(99,102,241,0.04)', cursor:'pointer', fontSize:12, color:'#6366F1', fontFamily:'inherit', fontWeight:500 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Runden Tischtyp
                </button>
                <button
                  onClick={() => setTablePool(p => ({ types: [...p.types, { id: makeTypeId(), shape:'rectangular', count:1, diameter:1.5, length:2.0, width:0.8 }] }))}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 10px', borderRadius:8, border:'1px dashed rgba(34,197,94,0.5)', background:'rgba(34,197,94,0.04)', cursor:'pointer', fontSize:12, color:'#16A34A', fontFamily:'inherit', fontWeight:500 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Eckigen Tischtyp
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Canvas card */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.08)', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Toolbar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid rgba(0,0,0,0.08)', flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#F5F5F7', border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, padding:'5px 12px', fontSize:13, fontWeight:500, fontFamily:'monospace', color:'#1D1D1F' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 3H3v7h18V3z"/></svg>
                {dimLabel}
              </div>
              {step===2 && (
                <span style={{ fontSize:12, color:'#6E6E73' }}>
                  Elemente: <span style={{ fontSize:10, fontWeight:700, minWidth:16, height:16, borderRadius:8, background:'#1D1D1F', color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'0 4px', marginLeft:4 }}>{elemCount}</span>
                </span>
              )}
            </div>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {placedTables.length > 0 && (
                <button onClick={() => setShowPlacedTables(v => !v)} style={{ ...btnXs, background: showPlacedTables ? '#EEF2FF' : '#fff', borderColor: showPlacedTables ? '#6366F1' : undefined, color: showPlacedTables ? '#4338CA' : '#6E6E73' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="7" height="4" rx="1"/><rect x="14" y="14" width="7" height="4" rx="1"/><ellipse cx="6.5" cy="15" rx="3.5" ry="3.5"/><ellipse cx="17.5" cy="7" rx="3.5" ry="3.5"/></svg>
                  Tische
                </button>
              )}
              <button onClick={handleZoomReset} style={btnXs}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Zoom zurücksetzen
              </button>
              <button onClick={handlePanReset} style={btnXs}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>
                Pan zurücksetzen
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', padding:28, background:'#F5F5F7', minHeight:480 }}>
            <div style={{ position:'relative', background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.14)', boxShadow:'0 4px 16px rgba(0,0,0,0.07)', overflow:'hidden', display:'inline-block' }}>
              <canvas ref={canvasRef} width={780} height={480} style={{ display:'block', cursor:'crosshair', width:780, height:480 }} />
            </div>
          </div>

          {/* Status bar */}
          <div style={{ padding:'10px 16px', borderTop:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12, color:'#6E6E73', flexWrap:'wrap', gap:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              {step===1 ? (
                <>
                  <span>Eckpunkte ziehen</span><span>·</span>
                  <span>Auf Kante klicken = neuer Punkt</span><span>·</span>
                  <span>Doppelklick = löschen</span>
                </>
              ) : step===2 ? (
                <>
                  <span>Element wählen → Zelle klicken</span><span>·</span>
                  <span>Ziehen = verschieben</span><span>·</span>
                  <span>Doppelklick = löschen</span>
                </>
              ) : (
                <span>Anzahl und Größe der verfügbaren Tische festlegen</span>
              )}
            </div>
            {onSave && (
              <span style={{ fontSize:12, color: saved ? '#34C759' : '#AEAEB2' }}>
                {saved ? 'Gespeichert ✓' : saving ? 'Wird gespeichert…' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        {step===1 && (
          <>
            <button onClick={handleReset} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:10, fontSize:14, fontWeight:500, cursor:'pointer', border:'1px solid rgba(0,0,0,0.14)', background:'#fff', color:'#1D1D1F', fontFamily:'inherit' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.07"/></svg>
              Zurücksetzen
            </button>
            <button onClick={handleGoToStep2} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', borderRadius:10, fontSize:14, fontWeight:500, cursor:'pointer', border:'none', background:'#1D1D1F', color:'#fff', fontFamily:'inherit' }}>
              Weiter zu Schritt 2
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </>
        )}
        {step===2 && (
          <>
            <button onClick={handleGoToStep1} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:10, fontSize:14, fontWeight:500, cursor:'pointer', border:'1px solid rgba(0,0,0,0.14)', background:'#fff', color:'#1D1D1F', fontFamily:'inherit' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Zurück zu Schritt 1
            </button>
            <button onClick={handleGoToStep3} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', borderRadius:10, fontSize:14, fontWeight:500, cursor:'pointer', border:'none', background:'#1D1D1F', color:'#fff', fontFamily:'inherit' }}>
              Weiter zu Schritt 3
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </>
        )}
        {step===3 && (
          <>
            <button onClick={handleGoToStep2} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:10, fontSize:14, fontWeight:500, cursor:'pointer', border:'1px solid rgba(0,0,0,0.14)', background:'#fff', color:'#1D1D1F', fontFamily:'inherit' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Zurück zu Schritt 2
            </button>
            {onSave && (
              <button onClick={handleSave} disabled={saving} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', borderRadius:10, fontSize:14, fontWeight:500, cursor: saving ? 'not-allowed' : 'pointer', border:'none', background:'#34C759', color:'#fff', fontFamily:'inherit', opacity: saving ? 0.7 : 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                {saving ? 'Wird gespeichert…' : 'Raum fertigstellen'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
