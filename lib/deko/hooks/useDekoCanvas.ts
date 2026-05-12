'use client'
import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  DekoItem, DekoItemType, DekoItemData,
  DekoCatalogItem, DekoFlatRate,
  ITEM_DEFAULTS,
} from '@/lib/deko/types'
import { ITEM_DEFAULTS as DEFAULTS } from '@/lib/deko/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CanvasViewport {
  zoom: number
  panX: number
  panY: number
}

export interface DragState {
  itemId: string
  startMouseX: number
  startMouseY: number
  startItemX: number
  startItemY: number
}

export interface UseDekoCanvasResult {
  items: DekoItem[]
  setItems: React.Dispatch<React.SetStateAction<DekoItem[]>>
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  viewport: CanvasViewport
  setViewport: React.Dispatch<React.SetStateAction<CanvasViewport>>
  dragState: DragState | null
  addItem: (type: DekoItemType, x: number, y: number, data?: Partial<DekoItemData>) => Promise<DekoItem | null>
  updateItemPosition: (id: string, x: number, y: number) => void
  commitItemPosition: (id: string, x: number, y: number) => Promise<void>
  updateItemSize: (id: string, width: number, height: number) => Promise<void>
  updateItemData: (id: string, data: DekoItemData) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  startDrag: (itemId: string, mouseX: number, mouseY: number, itemX: number, itemY: number) => void
  endDrag: () => void
  bringToFront: (id: string) => Promise<void>
  catalog: DekoCatalogItem[]
  flatRates: DekoFlatRate[]
  reloadCatalog: () => Promise<void>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDekoCanvas(
  canvasId: string,
  eventId: string,
  initialItems: DekoItem[],
  initialCatalog: DekoCatalogItem[],
  initialFlatRates: DekoFlatRate[],
  canEdit: boolean,
): UseDekoCanvasResult {
  const [items, setItems] = useState<DekoItem[]>(initialItems)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewport, setViewport] = useState<CanvasViewport>({ zoom: 0.45, panX: 0, panY: 0 })
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [catalog, setCatalog] = useState<DekoCatalogItem[]>(initialCatalog)
  const [flatRates, setFlatRates] = useState<DekoFlatRate[]>(initialFlatRates)
  const maxZRef = useRef(Math.max(0, ...initialItems.map(i => i.z_index)))

  const supabase = createClient()

  const addItem = useCallback(async (
    type: DekoItemType,
    x: number,
    y: number,
    data: Partial<DekoItemData> = {}
  ): Promise<DekoItem | null> => {
    if (!canEdit) return null
    const defaults = DEFAULTS[type]
    const newItem: Omit<DekoItem, 'id' | 'created_at' | 'updated_at' | 'created_by'> = {
      canvas_id: canvasId,
      event_id: eventId,
      type,
      x,
      y,
      width: defaults.w,
      height: defaults.h,
      z_index: maxZRef.current + 1,
      data: data as DekoItemData,
    }
    maxZRef.current += 1
    const { data: row, error } = await supabase
      .from('deko_items')
      .insert(newItem)
      .select()
      .single()
    if (error || !row) return null
    setItems(prev => [...prev, row as DekoItem])
    return row as DekoItem
  }, [canvasId, eventId, canEdit, supabase])

  // Optimistic local update — no DB call until endDrag
  const updateItemPosition = useCallback((id: string, x: number, y: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, x, y } : item))
  }, [])

  const commitItemPosition = useCallback(async (id: string, x: number, y: number) => {
    if (!canEdit) return
    setItems(prev => prev.map(item => item.id === id ? { ...item, x, y } : item))
    await supabase.from('deko_items').update({ x, y }).eq('id', id)
  }, [canEdit, supabase])

  const updateItemSize = useCallback(async (id: string, width: number, height: number) => {
    if (!canEdit) return
    setItems(prev => prev.map(item => item.id === id ? { ...item, width, height } : item))
    await supabase.from('deko_items').update({ width, height }).eq('id', id)
  }, [canEdit, supabase])

  const updateItemData = useCallback(async (id: string, data: DekoItemData) => {
    if (!canEdit) return
    setItems(prev => prev.map(item => item.id === id ? { ...item, data } : item))
    await supabase.from('deko_items').update({ data }).eq('id', id)
  }, [canEdit, supabase])

  const deleteItem = useCallback(async (id: string) => {
    if (!canEdit) return
    setItems(prev => prev.filter(item => item.id !== id))
    if (selectedId === id) setSelectedId(null)
    await supabase.from('deko_items').delete().eq('id', id)
  }, [canEdit, selectedId, supabase])

  const startDrag = useCallback((
    itemId: string,
    mouseX: number, mouseY: number,
    itemX: number, itemY: number
  ) => {
    if (!canEdit) return
    setDragState({ itemId, startMouseX: mouseX, startMouseY: mouseY, startItemX: itemX, startItemY: itemY })
    setSelectedId(itemId)
  }, [canEdit])

  const endDrag = useCallback(() => {
    setDragState(null)
  }, [])

  const bringToFront = useCallback(async (id: string) => {
    if (!canEdit) return
    const newZ = maxZRef.current + 1
    maxZRef.current = newZ
    setItems(prev => prev.map(item => item.id === id ? { ...item, z_index: newZ } : item))
    await supabase.from('deko_items').update({ z_index: newZ }).eq('id', id)
  }, [canEdit, supabase])

  const reloadCatalog = useCallback(async () => {
    const { data } = await supabase
      .from('deko_catalog_items')
      .select('*')
      .eq('event_id', eventId)
      .order('name')
    if (data) setCatalog(data as DekoCatalogItem[])
  }, [eventId, supabase])

  return {
    items, setItems,
    selectedId, setSelectedId,
    viewport, setViewport,
    dragState,
    addItem, updateItemPosition, commitItemPosition,
    updateItemSize, updateItemData, deleteItem,
    startDrag, endDrag, bringToFront,
    catalog, flatRates, reloadCatalog,
  }
}
