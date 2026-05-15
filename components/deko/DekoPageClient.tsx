'use client'
import React, { useState, useRef, useEffect } from 'react'
import { Lock, Unlock, GitBranch } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DekoNavigationBar from './DekoNavigationBar'
import DekoCanvas, { type DekoCanvasHandle, type ScreenRect } from './DekoCanvas'
import DekoFloatingToolbar from './DekoFloatingToolbar'
import DekoItemLightbox from './DekoItemLightbox'
import DekoFreezeDialog from './DekoFreezeDialog'
import DekoCommentOverlay from './DekoCommentOverlay'
import type {
  DekoArea, DekoCanvas as DekoCanvasType, DekoItem,
  DekoCatalogItem, DekoFlatRate, DekoRole, DekoItemType,
} from '@/lib/deko/types'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  eventId: string
  role: DekoRole
  userId: string
  userName: string
  initialAreas: DekoArea[]
  initialMoodboards: DekoCanvasType[]
  initialCatalog: DekoCatalogItem[]
  initialFlatRates: DekoFlatRate[]
  // canvas items keyed by canvas_id
  initialItemsByCanvas: Record<string, DekoItem[]>
  allFrozen: boolean
  isVeranstalter: boolean
  dlReadOnly?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DekoPageClient({
  eventId, role, userId, userName,
  initialAreas, initialMoodboards, initialCatalog, initialFlatRates,
  initialItemsByCanvas, allFrozen, isVeranstalter, dlReadOnly = false,
}: Props) {
  const canEdit = !dlReadOnly
  const [areas, setAreas] = useState<DekoArea[]>(initialAreas)
  const [moodboards, setMoodboards] = useState<DekoCanvasType[]>(initialMoodboards)
  const [catalog, setCatalog] = useState<DekoCatalogItem[]>(initialCatalog)
  const [itemsByCanvas, setItemsByCanvas] = useState<Record<string, DekoItem[]>>(initialItemsByCanvas)

  // Determine first canvas to show
  const firstCanvasId = areas[0]?.canvases?.[0]?.id ?? moodboards[0]?.id ?? null
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(firstCanvasId)

  // Always fetch fresh items when switching canvas — keeps state in sync after reconnects/edits
  useEffect(() => {
    if (!activeCanvasId) return
    let cancelled = false
    const supabase = createClient()
    supabase.from('deko_items').select('*').eq('canvas_id', activeCanvasId).then(({ data }) => {
      if (cancelled) return
      const items = (data ?? []) as DekoItem[]
      setItemsByCanvas(prev => ({ ...prev, [activeCanvasId]: items }))
      canvasRef.current?.resetItems(items)
    })
    return () => { cancelled = true }
  }, [activeCanvasId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [pendingType, setPendingType] = useState<DekoItemType | null>(null)
  const [lightboxItem, setLightboxItem] = useState<DekoItem | null>(null)
  const [lightboxAnchor, setLightboxAnchor] = useState<ScreenRect | undefined>(undefined)
  const [showFreeze, setShowFreeze] = useState(false)
  const [freezing, setFreezing] = useState(false)
  const [frozen, setFrozen] = useState(allFrozen)

  // Find active canvas metadata
  const allCanvases: DekoCanvasType[] = [
    ...areas.flatMap(a => a.canvases ?? []),
    ...moodboards,
  ]
  const activeCanvas = allCanvases.find(c => c.id === activeCanvasId)
  const isActiveFrozen = frozen || (activeCanvas?.is_frozen ?? false)

  const canvasRef = useRef<DekoCanvasHandle>(null)
  const [selectedItem, setSelectedItem] = useState<DekoItem | null>(null)

  async function handleFreeze() {
    setFreezing(true)
    const res = await fetch('/api/deko/freeze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, action: 'freeze' }),
    })
    setFreezing(false)
    if (res.ok) {
      setFrozen(true)
      setShowFreeze(false)
      // Update all main canvases to frozen in local state
      setAreas(prev => prev.map(a => ({
        ...a, canvases: (a.canvases ?? []).map(c => c.canvas_type === 'main' ? { ...c, is_frozen: true } : c),
      })))
    }
  }

  async function handlePromoteVariant(variant: DekoCanvasType) {
    const area = areas.find(a => a.canvases?.some(c => c.id === variant.id))
    if (!area) return
    const mainCanvas = area.canvases?.find(c => c.canvas_type === 'main')
    const supabase = createClient()
    if (mainCanvas) {
      await supabase.from('deko_canvases').update({ canvas_type: 'variant' }).eq('id', mainCanvas.id)
    }
    await supabase.from('deko_canvases').update({ canvas_type: 'main' }).eq('id', variant.id)
    setAreas(prev => prev.map(a => a.id === area.id ? {
      ...a,
      canvases: (a.canvases ?? []).map(c => {
        if (c.id === variant.id) return { ...c, canvas_type: 'main' as DekoCanvasType['canvas_type'] }
        if (mainCanvas && c.id === mainCanvas.id) return { ...c, canvas_type: 'variant' as DekoCanvasType['canvas_type'] }
        return c
      }),
    } : a))
  }

  async function handleUnfreeze() {
    const res = await fetch('/api/deko/freeze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, action: 'unfreeze' }),
    })
    if (res.ok) {
      setFrozen(false)
      setAreas(prev => prev.map(a => ({
        ...a, canvases: (a.canvases ?? []).map(c => ({ ...c, is_frozen: false })),
      })))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* Page header */}
      <div style={{ padding: '36px 40px 24px', flexShrink: 0, background: 'var(--bg)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Dekoration</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          {role === 'brautpaar'
            ? 'Gestaltet eure Wunschdekoration und reicht das Konzept ein.'
            : 'Freies Canvas zur Dekoration – Bereiche, Varianten und Moodboards.'}
        </p>
      </div>

    <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
      {/* ── Left nav ── */}
      <DekoNavigationBar
        eventId={eventId}
        areas={areas}
        moodboards={moodboards}
        activeCanvasId={activeCanvasId}
        onSelectCanvas={setActiveCanvasId}
        canEdit={canEdit}
        onAreasChange={setAreas}
        onMoodboardsChange={setMoodboards}
      />

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>

        {/* Empty state — no areas yet */}
        {!activeCanvasId && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
            {canEdit
              ? 'Noch keine Bereiche — erstelle einen Bereich über die linke Navigation.'
              : 'Noch keine Dekorationsbereiche angelegt.'}
          </div>
        )}

        {/* Canvas header — only when a canvas is selected */}
        {activeCanvasId && <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--border)', gap: 10, background: 'var(--surface)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>
            {activeCanvas?.name ?? 'Canvas'}
            {activeCanvas?.canvas_type === 'variant' && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 8 }}>Variante</span>
            )}
          </h2>

          {/* Promote variant to main */}
          {activeCanvas?.canvas_type === 'variant' && canEdit && (
            <button onClick={() => activeCanvas && handlePromoteVariant(activeCanvas)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
              <GitBranch size={12} /> Als Hauptcanvas setzen
            </button>
          )}

          {/* Comment button for canvas-level */}
          <DekoCommentOverlay
            eventId={eventId} targetType="canvas" targetId={activeCanvasId}
            userId={userId} userName={userName} canvasZoom={1}
          />

          {/* Freeze / unfreeze buttons */}
          {role === 'brautpaar' && !frozen && (
            <button onClick={() => setShowFreeze(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#C9B99A', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
              <Lock size={14} /> Konzept einreichen
            </button>
          )}
          {role === 'brautpaar' && frozen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#D4EDDA', border: '1px solid #28a745', borderRadius: 8, fontSize: 12, color: '#155724', fontWeight: 600 }}>
              <Lock size={13} /> Eingereicht
            </div>
          )}
          {isVeranstalter && frozen && (
            <button onClick={handleUnfreeze}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
              <Unlock size={13} /> Freeze aufheben
            </button>
          )}
        </div>}

        {/* Canvas */}
        {activeCanvasId && <DekoCanvas
          ref={canvasRef}
          key={activeCanvasId}
          canvasId={activeCanvasId}
          eventId={eventId}
          role={role}
          userId={userId}
          userName={userName}
          isFrozen={isActiveFrozen}
          initialItems={itemsByCanvas[activeCanvasId] ?? []}
          initialCatalog={catalog}
          initialFlatRates={initialFlatRates}
          onItemSelect={setSelectedItem}
          onOpenLightbox={(item, anchor) => { setLightboxItem(item); setLightboxAnchor(anchor) }}
          pendingItemType={pendingType}
          onPendingItemPlaced={() => setPendingType(null)}
        />}
      </div>

      {/* ── Floating toolbar (only when canEdit and canvas selected) ── */}
      {activeCanvasId && canEdit && !isActiveFrozen && (
        <DekoFloatingToolbar
          pendingType={pendingType}
          onSelect={setPendingType}
          onCancel={() => setPendingType(null)}
        />
      )}

      {/* ── Item Lightbox ── */}
      {lightboxItem && (
        <DekoItemLightbox
          item={lightboxItem}
          catalog={catalog}
          flatRates={initialFlatRates}
          role={role}
          userId={userId}
          eventId={eventId}
          canEdit={canEdit && !isActiveFrozen && (role !== 'dienstleister' || lightboxItem.created_by === userId)}
          anchorRect={lightboxAnchor}
          onDataChange={(data) => {
            canvasRef.current?.updateItemData(lightboxItem.id, data, lightboxItem.data)
          }}
          onDelete={() => {
            canvasRef.current?.deleteItem(lightboxItem.id)
            setLightboxItem(null)
          }}
          onBringToFront={() => {
            canvasRef.current?.bringToFront(lightboxItem.id)
          }}
          onClose={() => { setLightboxItem(null); setLightboxAnchor(undefined) }}
          onCatalogCreated={(item) => setCatalog(prev => [...prev, item])}
          onCatalogUpdated={(item) => {
            setCatalog(prev => prev.map(c => c.id === item.id ? item : c))
            canvasRef.current?.reloadCatalog()
          }}
        />
      )}

      {/* ── Freeze dialog ── */}
      {showFreeze && (
        <DekoFreezeDialog
          onConfirm={handleFreeze}
          onClose={() => setShowFreeze(false)}
          isFreezing={freezing}
        />
      )}
    </div>
    </div>
  )
}
