'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FileText, Image, Video, Music, FileSpreadsheet, Download,
  Trash2, Upload, X, Loader2, File, AlertCircle,
} from 'lucide-react'
import { useFileUpload } from '@/hooks/useFileUpload'
import {
  type FileMetadata,
  type LegacyEventFile,
  type FileModule,
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  MODULE_LABELS,
  ALL_MODULES,
  mimeToIcon,
  formatFileSize,
} from '@/lib/files/types'

// ─── Icon helper ───────────────────────────────────────────────────────────

function FileIcon({ mime, size = 16 }: { mime: string; size?: number }) {
  const type = mimeToIcon(mime)
  const color = type === 'image' ? '#10b981'
    : type === 'video'  ? '#8b5cf6'
    : type === 'pdf'    ? '#ef4444'
    : type === 'sheet'  ? '#22c55e'
    : type === 'doc'    ? '#3b82f6'
    : 'var(--accent)'
  const Icon = type === 'image' ? Image
    : type === 'video'  ? Video
    : type === 'pdf' || type === 'doc' ? FileText
    : type === 'sheet'  ? FileSpreadsheet
    : File
  return <Icon size={size} style={{ color, flexShrink: 0 }} />
}

// ─── Category labels ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  vertrag:       'Vertrag',
  versicherung:  'Versicherung',
  genehmigung:   'Genehmigung',
  rider:         'Rider',
  angebot:       'Angebot',
  rechnung:      'Rechnung',
  menu:          'Menü',
  sonstiges:     'Sonstiges',
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  eventId: string
  /** If set, only shows + uploads to this module. If omitted, shows all modules. */
  module?: FileModule
  /** Which module new uploads are assigned to (defaults to module or 'files') */
  uploadModule?: FileModule
  canUpload: boolean
  /** userId needed to show delete button on own files */
  userId: string
  isVeranstalter?: boolean
}

// ─── Row component ───────────────────────────────────────────────────────────

function FileRow({
  name,
  mime,
  size,
  uploadedAt,
  module,
  canDelete,
  onDownload,
  onDelete,
  isLegacy = false,
  legacyUrl,
}: {
  name: string
  mime: string
  size: number | null
  uploadedAt: string
  module?: string
  canDelete: boolean
  onDownload?: () => Promise<void>
  onDelete?: () => Promise<void>
  isLegacy?: boolean
  legacyUrl?: string
}) {
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dlError, setDlError] = useState<string | null>(null)

  async function handleDownload() {
    setDlError(null)
    if (isLegacy && legacyUrl) {
      window.open(legacyUrl, '_blank', 'noopener')
      return
    }
    if (!onDownload) return
    setDownloading(true)
    try {
      await onDownload()
    } catch (e) {
      setDlError(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setDownloading(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    if (!confirm(`"${name}" wirklich löschen?`)) return
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 18px',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: 'var(--accent-light, #F0F0FF)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <FileIcon mime={mime} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, fontWeight: 500, margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, marginTop: 1 }}>
          {new Date(uploadedAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
          {size ? ` · ${formatFileSize(size)}` : ''}
          {module ? ` · ${MODULE_LABELS[module as FileModule] ?? module}` : ''}
          {isLegacy && ' · Altdatei'}
        </p>
        {dlError && <p style={{ fontSize: 11, color: '#ef4444', margin: 0, marginTop: 2 }}>{dlError}</p>}
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--surface)',
            fontSize: 12, color: 'var(--text-primary)', cursor: downloading ? 'wait' : 'pointer',
          }}
        >
          {downloading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={12} />}
          Download
        </button>
        {canDelete && onDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 6,
              border: '1px solid var(--border)', background: 'transparent',
              cursor: deleting ? 'wait' : 'pointer', color: '#ef4444',
            }}
          >
            {deleting ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Upload overlay ──────────────────────────────────────────────────────────

function UploadPanel({
  eventId,
  uploadModule,
  isVeranstalter,
  onSuccess,
  onClose,
}: {
  eventId: string
  uploadModule: FileModule
  isVeranstalter: boolean
  onSuccess: () => void
  onClose: () => void
}) {
  const { upload, uploading, progress, error, reset } = useFileUpload()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [module, setModule] = useState<FileModule>(uploadModule)
  const [category, setCategory] = useState('sonstiges')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    if (!ALLOWED_MIME_TYPES.has(f.type) && f.type !== '') {
      alert('Dateityp nicht unterstützt.')
      return
    }
    if (f.size > MAX_FILE_BYTES) {
      alert('Datei zu groß (max. 500 MB).')
      return
    }
    setSelectedFile(f)
    reset()
  }

  async function handleUpload() {
    if (!selectedFile) return
    const result = await upload(selectedFile, eventId, module, category)
    if (result) {
      onSuccess()
      onClose()
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface, #fff)', borderRadius: 16,
        padding: '28px 28px 24px', maxWidth: 480, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Datei hochladen</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent, #6366f1)' : 'var(--border, #e5e5e5)'}`,
            borderRadius: 10, padding: '28px 20px', textAlign: 'center',
            cursor: 'pointer', marginBottom: 16, transition: 'border-color 0.15s',
            background: dragOver ? 'var(--accent-light, #F0F0FF)' : 'transparent',
          }}
        >
          <input
            ref={inputRef} type="file" style={{ display: 'none' }}
            accept={[...ALLOWED_MIME_TYPES].join(',')}
            onChange={e => handleFiles(e.target.files)}
          />
          {selectedFile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              <FileIcon mime={selectedFile.type} size={20} />
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{selectedFile.name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{formatFileSize(selectedFile.size)}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setSelectedFile(null); reset() }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <Upload size={24} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                Datei hierher ziehen oder <span style={{ color: 'var(--accent, #6366f1)', fontWeight: 500 }}>auswählen</span>
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                PDF, Bilder, Videos, Excel, Word · max. 500 MB
              </p>
            </>
          )}
        </div>

        {/* Module + Category selectors */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {isVeranstalter && (
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>
                Modul
              </label>
              <select
                value={module}
                onChange={e => setModule(e.target.value as FileModule)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg)', color: 'var(--text-primary)' }}
              >
                {ALL_MODULES.map(m => (
                  <option key={m} value={m}>{MODULE_LABELS[m]}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>
              Kategorie
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg)', color: 'var(--text-primary)' }}
            >
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Progress */}
        {uploading && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5 }}>
              <span>Wird hochgeladen…</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--accent, #6366f1)', width: `${progress}%`, transition: 'width 0.2s' }} />
            </div>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 12, marginBottom: 12 }}>
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, cursor: 'pointer' }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: !selectedFile || uploading ? 'var(--border)' : 'var(--accent, #6366f1)',
              color: !selectedFile || uploading ? 'var(--text-tertiary)' : '#fff',
              fontSize: 13, fontWeight: 500, cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Wird hochgeladen…' : 'Hochladen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function FilesSection({
  eventId,
  module,
  uploadModule,
  canUpload,
  userId,
  isVeranstalter = false,
}: Props) {
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [legacyFiles, setLegacyFiles] = useState<LegacyEventFile[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  const effectiveUploadModule: FileModule = uploadModule ?? module ?? 'files'

  const loadFiles = useCallback(async () => {
    const supabase = createClient()

    // New R2 files
    let q = supabase
      .from('file_metadata')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (module) q = q.eq('module', module)

    const { data: newFiles } = await q
    setFiles((newFiles as FileMetadata[]) ?? [])

    // Legacy event_files (only shown when no module filter, or module = 'files')
    if (!module || module === 'files') {
      const { data: legacy } = await supabase
        .from('event_files')
        .select('id, event_id, name, file_url, category, uploaded_at')
        .eq('event_id', eventId)
        .order('uploaded_at', { ascending: false })
      setLegacyFiles((legacy as LegacyEventFile[]) ?? [])
    }

    setLoading(false)
  }, [eventId, module])

  useEffect(() => { loadFiles() }, [loadFiles])

  async function handleDownload(fileId: string) {
    const res = await fetch(`/api/files/${fileId}/download-url`)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Fehler beim Abrufen des Links' }))
      throw new Error(error)
    }
    const { downloadUrl } = await res.json() as { downloadUrl: string }
    // Create invisible anchor for download
    const a = document.createElement('a')
    a.href = downloadUrl
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function handleDelete(fileId: string) {
    const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Löschen fehlgeschlagen' }))
      alert(error)
      return
    }
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  // Group new files by module when showing all
  const grouped = module
    ? { [module]: files }
    : files.reduce<Record<string, FileMetadata[]>>((acc, f) => {
        if (!acc[f.module]) acc[f.module] = []
        acc[f.module].push(f)
        return acc
      }, {})

  const totalCount = files.length + legacyFiles.length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', margin: 0, marginBottom: 4 }}>
            Dateien
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            {totalCount} {totalCount !== 1 ? 'Dateien' : 'Datei'}
          </p>
        </div>
        {canUpload && (
          <button
            onClick={() => setShowUpload(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 8,
              background: 'var(--accent, #6366f1)', color: '#fff',
              border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Upload size={14} />
            Datei hochladen
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Wird geladen…
        </div>
      ) : totalCount === 0 ? (
        <div style={{
          background: 'var(--surface)', borderRadius: 12, padding: '40px 24px',
          textAlign: 'center', border: '1px solid var(--border)',
        }}>
          <File size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 10 }} />
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            {canUpload ? 'Noch keine Dateien. Lade deine erste Datei hoch.' : 'Noch keine Dateien hinterlegt.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>

          {/* New R2 files — grouped by module */}
          {Object.entries(grouped).map(([mod, modFiles]) => (
            modFiles.length === 0 ? null : (
              <div key={mod}>
                {!module && (
                  <p style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8, marginTop: 0,
                  }}>
                    {MODULE_LABELS[mod as FileModule] ?? mod}
                  </p>
                )}
                <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {modFiles.map((f, i) => (
                    <div key={f.id} style={{ borderBottom: i < modFiles.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <FileRow
                        name={f.original_name}
                        mime={f.mime_type}
                        size={f.size_bytes}
                        uploadedAt={f.created_at}
                        module={!module ? f.module : undefined}
                        canDelete={isVeranstalter || f.uploaded_by === userId}
                        onDownload={() => handleDownload(f.id)}
                        onDelete={() => handleDelete(f.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}

          {/* Legacy event_files */}
          {legacyFiles.length > 0 && (
            <div>
              <p style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8, marginTop: 0,
              }}>
                Ältere Dokumente
              </p>
              <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                {legacyFiles.map((f, i) => (
                  <div key={f.id} style={{ borderBottom: i < legacyFiles.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <FileRow
                      name={f.name}
                      mime="application/octet-stream"
                      size={null}
                      uploadedAt={f.uploaded_at}
                      canDelete={false}
                      isLegacy
                      legacyUrl={f.file_url}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload overlay */}
      {showUpload && (
        <UploadPanel
          eventId={eventId}
          uploadModule={effectiveUploadModule}
          isVeranstalter={isVeranstalter}
          onSuccess={loadFiles}
          onClose={() => setShowUpload(false)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
