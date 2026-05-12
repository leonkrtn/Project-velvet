export type FileModule =
  | 'files'
  | 'catering'
  | 'musik'
  | 'ablaufplan'
  | 'dekoration'
  | 'medien'
  | 'patisserie'
  | 'sitzplan'
  | 'gaesteliste'
  | 'chats'
  | 'allgemein'

export type FileStatus = 'pending' | 'active' | 'deleted'

export interface FileMetadata {
  id: string
  event_id: string
  r2_key: string
  original_name: string
  mime_type: string
  size_bytes: number | null
  module: FileModule
  category: string
  uploaded_by: string | null
  status: FileStatus
  expires_at: string | null
  created_at: string
  updated_at: string
}

/** Legacy row from event_files (pre-R2, direct public URLs). Read-only in the new UI. */
export interface LegacyEventFile {
  id: string
  event_id: string
  name: string
  file_url: string
  category: string
  uploaded_at: string
}

export const MODULE_LABELS: Record<FileModule, string> = {
  files:       'Allgemein',
  catering:    'Catering',
  musik:       'Musik',
  ablaufplan:  'Ablaufplan',
  dekoration:  'Dekoration',
  medien:      'Medien',
  patisserie:  'Patisserie',
  sitzplan:    'Sitzplan',
  gaesteliste: 'Gästeliste',
  chats:       'Chats',
  allgemein:   'Allgemein',
}

export const ALL_MODULES: FileModule[] = [
  'files', 'catering', 'musik', 'ablaufplan', 'dekoration',
  'medien', 'patisserie', 'sitzplan', 'gaesteliste', 'chats', 'allgemein',
]

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/heic', 'image/heif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska',
  'application/zip', 'application/x-zip-compressed',
  'text/plain', 'text/csv',
])

/** 500 MB hard limit per file */
export const MAX_FILE_BYTES = 500 * 1024 * 1024

export function mimeToIcon(mime: string): 'image' | 'video' | 'pdf' | 'sheet' | 'doc' | 'file' {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') return 'sheet'
  if (mime.includes('wordprocessing') || mime.includes('msword')) return 'doc'
  return 'file'
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim()
    .substring(0, 200)
    || 'datei'
}
