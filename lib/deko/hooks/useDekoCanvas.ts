'use client'
import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  DekoItem, DekoItemType, DekoItemData,
  DekoCatalogItem, DekoFlatRate,
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

export interface ResizeState {
  itemId: string
  startMouseX: number
  startMouseY: number
  startWidth: number
  startHeight: number
}

interface UndoCommand {
  undo: () => void
  redo: () => void
}

export interface UseDekoCanvasResult {
  items: DekoItem[]
  setItems: React.Dispatch<React.SetStateAction<DekoItem[]>>
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
  viewport: CanvasViewport
  setViewport: React.Dispatch<React.SetStateAction<CanvasViewport>>
  dragState: DragState | null
  resizeState: ResizeState | null
  snapToGrid: boolean
  toggleSnapToGrid: () => void
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  addItem: (type: DekoItemType, x: number, y: number, data?: Partial<DekoItemData>) => Promise<DekoItem | null>
  updateItemPosition: (id: string, x: number, y: number) => void
  commitItemPosition: (id: string, x: number, y: number, prevX?: number, prevY?: number) => Promise<void>
  nudgeItem: (id: string, dx: number, dy: number) => Promise<void>
  updateItemSize: (id: string, width: number, height: number, dataPatch?: Partial<DekoItemData>) => Promise<void>
  updateItemSizeLocal: (id: string, width: number, height: number) => void
  updateItemData: (id: string, data: DekoItemData, prevData?: DekoItemData) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  deleteItems: (ids: string[]) => Promise<void>
  startDrag: (itemId: string, mouseX: number, mouseY: number, itemX: number, itemY: number) => void
  endDrag: () => void
  startResize: (itemId: string, mouseX: number, mouseY: number, width: number, height: number) => void
  endResize: () => void
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
  const [items, _setItems] = useState<DekoItem[]>(initialItems)
  const itemsRef = useRef<DekoItem[]>(initialItems)

  // Wrap setItems so itemsRef stays in sync for undo/nudge lookups
  const setItems = useCallback((update: React.SetStateAction<DekoItem[]>) => {
    _setItems(prev => {
      const next = typeof update === 'function'
        ? (update as (p: DekoItem[]) => DekoItem[])(prev)
        : update
      itemsRef.current = next
      return next
    })
  }, []) as React.Dispatch<React.SetStateAction<DekoItem[]>>

  const [selectedId, _setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [viewport, setViewport] = useState<CanvasViewport>({ zoom: 0.45, panX: 0, panY: 0 })
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [catalog, setCatalog] = useState<DekoCatalogItem[]>(initialCatalog)
  const [flatRates] = useState<DekoFlatRate[]>(initialFlatRates)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const maxZRef = useRef(Math.max(0, ...initialItems.map(i => i.z_index)))
  const selectedIdRef = useRef<string | null>(null)
  const undoStack = useRef<UndoCommand[]>([])
  const redoStack = useRef<UndoCommand[]>([])

  const supabase = createClient()

  // ── Undo/redo ──────────────────────────────────────────────────────────────

  const pushUndo = useCallback((cmd: UndoCommand) => {
    undoStack.current.push(cmd)
    if (undoStack.current.length > 50) undoStack.current.shift()
    redoStack.current = []
    setCanUndo(true)
    setCanRedo(false)
  }, [])

  const undo = useCallback(() => {
    const cmd = undoStack.current.pop()
    if (!cmd) return
    cmd.undo()
    redoStack.current.push(cmd)
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(true)
  }, [])

  const redo = useCallback(() => {
    const cmd = redoStack.current.pop()
    if (!cmd) return
    cmd.redo()
    undoStack.current.push(cmd)
    setCanUndo(true)
    setCanRedo(redoStack.current.length > 0)
  }, [])

  const toggleSnapToGrid = useCallback(() => setSnapToGrid(v => !v), [])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addItem = useCallback(async (
    type: DekoItemType, x: number, y: number, data: Partial<DekoItemData> = {}
  ): Promise<DekoItem | null> => {
    if (!canEdit) return null
    const defaults = DEFAULTS[type]
    const isFrame = type === 'frame'
    const zIndex = isFrame ? 0 : maxZRef.current + 1
    const payload: Omit<DekoItem, 'id' | 'created_at' | 'updated_at' | 'created_by'> = {
      canvas_id: canvasId, event_id: eventId, type, x, y,
      width: defaults.w, height: defaults.h,
      z_index: zIndex,
      data: data as DekoItemData,
    }
    if (!isFrame) maxZRef.current += 1
    const { data: row, error } = await supabase.from('deko_items').insert(payload).select().single()
    if (error || !row) { console.error('[deko] addItem failed', error); return null }
    const item = row as DekoItem
    setItems(prev => [...prev, item])
    pushUndo({
      undo: () => {
        setItems(prev => prev.filter(i => i.id !== item.id))
        supabase.from('deko_items').delete().eq('id', item.id)
      },
      redo: () => {
        setItems(prev => [...prev, item])
        supabase.from('deko_items').upsert(item)
      },
    })
    return item
  }, [canvasId, eventId, canEdit, supabase, setItems, pushUndo])

  const updateItemPosition = useCallback((id: string, x: number, y: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, x, y } : item))
  }, [setItems])

  const commitItemPosition = useCallback(async (
    id: string, x: number, y: number, prevX?: number, prevY?: number
  ) => {
    if (!canEdit) return
    setItems(prev => prev.map(item => item.id === id ? { ...item, x, y } : item))
    const { error } = await supabase.from('deko_items').update({ x, y }).eq('id', id)
    if (error) console.error('[deko] commitItemPosition failed', error)
    if (prevX !== undefined && prevY !== undefined && (prevX !== x || prevY !== y)) {
      pushUndo({
        undo: () => {
          setItems(prev => prev.map(i => i.id === id ? { ...i, x: prevX!, y: prevY! } : i))
          supabase.from('deko_items').update({ x: prevX, y: prevY }).eq('id', id)
        },
        redo: () => {
          setItems(prev => prev.map(i => i.id === id ? { ...i, x, y } : i))
          supabase.from('deko_items').update({ x, y }).eq('id', id)
        },
      })
    }
  }, [canEdit, supabase, setItems, pushUndo])

  const nudgeItem = useCallback(async (id: string, dx: number, dy: number) => {
    if (!canEdit) return
    const item = itemsRef.current.find(i => i.id === id)
    if (!item) return
    const newX = item.x + dx
    const newY = item.y + dy
    setItems(prev => prev.map(i => i.id === id ? { ...i, x: newX, y: newY } : i))
    await supabase.from('deko_items').update({ x: newX, y: newY }).eq('id', id)
    pushUndo({
      undo: () => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, x: item.x, y: item.y } : i))
        supabase.from('deko_items').update({ x: item.x, y: item.y }).eq('id', id)
      },
      redo: () => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, x: newX, y: newY } : i))
        supabase.from('deko_items').update({ x: newX, y: newY }).eq('id', id)
      },
    })
  }, [canEdit, supabase, setItems, pushUndo])

  const updateItemSize = useCallback(async (id: string, width: number, height: number, dataPatch?: Partial<DekoItemData>) => {
    if (!canEdit) return
    setItems(prev => prev.map(item => item.id === id ? { ...item, width, height, ...(dataPatch ? { data: { ...item.data, ...dataPatch } } : {}) } : item))
    const payload: Record<string, unknown> = { width, height }
    if (dataPatch) {
      const current = itemsRef.current.find(i => i.id === id)
      if (current) payload.data = { ...current.data, ...dataPatch }
    }
    const { error } = await supabase.from('deko_items').update(payload).eq('id', id)
    if (error) console.error('[deko] updateItemSize failed', error)
  }, [canEdit, supabase, setItems])

  const updateItemSizeLocal = useCallback((id: string, width: number, height: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, width, height } : item))
  }, [setItems])

  const updateItemData = useCallback(async (id: string, data: DekoItemData, prevData?: DekoItemData) => {
    if (!canEdit) return
    setItems(prev => prev.map(item => item.id === id ? { ...item, data } : item))
    const { error } = await supabase.from('deko_items').update({ data }).eq('id', id)
    if (error) console.error('[deko] updateItemData failed', error)
    if (prevData !== undefined) {
      pushUndo({
        undo: () => {
          setItems(prev => prev.map(i => i.id === id ? { ...i, data: prevData! } : i))
          supabase.from('deko_items').update({ data: prevData }).eq('id', id)
        },
        redo: () => {
          setItems(prev => prev.map(i => i.id === id ? { ...i, data } : i))
          supabase.from('deko_items').update({ data }).eq('id', id)
        },
      })
    }
  }, [canEdit, supabase, setItems, pushUndo])

  const deleteItem = useCallback(async (id: string) => {
    if (!canEdit) return
    const item = itemsRef.current.find(i => i.id === id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (selectedIdRef.current === id) _setSelectedId(null)
    setSelectedIds(prev => prev.filter(sid => sid !== id))
    const { error } = await supabase.from('deko_items').delete().eq('id', id)
    if (error) { console.error('[deko] deleteItem failed', error); return }
    if (item) {
      pushUndo({
        undo: () => {
          setItems(prev => [...prev, item])
          supabase.from('deko_items').upsert(item)
        },
        redo: () => {
          setItems(prev => prev.filter(i => i.id !== id))
          supabase.from('deko_items').delete().eq('id', id)
        },
      })
    }
  }, [canEdit, supabase, setItems, pushUndo])

  const deleteItems = useCallback(async (ids: string[]) => {
    if (!canEdit || ids.length === 0) return
    const idSet = new Set(ids)
    const deleted = itemsRef.current.filter(i => idSet.has(i.id))
    setItems(prev => prev.filter(i => !idSet.has(i.id)))
    setSelectedIds([])
    if (idSet.has(selectedIdRef.current!)) _setSelectedId(null)
    await Promise.all(ids.map(id => supabase.from('deko_items').delete().eq('id', id)))
    pushUndo({
      undo: () => {
        setItems(prev => [...prev, ...deleted])
        deleted.forEach(item => supabase.from('deko_items').upsert(item))
      },
      redo: () => {
        setItems(prev => prev.filter(i => !idSet.has(i.id)))
        ids.forEach(id => supabase.from('deko_items').delete().eq('id', id))
      },
    })
  }, [canEdit, supabase, setItems, pushUndo])

  const wrappedSetSelectedId = useCallback((id: string | null) => {
    selectedIdRef.current = id
    _setSelectedId(id)
    setSelectedIds(id ? [id] : [])
  }, [])

  const startDrag = useCallback((
    itemId: string, mouseX: number, mouseY: number, itemX: number, itemY: number
  ) => {
    if (!canEdit) return
    setDragState({ itemId, startMouseX: mouseX, startMouseY: mouseY, startItemX: itemX, startItemY: itemY })
    wrappedSetSelectedId(itemId)
  }, [canEdit, wrappedSetSelectedId])

  const endDrag = useCallback(() => setDragState(null), [])

  const startResize = useCallback((
    itemId: string, mouseX: number, mouseY: number, width: number, height: number
  ) => {
    if (!canEdit) return
    setResizeState({ itemId, startMouseX: mouseX, startMouseY: mouseY, startWidth: width, startHeight: height })
    wrappedSetSelectedId(itemId)
  }, [canEdit, wrappedSetSelectedId])

  const endResize = useCallback(() => setResizeState(null), [])

  const bringToFront = useCallback(async (id: string) => {
    if (!canEdit) return
    const newZ = maxZRef.current + 1
    maxZRef.current = newZ
    setItems(prev => prev.map(item => item.id === id ? { ...item, z_index: newZ } : item))
    const { error } = await supabase.from('deko_items').update({ z_index: newZ }).eq('id', id)
    if (error) console.error('[deko] bringToFront failed', error)
  }, [canEdit, supabase, setItems])

  const reloadCatalog = useCallback(async () => {
    const { data, error } = await supabase
      .from('deko_catalog_items').select('*').eq('event_id', eventId).order('name')
    if (error) { console.error('[deko] reloadCatalog failed', error); return }
    if (data) setCatalog(data as DekoCatalogItem[])
  }, [eventId, supabase])

  return {
    items, setItems,
    selectedId, setSelectedId: wrappedSetSelectedId,
    selectedIds, setSelectedIds,
    viewport, setViewport,
    dragState, resizeState,
    snapToGrid, toggleSnapToGrid,
    canUndo, canRedo, undo, redo,
    addItem, updateItemPosition, commitItemPosition, nudgeItem,
    updateItemSize, updateItemSizeLocal, updateItemData,
    deleteItem, deleteItems,
    startDrag, endDrag, startResize, endResize, bringToFront,
    catalog, flatRates, reloadCatalog,
  }
}
