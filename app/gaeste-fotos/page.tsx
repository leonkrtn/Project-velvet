'use client'
import React, { useState, useRef } from 'react'
import { Search, Trash2, Upload, ImageIcon, X, BookOpen, Check, ShoppingBag } from 'lucide-react'
import { saveEvent } from '@/lib/store'
import type { GuestPhoto } from '@/lib/store'
import { useEvent } from '@/lib/event-context'
import { useFeatureEnabled, FeatureDisabledScreen } from '@/components/FeatureGate'
import { v4 as uuid } from 'uuid'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Album styles ────────────────────────────────────────────────────────────
const ALBUM_STYLES = [
  {
    id: 'klassisch-elegant',
    name: 'Klassisch Elegant',
    desc: 'Zeitlos schön mit goldenen Akzenten',
    bg: '#FDFAF5', accent: '#C9A84C', border: '#C9A84C',
  },
  {
    id: 'botanisch',
    name: 'Botanisch',
    desc: 'Florales Design mit Naturmotiven',
    bg: '#F2F5EF', accent: '#6B8C5E', border: '#A8C89A',
  },
  {
    id: 'rustikal',
    name: 'Rustikal Romantisch',
    desc: 'Warme Erdtöne im Landhausstil',
    bg: '#F5EFE6', accent: '#9C6D42', border: '#C4956A',
  },
  {
    id: 'minimalistisch',
    name: 'Modern Minimalistisch',
    desc: 'Klare Linien und pure Eleganz',
    bg: '#FFFFFF', accent: '#1A1A1A', border: '#E0E0E0',
  },
  {
    id: 'vintage',
    name: 'Vintage Romantik',
    desc: 'Nostalgischer Charme mit Sepiaglanz',
    bg: '#F5EDE4', accent: '#8B5E52', border: '#C4956A',
  },
  {
    id: 'maerchenhaft',
    name: 'Märchenhaft',
    desc: 'Verspielt und romantisch in Pastelltönen',
    bg: '#FDF0F5', accent: '#C67B9A', border: '#E8A8C8',
  },
]

// ── Preview configs (visual style per album type) ───────────────────────────
const PREVIEW_CONFIGS: Record<string, {
  bodyBg: string; headerBg: string; headerText: string; accentColor: string
  dimText: string; fontFamily: string; photoRadius: string; photoBorder: string
  photoFilter: string; photoShadow: string; headerBorder: string
  columns: number; gap: number; decorator: string
}> = {
  'klassisch-elegant': {
    bodyBg: '#FDFAF5', headerBg: 'linear-gradient(160deg,#FDF8EE,#F5E8C8)',
    headerText: '#9A6E1A', accentColor: '#C9A84C', dimText: '#8A7045',
    fontFamily: '"Georgia","Times New Roman",serif',
    photoRadius: '3px', photoBorder: '2px solid #C9A84C', photoFilter: 'none',
    photoShadow: 'none', headerBorder: '2px solid #C9A84C',
    columns: 3, gap: 6, decorator: '✦  ✦  ✦',
  },
  'botanisch': {
    bodyBg: '#F0F5EC', headerBg: 'linear-gradient(160deg,#E8F0E4,#D4E6CC)',
    headerText: '#3D6A35', accentColor: '#6B8C5E', dimText: '#5A7050',
    fontFamily: '"Georgia",serif',
    photoRadius: '8px', photoBorder: '1.5px solid #A8C89A', photoFilter: 'none',
    photoShadow: 'none', headerBorder: '2px solid #8AB88A',
    columns: 2, gap: 10, decorator: '❧  ❧  ❧',
  },
  'rustikal': {
    bodyBg: '#F5EDE0', headerBg: 'linear-gradient(160deg,#EDE0CC,#DECCB0)',
    headerText: '#6A3A15', accentColor: '#9C6D42', dimText: '#8A6045',
    fontFamily: '"Palatino Linotype","Palatino",serif',
    photoRadius: '2px', photoBorder: '3px solid #C4956A',
    photoFilter: 'sepia(25%) saturate(85%) brightness(98%)',
    photoShadow: '3px 3px 8px rgba(100,60,20,.2)', headerBorder: '2px solid #C4956A',
    columns: 2, gap: 10, decorator: '—  ✦  —',
  },
  'minimalistisch': {
    bodyBg: '#FFFFFF', headerBg: '#FFFFFF',
    headerText: '#0A0A0A', accentColor: '#1A1A1A', dimText: '#777',
    fontFamily: '"Helvetica Neue","Arial",sans-serif',
    photoRadius: '0', photoBorder: 'none', photoFilter: 'none',
    photoShadow: 'none', headerBorder: '1px solid #E0E0E0',
    columns: 3, gap: 2, decorator: '',
  },
  'vintage': {
    bodyBg: '#F5EDE4', headerBg: 'linear-gradient(160deg,#EDE0D5,#DDD0C8)',
    headerText: '#5A2A18', accentColor: '#8B5E52', dimText: '#8A6558',
    fontFamily: '"Palatino Linotype","Book Antiqua",serif',
    photoRadius: '1px', photoBorder: '4px double #C4956A',
    photoFilter: 'sepia(40%) contrast(90%) brightness(95%)',
    photoShadow: '2px 3px 10px rgba(80,40,20,.2)', headerBorder: '3px double #C4956A',
    columns: 2, gap: 14, decorator: '~  ❦  ~',
  },
  'maerchenhaft': {
    bodyBg: '#FDF0F5', headerBg: 'linear-gradient(160deg,#FDE8F0,#F0D8EC)',
    headerText: '#9A4A70', accentColor: '#C67B9A', dimText: '#9A6580',
    fontFamily: '"Georgia",serif',
    photoRadius: '50%', photoBorder: '3px solid #E8A8C8', photoFilter: 'none',
    photoShadow: '0 3px 14px rgba(200,100,160,.22)', headerBorder: '2px solid #E8A8C8',
    columns: 3, gap: 12, decorator: '✿  ✿  ✿',
  },
}

// ── Page component ──────────────────────────────────────────────────────────
export default function GaesteFotosPage() {
  const enabled = useFeatureEnabled('gaeste-fotos')
  const { event, updateEvent } = useEvent()
  const [search, setSearch] = useState('')
  const [uploaderName, setUploaderName] = useState('')
  const [lightbox, setLightbox] = useState<GuestPhoto | null>(null)
  const [showAlbumModal, setShowAlbumModal] = useState(false)
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null)
  const [step, setStep] = useState<'select' | 'preview' | 'confirmed'>('select')
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
      newPhotos.push({ id: uuid(), uploaderName: name, dataUrl, uploadedAt: new Date().toISOString() })
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

  const closeModal = () => {
    setShowAlbumModal(false)
    setSelectedAlbum(null)
    setStep('select')
  }

  const goToPreview = () => { if (selectedAlbum) setStep('preview') }
  const submitOrder = () => { setStep('confirmed') }

  const uploaderGroups = Array.from(new Set(filtered.map(p => p.uploaderName)))
  const selectedStyle = ALBUM_STYLES.find(s => s.id === selectedAlbum)

  return (
    <>
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingBottom: 88 }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

          {/* Header */}
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: 'var(--heading-font)', fontSize: 26, fontWeight: 500, color: 'var(--text)', margin: '0 0 6px' }}>Gäste-Fotos</h1>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
                Sammelt Fotos vom Tag · {photos.length} Foto{photos.length !== 1 ? 's' : ''}
              </p>
            </div>
            {photos.length > 0 && (
              <button
                onClick={() => setShowAlbumModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  background: 'var(--gold)', color: '#fff', border: 'none',
                  borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                <BookOpen size={14} /> Album bestellen
              </button>
            )}
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
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleUpload} />
              <button
                onClick={() => {
                  if (!uploaderName.trim()) { alert('Bitte gib deinen Namen ein, bevor du Fotos hochlädst.'); return }
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
                          position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer',
                          fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
      </div>

      {/* ── Album-Bestell-Modal ──────────────────────────────────────────────── */}
      {showAlbumModal && (
        <>
          <div onClick={closeModal} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 91, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{
              background: 'var(--bg)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
              maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24,
            }}>

              {step === 'confirmed' && (
                /* ── Schritt 3: Bestellbestätigung ── */
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', background: 'var(--gold-pale)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                  }}>
                    <Check size={26} color="var(--gold)" strokeWidth={2.5} />
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)', margin: '0 0 8px', fontFamily: 'var(--heading-font)' }}>
                    Bestellung aufgegeben!
                  </h2>
                  <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, margin: '0 0 6px' }}>
                    Dein <strong style={{ color: 'var(--text)' }}>{selectedStyle?.name}</strong>-Album mit {photos.length} Foto{photos.length !== 1 ? 's' : ''} wurde bestellt.
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 28 }}>
                    Wir melden uns in Kürze mit weiteren Details zur Lieferung.
                  </p>
                  <button onClick={closeModal} style={{ padding: '10px 24px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Schließen
                  </button>
                </div>
              )}

              {step === 'preview' && selectedAlbum && (() => {
                /* ── Schritt 2: Album-Vorschau ── */
                const cfg = PREVIEW_CONFIGS[selectedAlbum]
                const previewPhotos = photos.slice(0, 6)
                const isItalic = selectedAlbum === 'klassisch-elegant' || selectedAlbum === 'vintage'
                return (
                  <>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px', fontFamily: 'var(--heading-font)' }}>Vorschau</h2>
                        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>So wird dein <strong>{selectedStyle?.name}</strong>-Album aussehen</p>
                      </div>
                      <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4 }}>
                        <X size={18} />
                      </button>
                    </div>

                    {/* Album mockup */}
                    <div style={{ borderRadius: 10, overflow: 'hidden', border: cfg.headerBorder, marginBottom: 20 }}>
                      {/* Album cover strip */}
                      <div style={{ background: cfg.headerBg, padding: '20px 20px 16px', textAlign: 'center', borderBottom: cfg.headerBorder }}>
                        {cfg.decorator && <div style={{ fontSize: 13, color: cfg.accentColor, letterSpacing: '0.4em', opacity: 0.6, marginBottom: 8 }}>{cfg.decorator}</div>}
                        <div style={{ fontFamily: cfg.fontFamily, fontSize: 20, fontWeight: 400, color: cfg.headerText, letterSpacing: '0.05em', marginBottom: 4 }}>
                          {event.coupleName || 'Hochzeitsalbum'}
                        </div>
                        <div style={{ fontSize: 10, color: cfg.dimText, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Fotoalbum · {photos.length} Fotos</div>
                        {cfg.decorator && <div style={{ fontSize: 13, color: cfg.accentColor, letterSpacing: '0.4em', opacity: 0.6, marginTop: 8 }}>{cfg.decorator}</div>}
                      </div>

                      {/* Photo grid */}
                      <div style={{
                        background: cfg.bodyBg, padding: 14,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${cfg.columns}, 1fr)`,
                        gap: cfg.gap,
                      }}>
                        {previewPhotos.map((photo, i) => (
                          <div key={photo.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                              width: '100%', aspectRatio: '1/1', overflow: 'hidden',
                              borderRadius: cfg.photoRadius,
                              border: cfg.photoBorder,
                              boxShadow: cfg.photoShadow,
                              ...(selectedAlbum === 'vintage' ? { padding: 5, background: '#FDF5EE' } : {}),
                            }}>
                              <img
                                src={photo.dataUrl}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: cfg.photoFilter }}
                              />
                            </div>
                            <div style={{ fontSize: 9, color: cfg.dimText, marginTop: 4, textAlign: 'center', fontFamily: cfg.fontFamily, fontStyle: isItalic ? 'italic' : 'normal' }}>
                              {photo.uploaderName}
                            </div>
                          </div>
                        ))}
                        {photos.length > 6 && (
                          <div style={{ aspectRatio: '1/1', borderRadius: cfg.photoRadius, border: cfg.photoBorder, background: cfg.headerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 16, fontWeight: 600, color: cfg.accentColor }}>+{photos.length - 6}</span>
                            <span style={{ fontSize: 9, color: cfg.dimText }}>weitere</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setStep('select')}
                        style={{ padding: '10px 18px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        ← Zurück
                      </button>
                      <button
                        onClick={submitOrder}
                        style={{ padding: '10px 18px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <ShoppingBag size={13} /> Jetzt bestellen
                      </button>
                    </div>
                  </>
                )
              })()}

              {step === 'select' && (
                /* ── Schritt 1: Stilauswahl ── */
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px', fontFamily: 'var(--heading-font)' }}>
                        Fotoalbum bestellen
                      </h2>
                      <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
                        Wähle ein Gestaltungsthema für dein Album
                      </p>
                    </div>
                    <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4 }}>
                      <X size={18} />
                    </button>
                  </div>

                  {/* Style grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
                    {ALBUM_STYLES.map(style => {
                      const isSelected = selectedAlbum === style.id
                      return (
                        <button
                          key={style.id}
                          onClick={() => setSelectedAlbum(style.id)}
                          style={{
                            background: isSelected ? style.bg : 'var(--surface)',
                            border: `2px solid ${isSelected ? style.accent : 'var(--border)'}`,
                            borderRadius: 'var(--r-sm)', padding: 12, cursor: 'pointer',
                            textAlign: 'left', position: 'relative', transition: 'border-color .15s',
                            fontFamily: 'inherit',
                          }}
                        >
                          {/* Mini preview */}
                          <div style={{ background: style.bg, borderRadius: 6, padding: '10px 10px 8px', marginBottom: 10, border: `1px solid ${style.border}` }}>
                            <div style={{ height: 5, width: '55%', borderRadius: 3, background: style.accent, marginBottom: 7, opacity: 0.8 }} />
                            <div style={{ height: 3, width: '35%', borderRadius: 2, background: style.accent, marginBottom: 9, opacity: 0.4 }} />
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                              {[0.3, 0.45, 0.35].map((op, i) => (
                                <div key={i} style={{ aspectRatio: '1/1', borderRadius: 3, background: style.accent, opacity: op }} />
                              ))}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{style.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.45 }}>{style.desc}</div>
                          {isSelected && (
                            <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%', background: style.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={11} color="#fff" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={closeModal}
                      style={{ padding: '10px 18px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={goToPreview}
                      disabled={!selectedAlbum}
                      style={{
                        padding: '10px 18px',
                        background: selectedAlbum ? 'var(--gold)' : 'var(--border)',
                        color: selectedAlbum ? '#fff' : 'var(--text-dim)',
                        border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600,
                        cursor: selectedAlbum ? 'pointer' : 'not-allowed',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'background .15s',
                      }}
                    >
                      Vorschau ansehen →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
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
    </>
  )
}
