'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Eye, EyeOff, KeyRound, ImagePlus, X, Pencil, Check } from 'lucide-react'
import { MARKETPLACE_CATEGORIES, PRICE_RANGES, categoryLabel } from '@/lib/marketplace/types'

interface Vendor {
  id: string
  name: string
  company_name: string | null
  category: string
  email: string | null
  phone: string | null
  website: string | null
  description: string | null
  street: string | null
  zip: string | null
  city: string | null
  price_range: string | null
  published: boolean
  logo_url: string | null
  login_email: string | null
}

const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid var(--border, #ddd)', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #888)', marginBottom: 4, display: 'block' }
const btnP: React.CSSProperties = { padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--gold, #B89968)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnS: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border, #ddd)', background: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }

export default function MarketplaceVendorsSection() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/marketplace/vendors')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setVendors(json.vendors ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function togglePublish(v: Vendor) {
    await fetch(`/api/admin/marketplace/vendors/${v.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !v.published }),
    })
    load()
  }

  async function remove(v: Vendor) {
    if (!confirm(`Vendor "${v.name}" wirklich löschen? Login und Bilder werden entfernt.`)) return
    await fetch(`/api/admin/marketplace/vendors/${v.id}`, { method: 'DELETE' })
    load()
  }

  async function resetPassword(v: Vendor) {
    const pw = prompt(`Neues Passwort für ${v.login_email ?? v.name} (mind. 8 Zeichen):`)
    if (!pw) return
    const res = await fetch(`/api/admin/marketplace/vendors/${v.id}/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    alert(res.ok ? 'Passwort aktualisiert.' : 'Fehler beim Zurücksetzen.')
  }

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Marktplatz · Dienstleister</h2>
        <button style={btnP} onClick={() => { setShowCreate(s => !s); setEditId(null) }}>
          <Plus size={15} /> Vendor anlegen
        </button>
      </div>

      {error && <p style={{ color: '#C62828', fontSize: 13 }}>{error}</p>}

      {showCreate && <VendorForm onDone={() => { setShowCreate(false); load() }} onCancel={() => setShowCreate(false)} />}

      {loading ? (
        <p style={{ fontSize: 13, color: '#888' }}>Lädt…</p>
      ) : vendors.length === 0 ? (
        <p style={{ fontSize: 13, color: '#888' }}>Noch keine Vendors angelegt.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {vendors.map(v => (
            <div key={v.id} style={{ border: '1px solid var(--border, #eee)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f3f3f3', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {v.logo_url
                    ? <img src={v.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 16, fontWeight: 700, color: '#bbb' }}>{v.name.charAt(0)}</span>}
                </div>
                <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{v.company_name || v.name}</div>
                  <div style={{ fontSize: 12, color: '#888', wordBreak: 'break-word' }}>{categoryLabel(v.category)}{v.city ? ` · ${v.city}` : ''}{v.login_email ? ` · ${v.login_email}` : ''}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, padding: '5px 9px', borderRadius: 100, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: v.published ? '#E6F4EA' : '#FCE8E6', color: v.published ? '#1E7E34' : '#C5221F', whiteSpace: 'nowrap' }}>
                  {v.published ? 'Veröffentlicht' : 'Entwurf'}
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button style={btnS} onClick={() => togglePublish(v)} title={v.published ? 'Verstecken' : 'Veröffentlichen'}>
                    {v.published ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button style={btnS} onClick={() => setEditId(editId === v.id ? null : v.id)}><Pencil size={14} /></button>
                  <button style={btnS} onClick={() => resetPassword(v)} title="Passwort zurücksetzen"><KeyRound size={14} /></button>
                  <button style={{ ...btnS, color: '#C62828' }} onClick={() => remove(v)}><Trash2 size={14} /></button>
                </div>
              </div>
              {editId === v.id && <VendorForm vendor={v} onDone={() => { setEditId(null); load() }} onCancel={() => setEditId(null)} />}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Anlege-/Bearbeiten-Formular ───────────────────────────────────────────────
function VendorForm({ vendor, onDone, onCancel }: { vendor?: Vendor; onDone: () => void; onCancel: () => void }) {
  const editing = !!vendor
  const [f, setF] = useState({
    name: vendor?.name ?? '', email: vendor?.email ?? '', password: '',
    companyName: vendor?.company_name ?? '', category: vendor?.category ?? 'fotograf',
    phone: vendor?.phone ?? '', website: vendor?.website ?? '', description: vendor?.description ?? '',
    street: vendor?.street ?? '', zip: vendor?.zip ?? '', city: vendor?.city ?? '',
    priceRange: vendor?.price_range ?? '', published: vendor?.published ?? false,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f, val: unknown) => setF(prev => ({ ...prev, [k]: val }))

  async function uploadImage(kind: 'logo' | 'photo', file: File): Promise<string | null> {
    if (!vendor) return null
    const r = await fetch(`/api/admin/marketplace/vendors/${vendor.id}/upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, contentType: file.type }),
    })
    const { uploadUrl, key } = await r.json()
    if (!uploadUrl) return null
    await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
    return key as string
  }

  async function submit() {
    setErr('')
    if (!f.name.trim() || (!editing && (!f.email.trim() || f.password.length < 8))) {
      setErr('Name, E-Mail und Passwort (mind. 8 Zeichen) erforderlich.')
      return
    }
    setBusy(true)
    try {
      if (editing) {
        const res = await fetch(`/api/admin/marketplace/vendors/${vendor.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: f.name, company_name: f.companyName || null, category: f.category,
            email: f.email || null, phone: f.phone || null, website: f.website || null,
            description: f.description || null, street: f.street || null, zip: f.zip || null,
            city: f.city || null, price_range: f.priceRange || null, published: f.published,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      } else {
        const res = await fetch('/api/admin/marketplace/vendors', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(f),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      }
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: 16, background: '#fafafa', borderTop: '1px solid var(--border, #eee)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {err && <p style={{ color: '#C62828', fontSize: 12.5, margin: 0 }}>{err}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <div><label style={lbl}>Name (Ansprechpartner) *</label><input style={inp} value={f.name} onChange={e => set('name', e.target.value)} /></div>
        <div><label style={lbl}>Firmenname</label><input style={inp} value={f.companyName} onChange={e => set('companyName', e.target.value)} /></div>
        <div>
          <label style={lbl}>Kategorie</label>
          <select style={inp} value={f.category} onChange={e => set('category', e.target.value)}>
            {MARKETPLACE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Preisklasse</label>
          <select style={inp} value={f.priceRange} onChange={e => set('priceRange', e.target.value)}>
            <option value="">—</option>
            {PRICE_RANGES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div><label style={lbl}>E-Mail (Login) {editing ? '' : '*'}</label><input style={inp} type="email" value={f.email} onChange={e => set('email', e.target.value)} disabled={editing} /></div>
        {!editing && <div><label style={lbl}>Passwort *</label><input style={inp} type="text" value={f.password} onChange={e => set('password', e.target.value)} placeholder="mind. 8 Zeichen" /></div>}
        <div><label style={lbl}>Telefon</label><input style={inp} value={f.phone} onChange={e => set('phone', e.target.value)} /></div>
        <div><label style={lbl}>Website</label><input style={inp} value={f.website} onChange={e => set('website', e.target.value)} placeholder="https://…" /></div>
        <div><label style={lbl}>Straße</label><input style={inp} value={f.street} onChange={e => set('street', e.target.value)} /></div>
        <div><label style={lbl}>PLZ</label><input style={inp} value={f.zip} onChange={e => set('zip', e.target.value)} /></div>
        <div><label style={lbl}>Stadt</label><input style={inp} value={f.city} onChange={e => set('city', e.target.value)} /></div>
      </div>
      <div><label style={lbl}>Beschreibung</label><textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={f.description} onChange={e => set('description', e.target.value)} /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.published} onChange={e => set('published', e.target.checked)} /> Veröffentlicht (für Brautpaare sichtbar)
      </label>

      {editing && <VendorImages vendor={vendor!} uploadImage={uploadImage} />}

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnP} onClick={submit} disabled={busy}><Check size={15} /> {busy ? 'Speichert…' : editing ? 'Speichern' : 'Anlegen'}</button>
        <button style={btnS} onClick={onCancel}><X size={14} /> Abbrechen</button>
      </div>
    </div>
  )
}

// ── Logo + Galerie-Bilder (nur im Bearbeiten-Modus) ──────────────────────────
function VendorImages({ vendor, uploadImage }: { vendor: Vendor; uploadImage: (kind: 'logo' | 'photo', file: File) => Promise<string | null> }) {
  const [photos, setPhotos] = useState<{ id: string; url: string | null }[]>([])
  const [logoUrl, setLogoUrl] = useState<string | null>(vendor.logo_url)
  const [busy, setBusy] = useState(false)

  const loadPhotos = useCallback(async () => {
    const res = await fetch(`/api/admin/marketplace/vendors/${vendor.id}/photos`)
    const json = await res.json()
    setPhotos(json.photos ?? [])
  }, [vendor.id])
  useEffect(() => { loadPhotos() }, [loadPhotos])

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBusy(true)
    const key = await uploadImage('logo', file)
    if (key) {
      await fetch(`/api/admin/marketplace/vendors/${vendor.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo_r2_key: key }),
      })
      setLogoUrl(URL.createObjectURL(file))
    }
    setBusy(false)
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBusy(true)
    const key = await uploadImage('photo', file)
    if (key) {
      await fetch(`/api/admin/marketplace/vendors/${vendor.id}/photos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ r2_key: key }),
      })
      await loadPhotos()
    }
    setBusy(false)
  }

  async function removePhoto(id: string) {
    await fetch(`/api/admin/marketplace/vendors/${vendor.id}/photos/${id}`, { method: 'DELETE' })
    loadPhotos()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 56, height: 56, borderRadius: 8, background: '#f0f0f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {logoUrl ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: '#aaa' }}>Logo</span>}
        </div>
        <label style={{ ...btnS, cursor: busy ? 'wait' : 'pointer' }}>
          <ImagePlus size={14} /> Logo hochladen
          <input type="file" accept="image/*" hidden onChange={onLogo} />
        </label>
        <label style={{ ...btnS, cursor: busy ? 'wait' : 'pointer' }}>
          <ImagePlus size={14} /> Beispielfoto hinzufügen
          <input type="file" accept="image/*" hidden onChange={onPhoto} />
        </label>
      </div>
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {photos.map(p => (
            <div key={p.id} style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', background: '#f0f0f0' }}>
              {p.url && <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              <button onClick={() => removePhoto(p.id)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 100, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={12} color="#fff" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
