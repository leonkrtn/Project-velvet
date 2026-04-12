'use client'
import React, { useState, useRef } from 'react'
import { Search, Trash2, Upload, ImageIcon, X } from 'lucide-react'
import { saveEvent } from '@/lib/store'
import type { GuestPhoto } from '@/lib/store'
import { useEvent } from '@/lib/event-context'
import { useFeatureEnabled, FeatureDisabledScreen } from '@/components/FeatureGate'
import { v4 as uuid } from 'uuid'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function GaesteFotosPage() {
  const enabled = useFeatureEnabled('gaeste-fotos')
  const { event, updateEvent } = useEvent()
  const [search, setSearch] = useState('')
  const [uploaderName, setUploaderName] = useState('')
  const [lightbox, setLightbox] = useState<GuestPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!event) return null
  if (!enabled) return <FeatureDisabledScreen />

  const photos: GuestPhoto[] = event.guestPhotos ?? []
  const filtered = search
    ? photos.filter(p => p.uploaderName.toLowerCase().includes(search.toLowerCase()))
    : photos

  const readFile = (file: File): Promise<string> =>
    new Promise(res => {
      const reader = new FileReader()
      reader.onload = e => res(e.target?.result as string)
      reader.readAsDataURL(file)
    })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !uploaderName.trim()) return
    const name = uploaderName.trim()
    const newPhotos: GuestPhoto[] = []
    for (let i = 0; i < files.length; i++) {
      const dataUrl = await readFile(files[i])
      newPhotos.push({
        id: uuid(),
        uploaderName: name,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      })
    }
    const updated = { ...event, guestPhotos: [...photos, ...newPhotos] }
    updateEvent(updated); saveEvent(updated)
    e.target.value = ''
  }

  const remove = (id: string) => {
    const updated = { ...event, guestPhotos: photos.filter(p => p.id !== id) }
    updateEvent(updated); saveEvent(updated)
    if (lightbox?.id === id) setLightbox(null)
  }

  // Grouped by uploader
  const uploaderGroups = Array.from(new Set(filtered.map(p => p.uploaderName)))

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingBottom: 88 }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'var(--heading-font)', fontSize: 26, fontWeight: 500, color: 'var(--text)', margin: '0 0 6px' }}>Gäste-Fotos</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
            Sammelt Fotos vom Tag · {photos.length} Foto{photos.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Upload area */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px', marginBottom: 20 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)', marginBottom: 12 }}>Fotos hochladen</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Dein Name</label>
              <input
                value={uploaderName}
                onChange={e => setUploaderName(e.target.value)}
                placeholder="z. B. Max Mustermann"
                style={{
                  width: '100%', padding: '10px 13px', background: '#fff', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
            <button
              onClick={() => {
                if (!uploaderName.trim()) {
                  alert('Bitte gib deinen Namen ein, bevor du Fotos hochlädst.')
                  return
                }
                fileRef.current?.click()
              }}
              style={{
                padding: '10px 18px', background: 'var(--gold)', color: '#fff', border: 'none',
                borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              }}
            >
              <Upload size={14} /> Hochladen
            </button>
          </div>
        </div>

        {/* Search */}
        {photos.length > 0 && (
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nach Name suchen …"
              style={{
                width: '100%', padding: '10px 13px 10px 36px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-dim)', display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {photos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-dim)' }}>
            <ImageIcon size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p style={{ fontSize: 15, fontWeight: 500 }}>Noch keine Fotos</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>Gäste können hier Fotos vom Tag hochladen.</p>
          </div>
        )}

        {/* Grouped photo grid */}
        {uploaderGroups.map(name => {
          const userPhotos = filtered.filter(p => p.uploaderName === name)
          return (
            <div key={name} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gold-pale)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{userPhotos.length} Foto{userPhotos.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {userPhotos.map(photo => (
                  <div key={photo.id} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setLightbox(photo)}>
                    <img
                      src={photo.dataUrl}
                      alt={`Foto von ${photo.uploaderName}`}
                      style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8, display: 'block' }}
                    />
                    <button
                      onClick={e => { e.stopPropagation(); remove(photo.id) }}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.55)', color: '#fff',
                        border: 'none', cursor: 'pointer', fontSize: 11,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {search && filtered.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-dim)', padding: '32px 0' }}>
            Keine Fotos von „{search}" gefunden.
          </p>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <>
          <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 81, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ position: 'relative', maxWidth: 600, width: '100%' }}>
              <img
                src={lightbox.dataUrl}
                alt=""
                style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12, display: 'block' }}
              />
              <div style={{ textAlign: 'center', marginTop: 10, color: '#fff', fontSize: 13 }}>
                {lightbox.uploaderName} · {formatDate(lightbox.uploadedAt)}
              </div>
              <button
                onClick={() => setLightbox(null)}
                style={{ position: 'absolute', top: -12, right: -12, width: 32, height: 32, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} style={{ color: '#1A1A1A' }} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
