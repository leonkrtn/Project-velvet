'use client'
import React, { useState, useCallback } from 'react'
import { Lock, Unlock } from 'lucide-react'
import DekoNavigationBar from './DekoNavigationBar'
import DekoCanvas from './DekoCanvas'
import DekoFloatingToolbar from './DekoFloatingToolbar'
import DekoItemLightbox from './DekoItemLightbox'
import DekoFreezeDialog from './DekoFreezeDialog'
import DekoCommentOverlay from './DekoCommentOverlay'
import type {
  DekoArea, DekoCanvas as DekoCanvasType, DekoItem,
  DekoCatalogItem, DekoFlatRate, DekoRole, DekoItemType, DekoItemData,
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
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DekoPageClient({
  eventId, role, userId, userName,
  initialAreas, initialMoodboards, initialCatalog, initialFlatRates,
  initialItemsByCanvas, allFrozen, isVeranstalter,
}: Props) {
  const canEdit = role !== 'trauzeuge'
  const [areas, setAreas] = useState<DekoArea[]>(initialAreas)
  const [moodboards, setMoodboards] = useState<DekoCanvasType[]>(initialMoodboards)
  const [catalog, setCatalog] = useState<DekoCatalogItem[]>(initialCatalog)

  // Determine first canvas to show
  const firstCanvasId = areas[0]?.canvases?.[0]?.id ?? moodboards[0]?.id ?? null
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(firstCanvasId)
  const [pendingType, setPendingType] = useState<DekoItemType | null>(null)
  const [lightboxItem, setLightboxItem] = useState<DekoItem | null>(null)
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

  // Callback refs for canvas item interaction
  const [selectedItem, setSelectedItem] = useState<DekoItem | null>(null)
  const [itemDataStore, setItemDataStore] = useState<Record<string, DekoItemData>>({})

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
          key={activeCanvasId}
          canvasId={activeCanvasId}
          eventId={eventId}
          role={role}
          userId={userId}
          userName={userName}
          isFrozen={isActiveFrozen}
          initialItems={initialItemsByCanvas[activeCanvasId] ?? []}
          initialCatalog={catalog}
          initialFlatRates={initialFlatRates}
          onItemSelect={setSelectedItem}
          onOpenLightbox={setLightboxItem}
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
          onDataChange={(data) => {
            setItemDataStore(prev => ({ ...prev, [lightboxItem.id]: data }))
          }}
          onDelete={() => {
            setLightboxItem(null)
          }}
          onBringToFront={() => {}}
          onClose={() => setLightboxItem(null)}
          onCatalogCreated={(item) => setCatalog(prev => [...prev, item])}
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
  )
}
