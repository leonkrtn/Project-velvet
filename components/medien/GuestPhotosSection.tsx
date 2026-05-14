'use client'
import React, { useState, useEffect, useRef } from 'react'
import { Images, Upload, Trash2, X, Loader, Globe, Lock } from 'lucide-react'

interface Photo {
  id: string
  uploader_name: string | null
  uploaded_at: string
  url: string | null
  can_delete: boolean
}

interface Props {
  eventId: string
  mode?: string
}

export default function GuestPhotosSection({ eventId, mode }: Props) {
  const [photos, setPhotos]       = useState<Photo[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox]   = useState<Photo | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [isPublic, setIsPublic]   = useState(true)
  const [isBrautpaar, setIsBrautpaar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [eventId])

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/events/${eventId}/photos`)
      const data = await res.json()
      setPhotos(data.photos ?? [])
      setIsPublic(data.isPublic ?? true)
      setIsBrautpaar(data.isBrautpaar ?? false)
    } catch {
      setError('Fotos konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  async function togglePublic(val: boolean) {
    setIsPublic(val)
    await fetch(`/api/events/${eventId}/photos`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: val }),
    })
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)

    for (const file of Array.from(files)) {
      try {
        // 1. Request presigned upload URL
        const res1 = await fetch(`/api/events/${eventId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }),
        })
        if (!res1.ok) {
          const j = await res1.json()
          setError(j.error ?? 'Upload fehlgeschlagen')
          continue
        }
        const { photoId, uploadUrl } = await res1.json()

        // 2. Upload directly to R2
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })

        // 3. Confirm
        await fetch(`/api/events/${eventId}/photos/${photoId}`, { method: 'PATCH' })
      } catch {
        setError('Upload fehlgeschlagen')
      }
    }

    setUploading(false)
    load()
  }

  async function deletePhoto(photo: Photo) {
    if (!confirm(`Foto von „${photo.uploader_name ?? 'Unbekannt'}" löschen?`)) return
    const res = await fetch(`/api/events/${eventId}/photos/${photo.id}`, { method: 'DELETE' })
    if (res.ok) setPhotos(p => p.filter(x => x.id !== photo.id))
  }

  function fmt(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div style={{ marginTop: 32 }}>
      {/* Brautpaar visibility toggle */}
      {(isBrautpaar || mode === 'brautpaar') && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', marginBottom: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isPublic
              ? <Globe size={14} color="var(--accent)" />
              : <Lock size={14} color="var(--text-secondary)" />}
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>
                {isPublic ? 'Alle Gäste sehen alle Fotos' : 'Gäste sehen nur ihre eigenen Fotos'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>Sichtbarkeit für Gäste</p>
            </div>
          </div>
          <button
            onClick={() => togglePublic(!isPublic)}
            style={{
              width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
              background: isPublic ? 'var(--accent)' : 'var(--border2)', position: 'relative', flexShrink: 0, transition: 'background 0.2s',
            }}
          >
            <span style={{ position: 'absolute', top: 3, left: isPublic ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
          Gästefotos ({photos.length})
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'var(--surface)',
            fontSize: 12, cursor: uploading ? 'default' : 'pointer',
            color: 'var(--text-secondary)', fontFamily: 'inherit',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={13} />}
          {uploading ? 'Wird hochgeladen…' : 'Foto hochladen'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)', color: '#FF3B30', fontSize: 13, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30' }}><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Wird geladen…</div>
      ) : photos.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)',
            border: '2px dashed var(--border)', padding: '40px 24px',
            textAlign: 'center', cursor: 'pointer',
          }}
          onClick={() => fileRef.current?.click()}
        >
          <Images size={28} style={{ color: 'var(--text-tertiary)', marginBottom: 10 }} />
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Noch keine Fotos hochgeladen</p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Klicken zum Hochladen</p>
        </div>
      ) : (
        <div style={{ columns: '3 160px', gap: 8 }}>
          {photos.map(photo => (
            <div
              key={photo.id}
              style={{
                position: 'relative', breakInside: 'avoid', marginBottom: 8,
                borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                cursor: 'pointer', background: 'var(--border)',
              }}
              onClick={() => setLightbox(photo)}
            >
              {photo.url && (
                <img
                  src={photo.url}
                  alt={photo.uploader_name ?? ''}
                  style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                  loading="lazy"
                />
              )}
              {/* Hover overlay */}
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
                transition: 'background 0.15s',
                display: 'flex', alignItems: 'flex-end',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.35)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
              >
                <div style={{ padding: '6px 8px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                    {photo.uploader_name ?? '—'}
                  </span>
                  {photo.can_delete && (
                    <button
                      onClick={e => { e.stopPropagation(); deletePhoto(photo) }}
                      style={{ background: 'rgba(255,59,48,0.85)', border: 'none', borderRadius: 4, padding: '3px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <Trash2 size={11} color="#fff" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
            zIndex: 1000, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 16, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} color="#fff" />
          </button>
          {lightbox.url && (
            <img
              src={lightbox.url}
              alt=""
              style={{ maxHeight: '85vh', maxWidth: '90vw', borderRadius: 8, objectFit: 'contain' }}
              onClick={e => e.stopPropagation()}
            />
          )}
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 12 }}>
            {lightbox.uploader_name ?? '—'} · {fmt(lightbox.uploaded_at)}
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
