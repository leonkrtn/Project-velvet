'use client'
import React, { useRef, useCallback, useState, useEffect } from 'react'
import { CANVAS_W, CANVAS_H, type DekoItem, type DekoItemType, type PresenceUser, type DekoCatalogItem, type DekoFlatRate } from '@/lib/deko/types'
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
  pendingItemType?: DekoItemType | null
  onPendingItemPlaced?: () => void
}

// ── Presence cursor (viewport coordinates, outside zoom context) ──────────────

function PresenceCursor({ user, x, y }: { user: PresenceUser; x: number; y: number }) {
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      pointerEvents: 'none',
      zIndex: 9999,
      transform: 'translate(-2px, -2px)',
    }}>
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

// ── Dot grid background ───────────────────────────────────────────────────────

function CanvasBackground() {
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <defs>
        <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(0,0,0,0.07)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dots)" />
    </svg>
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
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY, px: canvas.viewport.panX, py: canvas.viewport.panY }
      return
    }
    if ((e.target as HTMLElement).dataset.canvasbg === 'true') {
      canvas.setSelectedId(null)
      onItemSelect?.(null)
    }
  }, [canvas, onItemSelect])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      canvas.setViewport(v => ({ ...v, panX: panStart.current.px + dx, panY: panStart.current.py + dy }))
      return
    }

    if (canvas.resizeState) {
      const dx = (e.clientX - canvas.resizeState.startMouseX) / canvas.viewport.zoom
      const dy = (e.clientY - canvas.resizeState.startMouseY) / canvas.viewport.zoom
      const newW = Math.max(40, Math.round(canvas.resizeState.startWidth + dx))
      const newH = Math.max(40, Math.round(canvas.resizeState.startHeight + dy))
      canvas.updateItemSizeLocal(canvas.resizeState.itemId, newW, newH)
      return
    }

    if (canvas.dragState) {
      const dx = (e.clientX - canvas.dragState.startMouseX) / canvas.viewport.zoom
      const dy = (e.clientY - canvas.dragState.startMouseY) / canvas.viewport.zoom
      const newX = Math.round(canvas.dragState.startItemX + dx)
      const newY = Math.round(canvas.dragState.startItemY + dy)
      canvas.updateItemPosition(canvas.dragState.itemId, newX, newY)
      const canvasX = (e.clientX - rect.left - canvas.viewport.panX) / canvas.viewport.zoom
      const canvasY = (e.clientY - rect.top - canvas.viewport.panY) / canvas.viewport.zoom
      broadcastCursor(canvasX, canvasY, canvas.dragState.itemId)
      return
    }

    const canvasX = (e.clientX - rect.left - canvas.viewport.panX) / canvas.viewport.zoom
    const canvasY = (e.clientY - rect.top - canvas.viewport.panY) / canvas.viewport.zoom
    broadcastCursor(canvasX, canvasY)
  }, [canvas, broadcastCursor])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) { isPanning.current = false; return }
    if (canvas.resizeState) {
      const dx = (e.clientX - canvas.resizeState.startMouseX) / canvas.viewport.zoom
      const dy = (e.clientY - canvas.resizeState.startMouseY) / canvas.viewport.zoom
      const newW = Math.max(40, Math.round(canvas.resizeState.startWidth + dx))
      const newH = Math.max(40, Math.round(canvas.resizeState.startHeight + dy))
      canvas.updateItemSize(canvas.resizeState.itemId, newW, newH)
      canvas.endResize()
      return
    }
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
      const newZoom = Math.min(4, Math.max(0.1, v.zoom * delta))
      const scale = newZoom / v.zoom
      return {
        zoom: newZoom,
        panX: mouseX - scale * (mouseX - v.panX),
        panY: mouseY - scale * (mouseY - v.panY),
      }
    })
  }, [canvas])

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
        const tag = document.activeElement?.tagName
        const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.isContentEditable
        if (isEditable) return
        canvas.deleteItem(canvas.selectedId)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ']') canvas.bringToFront(canvas.selectedId)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canvas])

  const { zoom, panX, panY } = canvas.viewport
  const sortedItems = [...canvas.items].sort((a, b) => a.z_index - b.z_index)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* ── Toolbar bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 14px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)', fontSize: 12,
        color: 'var(--text-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg, #F5F3EF)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 4px' }}>
          <button onClick={() => canvas.setViewport(v => ({ ...v, zoom: Math.max(0.1, v.zoom * 0.8) }))}
            style={zoomBtnStyle}>−</button>
          <span style={{ minWidth: 44, textAlign: 'center', fontSize: 11, fontWeight: 600 }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => canvas.setViewport(v => ({ ...v, zoom: Math.min(4, v.zoom * 1.25) }))}
            style={zoomBtnStyle}>+</button>
        </div>
        <button onClick={() => canvas.setViewport({ zoom: 0.45, panX: 0, panY: 0 })}
          style={{ ...zoomBtnStyle, padding: '0 8px', width: 'auto', fontSize: 11 }}>Reset</button>
        {isFrozen && (
          <span style={{ marginLeft: 8, color: '#C9B99A', fontWeight: 600, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            🔒 Eingefroren
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 11 }}>
          Alt+Ziehen oder Mitteltaste = Schieben · Strg+Scrollen = Zoom · Entf = Löschen
        </span>
      </div>

      {/* ── Viewport ── */}
      <div
        ref={viewportRef}
        style={{
          flex: 1, overflow: 'hidden', position: 'relative',
          background: '#EFECE7',
          cursor: canvas.resizeState ? 'se-resize' : pendingItemType ? 'crosshair' : 'default',
          userSelect: 'none',
        }}
        onMouseDown={handleViewportMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          isPanning.current = false
          if (canvas.dragState) canvas.endDrag()
          if (canvas.resizeState) canvas.endResize()
        }}
        onWheel={handleWheel}
      >
        {/* Canvas world — CSS zoom replaces transform:scale() to avoid blur at high zoom */}
        <div style={{
          position: 'absolute',
          left: panX,
          top: panY,
          width: CANVAS_W,
          height: CANVAS_H,
          zoom: zoom,
          background: '#FDFCFA',
          boxShadow: '0 8px 48px rgba(0,0,0,0.18)',
          borderRadius: 2,
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
              canEdit={canEdit && (role !== 'dienstleister' || item.created_by === userId)}
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
              onResizeMouseDown={(e) => {
                canvas.startResize(item.id, e.clientX, e.clientY, item.width, item.height)
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
                onVoteChange={() => {}}
              />
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
        </div>

        {/* Presence cursors — outside zoom context, in viewport coordinates */}
        {presenceUsers.map(u => (
          <PresenceCursor
            key={u.user_id}
            user={u}
            x={panX + u.cursor_x * zoom}
            y={panY + u.cursor_y * zoom}
          />
        ))}

        {/* Placement overlay — captures click anywhere on viewport when a tool is selected */}
        {pendingItemType && canEdit && (
          <div
            style={{ position: 'absolute', inset: 0, zIndex: 1000, cursor: 'crosshair' }}
            onMouseDown={(e) => {
              if (e.button === 1 || (e.button === 0 && e.altKey)) return
              if (e.button !== 0) return
              e.stopPropagation()
              const rect = viewportRef.current!.getBoundingClientRect()
              const canvasX = (e.clientX - rect.left - canvas.viewport.panX) / canvas.viewport.zoom
              const canvasY = (e.clientY - rect.top - canvas.viewport.panY) / canvas.viewport.zoom
              canvas.addItem(pendingItemType, Math.round(canvasX), Math.round(canvasY)).then(newItem => {
                onPendingItemPlaced?.()
                if (newItem) onOpenLightbox?.(newItem)
              })
            }}
          />
        )}
      </div>

      {/* ── Budget bar ── */}
      <DekoBudgetBar
        items={canvas.items}
        catalog={canvas.catalog}
        flatRates={canvas.flatRates}
        eventId={eventId}
      />
    </div>
  )
}

// ── Item wrapper ──────────────────────────────────────────────────────────────

interface WrapperProps {
  item: DekoItem
  isSelected: boolean
  isDraggedByOther: boolean
  canEdit: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onDoubleClick: (e: React.MouseEvent) => void
  onResizeMouseDown: (e: React.MouseEvent) => void
  children: React.ReactNode
}

function DekoItemWrapper({ item, isSelected, isDraggedByOther, canEdit, onMouseDown, onDoubleClick, onResizeMouseDown, children }: WrapperProps) {
  const isFrame = item.type === 'frame'
  const isTransparent = item.type === 'heading' || item.type === 'divider'

  return (
    <div
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.z_index,
        outline: isSelected
          ? '2px solid #C9B99A'
          : isDraggedByOther
            ? '2px dashed #61AFEF'
            : 'none',
        outlineOffset: isTransparent ? 3 : 2,
        borderRadius: isFrame ? 10 : isTransparent ? 0 : 6,
        cursor: canEdit ? 'grab' : 'default',
        boxSizing: 'border-box',
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {children}
      {isSelected && canEdit && (
        <div
          style={{
            position: 'absolute', bottom: -6, right: -6,
            width: 14, height: 14,
            background: '#C9B99A', borderRadius: '50%',
            border: '2px solid white',
            cursor: 'se-resize',
            zIndex: 1,
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            onResizeMouseDown(e)
          }}
        />
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const zoomBtnStyle: React.CSSProperties = {
  width: 26, height: 26,
  border: 'none',
  borderRadius: 4,
  background: 'none',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit',
  padding: 0,
  color: 'var(--text)',
}
