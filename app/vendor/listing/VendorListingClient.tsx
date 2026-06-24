'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Loader2, Save, Send, Eye, EyeOff, Plus, Trash2, Image as ImageIcon, Star,
  CheckCircle2, AlertTriangle, Clock, ArrowUp, ArrowDown, FileText,
} from 'lucide-react'
import {
  MARKETPLACE_CATEGORIES, PRICE_RANGES, PRICE_UNITS, SOCIAL_PLATFORMS,
  moderationLabel, type ModerationStatus,
} from '@/lib/marketplace/types'

interface Vendor {
  id: string; name: string; company_name: string | null; category: string
  email: string | null; phone: string | null; website: string | null; description: string | null
  street: string | null; zip: string | null; city: string | null; price_range: string | null
  moderation_status: ModerationStatus; pending_changes: Record<string, unknown> | null
  verified: boolean; published: boolean; rejected_reason: string | null
  social_links: Record<string, string>; service_cities: string[]; service_radius_km: number | null
}
interface Photo { id: string; sort_order: number; url: string | null }
interface Pkg { id: string; title: string; description: string; price_from: number | null; price_unit: string; sort_order: number }
interface Faq { id: string; question: string; answer: string; sort_order: number }
interface Avail { id: string; day: string; status: string }

const C = {
  bg: 'var(--bg)', surface: 'var(--surface)', border: 'var(--border)',
  text: 'var(--text)', dim: 'var(--text-dim)', gold: 'var(--gold)', red: 'var(--red)',
}
const inp: React.CSSProperties = {
  width: '100%', padding: '11px 13px', fontSize: 14, border: `1px solid ${C.border}`,
  borderRadius: 8, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: C.text,
}
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: C.dim, marginBottom: 6 }
const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22, marginBottom: 18 }
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 16px' }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid transparent' }
const btnGold: React.CSSProperties = { ...btn, background: C.gold, color: '#fff' }
const btnGhost: React.CSSProperties = { ...btn, background: '#fff', color: C.text, border: `1px solid ${C.border}` }

export default function VendorListingClient() {
  const [loading, setLoading] = useState(true)
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [packages, setPackages] = useState<Pkg[]>([])
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [availability, setAvailability] = useState<Avail[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Formularfelder
  const [f, setF] = useState({
    name: '', company_name: '', category: 'sonstiges', street: '', zip: '', city: '',
    description: '', email: '', phone: '', website: '', price_range: '',
    service_cities: '', service_radius_km: '',
  })
  const [social, setSocial] = useState<Record<string, string>>({})

  // initial=true zeigt den Vollbild-Spinner (nur beim allerersten Laden). Alle
  // späteren Aktualisierungen laufen still, damit die Seite nicht neu aufbaut
  // und der Scroll nicht nach oben springt.
  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    const res = await fetch('/api/vendor/marketplace/profile')
    if (!res.ok) { if (initial) setLoading(false); return }
    const d = await res.json()
    const v: Vendor = d.vendor
    setVendor(v); setLogoUrl(d.logoUrl)
    // Galerie nur ersetzen, wenn sich die Foto-Menge wirklich geändert hat —
    // sonst würden frisch signierte URLs die <img> unnötig neu laden (Flackern).
    const incoming: Photo[] = d.photos ?? []
    setPhotos(prev => {
      const sameSet = prev.length === incoming.length && prev.every((p, i) => p.id === incoming[i].id)
      return sameSet ? prev : incoming
    })
    setPackages(d.packages ?? []); setFaqs(d.faqs ?? []); setAvailability(d.availability ?? [])
    // Bei freigegebenem Profil ggf. gestaffelte (in Prüfung befindliche) Werte anzeigen.
    const pc = (v.pending_changes ?? {}) as Record<string, unknown>
    const pick = (k: string, fallback: unknown) => (k in pc ? pc[k] : fallback)
    setF({
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
    })
    setSocial(v.social_links ?? {})
    setLoading(false)
  }, [])

  useEffect(() => { load(true) }, [load])

  const flash = (kind: 'ok' | 'err', text: string) => { setMsg({ kind, text }); setTimeout(() => setMsg(null), 4000) }

  // Positive UX: sofort bestätigen, im Hintergrund speichern, danach still
  // synchronisieren (für den „in Prüfung"-Hinweis bei sensiblen Feldern).
  function saveProfile() {
    const payload = {
      name: f.name, company_name: f.company_name, category: f.category,
      street: f.street, zip: f.zip, city: f.city,
      description: f.description, email: f.email, phone: f.phone, website: f.website,
      price_range: f.price_range,
      service_cities: f.service_cities.split(',').map(s => s.trim()).filter(Boolean),
      service_radius_km: f.service_radius_km,
      social_links: social,
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

  // Positive UX: Status sofort umstellen, Anfrage im Hintergrund; bei Fehler resync.
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

  // ── Uploads ────────────────────────────────────────────────────────────────
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

  // ── Pakete ───────────────────────────────────────────────────────────────
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

  // ── FAQ ──────────────────────────────────────────────────────────────────
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

  // ── Verfügbarkeit ──────────────────────────────────────────────────────────
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

  if (loading) {
    return <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="bp-spin" /></div>
  }
  if (!vendor) {
    return <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim }}>Kein Profil gefunden.</div>
  }

  const hasPending = !!vendor.pending_changes && Object.keys(vendor.pending_changes).length > 0
  const status = vendor.moderation_status
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF(s => ({ ...s, [k]: e.target.value }))

  // Pflichtangaben vor dem Einreichen (Spiegel der Server-Prüfung).
  const requirements = [
    { key: 'company', label: 'Firma / Anzeigename', ok: !!f.company_name.trim() },
    { key: 'desc', label: 'Beschreibung (mind. 30 Zeichen)', ok: f.description.trim().length >= 30 },
    { key: 'city', label: 'Stadt', ok: !!f.city.trim() },
    { key: 'photo', label: 'Mindestens 1 Foto', ok: photos.length >= 1 },
  ]
  const allRequirementsMet = requirements.every(r => r.ok)
  const showRequirements = status === 'draft' || status === 'rejected'

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, padding: '32px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, fontSize: 24, color: C.gold, letterSpacing: '0.16em', lineHeight: 1, marginBottom: 6 }}>FOREVR</p>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: C.text }}>Mein Anbieter-Profil</h1>
          </div>
          <Link href="/vendor/dashboard" style={{ ...btnGhost, textDecoration: 'none' }}>Zu meinen Events</Link>
        </div>

        {/* Status-Banner */}
        <StatusBanner status={status} hasPending={hasPending} verified={vendor.verified} published={vendor.published} reason={vendor.rejected_reason} />

        {/* Aktionen */}
        <div style={card}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={saveProfile} style={btnGold}>
              <Save size={15} /> Speichern
            </button>
            {showRequirements && (
              <button onClick={submitForReview} disabled={!allRequirementsMet} style={{ ...btnGhost, opacity: allRequirementsMet ? 1 : 0.5, cursor: allRequirementsMet ? 'pointer' : 'not-allowed' }} title={allRequirementsMet ? '' : 'Bitte zuerst alle Pflichtangaben ausfüllen'}>
                <Send size={15} /> Zur Prüfung einreichen
              </button>
            )}
            {status === 'approved' && (
              <button onClick={togglePublish} style={vendor.published ? btnGhost : btnGold}>
                {vendor.published ? <><EyeOff size={15} /> Offline nehmen</> : <><Eye size={15} /> Online schalten</>}
              </button>
            )}
            {msg && <span style={{ fontSize: 13, fontWeight: 600, color: msg.kind === 'ok' ? '#15803D' : C.red }}>{msg.text}</span>}
          </div>

          {showRequirements && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.dim, marginBottom: 8 }}>Pflichtangaben vor dem Einreichen</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {requirements.map(r => (
                  <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: r.ok ? '#15803D' : C.dim }}>
                    {r.ok ? <CheckCircle2 size={15} /> : <span style={{ width: 15, height: 15, borderRadius: '50%', border: `1.5px solid ${C.border}`, display: 'inline-block' }} />}
                    {r.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fragebogen & Auto-Angebot */}
        <a href="/vendor/anfrage-formular" style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(184,153,104,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={20} style={{ color: C.gold }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Fragebogen & Auto-Angebot</div>
            <div style={{ fontSize: 12.5, color: C.dim, marginTop: 2 }}>Fragen festlegen, aus denen automatisch ein Angebotsentwurf entsteht.</div>
          </div>
          <span style={{ ...btnGhost, pointerEvents: 'none' }}>Öffnen</span>
        </a>

        {/* Stammdaten (sensibel) */}
        <div style={card}>
          <h2 style={h2}>Stammdaten <SensitiveHint /></h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label style={lbl}>Firma / Anzeigename *</label><input style={inp} value={f.company_name} onChange={set('company_name')} placeholder="So erscheint ihr im Marktplatz" /></div>
            <div><label style={lbl}>Ansprechpartner (intern, nicht öffentlich)</label><input style={inp} value={f.name} onChange={set('name')} /></div>
            <div>
              <label style={lbl}>Kategorie *</label>
              <select style={inp} value={f.category} onChange={set('category')}>
                {MARKETPLACE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Straße</label><input style={inp} value={f.street} onChange={set('street')} /></div>
            <div><label style={lbl}>PLZ</label><input style={inp} value={f.zip} onChange={set('zip')} /></div>
            <div><label style={lbl}>Stadt</label><input style={inp} value={f.city} onChange={set('city')} /></div>
          </div>
        </div>

        {/* Profil-Inhalt (sofort live) */}
        <div style={card}>
          <h2 style={h2}>Beschreibung & Kontakt</h2>
          <label style={lbl}>Beschreibung</label>
          <textarea style={{ ...inp, minHeight: 110, resize: 'vertical' }} value={f.description} onChange={set('description')} placeholder="Stell dich und deine Leistung vor…" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <div>
              <label style={lbl}>Preisklasse</label>
              <select style={inp} value={f.price_range} onChange={set('price_range')}>
                <option value="">—</option>
                {PRICE_RANGES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Website</label><input style={inp} value={f.website} onChange={set('website')} placeholder="https://" /></div>
            <div><label style={lbl}>E-Mail (öffentlich nach Anfrage)</label><input style={inp} value={f.email} onChange={set('email')} /></div>
            <div><label style={lbl}>Telefon (öffentlich nach Anfrage)</label><input style={inp} value={f.phone} onChange={set('phone')} /></div>
          </div>
        </div>

        {/* Einsatzgebiet */}
        <div style={card}>
          <h2 style={h2}>Einsatzgebiet</h2>
          <label style={lbl}>Städte / Regionen (mit Komma trennen)</label>
          <input style={inp} value={f.service_cities} onChange={set('service_cities')} placeholder="München, Augsburg, Allgäu" />
          <div style={{ marginTop: 14, maxWidth: 220 }}>
            <label style={lbl}>Anfahrtsradius (km, optional)</label>
            <input style={inp} type="number" value={f.service_radius_km} onChange={set('service_radius_km')} placeholder="100" />
          </div>
        </div>

        {/* Social-Links */}
        <div style={card}>
          <h2 style={h2}>Social-Media</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {SOCIAL_PLATFORMS.map(s => (
              <div key={s.key}>
                <label style={lbl}>{s.label}</label>
                <input style={inp} value={social[s.key] ?? ''} onChange={e => setSocial(p => ({ ...p, [s.key]: e.target.value }))} placeholder="https://" />
              </div>
            ))}
          </div>
        </div>

        {/* Logo & Galerie */}
        <div style={card}>
          <h2 style={h2}>Logo & Galerie</h2>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <label style={lbl}>Logo <SensitiveHint /></label>
              <div onClick={() => logoInput.current?.click()} style={{ width: 110, height: 110, borderRadius: 12, border: `1px dashed ${C.border}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : <ImageIcon size={26} color={C.dim} />}
              </div>
              <input ref={logoInput} type="file" accept="image/*" hidden onChange={onLogo} />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={lbl}>Galerie (max. 15, erstes Bild = Titelbild)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {photos.map((p, i) => (
                  <div key={p.id} style={{ width: 96, height: 72, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}`, position: 'relative', background: '#fff' }}>
                    {p.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {i === 0 && <span style={{ position: 'absolute', top: 3, left: 3, background: C.gold, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5 }}>Titel</span>}
                    <div style={{ position: 'absolute', bottom: 2, right: 2, display: 'flex', gap: 2 }}>
                      <button onClick={() => movePhoto(i, -1)} style={miniBtn} title="nach vorne"><ArrowUp size={11} /></button>
                      <button onClick={() => movePhoto(i, 1)} style={miniBtn} title="nach hinten"><ArrowDown size={11} /></button>
                      <button onClick={() => deletePhoto(p.id)} style={{ ...miniBtn, color: '#fff', background: 'rgba(185,28,28,0.85)' }} title="löschen"><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
                {photos.length < 15 && (
                  <button onClick={() => photoInput.current?.click()} disabled={uploadingPhoto} style={{ width: 96, height: 72, borderRadius: 8, border: `1px dashed ${C.border}`, background: '#fff', cursor: uploadingPhoto ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim }}>
                    {uploadingPhoto ? <Loader2 size={18} className="bp-spin" /> : <Plus size={20} />}
                  </button>
                )}
              </div>
              <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={onPhoto} />
            </div>
          </div>
        </div>

        {/* Pakete */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ ...h2, margin: 0 }}>Pakete & Leistungen</h2>
            <button onClick={addPackage} style={btnGhost}><Plus size={15} /> Paket</button>
          </div>
          {packages.length === 0 && <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Noch keine Pakete.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {packages.map((p, idx) => (
              <div key={p.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <input style={{ ...inp, flex: 1 }} value={p.title} onChange={e => setPackages(a => a.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))} placeholder="Titel" />
                  <input style={{ ...inp, width: 120 }} type="number" value={p.price_from ?? ''} onChange={e => setPackages(a => a.map((x, i) => i === idx ? { ...x, price_from: e.target.value === '' ? null : Number(e.target.value) } : x))} placeholder="Preis €" />
                  <select style={{ ...inp, width: 140 }} value={p.price_unit} onChange={e => setPackages(a => a.map((x, i) => i === idx ? { ...x, price_unit: e.target.value } : x))}>
                    {PRICE_UNITS.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
                  </select>
                </div>
                <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={p.description} onChange={e => setPackages(a => a.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} placeholder="Was ist enthalten?" />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => savePackage(p)} style={btnGold}><Save size={14} /> Speichern</button>
                  <button onClick={() => delPackage(p.id)} style={{ ...btnGhost, color: C.red }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ ...h2, margin: 0 }}>FAQ</h2>
            <button onClick={addFaq} style={btnGhost}><Plus size={15} /> Frage</button>
          </div>
          {faqs.length === 0 && <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Noch keine Fragen.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faqs.map((q, idx) => (
              <div key={q.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                <input style={{ ...inp, marginBottom: 8 }} value={q.question} onChange={e => setFaqs(a => a.map((x, i) => i === idx ? { ...x, question: e.target.value } : x))} placeholder="Frage" />
                <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={q.answer} onChange={e => setFaqs(a => a.map((x, i) => i === idx ? { ...x, answer: e.target.value } : x))} placeholder="Antwort" />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => saveFaq(q)} style={btnGold}><Save size={14} /> Speichern</button>
                  <button onClick={() => delFaq(q.id)} style={{ ...btnGhost, color: C.red }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Verfügbarkeit */}
        <div style={card}>
          <h2 style={h2}>Verfügbarkeit — belegte Tage</h2>
          <p style={{ color: C.dim, fontSize: 13, margin: '0 0 12px' }}>Markiere belegte Termine. Brautpaare sehen, ob du an ihrem Hochzeitsdatum frei bist.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input style={{ ...inp, maxWidth: 200 }} type="date" value={newDay} onChange={e => setNewDay(e.target.value)} />
            <button onClick={addDay} style={btnGhost}><Plus size={15} /> Tag blockieren</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {availability.map(d => (
              <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: '#fff', border: `1px solid ${C.border}`, fontSize: 12.5 }}>
                {new Date(d.day).toLocaleDateString('de-DE')}
                <button onClick={() => delDay(d.day)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, display: 'flex', padding: 0 }}><Trash2 size={12} /></button>
              </span>
            ))}
            {availability.length === 0 && <span style={{ color: C.dim, fontSize: 13 }}>Keine belegten Tage.</span>}
          </div>
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}

const miniBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18,
  borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.85)', cursor: 'pointer', color: '#333', padding: 0,
}

function SensitiveHint() {
  return <span title="Änderungen werden vor der Veröffentlichung geprüft" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginLeft: 6 }}>· wird geprüft</span>
}

function StatusBanner({ status, hasPending, verified, published, reason }: {
  status: ModerationStatus; hasPending: boolean; verified: boolean; published: boolean; reason: string | null
}) {
  const map: Record<string, { bg: string; fg: string; icon: React.ReactNode; text: string }> = {
    draft: { bg: '#FEF9F0', fg: '#92600A', icon: <Clock size={16} />, text: 'Entwurf — vervollständige dein Profil und reiche es zur Prüfung ein.' },
    pending: { bg: '#EFF6FF', fg: '#1D4ED8', icon: <Clock size={16} />, text: 'In Prüfung — wir melden uns, sobald dein Profil freigegeben ist.' },
    approved: { bg: '#F0FDF4', fg: '#15803D', icon: <CheckCircle2 size={16} />, text: published ? 'Freigegeben und online sichtbar.' : 'Freigegeben — aktuell offline. Schalte es online, um sichtbar zu sein.' },
    rejected: { bg: '#FEF2F2', fg: '#B91C1C', icon: <AlertTriangle size={16} />, text: `Abgelehnt: ${reason ?? 'Bitte überarbeite dein Profil.'}` },
    suspended: { bg: '#FEF2F2', fg: '#B91C1C', icon: <AlertTriangle size={16} />, text: 'Gesperrt — bitte kontaktiere den Support.' },
  }
  const s = map[status]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: s.bg, color: s.fg, fontSize: 13.5, fontWeight: 600 }}>
        {s.icon} {moderationLabel(status)} · {s.text}
        {verified && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#15803D' }}><Star size={14} /> Verifiziert</span>}
      </div>
      {hasPending && status === 'approved' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: '#EFF6FF', color: '#1D4ED8', fontSize: 13, fontWeight: 600 }}>
          <Clock size={15} /> Du hast Änderungen an sensiblen Feldern vorgenommen — sie werden geprüft. Bis dahin bleibt die freigegebene Version online.
        </div>
      )}
    </div>
  )
}
