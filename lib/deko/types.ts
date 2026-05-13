// ── Canvas dimensions (A3 landscape, 150 DPI equivalent) ─────────────────────
export const CANVAS_W = 3200
export const CANVAS_H = 2264   // A3 ratio ≈ 1.414
export const CANVAS_DEFAULT_ZOOM = 0.45

// ── Item types ────────────────────────────────────────────────────────────────
export type DekoItemType =
  | 'image_upload' | 'image_url'
  | 'color_palette' | 'color_swatch'
  | 'text_block' | 'sticky_note' | 'heading'
  | 'article' | 'flat_rate_article'
  | 'frame' | 'divider' | 'area_label'
  | 'vote_card' | 'checklist' | 'link_card'
  | 'table_ref' | 'room_info' | 'guest_count'
  | 'fabric'

export type CanvasType = 'main' | 'variant' | 'moodboard'
export type Availability = 'available' | 'limited' | 'unavailable'
export type DekoRole = 'veranstalter' | 'brautpaar' | 'dienstleister' | 'trauzeuge'

// ── Per-type data shapes ──────────────────────────────────────────────────────

export interface ImageUploadData {
  storage_key: string
  preview_url: string
  caption?: string
}

export interface ImageUrlData {
  url: string
  preview_url?: string
  caption?: string
}

export interface ColorPaletteData {
  colors: { hex: string; name: string }[]
}

export interface ColorSwatchData {
  hex: string
  name: string
}

export interface TextBlockData {
  content: string
  font_size?: number
  bold?: boolean
  italic?: boolean
  align?: 'left' | 'center' | 'right'
}

export interface StickyNoteData {
  content: string
  color: string   // CSS color, e.g. '#FFF3CD'
}

export interface HeadingData {
  text: string
  level: 1 | 2 | 3
  font_size?: number
  bold?: boolean
  italic?: boolean
  align?: 'left' | 'center' | 'right'
}

export interface ArticleData {
  catalog_item_id: string
  quantity: number
  notes?: string
}

export interface FlatRateArticleData {
  catalog_item_id: string
  quantity: number
  flat_rate_id: string
  is_free?: boolean
  notes?: string
}

export interface FabricData {
  catalog_item_id: string
  quantity_meters: number
  notes?: string
}

export interface FrameData {
  label?: string
  color: string   // background tint
  opacity: number // 0–1
}

export interface DividerData {
  orientation: 'horizontal' | 'vertical'
  style: 'solid' | 'dashed' | 'dotted'
  color: string
}

export interface AreaLabelData {
  text: string
  color: string
  bg_color: string
}

export interface VoteCardData {
  title: string
  image_url?: string
  storage_key?: string
  description?: string
}

export interface ChecklistData {
  title?: string
  items: { id: string; text: string; checked: boolean }[]
}

export interface LinkCardData {
  url: string
  title?: string
  description?: string
  image_url?: string
  domain?: string
}

export interface TableRefData {
  table_id: string
  label?: string
}

export interface RoomInfoData {
  // no config — reads live from room config
}

export interface GuestCountData {
  // no config — reads live from event
}

// Union for all data types
export type DekoItemData =
  | ImageUploadData | ImageUrlData
  | ColorPaletteData | ColorSwatchData
  | TextBlockData | StickyNoteData | HeadingData
  | ArticleData | FlatRateArticleData | FabricData
  | FrameData | DividerData | AreaLabelData
  | VoteCardData | ChecklistData | LinkCardData
  | TableRefData | RoomInfoData | GuestCountData

// ── DB row types ──────────────────────────────────────────────────────────────

export interface DekoItem {
  id: string
  canvas_id: string
  event_id: string
  type: DekoItemType
  x: number
  y: number
  width: number
  height: number
  z_index: number
  data: DekoItemData
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DekoCanvas {
  id: string
  event_id: string
  area_id: string | null
  name: string
  canvas_type: CanvasType
  is_frozen: boolean
  frozen_at: string | null
  frozen_by: string | null
  sort_order: number
  created_by: string | null
  created_at: string
}

export interface DekoArea {
  id: string
  event_id: string
  name: string
  color: string
  sort_order: number
  from_template_id: string | null
  created_by: string | null
  created_at: string
  canvases?: DekoCanvas[]
}

export interface DekoCatalogItem {
  id: string
  event_id: string
  item_type: 'article' | 'fabric'
  name: string
  image_url: string | null
  color: string | null
  notes: string | null
  // article
  material: string | null
  dim_width_cm: number | null
  dim_height_cm: number | null
  dim_depth_cm: number | null
  price_per_unit: number | null
  flat_rate_id: string | null
  is_free: boolean
  availability: Availability
  // fabric
  fabric_type: string | null
  fabric_width_cm: number | null
  price_per_meter: number | null
  created_by: string | null
}

export interface DekoFlatRate {
  id: string
  event_id: string
  name: string
  description: string | null
  amount: number
}

export interface DekoComment {
  id: string
  event_id: string
  target_type: 'item' | 'canvas' | 'area'
  target_id: string
  content: string
  author_id: string
  created_at: string
  updated_at: string
  author_name?: string
  replies?: DekoCommentReply[]
}

export interface DekoCommentReply {
  id: string
  comment_id: string
  content: string
  author_id: string
  created_at: string
  author_name?: string
}

export interface DekoVote {
  item_id: string
  user_id: string
  vote: 'up' | 'down'
}

// ── Organizer templates ───────────────────────────────────────────────────────

export interface DekoOrganizerTemplate {
  id: string
  organizer_id: string
  name: string
  description: string | null
  preview_image_url: string | null
  sort_order: number
}

export interface DekoOrganizerFlatRate {
  id: string
  organizer_id: string
  template_id: string | null
  name: string
  description: string | null
  amount: number
}

// ── Real-time presence ────────────────────────────────────────────────────────

export interface PresenceUser {
  user_id: string
  user_name: string
  color: string
  cursor_x: number
  cursor_y: number
  dragging_item_id?: string
}

// ── Default dimensions per item type ─────────────────────────────────────────

export const ITEM_DEFAULTS: Record<DekoItemType, { w: number; h: number }> = {
  image_upload:      { w: 280, h: 220 },
  image_url:         { w: 280, h: 220 },
  color_palette:     { w: 320, h: 80  },
  color_swatch:      { w: 100, h: 100 },
  text_block:        { w: 280, h: 140 },
  sticky_note:       { w: 200, h: 180 },
  heading:           { w: 320, h: 60  },
  article:           { w: 240, h: 300 },
  flat_rate_article: { w: 240, h: 260 },
  fabric:            { w: 240, h: 260 },
  frame:             { w: 500, h: 400 },
  divider:           { w: 400, h: 20  },
  area_label:        { w: 200, h: 48  },
  vote_card:         { w: 240, h: 300 },
  checklist:         { w: 240, h: 220 },
  link_card:         { w: 280, h: 160 },
  table_ref:         { w: 220, h: 160 },
  room_info:         { w: 220, h: 180 },
  guest_count:       { w: 160, h: 100 },
}

// ── Budget calculation helper ─────────────────────────────────────────────────

export function calcItemPrice(
  item: DekoItem,
  catalog: DekoCatalogItem[],
  flatRates: DekoFlatRate[]
): number {
  if (item.type === 'article') {
    const d = item.data as ArticleData
    const cat = catalog.find(c => c.id === d.catalog_item_id)
    if (!cat || cat.is_free) return 0
    if (cat.flat_rate_id) return 0 // flat rate contributes separately
    return (cat.price_per_unit ?? 0) * (d.quantity ?? 1)
  }
  if (item.type === 'flat_rate_article') {
    const d = item.data as FlatRateArticleData
    if (d.is_free) return 0
    const fr = flatRates.find(f => f.id === d.flat_rate_id)
    return fr?.amount ?? 0
  }
  if (item.type === 'fabric') {
    const d = item.data as FabricData
    const cat = catalog.find(c => c.id === d.catalog_item_id)
    if (!cat || cat.is_free) return 0
    return (cat.price_per_meter ?? 0) * (d.quantity_meters ?? 1)
  }
  return 0
}

export function calcCanvasBudget(
  items: DekoItem[],
  catalog: DekoCatalogItem[],
  flatRates: DekoFlatRate[]
): number {
  // Flat rates: only count once per flat_rate_id
  const seenFlatRates = new Set<string>()
  let total = 0
  for (const item of items) {
    if (item.type === 'flat_rate_article') {
      const d = item.data as FlatRateArticleData
      if (d.is_free) continue
      if (!seenFlatRates.has(d.flat_rate_id)) {
        seenFlatRates.add(d.flat_rate_id)
        const fr = flatRates.find(f => f.id === d.flat_rate_id)
        total += fr?.amount ?? 0
      }
    } else {
      total += calcItemPrice(item, catalog, flatRates)
    }
  }
  return total
}
