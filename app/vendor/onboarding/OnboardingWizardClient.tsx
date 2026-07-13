'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Upload, Plus, Trash2, Check, ChevronLeft, ChevronRight,
  Eye, X,
} from 'lucide-react'
import { MARKETPLACE_CATEGORIES } from '@/lib/marketplace/types'
import { HelpTip } from '@/components/ui/HelpTooltip'
import { uploadVendorImage, UploadError } from '@/lib/marketplace/vendor-upload'
import VendorMarketplacePreview, { type PreviewVendor } from '@/components/marketplace/VendorMarketplacePreview'
import ForevrHeart from '@/components/ForevrHeart'

interface Photo { id: string; url: string | null }

const ACCENT = '#2352C8'
const inp: React.CSSProperties = {
  width: '100%', height: 46, padding: '0 14px', fontSize: 15, border: '1px solid #d6ddea',
  borderRadius: 10, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#111827',
}
const txt: React.CSSProperties = { ...inp, height: 'auto', padding: '12px 14px', resize: 'vertical', lineHeight: 1.5 }

// Wizard-Schritte (Minimal-Set für ein einreichbares Listing).
const STEPS = [
  { key: 'firma', title: 'Wie heißt dein Unternehmen?', sub: 'Name und Gewerk — so wirst du im Marktplatz gefunden.' },
  { key: 'standort', title: 'Wo bist du zu Hause?', sub: 'Deine Stadt erscheint öffentlich und steuert die Umkreissuche.' },
  { key: 'beschreibung', title: 'Beschreibe dich in wenigen Sätzen', sub: 'Das lesen Brautpaare zuerst — mindestens 30 Zeichen.' },
  { key: 'logo', title: 'Lade dein Logo hoch', sub: 'Erscheint auf deiner Karte und in deinen Angeboten.' },
  { key: 'fotos', title: 'Zeig deine Arbeit', sub: 'Mindestens 1 Foto — das erste ist dein Titelbild.' },
  { key: 'kontakt', title: 'Wie erreicht man dich?', sub: 'Telefon oder E-Mail — sichtbar erst nach Annahme einer Anfrage.' },
  { key: 'marke', title: 'Deine Markenfarbe (optional)', sub: 'Akzent für deine Angebots-PDFs und Mails ans Brautpaar.' },
] as const

export default function OnboardingWizardClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [mobilePreview, setMobilePreview] = useState(false)

  const [f, setF] = useState({
    company_name: '', category: 'sonstiges', city: '', description: '',
    phone: '', email: '', brand_color: '',
  })
  const [verified, setVerified] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])

  const logoInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  const flash = (kind: 'ok' | 'err', text: string) => { setMsg({ kind, text }); setTimeout(() => setMsg(null), 3500) }

  // Bestehende Werte laden (Wiedereinstieg).
  const load = useCallback(async () => {
    const res = await fetch('/api/vendor/marketplace/profile')
    if (res.ok) {
      const d = await res.json()
      const v = d.vendor ?? {}
      setF({
        company_name: v.company_name ?? '',
        category: v.category ?? 'sonstiges',
        city: v.city ?? '',
        description: v.description ?? '',
        phone: v.phone ?? '',
        email: v.email ?? '',
        brand_color: v.brand_color ?? '',
      })
      setVerified(!!v.verified)
      setLogoUrl(d.logoUrl ?? null)
      setPhotos((d.photos ?? []).filter((p: Photo) => p.url))
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF(s => ({ ...s, [k]: e.target.value }))

  async function saveDraft() {
    await fetch('/api/vendor/marketplace/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: f.company_name, category: f.category, city: f.city,
        description: f.description, phone: f.phone, email: f.email, brand_color: f.brand_color,
      }),
    }).catch(() => {})
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
    setLogoBusy(true)
    try {
      const key = await uploadVendorImage(file, 'logo')
      const res = await fetch('/api/vendor/marketplace/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo_r2_key: key }),
      })
      if (!res.ok) { flash('err', 'Logo konnte nicht gespeichert werden'); return }
      setLogoUrl(URL.createObjectURL(file))
    } catch (err) {
      flash('err', err instanceof UploadError ? err.message : 'Upload fehlgeschlagen')
    } finally { setLogoBusy(false) }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); e.target.value = ''; if (!files.length) return
    setPhotoBusy(true)
    for (const file of files) {
      if (photos.length >= 15) break
      try {
        const key = await uploadVendorImage(file, 'photo')
        const res = await fetch('/api/vendor/marketplace/photos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ r2_key: key }),
        })
        const d = await res.json().catch(() => ({}))
        if (res.ok && d.id) setPhotos(p => [...p, { id: d.id as string, url: URL.createObjectURL(file) }])
      } catch (err) {
        if (err instanceof UploadError) flash('err', err.message)
      }
    }
    setPhotoBusy(false)
  }

  async function deletePhoto(id: string) {
    const res = await fetch(`/api/vendor/marketplace/photos/${id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) setPhotos(p => p.filter(x => x.id !== id))
  }

  const stepValid = (i: number): boolean => {
    switch (STEPS[i].key) {
      case 'firma': return !!f.company_name.trim()
      case 'standort': return !!f.city.trim()
      case 'beschreibung': return f.description.trim().length >= 30
      case 'logo': return !!logoUrl
      case 'fotos': return photos.length >= 1
      case 'kontakt': return !!f.phone.trim() || !!f.email.trim()
      default: return true
    }
  }

  const isLast = step === STEPS.length - 1

  async function next() {
    setBusy(true)
    await saveDraft()
    setBusy(false)
    if (isLast) { router.push('/vendor/listing'); return }
    setStep(s => s + 1)
  }
  async function skip() {
    setBusy(true)
    await saveDraft()
    router.push('/vendor/ubersicht')
  }

  // ── Live-Vorschau-Props ──
  const previewVendor: PreviewVendor = {
    company_name: f.company_name || null, name: null, category: f.category,
    description: f.description || null, street: null, zip: null, city: f.city || null,
    price_range: null, verified,
    social_links: {}, service_cities: [], service_radius_km: null,
    logo_url: logoUrl, photos: photos.filter(p => p.url).map(p => ({ id: p.id, url: p.url as string })),
  }
  const previewNode = (
    <VendorMarketplacePreview vendor={previewVendor} packages={[]} faqs={[]} reviews={[]} reviewAvg={0} reviewCount={0} availability={[]} brandColor={f.brand_color} />
  )

  if (loading) {
    return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F8FF' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: ACCENT }} />
    </div>
  }

  const s = STEPS[step]

  return (
    <div style={{ minHeight: '100dvh', background: '#F5F8FF', display: 'flex', flexDirection: 'column' }}>
      {/* Kopf */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', flexShrink: 0 }}>
        <ForevrHeart size={30} color={ACCENT} title="Forevr" />
        <button onClick={skip} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: '#4B5768' }}>
          Später einrichten
        </button>
      </header>

      {/* Fortschritt */}
      <div style={{ display: 'flex', gap: 4, padding: '0 24px 18px', flexShrink: 0 }}>
        {STEPS.map((_, i) => (
          <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? ACCENT : '#d6ddea', transition: 'background .3s' }} />
        ))}
      </div>

      <div className="ob-split" style={{ flex: 1, display: 'flex', gap: 24, padding: '0 24px 24px', minHeight: 0 }}>
        {/* Formular */}
        <div className="ob-form" style={{ flex: '1 1 0', minWidth: 0, maxWidth: 560, display: 'flex', flexDirection: 'column' }}>
          {/* Horizontaler Innenabstand: verhindert, dass der globale Fokus-Outline
              (:focus-visible, 2px + 2px Offset) vom Scroll-Container abgeschnitten wird. */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '3px 6px' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT }}>Schritt {step + 1} von {STEPS.length}</span>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', margin: '8px 0 6px', color: '#111827' }}>{s.title}</h1>
            <p style={{ fontSize: 14.5, color: '#4B5768', margin: '0 0 22px', lineHeight: 1.5 }}>{s.sub}</p>

            {s.key === 'firma' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={lblStyle}>Unternehmensname <Req /></label>
                  <input style={inp} value={f.company_name} onChange={set('company_name')} placeholder="z. B. Studio Lichtblick" autoFocus />
                </div>
                <div>
                  <label style={lblStyle}>Kategorie <Req /></label>
                  <select style={inp} value={f.category} onChange={set('category')}>
                    {MARKETPLACE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {s.key === 'standort' && (
              <div>
                <label style={lblStyle}>Stadt <Req /></label>
                <input style={inp} value={f.city} onChange={set('city')} placeholder="z. B. München" autoFocus />
              </div>
            )}

            {s.key === 'beschreibung' && (
              <div>
                <label style={lblStyle}>Kurzbeschreibung <Req /></label>
                <textarea style={{ ...txt, minHeight: 130 }} value={f.description} onChange={set('description')} placeholder="Beschreibe Leistung und Stil kurz und prägnant…" autoFocus />
                <p style={{ fontSize: 12, color: f.description.trim().length >= 30 ? '#15803D' : '#4B5768', margin: '6px 0 0' }}>
                  {f.description.trim().length >= 30 ? 'Mindestlänge erreicht' : `${f.description.trim().length}/30 Zeichen`}
                </p>
              </div>
            )}

            {s.key === 'logo' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div onClick={() => logoInput.current?.click()} style={{ width: 96, height: 96, borderRadius: 18, cursor: 'pointer', overflow: 'hidden', background: logoUrl ? '#fff' : ACCENT, border: '1px solid #d6ddea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {logoBusy
                    ? <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: logoUrl ? ACCENT : '#fff' }} />
                    : logoUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Upload size={26} color="#fff" />}
                </div>
                <div>
                  <button onClick={() => logoInput.current?.click()} disabled={logoBusy} style={btnGhost}>
                    <Upload size={15} /> {logoUrl ? 'Logo ersetzen' : 'Logo hochladen'}
                  </button>
                  <p style={{ fontSize: 12, color: '#4B5768', margin: '8px 0 0' }}>JPG, PNG oder WebP · max. 10 MB</p>
                </div>
                <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onLogo} />
              </div>
            )}

            {s.key === 'fotos' && (
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {photos.map((p, i) => (
                    <div key={p.id} style={{ width: 104, height: 78, borderRadius: 10, overflow: 'hidden', border: '1px solid #d6ddea', position: 'relative', background: '#fff' }}>
                      {p.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      {i === 0 && <span style={{ position: 'absolute', top: 4, left: 4, background: ACCENT, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>Titel</span>}
                      <button onClick={() => deletePhoto(p.id)} style={{ position: 'absolute', bottom: 3, right: 3, width: 20, height: 20, borderRadius: 5, border: 'none', background: 'rgba(185,28,28,0.9)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                  {photos.length < 15 && (
                    <button onClick={() => photoInput.current?.click()} disabled={photoBusy} style={{ width: 104, height: 78, borderRadius: 10, border: '1px dashed #b6c2d8', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5768' }}>
                      {photoBusy ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={22} />}
                    </button>
                  )}
                </div>
                <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onPhoto} />
              </div>
            )}

            {s.key === 'kontakt' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={lblStyle}>E-Mail <HelpTip text="Wird dem Brautpaar erst nach Annahme der Anfrage gezeigt (Schutz vor Spam)." /></label>
                  <input style={inp} type="email" value={f.email} onChange={set('email')} placeholder="kontakt@…" autoFocus />
                </div>
                <div>
                  <label style={lblStyle}>Telefon</label>
                  <input style={inp} value={f.phone} onChange={set('phone')} placeholder="+49 …" />
                </div>
                <p style={{ fontSize: 12.5, color: '#4B5768', margin: 0 }}>Mindestens eine Kontaktmöglichkeit ist Pflicht.</p>
              </div>
            )}

            {s.key === 'marke' && (
              <div>
                <label style={lblStyle}>Markenfarbe</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(f.brand_color) ? f.brand_color : '#B89968'} onChange={set('brand_color')} style={{ width: 48, height: 46, padding: 3, border: '1px solid #d6ddea', borderRadius: 10, background: '#fff', cursor: 'pointer' }} aria-label="Markenfarbe" />
                  <input style={{ ...inp, maxWidth: 200 }} value={f.brand_color} onChange={set('brand_color')} placeholder="#B89968 (optional)" />
                  {f.brand_color && <button onClick={() => setF(v => ({ ...v, brand_color: '' }))} style={btnGhost}>Zurücksetzen</button>}
                </div>
              </div>
            )}

          </div>

          {/* Steuerung */}
          {!stepValid(step) && !isLast && (
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '14px 0 0', textAlign: 'right' }}>
              Optional — du kannst diesen Schritt überspringen und später ausfüllen.
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 12, flexShrink: 0 }}>
            <button onClick={() => setStep(v => Math.max(0, v - 1))} disabled={step === 0 || busy} style={{ ...btnGhost, background: '#ffffff', color: '#111111', opacity: step === 0 ? 0.4 : 1 }}>
              <ChevronLeft size={16} /> Zurück
            </button>
            <button onClick={next} disabled={busy} style={{ ...btnDark, opacity: busy ? 0.6 : 1 }}>
              {busy ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : isLast ? <><Check size={16} /> Fertig — zum Profil</> : <>Weiter <ChevronRight size={16} /></>}
            </button>
          </div>
        </div>

        {/* Live-Vorschau (Desktop) */}
        <aside className="ob-preview" style={{ flex: '1 1 0', minWidth: 0, border: '1px solid #d6ddea', borderRadius: 16, background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100dvh - 150px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid #d6ddea', fontSize: 12.5, fontWeight: 700, color: '#4B5768', flexShrink: 0 }}>
            <Eye size={14} /> So sehen Brautpaare dein Profil
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 16, background: '#fff' }}>{previewNode}</div>
        </aside>
      </div>

      {/* Mobile-Vorschau */}
      <button className="ob-preview-fab" onClick={() => setMobilePreview(true)}><Eye size={16} /> Vorschau</button>
      {mobilePreview && (
        <div className="ob-preview-modal" style={{ position: 'fixed', inset: 0, zIndex: 120, background: '#F5F8FF', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #d6ddea', background: '#fff', flexShrink: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}><Eye size={15} /> Vorschau</span>
            <button onClick={() => setMobilePreview(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }} aria-label="Schließen"><X size={20} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>{previewNode}</div>
        </div>
      )}

      {msg && (
        <div style={{ position: 'fixed', bottom: 18, right: 18, zIndex: 130, padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: msg.kind === 'ok' ? '#F0FDF4' : '#FEF2F2', color: msg.kind === 'ok' ? '#15803D' : '#B91C1C', border: `1px solid ${msg.kind === 'ok' ? 'rgba(21,128,61,0.25)' : 'rgba(185,28,28,0.25)'}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {msg.text}
        </div>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .ob-preview-fab{ display:none; }
        @media(max-width:900px){
          .ob-preview{ display:none !important; }
          .ob-form{ max-width:none !important; }
          .ob-preview-fab{
            position:fixed; right:16px; bottom:18px; z-index:100;
            display:inline-flex; align-items:center; gap:6px; padding:11px 16px; border-radius:999px;
            border:none; cursor:pointer; background:${ACCENT}; color:#fff; font-family:inherit;
            font-size:13.5px; font-weight:600; box-shadow:0 8px 24px rgba(0,0,0,0.22);
          }
        }
      `}</style>
    </div>
  )
}

const lblStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }
const btnDark: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 46, padding: '0 22px', borderRadius: 10,
  fontSize: 14, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: '#fff', border: 'none', fontFamily: 'inherit',
}
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 16px', borderRadius: 10,
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#374151', border: '1px solid #d6ddea', fontFamily: 'inherit',
}

function Req() { return <span aria-hidden="true" style={{ color: ACCENT }}>*</span> }
