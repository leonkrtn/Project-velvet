'use client'
import React, { useState, useEffect, useRef } from 'react'
import { Images, Upload, Trash2, X, Loader, Camera } from 'lucide-react'

interface Photo {
  id: string
  uploader_name: string | null
  uploaded_at: string
  url: string | null
  is_own: boolean
}

interface Props {
  token: string
}

export default function RsvpPhotos({ token }: Props) {
  const [photos, setPhotos]       = useState<Photo[]>([])
  const [enabled, setEnabled]     = useState(true)
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [lightbox, setLightbox]   = useState<Photo | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [toast, setToast]         = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [token])

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/rsvp/${token}/photos`)
      const data = await res.json()
      setEnabled(data.enabled !== false)
      setPhotos(data.photos ?? [])
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    let done = 0

    for (const file of Array.from(files)) {
      try {
        const res1 = await fetch(`/api/rsvp/${token}/photos`, {
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

        // Upload to R2
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })

        // Confirm
        await fetch(`/api/rsvp/${token}/photos/${photoId}`, { method: 'PATCH' })
        done++
        setProgress(Math.round((done / files.length) * 100))
      } catch {
        setError('Ein Foto konnte nicht hochgeladen werden')
      }
    }

    setUploading(false)
    setProgress(0)
    if (done > 0) showToast(`${done} Foto${done > 1 ? 's' : ''} hochgeladen`)
    load()
  }

  async function deletePhoto(photo: Photo) {
    const res = await fetch(`/api/rsvp/${token}/photos/${photo.id}`, { method: 'DELETE' })
    if (res.ok) {
      setPhotos(p => p.filter(x => x.id !== photo.id))
      if (lightbox?.id === photo.id) setLightbox(null)
    }
  }

  function fmt(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
  }

  if (!enabled) return null

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(176,141,87,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Camera size={18} color="var(--gold, #b09057)" />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Eventfotos</p>
          <p style={{ fontSize: 13, color: 'var(--text-dim, #666)', margin: 0 }}>Teile deine Fotos vom großen Tag</p>
        </div>
      </div>

      {/* Upload button */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{
          width: '100%', padding: '14px 20px',
          background: 'var(--gold, #b09057)', color: '#fff',
          border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 600, cursor: uploading ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: uploading ? 0.7 : 1, fontFamily: 'inherit',
          marginBottom: 16,
        }}
      >
        {uploading
          ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Wird hochgeladen… {progress > 0 ? `${progress}%` : ''}</>
          : <><Upload size={16} /> Fotos hochladen</>
        }
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
        multiple
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FFF0EF', border: '1px solid #FFD5D2', color: '#c0392b', fontSize: 13, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {/* Gallery */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim, #666)', fontSize: 14 }}>Lädt…</div>
      ) : photos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 16px', background: 'var(--card-bg, #f9f8f6)', borderRadius: 12, border: '2px dashed var(--border-light, #ddd)' }}>
          <Images size={32} style={{ color: 'var(--text-dim, #999)', marginBottom: 8 }} />
          <p style={{ fontSize: 14, color: 'var(--text-dim, #666)', margin: 0 }}>Noch keine Fotos — sei der Erste!</p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-dim, #999)', marginBottom: 10 }}>{photos.length} Foto{photos.length !== 1 ? 's' : ''}</p>
          <div style={{ columns: '2 120px', gap: 6 }}>
            {photos.map(photo => (
              <div
                key={photo.id}
                style={{
                  position: 'relative', breakInside: 'avoid', marginBottom: 6,
                  borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                  background: '#eee',
                }}
                onClick={() => setLightbox(photo)}
              >
                {photo.url && (
                  <img
                    src={photo.url}
                    alt=""
                    style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                    loading="lazy"
                  />
                )}
                {/* Name + delete badge */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 8px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.5))', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 10, color: '#fff', fontWeight: 500 }}>{photo.uploader_name ?? '—'}</span>
                  {photo.is_own && (
                    <button
                      onClick={e => { e.stopPropagation(); deletePhoto(photo) }}
                      style={{ background: 'rgba(255,59,48,0.85)', border: 'none', borderRadius: 4, padding: '3px 5px', cursor: 'pointer' }}
                    >
                      <Trash2 size={10} color="#fff" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
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
              style={{ maxHeight: '82vh', maxWidth: '92vw', borderRadius: 10, objectFit: 'contain' }}
              onClick={e => e.stopPropagation()}
            />
          )}
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, margin: 0 }}>{lightbox.uploader_name ?? '—'} · {fmt(lightbox.uploaded_at)}</p>
            {lightbox.is_own && (
              <button
                onClick={e => { e.stopPropagation(); deletePhoto(lightbox) }}
                style={{ marginTop: 8, padding: '6px 14px', background: 'rgba(255,59,48,0.85)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}
              >
                <Trash2 size={12} /> Löschen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload success toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 14, zIndex: 1001 }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
