'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Upload, Save, Send, CheckCircle2, AlertTriangle, Clock,
  Plus, Trash2, ArrowUp, ArrowDown, Star, CalendarDays, X,
  PlayCircle, Music2, Monitor, Smartphone, Eye,
} from 'lucide-react'
import {
  MARKETPLACE_CATEGORIES, PRICE_UNITS, SOCIAL_PLATFORMS,
  moderationLabel, type ModerationStatus,
  MAX_VIDEO_URLS, youtubeVideoId, youtubeEmbedUrl,
} from '@/lib/marketplace/types'
import FragebogenBuilderClient from '@/app/vendor/anfrage-formular/FragebogenBuilderClient'
import { HelpTip } from '@/components/ui/HelpTooltip'
import { uploadVendorImage, UploadError } from '@/lib/marketplace/vendor-upload'
import VendorMarketplacePreview, {
  type PreviewVendor, type PreviewPackage, type PreviewFaq,
} from '@/components/marketplace/VendorMarketplacePreview'

interface Vendor {
  id: string; name: string; company_name: string | null; category: string
  email: string | null; phone: string | null; website: string | null; description: string | null
  street: string | null; zip: string | null; city: string | null; price_range: string | null
  company_street: string | null; company_zip: string | null; company_city: string | null
  moderation_status: ModerationStatus; pending_changes: Record<string, unknown> | null
  verified: boolean; published: boolean; rejected_reason: string | null
  social_links: Record<string, string>; service_cities: string[]; service_radius_km: number | null
  video_urls: string[] | null; audio_r2_key: string | null; audio_title: string | null
}
interface Photo { id: string; sort_order: number; url: string | null }
interface Pkg { id: string; title: string; description: string; price_from: number | null; price_unit: string; sort_order: number }
interface Faq { id: string; question: string; answer: string; sort_order: number }
interface Avail { id: string; day: string; status: string }

const inp: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 13px', fontSize: 14, border: '1px solid var(--border)',
  borderRadius: 10, background: '#fff', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box', color: 'var(--text)',
}
// Für Textareas: Höhe/Padding von `inp` zurücknehmen (mehrzeilig).
const txt: React.CSSProperties = { ...inp, height: 'auto', padding: '11px 13px', resize: 'vertical' }
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8,
}
const secCard: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
  padding: 20, marginBottom: 16,
}
const h2s: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }
const btnDark: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 18px', borderRadius: 10,
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: 'var(--accent)', color: '#fff',
  border: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 16px', borderRadius: 8,
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: '#fff', color: 'var(--text)',
  border: '1px solid var(--border)', fontFamily: 'inherit', boxSizing: 'border-box',
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || '?'
}

// Feld-Label mit optionalem Pflicht-Sternchen und „?"-Hilfe (Hover-Tooltip).
function Lbl({ children, required, help }: { children: React.ReactNode; required?: boolean; help?: string }) {
  return (
    <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>{children}{required && <span aria-hidden="true" style={{ color: 'var(--accent)', marginLeft: 2 }}>*</span>}</span>
      {help && <HelpTip text={help} />}
    </label>
  )
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onChange}
      aria-checked={checked}
      role="switch"
      style={{
        width: 44, height: 26, borderRadius: 13, padding: 0,
        background: checked ? '#34C759' : '#D1D5DB',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 20 : 2,
        width: 22, height: 22, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)', display: 'block',
      }} />
    </button>
  )
}

type ListingTab = 'anzeige' | 'anfrageformular'

export default function VendorListingClient() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ListingTab>('anzeige')
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [packages, setPackages] = useState<Pkg[]>([])
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [availability, setAvailability] = useState<Avail[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPct, setPhotoPct] = useState<number | null>(null)
  const [logoBusy, setLogoBusy] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [confirmPhotoId, setConfirmPhotoId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [f, setF] = useState({
    name: '', company_name: '', category: 'sonstiges', street: '', zip: '', city: '',
    description: '', email: '', phone: '', website: '', price_range: '',
    service_cities: '', service_radius_km: '', brand_color: '', audio_title: '',
  })
  const [social, setSocial] = useState<Record<string, string>>({})
  const [videos, setVideos] = useState<string[]>([])
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [uploadingAudio, setUploadingAudio] = useState(false)

  // Snapshot des zuletzt geladenen/gespeicherten Profil-Stands für Dirty-Erkennung.
  const savedSnapshot = useRef('')
  const dirty = !loading && !!vendor && JSON.stringify({ f, social, videos }) !== savedSnapshot.current

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    const res = await fetch('/api/vendor/marketplace/profile')
    if (!res.ok) { if (initial) setLoading(false); return }
    const d = await res.json()
    const v: Vendor = d.vendor
    setVendor(v); setLogoUrl(d.logoUrl)
    const incoming: Photo[] = d.photos ?? []
    setPhotos(prev => {
      const sameSet = prev.length === incoming.length && prev.every((p, i) => p.id === incoming[i].id)
      return sameSet ? prev : incoming
    })
    setPackages(d.packages ?? []); setFaqs(d.faqs ?? []); setAvailability(d.availability ?? [])
    const pc = (v.pending_changes ?? {}) as Record<string, unknown>
    const pick = (k: string, fallback: unknown) => (k in pc ? pc[k] : fallback)
    const nextF = {
      name: String(pick('name', v.name) ?? ''),
      company_name: String(pick('company_name', v.company_name) ?? ''),
      category: String(pick('category', v.category) ?? 'sonstiges'),
      street: String(pick('street', v.street) ?? ''),
      zip: String(pick('zip', v.zip) ?? ''),
      city: String(pick('city', v.city) ?? ''),
      description: v.description ?? '',
      email: v.email ?? '',
      phone: v.phone ?? '',
      website: v.website ?? '',
      price_range: v.price_range ?? '',
      service_cities: (v.service_cities ?? []).join(', '),
      service_radius_km: v.service_radius_km != null ? String(v.service_radius_km) : '',
      brand_color: (v as { brand_color?: string }).brand_color ?? '',
      audio_title: v.audio_title ?? '',
    }
    const nextSocial = v.social_links ?? {}
    const nextVideos = v.video_urls ?? []
    setF(nextF)
    setSocial(nextSocial)
    setVideos(nextVideos)
    setAudioUrl(d.audioUrl ?? null)
    savedSnapshot.current = JSON.stringify({ f: nextF, social: nextSocial, videos: nextVideos })
    setLoading(false)
  }, [])

  useEffect(() => { load(true) }, [load])

  // Warnung beim Verlassen der Seite mit ungespeicherten Profil-Änderungen.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const flash = (kind: 'ok' | 'err', text: string) => {
    setMsg({ kind, text }); setTimeout(() => setMsg(null), 4000)
  }

  async function saveProfile() {
    const payload = {
      name: f.name, company_name: f.company_name, category: f.category,
      street: f.street, zip: f.zip, city: f.city,
      description: f.description, email: f.email, phone: f.phone, website: f.website,
      price_range: f.price_range,
      service_cities: f.service_cities.split(',').map(s => s.trim()).filter(Boolean),
      service_radius_km: f.service_radius_km,
      social_links: social,
      brand_color: f.brand_color,
      video_urls: videos.map(v => v.trim()).filter(Boolean),
      audio_title: f.audio_title,
    }
    setSavingProfile(true)
    try {
      const res = await fetch('/api/vendor/marketplace/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        flash('err', d.error ?? 'Speichern fehlgeschlagen')
      } else {
        savedSnapshot.current = JSON.stringify({ f, social, videos })
        flash('ok', d.hasPendingChanges ? 'Gespeichert — sensible Änderungen gehen in die Prüfung.' : 'Gespeichert.')
        // Server-Layout neu rendern, damit der Firmenname/Logo im Header sofort aktualisiert.
        router.refresh()
      }
    } catch {
      flash('err', 'Speichern fehlgeschlagen')
    }
    setSavingProfile(false)
    load(false)
  }

  async function submitForReview() {
    try {
      const res = await fetch('/api/vendor/marketplace/profile/submit', { method: 'POST' })
      if (res.ok) {
        setVendor(v => v ? { ...v, moderation_status: 'pending', rejected_reason: null } : v)
        flash('ok', 'Zur Prüfung eingereicht.')
      } else {
        const d = await res.json().catch(() => ({}))
        flash('err', d.error ?? 'Einreichen fehlgeschlagen')
        load(false)
      }
    } catch {
      flash('err', 'Einreichen fehlgeschlagen')
      load(false)
    }
  }

  async function togglePublish() {
    if (!vendor) return
    const next = !vendor.published
    setVendor(v => v ? { ...v, published: next } : v)
    try {
      const res = await fetch('/api/vendor/marketplace/profile/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ published: next }),
      })
      if (!res.ok) {
        setVendor(v => v ? { ...v, published: !next } : v)
        flash('err', 'Sichtbarkeit konnte nicht geändert werden')
        return
      }
      flash('ok', next ? 'Listing ist online.' : 'Listing ist offline.')
    } catch {
      setVendor(v => v ? { ...v, published: !next } : v)
      flash('err', 'Sichtbarkeit konnte nicht geändert werden')
    }
  }

  const logoInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
    setLogoBusy(true)
    try {
      const key = await uploadVendorImage(file, 'logo')
      const res = await fetch('/api/vendor/marketplace/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo_r2_key: key }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { flash('err', d.error ?? 'Logo konnte nicht gespeichert werden'); return }
      // Sofort lokal anzeigen (Vorschau/Editor) statt vollem Reload; Header via refresh.
      setLogoUrl(URL.createObjectURL(file))
      flash('ok', d.hasPendingChanges ? 'Logo hochgeladen — geht in die Prüfung.' : 'Logo aktualisiert.')
      router.refresh()
    } catch (err) {
      flash('err', err instanceof UploadError ? err.message : 'Upload fehlgeschlagen')
    } finally {
      setLogoBusy(false)
    }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); e.target.value = ''; if (!files.length) return
    setUploadingPhoto(true)
    let added = 0, failed = 0
    for (const file of files) {
      if (photos.length + added >= 15) { flash('err', 'Maximal 15 Fotos.'); break }
      setPhotoPct(0)
      try {
        const key = await uploadVendorImage(file, 'photo', setPhotoPct)
        const res = await fetch('/api/vendor/marketplace/photos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ r2_key: key }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok || !d.id) { failed++; continue }
        // Lokal einfügen (mit Object-URL für sofortige Anzeige) statt vollem Reload.
        setPhotos(p => [...p, { id: d.id as string, sort_order: p.length, url: URL.createObjectURL(file) }])
        added++
      } catch (err) {
        failed++
        if (err instanceof UploadError) flash('err', err.message)
      }
    }
    setPhotoPct(null); setUploadingPhoto(false)
    if (added) flash('ok', `${added} Foto${added === 1 ? '' : 's'} hinzugefügt.`)
    else if (!failed) flash('err', 'Kein Foto hochgeladen.')
  }

  const audioInput = useRef<HTMLInputElement>(null)

  async function onAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 25 * 1024 * 1024) { flash('err', 'Die Hörprobe darf max. 25 MB groß sein'); return }
    setUploadingAudio(true)
    try {
      const contentType = file.type || 'audio/mpeg'
      const res = await fetch('/api/vendor/marketplace/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'audio', contentType }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        flash('err', d.error ?? 'Upload-URL fehlgeschlagen'); return
      }
      const { uploadUrl, key } = await res.json()
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
      if (!put.ok) { flash('err', 'Upload fehlgeschlagen'); return }
      const patch = await fetch('/api/vendor/marketplace/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio_r2_key: key }),
      })
      if (!patch.ok) { flash('err', 'Hörprobe konnte nicht gespeichert werden'); return }
      flash('ok', 'Hörprobe hochgeladen.')
      load(false)
    } finally {
      setUploadingAudio(false)
    }
  }

  async function deleteAudio() {
    const res = await fetch('/api/vendor/marketplace/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio_r2_key: null }),
    }).catch(() => null)
    if (!res?.ok) { flash('err', 'Hörprobe konnte nicht entfernt werden'); return }
    setAudioUrl(null)
    setF(s => ({ ...s, audio_title: '' }))
    flash('ok', 'Hörprobe entfernt.')
    load(false)
  }

  async function deletePhoto(id: string) {
    setConfirmPhotoId(null)
    const res = await fetch(`/api/vendor/marketplace/photos/${id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) { flash('err', 'Foto konnte nicht gelöscht werden'); return }
    setPhotos(p => p.filter(x => x.id !== id))
  }
  async function movePhoto(i: number, dir: -1 | 1) {
    const next = [...photos]; const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setPhotos(next)
    await fetch('/api/vendor/marketplace/photos', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: next.map(p => p.id) }),
    })
  }

  async function addPackage() {
    const res = await fetch('/api/vendor/marketplace/packages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Neues Paket' }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { flash('err', d.error ?? 'Fehler'); return }
    setPackages(x => [...x, { id: d.id, title: 'Neues Paket', description: '', price_from: null, price_unit: 'ab', sort_order: x.length }])
  }
  async function savePackage(p: Pkg) {
    const res = await fetch(`/api/vendor/marketplace/packages/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: p.title, description: p.description, price_from: p.price_from, price_unit: p.price_unit }),
    }).catch(() => null)
    if (res?.ok) flash('ok', 'Paket gespeichert.')
    else flash('err', 'Paket konnte nicht gespeichert werden')
  }
  async function delPackage(id: string) {
    await fetch(`/api/vendor/marketplace/packages/${id}`, { method: 'DELETE' })
    setPackages(x => x.filter(p => p.id !== id))
  }

  async function addFaq() {
    const res = await fetch('/api/vendor/marketplace/faqs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'Neue Frage' }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { flash('err', d.error ?? 'Fehler'); return }
    setFaqs(x => [...x, { id: d.id, question: 'Neue Frage', answer: '', sort_order: x.length }])
  }
  async function saveFaq(q: Faq) {
    const res = await fetch(`/api/vendor/marketplace/faqs/${q.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q.question, answer: q.answer }),
    }).catch(() => null)
    if (res?.ok) flash('ok', 'FAQ gespeichert.')
    else flash('err', 'FAQ konnte nicht gespeichert werden')
  }
  async function delFaq(id: string) {
    await fetch(`/api/vendor/marketplace/faqs/${id}`, { method: 'DELETE' })
    setFaqs(x => x.filter(q => q.id !== id))
  }

  const [newDay, setNewDay] = useState('')
  async function addDay() {
    if (!newDay) return
    if (availability.some(d => d.day === newDay)) { setNewDay(''); return }
    const res = await fetch('/api/vendor/marketplace/availability', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: newDay }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { flash('err', d.error ?? 'Fehler'); return }
    const row = d.day ?? { id: newDay, day: newDay, status: 'blocked' }
    setAvailability(a => [...a, row].sort((x, y) => x.day.localeCompare(y.day)))
    setNewDay('')
  }
  async function delDay(day: string) {
    await fetch(`/api/vendor/marketplace/availability?day=${day}`, { method: 'DELETE' })
    setAvailability(a => a.filter(d => d.day !== day))
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF(s => ({ ...s, [k]: e.target.value }))

  if (loading) {
    return (
      <div style={{ flex: 1, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }
  if (!vendor) {
    return (
      <div style={{ flex: 1, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
        Kein Profil gefunden.
      </div>
    )
  }

  const hasPending = !!vendor.pending_changes && Object.keys(vendor.pending_changes).length > 0
  const status = vendor.moderation_status
  const hasContact = !!f.phone.trim() || !!f.email.trim()
  const requirements = [
    { key: 'company', label: 'Firma / Anzeigename', ok: !!f.company_name.trim() },
    { key: 'desc', label: 'Beschreibung (mind. 30 Zeichen)', ok: f.description.trim().length >= 30 },
    { key: 'city', label: 'Stadt', ok: !!f.city.trim() },
    { key: 'photo', label: 'Mindestens 1 Foto', ok: photos.length >= 1 },
    { key: 'logo', label: 'Logo', ok: !!logoUrl },
    { key: 'contact', label: 'Kontakt (Telefon oder E-Mail)', ok: hasContact },
  ]
  const allRequirementsMet = requirements.every(r => r.ok)
  const showRequirements = status === 'draft' || status === 'rejected'
  const descLen = f.description.trim().length

  const categoryLabel = MARKETPLACE_CATEGORIES.find(c => c.key === f.category)?.label ?? f.category

  // ── Live-Vorschau-Props (exakt die Brautpaar-Detailansicht), abgeleitet aus dem Formular ──
  const previewVendor: PreviewVendor = {
    company_name: f.company_name || null, name: f.name || null, category: f.category,
    description: f.description || null, street: f.street || null, zip: f.zip || null, city: f.city || null,
    price_range: f.price_range || null, verified: vendor.verified,
    social_links: social,
    service_cities: f.service_cities.split(',').map(s => s.trim()).filter(Boolean),
    service_radius_km: f.service_radius_km ? Number(f.service_radius_km) : null,
    logo_url: logoUrl,
    photos: photos.filter(p => p.url).map(p => ({ id: p.id, url: p.url as string })),
  }
  const previewPackages: PreviewPackage[] = packages.map(p => ({
    id: p.id, title: p.title, description: p.description, price_from: p.price_from, price_unit: p.price_unit,
  }))
  const previewFaqs: PreviewFaq[] = faqs.map(q => ({ id: q.id, question: q.question, answer: q.answer }))
  const previewAvailability = availability.map(a => a.day)

  const previewNode = (
    <VendorMarketplacePreview
      vendor={previewVendor}
      packages={previewPackages}
      faqs={previewFaqs}
      reviews={[]}
      reviewAvg={0}
      reviewCount={0}
      availability={previewAvailability}
      brandColor={f.brand_color}
    />
  )

  return (
    <div className="vnd-page-outer" style={{ flex: 1, background: 'var(--bg)', padding: '28px 24px 48px', overflow: 'auto' }}>
      <div className="vnd-page-card">

        {/* ── Header ── */}
        <div className="listing-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>Anbieter-Profil</h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 6, marginBottom: 0 }}>
              So erscheinst du im Forevr-Marktplatz.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>Öffentlich sichtbar</span>
              <Toggle
                checked={vendor.published}
                onChange={togglePublish}
                disabled={status !== 'approved'}
              />
            </div>
            {status !== 'approved' && (
              <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>Verfügbar, sobald dein Profil freigegeben ist</span>
            )}
          </div>
        </div>

        {/* ── Tab switcher ── */}
        <div data-tour="vdr-listing-tabs" style={{ display: 'inline-flex', background: 'var(--border)', borderRadius: 10, padding: 3, marginBottom: 24, gap: 2 }}>
          {(['anzeige', 'anfrageformular'] as ListingTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '7px 18px', borderRadius: 8, border: '1px solid transparent', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
                background: activeTab === tab ? 'var(--surface)' : 'transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                transition: 'box-shadow .15s, border-color .15s',
              }}
              onMouseEnter={e => { if (activeTab !== tab) { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--accent)' } }}
              onMouseLeave={e => { if (activeTab !== tab) { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'transparent' } }}
            >
              {tab === 'anzeige' ? 'Anzeige' : 'Anfrageformular'}
            </button>
          ))}
        </div>

        {activeTab === 'anzeige' ? (
          <div className="listing-split">
            <div className="listing-form-col">
            {/* ── Status banner (zuerst — wichtigste Info) ── */}
            <StatusBanner status={status} hasPending={hasPending} verified={vendor.verified} published={vendor.published} reason={vendor.rejected_reason} />

            {/* ── Submit for review (draft/rejected) ── */}
            {showRequirements && (
              <div style={{ ...secCard, marginBottom: 16 }}>
                <h2 style={{ ...h2s, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Zur Prüfung einreichen
                  <HelpTip text="Jedes Profil wird einmalig kurz geprüft, bevor es im Marktplatz erscheint. So stellen wir sicher, dass nur seriöse, vollständige Anbieter gelistet sind — das schafft Vertrauen bei den Brautpaaren und schützt deinen Auftritt. Die Prüfung dauert in der Regel unter 24 Stunden." />
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {requirements.map(r => (
                    <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: r.ok ? '#15803D' : 'var(--text-dim)' }}>
                      {r.ok
                        ? <CheckCircle2 size={15} />
                        : <span style={{ width: 15, height: 15, borderRadius: '50%', border: '1.5px solid var(--border)', display: 'inline-block', flexShrink: 0 }} />
                      }
                      {r.label}
                    </div>
                  ))}
                </div>
                <button
                  onClick={submitForReview}
                  disabled={!allRequirementsMet}
                  style={{ ...btnDark, opacity: allRequirementsMet ? 1 : 0.5, cursor: allRequirementsMet ? 'pointer' : 'not-allowed' }}
                >
                  <Send size={15} /> Zur Prüfung einreichen
                </button>
              </div>
            )}

            {/* ── Main profile card ── */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16 }}>

              <Lbl required help="Dein Firmenlogo erscheint auf deiner Marktplatz-Karte und in deinen Angebots-PDFs. Zum Hochladen auf das Feld klicken.">Logo</Lbl>
              {/* Avatar + company info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, marginTop: 8 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div
                    onClick={() => logoInput.current?.click()}
                    style={{
                      width: 56, height: 56, borderRadius: 14, cursor: 'pointer', overflow: 'hidden',
                      background: logoUrl ? 'transparent' : 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {logoUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
                          {getInitials(f.company_name)}
                        </span>
                    }
                  </div>
                  <button
                    onClick={() => logoInput.current?.click()}
                    disabled={logoBusy}
                    style={{
                      position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)',
                      width: 22, height: 22, borderRadius: '50%', padding: 0,
                      background: 'var(--accent)', border: '2px solid var(--bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: logoBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {logoBusy
                      ? <Loader2 size={11} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                      : <Upload size={11} color="#fff" />}
                  </button>
                  <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onLogo} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text)' }}>
                    {f.company_name || <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>Unternehmensname</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 3 }}>
                    {categoryLabel}
                    {f.city ? ` · ${f.city}` : ''}
                    {f.service_radius_km ? ' & Umgebung' : ''}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginBottom: 18 }} />

              {/* Kurzbeschreibung */}
              <div style={{ marginBottom: 16 }}>
                <Lbl required help="Mindestens 30 Zeichen. Beschreibe Leistung und Stil kurz und prägnant — das sehen Brautpaare zuerst.">Kurzbeschreibung</Lbl>
                <textarea
                  value={f.description}
                  onChange={set('description')}
                  placeholder="Beschreibe deine Leistung kurz und prägnant…"
                  style={{ ...txt, minHeight: 90, lineHeight: 1.55 }}
                />
                <p style={{ fontSize: 11.5, color: descLen >= 30 ? '#15803D' : 'var(--text-dim)', margin: '5px 0 0' }}>
                  {descLen >= 30 ? 'Mindestlänge erreicht' : `${descLen}/30 Zeichen (Minimum für die Freigabe)`}
                </p>
              </div>

              {/* Markenfarbe */}
              <div style={{ marginBottom: 16 }}>
                <Lbl help="Deine Akzentfarbe für Angebots-PDFs und die Mails ans Brautpaar. Leer lassen für den Forevr-Standard.">Markenfarbe</Lbl>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(f.brand_color) ? f.brand_color : '#B89968'}
                    onChange={set('brand_color')}
                    style={{ width: 44, height: 42, padding: 2, border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
                    aria-label="Markenfarbe wählen"
                  />
                  <input
                    value={f.brand_color}
                    onChange={set('brand_color')}
                    placeholder="#B89968 (leer = Forevr-Standard)"
                    style={{ ...inp, maxWidth: 240 }}
                  />
                  {f.brand_color && (
                    <button onClick={() => setF(s => ({ ...s, brand_color: '' }))} style={{ ...btnGhost, padding: '0 12px' }}>Zurücksetzen</button>
                  )}
                </div>
              </div>

              {/* Kategorie + Ab-Preis */}
              <div className="listing-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Kategorie</label>
                  <select value={f.category} onChange={set('category')} style={inp}>
                    {MARKETPLACE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Ab-Preis</label>
                  <input value={f.price_range} onChange={set('price_range')} placeholder="ab 1.600 €" style={inp} />
                </div>
              </div>
            </div>

            {/* ── Galerie ── */}
            <div data-tour="vdr-listing-gallery" style={secCard}>
              <h2 style={h2s}>Galerie <span aria-hidden="true" style={{ color: 'var(--accent)' }}>*</span></h2>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 12px' }}>
                Mindestens 1 Foto. Erstes Bild = Titelbild. Max. 15 Fotos.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                {photos.map((p, i) => (
                  <div key={p.id} style={{ width: 96, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', background: '#fff' }}>
                    {p.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {i === 0 && (
                      <span style={{ position: 'absolute', top: 3, left: 3, background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>
                        Titel
                      </span>
                    )}
                    <div style={{ position: 'absolute', bottom: 2, right: 2, display: 'flex', gap: 2 }}>
                      <button onClick={() => movePhoto(i, -1)} style={miniBtn} title="nach vorne"><ArrowUp size={11} /></button>
                      <button onClick={() => movePhoto(i, 1)} style={miniBtn} title="nach hinten"><ArrowDown size={11} /></button>
                      <button onClick={() => setConfirmPhotoId(p.id)} style={{ ...miniBtn, color: '#fff', background: 'rgba(185,28,28,0.85)' }} title="löschen"><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
                {photos.length < 15 && (
                  <button onClick={() => photoInput.current?.click()} disabled={uploadingPhoto} style={{ width: 96, height: 72, borderRadius: 8, border: '1px dashed var(--border)', background: '#fff', cursor: uploadingPhoto ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                    {uploadingPhoto
                      ? <>
                          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                          {photoPct != null && <span style={{ fontSize: 10.5, fontWeight: 700 }}>{photoPct}%</span>}
                        </>
                      : <Plus size={20} />}
                  </button>
                )}
              </div>
              <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onPhoto} />
            </div>

            {/* ── Videos & Hörprobe ── */}
            <div style={secCard}>
              <h2 style={{ ...h2s, display: 'flex', alignItems: 'center', gap: 8 }}>
                <PlayCircle size={16} style={{ color: 'var(--text-dim)' }} />
                Videos & Hörprobe
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 14px', lineHeight: 1.5 }}>
                Zeige Brautpaaren, wie du arbeitest: bis zu {MAX_VIDEO_URLS} YouTube-Videos (werden auf deiner
                Detailseite in einem Player angezeigt) und eine Hörprobe — ideal für DJs und Bands.
              </p>

              <label style={lbl}>YouTube-Videos (max. {MAX_VIDEO_URLS})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {videos.map((url, i) => {
                  const vid = youtubeVideoId(url)
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          style={{ ...inp, flex: 1, minWidth: 0 }}
                          value={url}
                          onChange={e => setVideos(v => v.map((x, j) => j === i ? e.target.value : x))}
                          placeholder="https://www.youtube.com/watch?v=…"
                        />
                        <button onClick={() => setVideos(v => v.filter((_, j) => j !== i))} style={{ ...btnGhost, color: 'var(--red)', padding: '0 12px' }} title="Video entfernen">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {url.trim() && !vid && (
                        <p style={{ fontSize: 11.5, color: '#B91C1C', margin: '5px 0 0' }}>
                          Kein gültiger YouTube-Link (z. B. youtube.com/watch?v=… oder youtu.be/…)
                        </p>
                      )}
                      {vid && (
                        <div style={{ marginTop: 8, width: 240, maxWidth: '100%', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <iframe
                            title={`Video ${i + 1}`}
                            src={youtubeEmbedUrl(vid)}
                            style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {videos.length < MAX_VIDEO_URLS && (
                <button onClick={() => setVideos(v => [...v, ''])} style={btnGhost}>
                  <Plus size={15} /> Video hinzufügen
                </button>
              )}

              <div style={{ borderTop: '1px solid var(--border)', margin: '18px 0 14px' }} />

              <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Music2 size={13} /> Hörprobe (eine Audiodatei, z. B. MP3 — max. 25 MB)
              </label>
              {audioUrl ? (
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: '#fff' }}>
                  <audio controls src={audioUrl} style={{ width: '100%', display: 'block' }} preload="metadata" />
                  <div style={{ marginTop: 10 }}>
                    <label style={lbl}>Titel der Hörprobe (optional)</label>
                    <input style={inp} value={f.audio_title} onChange={set('audio_title')} placeholder='z. B. "Live-Mitschnitt Hochzeit 2025"' />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => audioInput.current?.click()} disabled={uploadingAudio} style={btnGhost}>
                      {uploadingAudio ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />} Ersetzen
                    </button>
                    <button onClick={deleteAudio} style={{ ...btnGhost, color: 'var(--red)' }}>
                      <Trash2 size={14} /> Entfernen
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => audioInput.current?.click()} disabled={uploadingAudio} style={btnGhost}>
                  {uploadingAudio ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Music2 size={15} />} Audiodatei hochladen
                </button>
              )}
              <input ref={audioInput} type="file" accept="audio/mpeg,audio/mp3,audio/mp4,audio/aac,audio/wav,audio/x-wav,audio/x-m4a,audio/ogg,.mp3,.m4a,.wav,.ogg,.aac" hidden onChange={onAudio} />
            </div>

            {/* ── Weitere Stammdaten ── */}
            <div style={secCard}>
              <h2 style={{ ...h2s, display: 'flex', alignItems: 'center', gap: 8 }}>
                Weitere Angaben
                <HelpTip text="Änderungen an Firmenname, Kategorie, Adresse und Logo werden vor der Veröffentlichung kurz geprüft." />
              </h2>
              <div className="listing-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Lbl required>Firma / Anzeigename</Lbl><input style={inp} value={f.company_name} onChange={set('company_name')} placeholder="So erscheint ihr im Marktplatz" /></div>
                <div><Lbl help="Nur intern — dein Ansprechpartner. Erscheint nicht öffentlich im Marktplatz.">Ansprechpartner</Lbl><input style={inp} value={f.name} onChange={set('name')} /></div>
                <div><Lbl help="Teil deiner Standort-Angabe. Öffentlich sichtbar ist nur die Stadt.">Straße</Lbl><input style={inp} value={f.street} onChange={set('street')} /></div>
                <div><Lbl>PLZ</Lbl><input style={inp} value={f.zip} onChange={set('zip')} /></div>
                <div><Lbl required help="Deine Stadt wird öffentlich auf deinem Profil angezeigt und für die Umkreissuche genutzt.">Stadt</Lbl><input style={inp} value={f.city} onChange={set('city')} /></div>
                <div><Lbl>Website</Lbl><input style={inp} value={f.website} onChange={set('website')} placeholder="https://" /></div>
                <div><Lbl required={!f.phone.trim()} help="Wird dem Brautpaar erst nach Annahme der Anfrage angezeigt (Schutz vor Spam). Telefon oder E-Mail ist Pflicht.">E-Mail</Lbl><input style={inp} value={f.email} onChange={set('email')} /></div>
                <div><Lbl required={!f.email.trim()} help="Wird dem Brautpaar erst nach Annahme der Anfrage angezeigt (Schutz vor Spam). Telefon oder E-Mail ist Pflicht.">Telefon</Lbl><input style={inp} value={f.phone} onChange={set('phone')} /></div>
              </div>
            </div>

            {/* ── Einsatzgebiet ── */}
            <div style={secCard}>
              <h2 style={h2s}>Einsatzgebiet</h2>
              <label style={lbl}>Städte / Regionen (mit Komma trennen)</label>
              <input style={inp} value={f.service_cities} onChange={set('service_cities')} placeholder="München, Augsburg, Allgäu" />
              <div style={{ marginTop: 12, maxWidth: 220 }}>
                <label style={lbl}>Anfahrtsradius (km, optional)</label>
                <input style={inp} type="number" value={f.service_radius_km} onChange={set('service_radius_km')} placeholder="100" />
              </div>
            </div>

            {/* ── Belegte Termine ── */}
            <div style={secCard}>
              <h2 style={{ ...h2s, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={16} style={{ color: 'var(--text-dim)' }} />
                Belegte Termine
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Markiere Tage, an denen du bereits gebucht bist. Sie werden in deinem Marktplatz-Profil
                als „Belegte Termine&ldquo; angezeigt, damit Brautpaare nicht umsonst anfragen.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: availability.length > 0 ? 12 : 0, flexWrap: 'wrap' }}>
                <input style={{ ...inp, maxWidth: 190 }} type="date" value={newDay} onChange={e => setNewDay(e.target.value)} />
                <button onClick={addDay} disabled={!newDay} style={{ ...btnGhost, opacity: newDay ? 1 : 0.5 }}>
                  <Plus size={15} /> Tag blockieren
                </button>
              </div>
              {availability.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {availability.map(d => (
                    <span key={d.day} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontSize: 12.5, color: 'var(--text)' }}>
                      {new Date(`${d.day}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      <button onClick={() => delDay(d.day)} title="Tag wieder freigeben" style={{ ...miniBtn, background: 'transparent', color: 'var(--text-dim)' }}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Social-Media ── */}
            <div style={secCard}>
              <h2 style={h2s}>Social-Media</h2>
              <div className="listing-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {SOCIAL_PLATFORMS.map(s => (
                  <div key={s.key}>
                    <label style={lbl}>{s.label}</label>
                    <input style={inp} value={social[s.key] ?? ''} onChange={e => setSocial(p => ({ ...p, [s.key]: e.target.value }))} placeholder="https://" />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Pakete & Leistungen ── */}
            <div style={secCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ ...h2s, margin: 0 }}>Pakete & Leistungen</h2>
                <button onClick={addPackage} style={btnGhost}><Plus size={15} /> Paket</button>
              </div>
              {packages.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>Noch keine Pakete.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {packages.map((p, idx) => (
                  <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                    <div className="listing-pkg-row" style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                      <input style={{ ...inp, flex: 1, minWidth: 0 }} value={p.title} onChange={e => setPackages(a => a.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))} placeholder="Titel" />
                      <input style={{ ...inp, width: 120 }} type="number" value={p.price_from ?? ''} onChange={e => setPackages(a => a.map((x, i) => i === idx ? { ...x, price_from: e.target.value === '' ? null : Number(e.target.value) } : x))} placeholder="Preis €" />
                      <select style={{ ...inp, width: 140 }} value={p.price_unit} onChange={e => setPackages(a => a.map((x, i) => i === idx ? { ...x, price_unit: e.target.value } : x))}>
                        {PRICE_UNITS.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
                      </select>
                    </div>
                    <textarea style={{ ...txt, minHeight: 60 }} value={p.description} onChange={e => setPackages(a => a.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} placeholder="Was ist enthalten?" />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => savePackage(p)} style={btnDark}><Save size={14} /> Speichern</button>
                      <button onClick={() => delPackage(p.id)} style={{ ...btnGhost, color: 'var(--red)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── FAQ ── */}
            <div style={secCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ ...h2s, margin: 0 }}>FAQ</h2>
                <button onClick={addFaq} style={btnGhost}><Plus size={15} /> Frage</button>
              </div>
              {faqs.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>Noch keine Fragen.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {faqs.map((q, idx) => (
                  <div key={q.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                    <input style={{ ...inp, marginBottom: 8 }} value={q.question} onChange={e => setFaqs(a => a.map((x, i) => i === idx ? { ...x, question: e.target.value } : x))} placeholder="Frage" />
                    <textarea style={{ ...txt, minHeight: 60 }} value={q.answer} onChange={e => setFaqs(a => a.map((x, i) => i === idx ? { ...x, answer: e.target.value } : x))} placeholder="Antwort" />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => saveFaq(q)} style={btnDark}><Save size={14} /> Speichern</button>
                      <button onClick={() => delFaq(q.id)} style={{ ...btnGhost, color: 'var(--red)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: 40 }} />

            {/* ── Schwebende Speichern-Leiste bei ungespeicherten Änderungen ── */}
            {dirty && (
              <div style={{
                position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 18px',
                background: 'var(--text)', color: '#fff', borderRadius: 999,
                boxShadow: '0 8px 28px rgba(0,0,0,0.28)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              }}>
                Ungespeicherte Änderungen
                <button onClick={saveProfile} disabled={savingProfile} style={{ ...btnDark, height: 36, padding: '0 16px', borderRadius: 999 }}>
                  {savingProfile ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />} Speichern
                </button>
              </div>
            )}

            {/* ── Foto löschen: Bestätigung ── */}
            {confirmPhotoId && (
              <div onClick={() => setConfirmPhotoId(null)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <AlertTriangle size={19} style={{ color: '#B91C1C', flexShrink: 0 }} />
                    <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>Foto löschen?</h3>
                  </div>
                  <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>
                    Das Foto wird dauerhaft aus deiner Galerie entfernt.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setConfirmPhotoId(null)} style={btnGhost}>Abbrechen</button>
                    <button onClick={() => deletePhoto(confirmPhotoId)} style={{ ...btnDark, background: '#B91C1C' }}><Trash2 size={14} /> Löschen</button>
                  </div>
                </div>
              </div>
            )}
            </div>{/* /listing-form-col */}

            {/* ── Live-Vorschau (rechte Spalte) ── */}
            <aside className="listing-preview-col">
              <div className="listing-preview-head">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)' }}>
                  <Eye size={14} /> Live-Vorschau
                </span>
                <div style={{ display: 'inline-flex', gap: 2, background: 'var(--border)', borderRadius: 8, padding: 2 }}>
                  <button onClick={() => setPreviewDevice('desktop')} title="Desktop" aria-label="Desktop-Vorschau"
                    style={{ ...prevDeviceBtn, background: previewDevice === 'desktop' ? 'var(--surface)' : 'transparent' }}>
                    <Monitor size={15} />
                  </button>
                  <button onClick={() => setPreviewDevice('mobile')} title="Mobil" aria-label="Mobil-Vorschau"
                    style={{ ...prevDeviceBtn, background: previewDevice === 'mobile' ? 'var(--surface)' : 'transparent' }}>
                    <Smartphone size={15} />
                  </button>
                </div>
              </div>
              <div className="listing-preview-scroll">
                <div className={`listing-preview-frame ${previewDevice}`}>
                  {previewNode}
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <FragebogenBuilderClient category={f.category} embedded />
        )}

        {/* ── Mobile: Vorschau-Button + Vollbild-Overlay ── */}
        {activeTab === 'anzeige' && (
          <button className="listing-preview-fab" onClick={() => setMobilePreviewOpen(true)}>
            <Eye size={16} /> Vorschau
          </button>
        )}
        {mobilePreviewOpen && (
          <div className="listing-preview-modal">
            <div className="listing-preview-modal-head">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                <Eye size={15} /> Live-Vorschau
              </span>
              <button onClick={() => setMobilePreviewOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', display: 'flex' }} aria-label="Schließen"><X size={20} /></button>
            </div>
            <div className="listing-preview-modal-body">{previewNode}</div>
          </div>
        )}
      </div>

      {/* ── Feedback-Toast ── */}
      {msg && (
        <div style={{
          position: 'fixed', bottom: 18, right: 18, zIndex: 70,
          padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: msg.kind === 'ok' ? '#F0FDF4' : '#FEF2F2',
          color: msg.kind === 'ok' ? '#15803D' : '#B91C1C',
          border: `1px solid ${msg.kind === 'ok' ? 'rgba(21,128,61,0.25)' : 'rgba(185,28,28,0.25)'}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxWidth: 340,
        }}>
          {msg.text}
        </div>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:580px){.listing-two-col{grid-template-columns:1fr!important}}

        /* Split-Pane: Formular links, Live-Vorschau rechts */
        .listing-split{ display:flex; gap:24px; align-items:flex-start; }
        .listing-form-col{ flex:1 1 0; min-width:0; max-width:640px; }
        .listing-preview-col{
          flex:1 1 0; min-width:0; position:sticky; top:16px; align-self:flex-start;
          display:flex; flex-direction:column; max-height:calc(100dvh - 90px);
          border:1px solid var(--border); border-radius:16px; background:var(--surface); overflow:hidden;
        }
        .listing-preview-head{
          display:flex; align-items:center; justify-content:space-between; gap:10px;
          padding:10px 14px; border-bottom:1px solid var(--border); flex-shrink:0;
        }
        .listing-preview-scroll{ flex:1; overflow:auto; padding:16px; background:#fff; }
        .listing-preview-frame{ margin:0 auto; transition:max-width .25s ease; }
        .listing-preview-frame.desktop{ max-width:100%; }
        .listing-preview-frame.mobile{ max-width:400px; }

        .listing-preview-fab{ display:none; }
        .listing-preview-modal{ display:none; }

        /* Unter 1100px: Vorschau-Spalte ausblenden, per Button als Vollbild öffnen */
        @media(max-width:1100px){
          .listing-preview-col{ display:none; }
          .listing-form-col{ max-width:none; }
          .listing-preview-fab{
            position:fixed; right:16px; bottom:18px; z-index:65;
            display:inline-flex; align-items:center; gap:6px; padding:11px 16px; border-radius:999px;
            border:none; cursor:pointer; background:var(--accent); color:#fff; font-family:inherit;
            font-size:13.5px; font-weight:600; box-shadow:0 8px 24px rgba(0,0,0,0.22);
          }
          .listing-preview-modal{
            position:fixed; inset:0; z-index:120; background:var(--bg);
            display:flex; flex-direction:column;
          }
          .listing-preview-modal-head{
            display:flex; align-items:center; justify-content:space-between; gap:10px;
            padding:12px 16px; border-bottom:1px solid var(--border); flex-shrink:0; background:var(--surface);
          }
          .listing-preview-modal-body{ flex:1; overflow:auto; padding:16px; background:#fff; }
        }
      `}</style>
    </div>
  )
}

const miniBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18,
  borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.85)', cursor: 'pointer',
  color: '#333', padding: 0,
}

const prevDeviceBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 26,
  borderRadius: 6, border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0,
}

function StatusBanner({ status, hasPending, verified, published, reason }: {
  status: ModerationStatus; hasPending: boolean; verified: boolean; published: boolean; reason: string | null
}) {
  const map: Record<string, { bg: string; fg: string; icon: React.ReactNode; text: string }> = {
    draft: { bg: '#FEF9F0', fg: '#92600A', icon: <Clock size={16} />, text: 'Entwurf — vervollständige dein Profil und reiche es zur Prüfung ein.' },
    pending: { bg: '#EFF6FF', fg: '#1D4ED8', icon: <Clock size={16} />, text: 'In Prüfung — wir melden uns, sobald dein Profil freigegeben ist.' },
    approved: { bg: '#F0FDF4', fg: '#15803D', icon: <CheckCircle2 size={16} />, text: published ? 'Freigegeben und online sichtbar.' : 'Freigegeben — aktuell offline.' },
    rejected: { bg: '#FEF2F2', fg: '#B91C1C', icon: <AlertTriangle size={16} />, text: `Abgelehnt: ${reason ?? 'Bitte überarbeite dein Profil.'}` },
    suspended: { bg: '#FEF2F2', fg: '#B91C1C', icon: <AlertTriangle size={16} />, text: 'Gesperrt — bitte kontaktiere den Support.' },
  }
  const s = map[status]
  if (!s) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: s.bg, color: s.fg, fontSize: 13.5, fontWeight: 600 }}>
        {s.icon} {moderationLabel(status)} · {s.text}
        {verified && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#15803D' }}>
            <Star size={14} /> Verifiziert
          </span>
        )}
      </div>
      {hasPending && status === 'approved' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: '#EFF6FF', color: '#1D4ED8', fontSize: 13, fontWeight: 600 }}>
          <Clock size={15} /> Du hast Änderungen an sensiblen Feldern vorgenommen — sie werden geprüft.
        </div>
      )}
    </div>
  )
}
