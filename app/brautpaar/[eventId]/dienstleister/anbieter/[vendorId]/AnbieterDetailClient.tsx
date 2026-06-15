'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, MapPin, Globe, Phone, Mail, Star, Send, Check, X, MessageSquare } from 'lucide-react'
import { categoryLabel } from '@/lib/marketplace/types'
import CategoryIcon from '@/components/marketplace/CategoryIcon'

interface Vendor {
  id: string; name: string; company_name: string | null; category: string
  email: string | null; phone: string | null; website: string | null; description: string | null
  street: string | null; zip: string | null; city: string | null; price_range: string | null
  logo_url: string | null; photos: { id: string; url: string }[]
}
interface Existing { id: string; status: string; conversation_id: string | null }

export default function AnbieterDetailClient({ eventId, vendor, existing }: { eventId: string; vendor: Vendor; existing: Existing | null }) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [budget, setBudget] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState<Existing | null>(existing)

  const addressParts = [vendor.street, [vendor.zip, vendor.city].filter(Boolean).join(' ')].filter(Boolean)
  const address = addressParts.join(', ')
  const hero = vendor.photos[0]?.url ?? vendor.logo_url
  const rest = vendor.photos.slice(1)

  async function send() {
    setErr(''); setBusy(true)
    try {
      const res = await fetch('/api/marketplace/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, dienstleisterId: vendor.id, message, budget }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSent({ id: json.id, status: 'pending', conversation_id: null })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fehler')
    } finally { setBusy(false) }
  }

  return (
    <div className="bp-page">
      <Link href={`/brautpaar/${eventId}/dienstleister`} className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, width: 'fit-content' }}>
        <ChevronLeft size={16} /> Zurück zum Marktplatz
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 28, alignItems: 'start' }} className="mp-detail-grid">
        {/* ── Hauptspalte ── */}
        <div>
          {/* Hero */}
          <div style={{ aspectRatio: '16/9', borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(135deg, var(--bp-gold-pale), var(--bp-ivory-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hero ? 'zoom-in' : 'default' }}
            onClick={() => hero && setLightbox(hero)}>
            {hero
              ? <img src={hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ color: 'var(--bp-gold-deep)', opacity: 0.5 }}><CategoryIcon category={vendor.category} size={64} /></div>}
          </div>

          {/* Thumbnails */}
          {rest.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              {rest.map(p => (
                <button key={p.id} onClick={() => setLightbox(p.url)} style={{ width: 96, height: 72, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--bp-rule)', cursor: 'zoom-in', padding: 0, background: 'none' }}>
                  <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}

          {/* Kopf */}
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--bp-gold-deep)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              <CategoryIcon category={vendor.category} size={14} /> {categoryLabel(vendor.category)}
            </div>
            <h1 className="bp-font-heading" style={{ fontSize: '2.1rem', fontWeight: 600, margin: '6px 0 8px', color: 'var(--bp-ink)', lineHeight: 1.15 }}>
              {vendor.company_name || vendor.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--bp-gold)' }}>
                {[0, 1, 2, 3, 4].map(i => <Star key={i} size={15} />)}
                <span style={{ fontSize: 12, color: 'var(--bp-ink-3)', marginLeft: 4 }}>Noch keine Bewertungen</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {vendor.city && <span className="bp-badge bp-badge-neutral" style={{ gap: 4 }}><MapPin size={11} /> {vendor.city}</span>}
              {vendor.price_range && <span className="bp-badge bp-badge-neutral">Preisklasse {vendor.price_range}</span>}
            </div>
          </div>

          {vendor.description && (
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--bp-ink-2)', margin: '18px 0 0' }}>{vendor.description}</p>
          )}

          {/* Standort-Karte */}
          {address && (
            <div style={{ marginTop: 26 }}>
              <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 10px' }}>Standort</h3>
              <p style={{ fontSize: 13.5, color: 'var(--bp-ink-2)', margin: '0 0 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> {address}</p>
              <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--bp-rule)' }}>
                <iframe
                  title="Standort"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                  style={{ width: '100%', height: 260, border: 0 }}
                  loading="lazy"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky Anfrage + Kontakt ── */}
        <aside style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 14 }} className="mp-detail-aside">
          <div className="bp-card" style={{ padding: 18 }}>
            {sent ? (
              <div style={{ background: '#E6F4EA', borderRadius: 10, padding: '14px 16px', fontSize: 13.5, color: '#1E7E34' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 4 }}>
                  <Check size={16} /> {sent.status === 'accepted' ? 'Anfrage angenommen' : 'Anfrage gesendet'}
                </div>
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  {sent.status === 'accepted'
                    ? 'Ihr könnt jetzt im Chat schreiben.'
                    : 'Ihr werdet benachrichtigt, sobald der Dienstleister antwortet.'}
                </p>
                {sent.status === 'accepted' && (
                  <Link href={`/brautpaar/${eventId}/nachrichten`} className="bp-btn bp-btn-primary" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                    <MessageSquare size={15} /> Zum Chat
                  </Link>
                )}
              </div>
            ) : (
              <>
                <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 4px' }}>Anfrage stellen</h3>
                <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 12px' }}>Eure Event-Eckdaten (Datum, Ort, Gästezahl) werden automatisch mitgesendet.</p>
                {err && <p style={{ color: '#C62828', fontSize: 12.5, margin: '0 0 8px' }}>{err}</p>}
                <textarea className="bp-textarea" placeholder="Beschreibt euer Anliegen, Wünsche, offene Fragen…" value={message} onChange={e => setMessage(e.target.value)} style={{ minHeight: 96, marginBottom: 8 }} />
                <input className="bp-input" type="number" placeholder="Budget (optional, €)" value={budget} onChange={e => setBudget(e.target.value)} style={{ marginBottom: 12 }} />
                <button onClick={send} disabled={busy} className="bp-btn bp-btn-primary" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Send size={15} /> {busy ? 'Sendet…' : 'Anfrage senden'}
                </button>
              </>
            )}
          </div>

          {/* Kontaktbox */}
          {(vendor.website || vendor.phone || vendor.email) && (
            <div className="bp-card" style={{ padding: 18 }}>
              <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: '0 0 10px' }}>Kontakt</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
                {vendor.website && <a href={vendor.website} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bp-gold-deep)', textDecoration: 'none' }}><Globe size={14} /> Website</a>}
                {vendor.phone && <a href={`tel:${vendor.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bp-ink-2)', textDecoration: 'none' }}><Phone size={14} /> {vendor.phone}</a>}
                {vendor.email && <a href={`mailto:${vendor.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bp-ink-2)', textDecoration: 'none' }}><Mail size={14} /> {vendor.email}</a>}
              </div>
            </div>
          )}
        </aside>
      </div>

      <style>{`@media (max-width: 880px){ .mp-detail-grid{ grid-template-columns:1fr !important; } .mp-detail-aside{ position:static !important; } }`}</style>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
