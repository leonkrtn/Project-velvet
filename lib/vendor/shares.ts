// Shared types + module catalog for vendor data-share boxes.
// Safe to import from both client and server (no server-only deps).

export type ShareModule =
  | 'ablaufplan'
  | 'sitzplan'
  | 'gaesteliste'
  | 'catering'
  | 'getraenke'
  | 'musik'
  | 'patisserie'

export type ShareMode = 'snapshot' | 'live'
export type ShareStatus = 'active' | 'frozen' | 'revoked'

export interface ShareModuleDef {
  key: ShareModule
  label: string
}

export const SHARE_MODULES: ShareModuleDef[] = [
  { key: 'ablaufplan',  label: 'Ablaufplan' },
  { key: 'sitzplan',    label: 'Sitzplan' },
  { key: 'gaesteliste', label: 'Gästeliste' },
  { key: 'catering',    label: 'Catering & Menü' },
  { key: 'getraenke',   label: 'Getränke' },
  { key: 'musik',       label: 'Musik' },
  { key: 'patisserie',  label: 'Patisserie' },
]

export const SHARE_MODULE_LABELS: Record<ShareModule, string> =
  Object.fromEntries(SHARE_MODULES.map(m => [m.key, m.label])) as Record<ShareModule, string>

export function isShareModule(value: string): value is ShareModule {
  return SHARE_MODULES.some(m => m.key === value)
}

// ── Snapshot data shape (rendered by ShareBox) ──────────────────────────────

export type SnapshotBlock =
  | { kind: 'keyvalue'; heading?: string; items: { label: string; value: string }[] }
  | { kind: 'list';     heading?: string; items: string[] }
  | { kind: 'table';    heading?: string; columns: string[]; rows: string[][] }
  | { kind: 'text';     heading?: string; text: string }
  // ── Rich, type-specific blocks (rendered with bespoke layouts in ShareBox) ──
  | { kind: 'stats';    heading?: string; items: { label: string; value: string; sub?: string }[] }
  | { kind: 'timeline'; heading?: string; items: { time: string; title: string; meta?: string; category?: string }[] }
  | { kind: 'tags';     heading?: string; items: string[] }
  | { kind: 'swatches'; heading?: string; items: { hex: string; name?: string }[] }
  | { kind: 'images';   heading?: string; items: { url: string; caption?: string }[] }
  | { kind: 'menu';     heading?: string; items: { name: string; note?: string }[] }
  | { kind: 'songs';    heading?: string; tone?: 'wish' | 'nogo'; items: { title: string; artist?: string }[] }

export interface ModuleSnapshot {
  module: ShareModule
  label: string
  generatedAt: string
  empty: boolean
  blocks: SnapshotBlock[]
}

export interface DataShare {
  id: string
  event_id: string
  conversation_id: string
  module: ShareModule
  mode: ShareMode
  status: ShareStatus
  snapshot: ModuleSnapshot | null
  shared_by: string | null
  message_id: string | null
  created_at: string
  updated_at: string
}
