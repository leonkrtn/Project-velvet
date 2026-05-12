'use client'
import React, { useRef, useCallback, useState, useEffect } from 'react'
import { CANVAS_W, CANVAS_H, type DekoItem, type DekoItemType, type PresenceUser, type DekoCatalogItem, type DekoFlatRate, ITEM_DEFAULTS } from '@/lib/deko/types'
import { useDekoCanvas } from '@/lib/deko/hooks/useDekoCanvas'
import { useDekoRealtime } from '@/lib/deko/hooks/useDekoRealtime'
import DekoItemRenderer from './items/DekoItemRenderer'
import DekoCommentOverlay from './DekoCommentOverlay'
import DekoBudgetBar from './DekoBudgetBar'
import type { DekoRole } from '@/lib/deko/types'

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
  onOpenLightbox?: (item: DekoItem) => void
  // injected from toolbar: pending item drop
  pendingItemType?: DekoItemType | null
  onPendingItemPlaced?: () => void
}

// ── Presence cursor ───────────────────────────────────────────────────────────

function PresenceCursor({ user }: { user: PresenceUser }) {
  return (
    <div style={{
      position: 'absolute',
      left: user.cursor_x,
      top: user.cursor_y,
      pointerEvents: 'none',
      zIndex: 9999,
      transform: 'translate(-2px, -2px)',
    }}>
      {/* cursor arrow */}
      <svg width="16" height="20" viewBox="0 0 16 20">
        <path d="M0 0 L0 16 L4 12 L8 20 L10 19 L6 11 L12 11 Z"
          fill={user.color} stroke="white" strokeWidth="1.5" />
      </svg>
      <div style={{
        marginTop: 2,
        background: user.color,
        color: '#fff',
        fontSize: 10,
        fontWeight: 600,
        padding: '1px 5px',
        borderRadius: 3,
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}>
        {user.user_name}
      </div>
    </div>
  )
}

// ── Canvas grid background ────────────────────────────────────────────────────

function CanvasBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* subtle dot grid */}
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(0,0,0,0.08)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>
      {/* canvas border shadow */}
      <div style={{
        position: 'absolute', inset: 0,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
        borderRadius: 4,
      }} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DekoCanvas({
  canvasId, eventId, role, userId, userName,
  isFrozen, initialItems, initialCatalog, initialFlatRates,
  onItemSelect, onOpenLightbox, pendingItemType, onPendingItemPlaced,
}: Props) {
  const canEdit = !isFrozen && (role === 'veranstalter' || role === 'brautpaar' || role === 'dienstleister')
  const viewportRef = useRef<HTMLDivElement>(null)
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  // Track items being dragged by others for highlight
  const [othersItems, setOthersItems] = useState<Set<string>>(new Set())

  const canvas = useDekoCanvas(canvasId, eventId, initialItems, initialCatalog, initialFlatRates, canEdit)
  const { broadcastCursor } = useDekoRealtime({
    canvasId,
    userId,
    userName,
    onItemInserted: (item) => {
      canvas.setItems(prev => {
        if (prev.find(i => i.id === item.id)) return prev
        return [...prev, item]
      })
    },
    onItemUpdated: (item) => {
      // Don't overwrite if we're currently dragging this item
      if (canvas.dragState?.itemId === item.id) return
      canvas.setItems(prev => prev.map(i => i.id === item.id ? item : i))
    },
    onItemDeleted: (id) => {
      canvas.setItems(prev => prev.filter(i => i.id !== id))
    },
    onPresenceSync: (users) => {
      const others = users.filter(u => u.user_id !== userId)
      setPresenceUsers(others)
      setOthersItems(new Set(
        others.filter(u => u.dragging_item_id).map(u => u.dragging_item_id!)
      ))
    },
  })

  // ── Pan logic ─────────────────────────────────────────────────────────────

  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 })

  const handleViewportMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse or space+click to pan, or click on canvas background
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY, px: canvas.viewport.panX, py: canvas.viewport.panY }
      return
    }
    // Clicked canvas background → deselect
    if ((e.target as HTMLElement).dataset.canvasbg === 'true') {
      canvas.setSelectedId(null)
      onItemSelect?.(null)
    }
    // Pending item placement on canvas click
    if (pendingItemType && canEdit) {
      const rect = viewportRef.current!.getBoundingClientRect()
      const canvasX = (e.clientX - rect.left - canvas.viewport.panX) / canvas.viewport.zoom
      const canvasY = (e.clientY - rect.top - canvas.viewport.panY) / canvas.viewport.zoom
      canvas.addItem(pendingItemType, Math.round(canvasX), Math.round(canvasY))
      onPendingItemPlaced?.()
    }
  }, [canvas, onItemSelect, pendingItemType, canEdit, onPendingItemPlaced])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    // Pan
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      canvas.setViewport(v => ({ ...v, panX: panStart.current.px + dx, panY: panStart.current.py + dy }))
      return
    }

    // Drag item
    if (canvas.dragState) {
      const dx = (e.clientX - canvas.dragState.startMouseX) / canvas.viewport.zoom
      const dy = (e.clientY - canvas.dragState.startMouseY) / canvas.viewport.zoom
      const newX = Math.round(canvas.dragState.startItemX + dx)
      const newY = Math.round(canvas.dragState.startItemY + dy)
      canvas.updateItemPosition(canvas.dragState.itemId, newX, newY)
      // broadcast cursor + dragging item
      const canvasX = (e.clientX - rect.left - canvas.viewport.panX) / canvas.viewport.zoom
      const canvasY = (e.clientY - rect.top - canvas.viewport.panY) / canvas.viewport.zoom
      broadcastCursor(canvasX, canvasY, canvas.dragState.itemId)
      return
    }

    // Broadcast cursor position (canvas coords)
    const canvasX = (e.clientX - rect.left - canvas.viewport.panX) / canvas.viewport.zoom
    const canvasY = (e.clientY - rect.top - canvas.viewport.panY) / canvas.viewport.zoom
    broadcastCursor(canvasX, canvasY)
  }, [canvas, broadcastCursor])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) { isPanning.current = false; return }
    if (canvas.dragState) {
      const dx = (e.clientX - canvas.dragState.startMouseX) / canvas.viewport.zoom
      const dy = (e.clientY - canvas.dragState.startMouseY) / canvas.viewport.zoom
      const newX = Math.round(canvas.dragState.startItemX + dx)
      const newY = Math.round(canvas.dragState.startItemY + dy)
      canvas.commitItemPosition(canvas.dragState.itemId, newX, newY)
      canvas.endDrag()
    }
  }, [canvas])

  // ── Zoom on wheel ──────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const rect = viewportRef.current!.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    canvas.setViewport(v => {
      const newZoom = Math.min(3, Math.max(0.15, v.zoom * delta))
      // Zoom toward mouse position
      const scale = newZoom / v.zoom
      return {
        zoom: newZoom,
        panX: mouseX - scale * (mouseX - v.panX),
        panY: mouseY - scale * (mouseY - v.panY),
      }
    })
  }, [canvas])

  // Prevent browser zoom on ctrl+scroll
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const handler = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) e.preventDefault() }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!canvas.selectedId) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
        canvas.deleteItem(canvas.selectedId)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ']') canvas.bringToFront(canvas.selectedId)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canvas])

  const { zoom, panX, panY } = canvas.viewport

  // Sort items by z_index for rendering
  const sortedItems = [...canvas.items].sort((a, b) => a.z_index - b.z_index)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* ── Zoom controls ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)', fontSize: 12,
        color: 'var(--text-secondary)',
      }}>
        <button onClick={() => canvas.setViewport(v => ({ ...v, zoom: Math.max(0.15, v.zoom * 0.8) }))}
          style={zoomBtnStyle}>−</button>
        <span style={{ minWidth: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => canvas.setViewport(v => ({ ...v, zoom: Math.min(3, v.zoom * 1.25) }))}
          style={zoomBtnStyle}>+</button>
        <button onClick={() => canvas.setViewport({ zoom: 0.45, panX: 0, panY: 0 })}
          style={{ ...zoomBtnStyle, marginLeft: 4 }}>Reset</button>
        {isFrozen && (
          <span style={{ marginLeft: 12, color: '#C9B99A', fontWeight: 600, fontSize: 11 }}>
            🔒 Eingefroren — nur Lesen
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 11 }}>
          Alt+Drag oder Mittelmaus = Schieben · Ctrl+Scroll = Zoom · Entf = Löschen
        </span>
      </div>

      {/* ── Viewport ── */}
      <div
        ref={viewportRef}
        style={{
          flex: 1, overflow: 'hidden', position: 'relative',
          background: '#F5F3EF',
          cursor: isPanning.current ? 'grabbing' : pendingItemType ? 'crosshair' : 'default',
          userSelect: 'none',
        }}
        onMouseDown={handleViewportMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { isPanning.current = false; if (canvas.dragState) canvas.endDrag() }}
        onWheel={handleWheel}
      >
        {/* Canvas world (transformed) */}
        <div style={{
          position: 'absolute',
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          background: '#FDFCFA',
          boxShadow: '0 4px 32px rgba(0,0,0,0.15)',
        }}>
          <CanvasBackground />

          {/* Background click target */}
          <div
            data-canvasbg="true"
            style={{ position: 'absolute', inset: 0, zIndex: 0 }}
          />

          {/* Items */}
          {sortedItems.map(item => (
            <DekoItemWrapper
              key={item.id}
              item={item}
              isSelected={canvas.selectedId === item.id}
              isDraggedByOther={othersItems.has(item.id)}
              canEdit={canEdit && (
                role !== 'dienstleister' || item.created_by === userId
              )}
              onMouseDown={(e) => {
                e.stopPropagation()
                canvas.setSelectedId(item.id)
                onItemSelect?.(item)
                if (canEdit && (role !== 'dienstleister' || item.created_by === userId)) {
                  canvas.startDrag(item.id, e.clientX, e.clientY, item.x, item.y)
                  canvas.bringToFront(item.id)
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onOpenLightbox?.(item)
              }}
            >
              <DekoItemRenderer
                item={item}
                catalog={canvas.catalog}
                flatRates={canvas.flatRates}
                role={role}
                userId={userId}
                eventId={eventId}
                canEdit={canEdit && (role !== 'dienstleister' || item.created_by === userId)}
                onDataChange={(data) => canvas.updateItemData(item.id, data)}
                onVoteChange={() => {}} // handled in renderer
              />
              {/* Comment badge */}
              <DekoCommentOverlay
                eventId={eventId}
                targetType="item"
                targetId={item.id}
                canvasZoom={zoom}
                userId={userId}
                userName={userName}
              />
            </DekoItemWrapper>
          ))}

          {/* Presence cursors (in canvas coordinates) */}
          {presenceUsers.map(u => <PresenceCursor key={u.user_id} user={u} />)}
        </div>
      </div>

      {/* ── Budget bar (below canvas) ── */}
      <DekoBudgetBar
        items={canvas.items}
        catalog={canvas.catalog}
        flatRates={canvas.flatRates}
        eventId={eventId}
      />
    </div>
  )
}

// ── Item wrapper (handles selection highlight, resize handle) ─────────────────

interface WrapperProps {
  item: DekoItem
  isSelected: boolean
  isDraggedByOther: boolean
  canEdit: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onDoubleClick: (e: React.MouseEvent) => void
  children: React.ReactNode
}

function DekoItemWrapper({ item, isSelected, isDraggedByOther, canEdit, onMouseDown, onDoubleClick, children }: WrapperProps) {
  const outline = isSelected
    ? '2px solid #C9B99A'
    : isDraggedByOther
      ? '2px dashed #61AFEF'
      : 'none'

  // For frame items, don't show selection UI as a card
  const isFrame = item.type === 'frame'

  return (
    <div
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.z_index,
        outline,
        outlineOffset: 2,
        borderRadius: isFrame ? 8 : 4,
        cursor: canEdit ? 'grab' : 'default',
        boxSizing: 'border-box',
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {children}
      {isSelected && canEdit && (
        <div style={{
          position: 'absolute', bottom: -6, right: -6,
          width: 12, height: 12,
          background: '#C9B99A', borderRadius: '50%',
          border: '2px solid white',
          cursor: 'se-resize',
          zIndex: 1,
        }} />
      )}
    </div>
  )
}

const zoomBtnStyle: React.CSSProperties = {
  width: 24, height: 24,
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'none',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit',
  padding: 0,
}
