'use client'
import React, { useRef, useCallback, useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import {
  CANVAS_W, CANVAS_H,
  type DekoItem, type DekoItemType, type DekoItemData,
  type PresenceUser, type DekoCatalogItem, type DekoFlatRate, type DekoRole,
} from '@/lib/deko/types'
import { useDekoCanvas } from '@/lib/deko/hooks/useDekoCanvas'
import { useDekoRealtime } from '@/lib/deko/hooks/useDekoRealtime'
import DekoItemRenderer from './items/DekoItemRenderer'
import DekoCommentOverlay from './DekoCommentOverlay'
import DekoBudgetBar from './DekoBudgetBar'

// ── Constants & types ─────────────────────────────────────────────────────────

export type ScreenRect = { left: number; top: number; width: number; height: number }
type LassoRect = { x1: number; y1: number; x2: number; y2: number }

const SNAP_GRID = 20

const AUTO_LIGHTBOX = new Set<DekoItemType>([
  'image_upload', 'image_url', 'color_palette',
  'article', 'flat_rate_article', 'fabric', 'link_card', 'vote_card',
])

const AUTO_HEIGHT_TYPES = new Set<DekoItemType>(['text_block', 'sticky_note', 'checklist'])

const ITEM_LABELS: Record<DekoItemType, string> = {
  image_upload: 'Bild', image_url: 'Bild (URL)', color_palette: 'Farbpalette',
  color_swatch: 'Farbfeld', text_block: 'Textblock', sticky_note: 'Notiz',
  heading: 'Überschrift', article: 'Artikel', flat_rate_article: 'Pauschale',
  fabric: 'Stoff', frame: 'Rahmen', divider: 'Trennlinie', area_label: 'Bereichslabel',
  vote_card: 'Abstimmung', checklist: 'Checkliste', link_card: 'Link',
  table_ref: 'Tisch', room_info: 'Rauminfo', guest_count: 'Gästezahl',
}

// ── CSS animations (injected once) ────────────────────────────────────────────

let _animsInjected = false
function injectAnims() {
  if (_animsInjected || typeof document === 'undefined') return
  _animsInjected = true
  const s = document.createElement('style')
  s.textContent = `@keyframes deko-fadein { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }`
  document.head.appendChild(s)
}

// ── Imperative handle ─────────────────────────────────────────────────────────

export interface DekoCanvasHandle {
  deleteItem: (id: string) => Promise<void>
  updateItemData: (id: string, data: DekoItemData, prevData?: DekoItemData) => Promise<void>
  bringToFront: (id: string) => Promise<void>
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  canvasId: string
  eventId: string
  role: DekoRole
  userId: string
  userName: string
  isFrozen: boolean
  initialItems: DekoItem[]
  initialCatalog: DekoCatalogItem[]
  initialFlatRates: DekoFlatRate[]
  onItemSelect?: (item: DekoItem | null) => void
  onOpenLightbox?: (item: DekoItem, anchor?: ScreenRect) => void
  pendingItemType?: DekoItemType | null
  onPendingItemPlaced?: () => void
}

// ── Presence cursor ───────────────────────────────────────────────────────────

function PresenceCursor({ user, x, y }: { user: PresenceUser; x: number; y: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none', zIndex: 9999, transform: 'translate(-2px, -2px)' }}>
      <svg width="16" height="20" viewBox="0 0 16 20">
        <path d="M0 0 L0 16 L4 12 L8 20 L10 19 L6 11 L12 11 Z" fill={user.color} stroke="white" strokeWidth="1.5" />
      </svg>
      <div style={{ marginTop: 2, background: user.color, color: '#fff', fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
        {user.user_name}
      </div>
    </div>
  )
}

// ── Dot grid ──────────────────────────────────────────────────────────────────

function CanvasBackground() {
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <defs>
        <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(0,0,0,0.07)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dots)" />
    </svg>
  )
}

// ── Minimap ───────────────────────────────────────────────────────────────────

const MINI_W = 160
const MINI_H = Math.round(MINI_W * CANVAS_H / CANVAS_W)
const MINI_SCALE = MINI_W / CANVAS_W

function Minimap({ items, panX, panY, zoom, vpW, vpH, onNavigate }: {
  items: DekoItem[]; panX: number; panY: number; zoom: number
  vpW: number; vpH: number; onNavigate: (px: number, py: number) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const isDragging = useRef(false)
  const navigateRef = useRef(onNavigate)
  navigateRef.current = onNavigate
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const vpRef = useRef({ w: vpW, h: vpH })
  vpRef.current = { w: vpW, h: vpH }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = (e.clientX - rect.left) / MINI_SCALE
      const cy = (e.clientY - rect.top) / MINI_SCALE
      navigateRef.current(-(cx * zoomRef.current - vpRef.current.w / 2), -(cy * zoomRef.current - vpRef.current.h / 2))
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    e.stopPropagation()
    isDragging.current = true
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = (e.clientX - rect.left) / MINI_SCALE
    const cy = (e.clientY - rect.top) / MINI_SCALE
    onNavigate(-(cx * zoom - vpW / 2), -(cy * zoom - vpH / 2))
  }

  const winX = -panX / zoom
  const winY = -panY / zoom
  const winW = vpW / zoom
  const winH = vpH / zoom
  return (
    <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 50, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, overflow: 'hidden', background: '#F5F3EF', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
      <svg ref={svgRef} width={MINI_W} height={MINI_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} style={{ display: 'block', cursor: 'crosshair' }} onMouseDown={handleMouseDown}>
        <rect width={CANVAS_W} height={CANVAS_H} fill="#FDFCFA" />
        {items.map(item => (
          <rect key={item.id} x={item.x} y={item.y} width={item.width} height={item.height} fill="rgba(201,185,154,0.55)" rx="4" />
        ))}
        <rect
          x={Math.max(0, winX)} y={Math.max(0, winY)}
          width={Math.min(winW, CANVAS_W - Math.max(0, winX))}
          height={Math.min(winH, CANVAS_H - Math.max(0, winY))}
          fill="rgba(100,120,220,0.08)" stroke="#7B9FFF" strokeWidth={14} rx="4"
        />
      </svg>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const DekoCanvas = forwardRef<DekoCanvasHandle, Props>(function DekoCanvas({
  canvasId, eventId, role, userId, userName,
  isFrozen, initialItems, initialCatalog, initialFlatRates,
  onItemSelect, onOpenLightbox, pendingItemType, onPendingItemPlaced,
}, ref) {
  const canEdit = !isFrozen && (role === 'veranstalter' || role === 'brautpaar' || role === 'dienstleister')
  const viewportRef = useRef<HTMLDivElement>(null)
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [othersItems, setOthersItems] = useState<Set<string>>(new Set())
  const [newItemId, setNewItemId] = useState<string | null>(null)
  const [vpDims, setVpDims] = useState({ w: 800, h: 600 })
  const lassoStartRef = useRef<{ x: number; y: number } | null>(null)
  const lassoRef = useRef<LassoRect | null>(null)
  const [lasso, setLasso] = useState<LassoRect | null>(null)
  const spaceHeld = useRef(false)
  const [spaceActive, setSpaceActive] = useState(false)

  const canvas = useDekoCanvas(canvasId, eventId, initialItems, initialCatalog, initialFlatRates, canEdit)

  useImperativeHandle(ref, () => ({
    deleteItem: canvas.deleteItem,
    updateItemData: canvas.updateItemData,
    bringToFront: canvas.bringToFront,
  }), [canvas.deleteItem, canvas.updateItemData, canvas.bringToFront])

  useEffect(() => { injectAnims() }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setVpDims({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const tag = document.activeElement?.tagName
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable
      if (isEditing) return
      e.preventDefault()
      if (!spaceHeld.current) { spaceHeld.current = true; setSpaceActive(true) }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      spaceHeld.current = false; setSpaceActive(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const { broadcastCursor } = useDekoRealtime({
    canvasId, userId, userName,
    onItemInserted: (item) => {
      canvas.setItems(prev => prev.find(i => i.id === item.id) ? prev : [...prev, item])
    },
    onItemUpdated: (item) => {
      if (canvas.dragState?.itemId === item.id) return
      canvas.setItems(prev => prev.map(i => i.id === item.id ? item : i))
    },
    onItemDeleted: (id) => { canvas.setItems(prev => prev.filter(i => i.id !== id)) },
    onPresenceSync: (users) => {
      const others = users.filter(u => u.user_id !== userId)
      setPresenceUsers(others)
      setOthersItems(new Set(others.filter(u => u.dragging_item_id).map(u => u.dragging_item_id!)))
    },
  })

  // ── Pan inertia ───────────────────────────────────────────────────────────

  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const velRef = useRef({ vx: 0, vy: 0 })
  const lastPanRef = useRef({ x: 0, y: 0, t: 0 })
  const inertiaRafRef = useRef<number | null>(null)

  const startInertia = useCallback((vx: number, vy: number) => {
    if (inertiaRafRef.current) cancelAnimationFrame(inertiaRafRef.current)
    let pvx = vx, pvy = vy
    const tick = () => {
      pvx *= 0.88; pvy *= 0.88
      if (Math.abs(pvx) < 0.5 && Math.abs(pvy) < 0.5) { inertiaRafRef.current = null; return }
      canvas.setViewport(v => ({ ...v, panX: v.panX + pvx, panY: v.panY + pvy }))
      inertiaRafRef.current = requestAnimationFrame(tick)
    }
    inertiaRafRef.current = requestAnimationFrame(tick)
  }, [canvas.setViewport])

  // ── Multi-drag ────────────────────────────────────────────────────────────

  const multiDragStartRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  // ── Mouse handlers ────────────────────────────────────────────────────────

  const handleViewportMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && spaceHeld.current)) {
      e.preventDefault()
      if (inertiaRafRef.current) { cancelAnimationFrame(inertiaRafRef.current); inertiaRafRef.current = null }
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY, px: canvas.viewport.panX, py: canvas.viewport.panY }
      lastPanRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }
      velRef.current = { vx: 0, vy: 0 }
      return
    }
    if ((e.target as HTMLElement).dataset.canvasbg === 'true') {
      if (canEdit) {
        const rect = viewportRef.current?.getBoundingClientRect()
        if (rect) {
          const vx = e.clientX - rect.left
          const vy = e.clientY - rect.top
          lassoStartRef.current = { x: vx, y: vy }
          const r: LassoRect = { x1: vx, y1: vy, x2: vx, y2: vy }
          lassoRef.current = r
          setLasso(r)
        }
      }
      canvas.setSelectedId(null)
      canvas.setSelectedIds([])
      onItemSelect?.(null)
    }
  }, [canvas, onItemSelect, canEdit])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      canvas.setViewport(v => ({ ...v, panX: panStart.current.px + dx, panY: panStart.current.py + dy }))
      const now = Date.now()
      const dt = Math.max(1, now - lastPanRef.current.t)
      velRef.current = { vx: (e.clientX - lastPanRef.current.x) / dt * 16, vy: (e.clientY - lastPanRef.current.y) / dt * 16 }
      lastPanRef.current = { x: e.clientX, y: e.clientY, t: now }
      return
    }

    if (lassoStartRef.current) {
      const vx = e.clientX - rect.left
      const vy = e.clientY - rect.top
      const r: LassoRect = { x1: lassoStartRef.current.x, y1: lassoStartRef.current.y, x2: vx, y2: vy }
      lassoRef.current = r
      setLasso(r)
      return
    }

    if (canvas.resizeState) {
      const dx = (e.clientX - canvas.resizeState.startMouseX) / canvas.viewport.zoom
      const dy = (e.clientY - canvas.resizeState.startMouseY) / canvas.viewport.zoom
      canvas.updateItemSizeLocal(canvas.resizeState.itemId, Math.max(40, Math.round(canvas.resizeState.startWidth + dx)), Math.max(40, Math.round(canvas.resizeState.startHeight + dy)))
      return
    }

    if (canvas.dragState) {
      const rawDx = (e.clientX - canvas.dragState.startMouseX) / canvas.viewport.zoom
      const rawDy = (e.clientY - canvas.dragState.startMouseY) / canvas.viewport.zoom
      const snap = canvas.snapToGrid
      const sg = (v: number) => snap ? Math.round(v / SNAP_GRID) * SNAP_GRID : v

      if (multiDragStartRef.current.size > 1) {
        multiDragStartRef.current.forEach((start, sid) => {
          canvas.updateItemPosition(sid, sg(Math.round(start.x + rawDx)), sg(Math.round(start.y + rawDy)))
        })
      } else {
        canvas.updateItemPosition(canvas.dragState.itemId, sg(Math.round(canvas.dragState.startItemX + rawDx)), sg(Math.round(canvas.dragState.startItemY + rawDy)))
      }
      broadcastCursor((e.clientX - rect.left - canvas.viewport.panX) / canvas.viewport.zoom, (e.clientY - rect.top - canvas.viewport.panY) / canvas.viewport.zoom, canvas.dragState.itemId)
      return
    }

    broadcastCursor((e.clientX - rect.left - canvas.viewport.panX) / canvas.viewport.zoom, (e.clientY - rect.top - canvas.viewport.panY) / canvas.viewport.zoom)
  }, [canvas, broadcastCursor])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false
      startInertia(velRef.current.vx, velRef.current.vy)
      return
    }

    if (lassoStartRef.current) {
      const r = lassoRef.current
      if (r) {
        const { panX, panY, zoom } = canvas.viewport
        const lx1 = (Math.min(r.x1, r.x2) - panX) / zoom
        const ly1 = (Math.min(r.y1, r.y2) - panY) / zoom
        const lx2 = (Math.max(r.x1, r.x2) - panX) / zoom
        const ly2 = (Math.max(r.y1, r.y2) - panY) / zoom
        const captured = canvas.items
          .filter(item => item.x < lx2 && item.x + item.width > lx1 && item.y < ly2 && item.y + item.height > ly1)
          .map(i => i.id)
        if (captured.length > 0) canvas.setSelectedIds(captured)
      }
      lassoStartRef.current = null
      lassoRef.current = null
      setLasso(null)
      return
    }

    if (canvas.resizeState) {
      const dx = (e.clientX - canvas.resizeState.startMouseX) / canvas.viewport.zoom
      const dy = (e.clientY - canvas.resizeState.startMouseY) / canvas.viewport.zoom
      const resizedItem = canvas.items.find(i => i.id === canvas.resizeState!.itemId)
      const patch = resizedItem && AUTO_HEIGHT_TYPES.has(resizedItem.type) ? { _manual_size: true } : undefined
      canvas.updateItemSize(canvas.resizeState.itemId, Math.max(40, Math.round(canvas.resizeState.startWidth + dx)), Math.max(40, Math.round(canvas.resizeState.startHeight + dy)), patch as Partial<DekoItemData> | undefined)
      canvas.endResize()
      return
    }

    if (canvas.dragState) {
      const rawDx = (e.clientX - canvas.dragState.startMouseX) / canvas.viewport.zoom
      const rawDy = (e.clientY - canvas.dragState.startMouseY) / canvas.viewport.zoom
      const snap = canvas.snapToGrid
      const sg = (v: number) => snap ? Math.round(v / SNAP_GRID) * SNAP_GRID : v

      if (multiDragStartRef.current.size > 1) {
        multiDragStartRef.current.forEach((start, sid) => {
          const nx = sg(Math.round(start.x + rawDx))
          const ny = sg(Math.round(start.y + rawDy))
          canvas.commitItemPosition(sid, nx, ny, start.x, start.y)
        })
        multiDragStartRef.current.clear()
      } else {
        const nx = sg(Math.round(canvas.dragState.startItemX + rawDx))
        const ny = sg(Math.round(canvas.dragState.startItemY + rawDy))
        canvas.commitItemPosition(canvas.dragState.itemId, nx, ny, canvas.dragState.startItemX, canvas.dragState.startItemY)
      }
      canvas.endDrag()
    }
  }, [canvas, startInertia])

  // ── Wheel zoom ────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = viewportRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    canvas.setViewport(v => {
      const factor = e.ctrlKey || e.metaKey ? (e.deltaY > 0 ? 0.9 : 1.1) : (e.deltaY > 0 ? 0.93 : 1.075)
      const nz = Math.min(4, Math.max(0.1, v.zoom * factor))
      const s = nz / v.zoom
      return { zoom: nz, panX: mx - s * (mx - v.panX), panY: my - s * (my - v.panY) }
    })
  }, [canvas])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const h = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [])

  // ── Keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable
      if (isEditing) return

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); canvas.undo(); return }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); canvas.redo(); return }
      if (canvas.selectedId && (e.metaKey || e.ctrlKey) && e.key === ']') { canvas.bringToFront(canvas.selectedId); return }
      if (e.key === 'Escape') { canvas.setSelectedId(null); canvas.setSelectedIds([]); return }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (canvas.selectedIds.length > 1) canvas.deleteItems(canvas.selectedIds)
        else if (canvas.selectedId) canvas.deleteItem(canvas.selectedId)
        return
      }

      const id = canvas.selectedId
      if (!id) return
      const step = e.shiftKey ? 10 : 1
      if (e.key === 'ArrowLeft') { e.preventDefault(); canvas.nudgeItem(id, -step, 0) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); canvas.nudgeItem(id, step, 0) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); canvas.nudgeItem(id, 0, -step) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); canvas.nudgeItem(id, 0, step) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canvas])

  // ── Render ────────────────────────────────────────────────────────────────

  const { zoom, panX, panY } = canvas.viewport
  const sortedItems = [...canvas.items].sort((a, b) => a.z_index - b.z_index)
  const selectedSet = new Set(canvas.selectedIds)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg, #F5F3EF)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 4px' }}>
          <button onClick={() => canvas.setViewport(v => ({ ...v, zoom: Math.max(0.1, v.zoom * 0.8) }))} style={zoomBtnStyle}>−</button>
          <span style={{ minWidth: 44, textAlign: 'center', fontSize: 11, fontWeight: 600 }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => canvas.setViewport(v => ({ ...v, zoom: Math.min(4, v.zoom * 1.25) }))} style={zoomBtnStyle}>+</button>
        </div>
        <button onClick={() => canvas.setViewport({ zoom: 0.45, panX: 0, panY: 0 })} style={{ ...zoomBtnStyle, padding: '0 8px', width: 'auto', fontSize: 11 }}>Reset</button>
        <button onClick={canvas.undo} disabled={!canvas.canUndo} title="Rückgängig (Ctrl+Z)" style={{ ...zoomBtnStyle, opacity: canvas.canUndo ? 1 : 0.35, fontSize: 14 }}>↩</button>
        <button onClick={canvas.redo} disabled={!canvas.canRedo} title="Wiederholen (Ctrl+Y)" style={{ ...zoomBtnStyle, opacity: canvas.canRedo ? 1 : 0.35, fontSize: 14 }}>↪</button>
        <button
          onClick={canvas.toggleSnapToGrid}
          title="Am Raster einrasten"
          style={{ ...zoomBtnStyle, padding: '0 8px', width: 'auto', fontSize: 10, fontWeight: 600, background: canvas.snapToGrid ? '#C9B99A' : 'none', color: canvas.snapToGrid ? '#fff' : 'var(--text-secondary)', border: canvas.snapToGrid ? 'none' : '1px solid var(--border)' }}
        >GRID</button>
        {canvas.selectedIds.length > 1 && <>
          <span style={{ background: '#C9B99A', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
            {canvas.selectedIds.length} ausgewählt
          </span>
          <button onClick={() => canvas.deleteItems(canvas.selectedIds)} style={{ ...zoomBtnStyle, padding: '0 8px', width: 'auto', fontSize: 11, color: '#e05' }}>Löschen</button>
        </>}
        {isFrozen && <span style={{ marginLeft: 8, color: '#C9B99A', fontWeight: 600, fontSize: 11 }}>🔒 Eingefroren</span>}
        <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 11 }}>Leertaste+Ziehen · Scrollen = Zoom · Pfeiltasten</span>
      </div>

      {/* Viewport */}
      <div
        ref={viewportRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#EFECE7', cursor: canvas.resizeState ? 'se-resize' : (spaceActive && isPanning.current) ? 'grabbing' : spaceActive ? 'grab' : pendingItemType ? 'crosshair' : 'default', userSelect: 'none' }}
        onMouseDown={handleViewportMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isPanning.current) isPanning.current = false
          lassoStartRef.current = null; lassoRef.current = null; setLasso(null)
          if (canvas.dragState) canvas.endDrag()
          if (canvas.resizeState) canvas.endResize()
        }}
        onWheel={handleWheel}
      >
        {/* Canvas world */}
        <div style={{ position: 'absolute', left: panX, top: panY, width: CANVAS_W, height: CANVAS_H, zoom, background: '#FDFCFA', boxShadow: '0 8px 48px rgba(0,0,0,0.18)', borderRadius: 2 }}>
          <CanvasBackground />
          <div data-canvasbg="true" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

          {sortedItems.map(item => (
            <DekoItemWrapper
              key={item.id}
              item={item}
              isSelected={canvas.selectedId === item.id}
              isInSelection={selectedSet.has(item.id) && canvas.selectedIds.length > 1}
              isDraggedByOther={othersItems.has(item.id)}
              isNew={item.id === newItemId}
              canEdit={canEdit && (role !== 'dienstleister' || item.created_by === userId)}
              isAutoHeight={AUTO_HEIGHT_TYPES.has(item.type) && !(item.data as Record<string, unknown>)._manual_size}
              onMouseDown={(e) => {
                e.stopPropagation()
                const isMulti = e.shiftKey || e.metaKey || e.ctrlKey
                if (isMulti) {
                  const next = selectedSet.has(item.id)
                    ? canvas.selectedIds.filter(sid => sid !== item.id)
                    : [...canvas.selectedIds, item.id]
                  if (next.length <= 1) canvas.setSelectedId(next[0] ?? null)
                  else canvas.setSelectedIds(next)
                  return
                }
                const inSel = selectedSet.has(item.id) && canvas.selectedIds.length > 1
                if (!inSel) { canvas.setSelectedId(item.id); onItemSelect?.(item) }
                if (canEdit && (role !== 'dienstleister' || item.created_by === userId)) {
                  if (inSel) {
                    multiDragStartRef.current.clear()
                    canvas.selectedIds.forEach(sid => {
                      const it = canvas.items.find(i => i.id === sid)
                      if (it) multiDragStartRef.current.set(sid, { x: it.x, y: it.y })
                    })
                  } else {
                    multiDragStartRef.current.clear()
                  }
                  canvas.startDrag(item.id, e.clientX, e.clientY, item.x, item.y)
                  if (item.type !== 'frame') canvas.bringToFront(item.id)
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                // These types handle editing inline — don't open lightbox on double-click
                if (item.type === 'text_block' || item.type === 'sticky_note' || item.type === 'heading' || item.type === 'checklist') return
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                onOpenLightbox?.(item, { left: r.left, top: r.top, width: r.width, height: r.height })
              }}
              onResizeMouseDown={(e) => canvas.startResize(item.id, e.clientX, e.clientY, item.width, item.height)}
            >
              <DekoItemRenderer
                item={item} catalog={canvas.catalog} flatRates={canvas.flatRates}
                role={role} userId={userId} eventId={eventId}
                canEdit={canEdit && (role !== 'dienstleister' || item.created_by === userId)}
                onDataChange={(data) => canvas.updateItemData(item.id, data)}
                onVoteChange={() => {}}
              />
              <DekoCommentOverlay eventId={eventId} targetType="item" targetId={item.id} canvasZoom={zoom} userId={userId} userName={userName} />
            </DekoItemWrapper>
          ))}
        </div>

        {/* Presence cursors */}
        {presenceUsers.map(u => (
          <PresenceCursor key={u.user_id} user={u} x={panX + u.cursor_x * zoom} y={panY + u.cursor_y * zoom} />
        ))}

        {/* Lasso */}
        {lasso && (
          <div style={{ position: 'absolute', pointerEvents: 'none', zIndex: 500, left: Math.min(lasso.x1, lasso.x2), top: Math.min(lasso.y1, lasso.y2), width: Math.abs(lasso.x2 - lasso.x1), height: Math.abs(lasso.y2 - lasso.y1), border: '2px dashed #C9B99A', borderRadius: 4, background: 'rgba(201,185,154,0.08)' }} />
        )}

        {/* Placement overlay */}
        {pendingItemType && canEdit && (
          <div
            style={{ position: 'absolute', inset: 0, zIndex: 1000, cursor: 'crosshair' }}
            onMouseDown={(e) => {
              if (e.button !== 0 || e.altKey) return
              e.stopPropagation()
              const rect = viewportRef.current!.getBoundingClientRect()
              const cx = (e.clientX - rect.left - canvas.viewport.panX) / canvas.viewport.zoom
              const cy = (e.clientY - rect.top - canvas.viewport.panY) / canvas.viewport.zoom
              const anchor: ScreenRect = { left: e.clientX - 100, top: e.clientY - 20, width: 200, height: 40 }
              canvas.addItem(pendingItemType, Math.round(cx), Math.round(cy)).then(newItem => {
                onPendingItemPlaced?.()
                if (newItem) {
                  setNewItemId(newItem.id)
                  setTimeout(() => setNewItemId(null), 600)
                  if (AUTO_LIGHTBOX.has(newItem.type)) onOpenLightbox?.(newItem, anchor)
                }
              })
            }}
          />
        )}

        {/* Minimap */}
        <Minimap
          items={canvas.items} panX={panX} panY={panY} zoom={zoom}
          vpW={vpDims.w} vpH={vpDims.h}
          onNavigate={(nx, ny) => canvas.setViewport(v => ({ ...v, panX: nx, panY: ny }))}
        />
      </div>

      <DekoBudgetBar items={canvas.items} catalog={canvas.catalog} flatRates={canvas.flatRates} eventId={eventId} />
    </div>
  )
})

export default DekoCanvas

// ── Item wrapper ──────────────────────────────────────────────────────────────

interface WrapperProps {
  item: DekoItem
  isSelected: boolean
  isInSelection: boolean
  isDraggedByOther: boolean
  isNew: boolean
  canEdit: boolean
  isAutoHeight: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onDoubleClick: (e: React.MouseEvent) => void
  onResizeMouseDown: (e: React.MouseEvent) => void
  children: React.ReactNode
}

function DekoItemWrapper({ item, isSelected, isInSelection, isDraggedByOther, isNew, canEdit, isAutoHeight, onMouseDown, onDoubleClick, onResizeMouseDown, children }: WrapperProps) {
  const isFrame = item.type === 'frame'
  const isTransparent = item.type === 'heading' || item.type === 'divider'
  const [hoverVisible, setHoverVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const outline = isSelected
    ? '2px solid #C9B99A'
    : isInSelection
      ? '2px solid rgba(201,185,154,0.6)'
      : isDraggedByOther
        ? '2px dashed #61AFEF'
        : 'none'

  return (
    <div
      style={{
        position: 'absolute', left: item.x, top: item.y,
        width: item.width,
        height: isAutoHeight ? 'auto' : item.height,
        minHeight: isAutoHeight ? item.height : undefined,
        zIndex: item.z_index,
        outline, outlineOffset: isTransparent ? 3 : 2,
        borderRadius: isFrame ? 10 : isTransparent ? 0 : 6,
        cursor: canEdit ? 'grab' : 'default',
        boxSizing: 'border-box',
        animation: isNew ? 'deko-fadein 0.25s ease-out' : undefined,
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => { timerRef.current = setTimeout(() => setHoverVisible(true), 400) }}
      onMouseLeave={() => { if (timerRef.current) clearTimeout(timerRef.current); setHoverVisible(false) }}
    >
      {children}

      {/* Hover badge */}
      {hoverVisible && !isSelected && (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6, pointerEvents: 'none', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap', zIndex: 9999 }}>
          {ITEM_LABELS[item.type] ?? item.type}
        </div>
      )}

      {/* Resize handle */}
      {isSelected && canEdit && (
        <div
          style={{ position: 'absolute', bottom: -6, right: -6, width: 14, height: 14, background: '#C9B99A', borderRadius: '50%', border: '2px solid white', cursor: 'se-resize', zIndex: 1 }}
          onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e) }}
        />
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const zoomBtnStyle: React.CSSProperties = {
  width: 26, height: 26, border: 'none', borderRadius: 4, background: 'none',
  fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontFamily: 'inherit', padding: 0, color: 'var(--text)',
}
