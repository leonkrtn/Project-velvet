'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2, Upload, Save, Send, CheckCircle2, AlertTriangle, Clock,
  Plus, Trash2, ArrowUp, ArrowDown, Star, Building2,
} from 'lucide-react'
import {
  MARKETPLACE_CATEGORIES, PRICE_UNITS, SOCIAL_PLATFORMS,
  moderationLabel, type ModerationStatus,
} from '@/lib/marketplace/types'
import FragebogenBuilderClient from '@/app/vendor/anfrage-formular/FragebogenBuilderClient'

interface Vendor {
  id: string; name: string; company_name: string | null; category: string
  email: string | null; phone: string | null; website: string | null; description: string | null
  street: string | null; zip: string | null; city: string | null; price_range: string | null
  company_street: string | null; company_zip: string | null; company_city: string | null
  moderation_status: ModerationStatus; pending_changes: Record<string, unknown> | null
  verified: boolean; published: boolean; rejected_reason: string | null
  social_links: Record<string, string>; service_cities: string[]; service_radius_km: number | null
}
interface Photo { id: string; sort_order: number; url: string | null }
interface Pkg { id: string; title: string; description: string; price_from: number | null; price_unit: string; sort_order: number }
interface Faq { id: string; question: string; answer: string; sort_order: number }
interface Avail { id: string; day: string; status: string }

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 13px', fontSize: 14, border: '1px solid var(--border)',
  borderRadius: 10, background: '#fff', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box', color: 'var(--text)',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8,
}
const secCard: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
  padding: 20, marginBottom: 16,
}
const h2s: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }
const btnDark: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10,
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: 'var(--accent)', color: '#fff',
  border: 'none', fontFamily: 'inherit',
}
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: '#fff', color: 'var(--text)',
  border: '1px solid var(--border)', fontFamily: 'inherit',
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || '?'
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
  const [activeTab, setActiveTab] = useState<ListingTab>('anzeige')
  const [loading, setLoading] = useState(true)
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [packages, setPackages] = useState<Pkg[]>([])
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [availability, setAvailability] = useState<Avail[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [f, setF] = useState({
    name: '', company_name: '', category: 'sonstiges', street: '', zip: '', city: '',
    company_street: '', company_zip: '', company_city: '',
    description: '', email: '', phone: '', website: '', price_range: '',
    service_cities: '', service_radius_km: '', brand_color: '',
  })
  const [social, setSocial] = useState<Record<string, string>>({})

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
    setF({
      name: String(pick('name', v.name) ?? ''),
      company_name: String(pick('company_name', v.company_name) ?? ''),
      category: String(pick('category', v.category) ?? 'sonstiges'),
      street: String(pick('street', v.street) ?? ''),
      zip: String(pick('zip', v.zip) ?? ''),
      city: String(pick('city', v.city) ?? ''),
      company_street: v.company_street ?? '',
      company_zip: v.company_zip ?? '',
      company_city: v.company_city ?? '',
      description: v.description ?? '',
      email: v.email ?? '',
      phone: v.phone ?? '',
      website: v.website ?? '',
      price_range: v.price_range ?? '',
      service_cities: (v.service_cities ?? []).join(', '),
      service_radius_km: v.service_radius_km != null ? String(v.service_radius_km) : '',
      brand_color: (v as { brand_color?: string }).brand_color ?? '',
    })
    setSocial(v.social_links ?? {})
    setLoading(false)
  }, [])

  useEffect(() => { load(true) }, [load])

  const flash = (kind: 'ok' | 'err', text: string) => {
    setMsg({ kind, text }); setTimeout(() => setMsg(null), 4000)
  }

  function saveProfile() {
    const payload = {
      name: f.name, company_name: f.company_name, category: f.category,
      street: f.street, zip: f.zip, city: f.city,
      company_street: f.company_street, company_zip: f.company_zip, company_city: f.company_city,
      description: f.description, email: f.email, phone: f.phone, website: f.website,
      price_range: f.price_range,
      service_cities: f.service_cities.split(',').map(s => s.trim()).filter(Boolean),
      service_radius_km: f.service_radius_km,
      social_links: social,
      brand_color: f.brand_color,
    }
    flash('ok', 'Gespeichert.')
    fetch('/api/vendor/marketplace/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }).then(async res => {
      const d = await res.json().catch(() => ({}))
      if (!res.ok) flash('err', d.error ?? 'Speichern fehlgeschlagen')
      else if (d.hasPendingChanges) flash('ok', 'Gespeichert — sensible Änderungen gehen in die Prüfung.')
      load(false)
    }).catch(() => load(false))
  }

  function submitForReview() {
    setVendor(v => v ? { ...v, moderation_status: 'pending', rejected_reason: null } : v)
    flash('ok', 'Zur Prüfung eingereicht.')
    fetch('/api/vendor/marketplace/profile/submit', { method: 'POST' }).then(async res => {
      if (!res.ok) { const d = await res.json().catch(() => ({})); flash('err', d.error ?? 'Fehler'); load(false) }
    }).catch(() => load(false))
  }

  function togglePublish() {
    if (!vendor) return
    const next = !vendor.published
    setVendor(v => v ? { ...v, published: next } : v)
    flash('ok', next ? 'Listing ist online.' : 'Listing ist offline.')
    fetch('/api/vendor/marketplace/profile/publish', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ published: next }),
    }).then(res => { if (!res.ok) load(false) }).catch(() => load(false))
  }

  const logoInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  async function uploadImage(file: File, kind: 'logo' | 'photo'): Promise<string | null> {
    const res = await fetch('/api/vendor/marketplace/upload', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, contentType: file.type }),
    })
    if (!res.ok) { flash('err', 'Upload-URL fehlgeschlagen'); return null }
    const { uploadUrl, key } = await res.json()
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
    if (!put.ok) { flash('err', 'Upload fehlgeschlagen'); return null }
    return key
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const key = await uploadImage(file, 'logo'); if (!key) return
    const res = await fetch('/api/vendor/marketplace/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo_r2_key: key }),
    })
    const d = await res.json()
    flash('ok', d.hasPendingChanges ? 'Logo hochgeladen — geht in die Prüfung.' : 'Logo aktualisiert.')
    load(false)
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); if (!files.length) return
    setUploadingPhoto(true)
    for (const file of files) {
      const key = await uploadImage(file, 'photo'); if (!key) continue
      await fetch('/api/vendor/marketplace/photos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ r2_key: key }),
      })
    }
    setUploadingPhoto(false)
    flash('ok', 'Fotos hinzugefügt.'); load(false)
  }

  async function deletePhoto(id: string) {
    await fetch(`/api/vendor/marketplace/photos/${id}`, { method: 'DELETE' })
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
  function savePackage(p: Pkg) {
    flash('ok', 'Paket gespeichert.')
    fetch(`/api/vendor/marketplace/packages/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: p.title, description: p.description, price_from: p.price_from, price_unit: p.price_unit }),
    }).then(res => { if (!res.ok) flash('err', 'Konnte nicht speichern') })
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
  function saveFaq(q: Faq) {
    flash('ok', 'FAQ gespeichert.')
    fetch(`/api/vendor/marketplace/faqs/${q.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q.question, answer: q.answer }),
    }).then(res => { if (!res.ok) flash('err', 'Konnte nicht speichern') })
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
  const requirements = [
    { key: 'company', label: 'Firma / Anzeigename', ok: !!f.company_name.trim() },
    { key: 'desc', label: 'Beschreibung (mind. 30 Zeichen)', ok: f.description.trim().length >= 30 },
    { key: 'city', label: 'Stadt', ok: !!f.city.trim() },
    { key: 'photo', label: 'Mindestens 1 Foto', ok: photos.length >= 1 },
  ]
  const allRequirementsMet = requirements.every(r => r.ok)
  const showRequirements = status === 'draft' || status === 'rejected'

  const categoryLabel = MARKETPLACE_CATEGORIES.find(c => c.key === f.category)?.label ?? f.category

  return (
    <div className="vnd-page-outer" style={{ flex: 1, background: 'var(--bg)', padding: '28px 24px 48px', overflow: 'auto' }}>
      <div className="vnd-page-card">

        {/* ── Header ── */}
        <div className="listing-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>Anbieter-Profil</h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 6, marginBottom: 0 }}>
              So erscheint du im Forevr-Marktplatz.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>Öffentlich sichtbar</span>
            <Toggle
              checked={vendor.published}
              onChange={togglePublish}
              disabled={status !== 'approved'}
            />
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
          <>
            {/* ── Main profile card ── */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16 }}>

              {/* Avatar + company info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
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
                    style={{
                      position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)',
                      width: 22, height: 22, borderRadius: '50%', padding: 0,
                      background: 'var(--accent)', border: '2px solid var(--bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}
                  >
                    <Upload size={11} color="#fff" />
                  </button>
                  <input ref={logoInput} type="file" accept="image/*" hidden onChange={onLogo} />
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
                <label style={lbl}>Kurzbeschreibung</label>
                <textarea
                  value={f.description}
                  onChange={set('description')}
                  placeholder="Beschreibe deine Leistung kurz und prägnant…"
                  style={{ ...inp, minHeight: 90, resize: 'vertical', lineHeight: 1.55 }}
                />
              </div>

              {/* Markenfarbe */}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Markenfarbe</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(f.brand_color) ? f.brand_color : '#B89968'}
                    onChange={set('brand_color')}
                    style={{ width: 44, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
                    aria-label="Markenfarbe wählen"
                  />
                  <input
                    value={f.brand_color}
                    onChange={set('brand_color')}
                    placeholder="#B89968 (leer = Forevr-Standard)"
                    style={{ ...inp, maxWidth: 240 }}
                  />
                  {f.brand_color && (
                    <button onClick={() => setF(s => ({ ...s, brand_color: '' }))} style={{ ...btnGhost, padding: '8px 12px' }}>Zurücksetzen</button>
                  )}
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '6px 0 0' }}>
                  Akzentfarbe für deine Angebots-PDFs und die Mails an das Brautpaar.
                </p>
              </div>

              {/* Kategorie + Ab-Preis */}
              <div className="listing-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
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

              {/* Save */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={saveProfile} style={btnDark}>
                  <Save size={15} /> Speichern
                </button>
                {msg && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: msg.kind === 'ok' ? '#15803D' : 'var(--red)' }}>
                    {msg.text}
                  </span>
                )}
              </div>
            </div>

            {/* ── Status banner ── */}
            <StatusBanner status={status} hasPending={hasPending} verified={vendor.verified} published={vendor.published} reason={vendor.rejected_reason} />

            {/* ── Submit for review (draft/rejected) ── */}
            {showRequirements && (
              <div style={{ ...secCard, marginBottom: 16 }}>
                <h2 style={h2s}>Zur Prüfung einreichen</h2>
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

            {/* ── Galerie ── */}
            <div data-tour="vdr-listing-gallery" style={secCard}>
              <h2 style={h2s}>Galerie</h2>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 12px' }}>
                Erstes Bild = Titelbild. Max. 15 Fotos.
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
                      <button onClick={() => deletePhoto(p.id)} style={{ ...miniBtn, color: '#fff', background: 'rgba(185,28,28,0.85)' }} title="löschen"><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
                {photos.length < 15 && (
                  <button onClick={() => photoInput.current?.click()} disabled={uploadingPhoto} style={{ width: 96, height: 72, borderRadius: 8, border: '1px dashed var(--border)', background: '#fff', cursor: uploadingPhoto ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                    {uploadingPhoto ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={20} />}
                  </button>
                )}
              </div>
              <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={onPhoto} />
            </div>

            {/* ── Weitere Stammdaten ── */}
            <div style={secCard}>
              <h2 style={h2s}>Weitere Angaben <SensitiveHint /></h2>
              <div className="listing-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Firma / Anzeigename *</label><input style={inp} value={f.company_name} onChange={set('company_name')} placeholder="So erscheint ihr im Marktplatz" /></div>
                <div><label style={lbl}>Ansprechpartner (intern)</label><input style={inp} value={f.name} onChange={set('name')} /></div>
                <div><label style={lbl}>Straße</label><input style={inp} value={f.street} onChange={set('street')} /></div>
                <div><label style={lbl}>PLZ</label><input style={inp} value={f.zip} onChange={set('zip')} /></div>
                <div><label style={lbl}>Stadt *</label><input style={inp} value={f.city} onChange={set('city')} /></div>
                <div><label style={lbl}>Website</label><input style={inp} value={f.website} onChange={set('website')} placeholder="https://" /></div>
                <div><label style={lbl}>E-Mail (öffentlich nach Anfrage)</label><input style={inp} value={f.email} onChange={set('email')} /></div>
                <div><label style={lbl}>Telefon (öffentlich nach Anfrage)</label><input style={inp} value={f.phone} onChange={set('phone')} /></div>
              </div>
            </div>

            {/* ── Allgemeine Firmenadresse (Stammdaten, NICHT Teil des Marktplatz-Listings) ── */}
            <div style={{ ...secCard, background: 'var(--bg)', border: '1px dashed var(--border)' }}>
              <h2 style={{ ...h2s, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={16} style={{ color: 'var(--text-dim)' }} />
                Allgemeine Firmenadresse
              </h2>
              <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '0 0 14px', lineHeight: 1.5 }}>
                Interne Stammdaten (z. B. für Rechnungen) — <strong>nicht Teil deines Marktplatz-Listings</strong> und
                geht nicht in die Prüfung. Wird nur angezeigt, wenn oben unter „Weitere Angaben“ keine Adresse hinterlegt ist.
              </p>
              <div className="listing-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Straße</label><input style={inp} value={f.company_street} onChange={set('company_street')} /></div>
                <div><label style={lbl}>PLZ</label><input style={inp} value={f.company_zip} onChange={set('company_zip')} /></div>
                <div><label style={lbl}>Ort</label><input style={inp} value={f.company_city} onChange={set('company_city')} /></div>
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
                    <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={p.description} onChange={e => setPackages(a => a.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} placeholder="Was ist enthalten?" />
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
                    <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={q.answer} onChange={e => setFaqs(a => a.map((x, i) => i === idx ? { ...x, answer: e.target.value } : x))} placeholder="Antwort" />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => saveFaq(q)} style={btnDark}><Save size={14} /> Speichern</button>
                      <button onClick={() => delFaq(q.id)} style={{ ...btnGhost, color: 'var(--red)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: 40 }} />
          </>
        ) : (
          <FragebogenBuilderClient category={f.category} embedded />
        )}
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:580px){.listing-two-col{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  )
}

const miniBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18,
  borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.85)', cursor: 'pointer',
  color: '#333', padding: 0,
}

function SensitiveHint() {
  return (
    <span title="Änderungen werden vor der Veröffentlichung geprüft" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginLeft: 6 }}>
      · wird geprüft
    </span>
  )
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
