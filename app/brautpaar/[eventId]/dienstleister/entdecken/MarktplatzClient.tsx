'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, MapPin, X, Send, Check, Store } from 'lucide-react'
import { MARKETPLACE_CATEGORIES, categoryLabel } from '@/lib/marketplace/types'

interface VendorCard {
  id: string
  name: string
  company_name: string | null
  category: string
  city: string | null
  price_range: string | null
  description: string | null
  logo_url: string | null
}
interface VendorDetail extends VendorCard {
  email: string | null
  phone: string | null
  website: string | null
  street: string | null
  zip: string | null
  photos: { id: string; url: string | null }[]
}
interface Req { id: string; dienstleister_id: string; status: string; conversation_id: string | null }

export default function MarktplatzClient({ eventId }: { eventId: string }) {
  const [vendors, setVendors] = useState<VendorCard[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState<VendorDetail | null>(null)
  const [requests, setRequests] = useState<Req[]>([])

  const loadRequests = useCallback(async () => {
    const res = await fetch(`/api/marketplace/requests?eventId=${eventId}`)
    if (res.ok) setRequests((await res.json()).requests ?? [])
  }, [eventId])

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (category) sp.set('category', category)
    if (city.trim()) sp.set('city', city.trim())
    if (q.trim()) sp.set('q', q.trim())
    const res = await fetch(`/api/marketplace/vendors?${sp.toString()}`)
    const json = await res.json()
    setVendors(json.vendors ?? [])
    setLoading(false)
  }, [category, city, q])

  useEffect(() => { loadRequests() }, [loadRequests])
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  function requestFor(vendorId: string): Req | undefined {
    return requests.find(r => r.dienstleister_id === vendorId && (r.status === 'pending' || r.status === 'accepted'))
  }

  async function openDetail(id: string) {
    const res = await fetch(`/api/marketplace/vendors?id=${id}`)
    const json = await res.json()
    if (json.vendor) setDetail(json.vendor)
  }

  return (
    <div className="bp-page">
      <div className="bp-page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="bp-page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Store size={22} /> Dienstleister entdecken</h1>
        <p className="bp-page-subtitle">Finde Dienstleister für deine Hochzeit und stelle direkt eine Anfrage.</p>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <select className="bp-input" value={category} onChange={e => setCategory(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">Alle Kategorien</option>
          {MARKETPLACE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <div style={{ position: 'relative', flex: '1 1 160px' }}>
          <MapPin size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
          <input className="bp-input" placeholder="Ort / Stadt" value={city} onChange={e => setCity(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
          <input className="bp-input" placeholder="Suche…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#888' }}>Lädt…</p>
      ) : vendors.length === 0 ? (
        <p style={{ color: '#888' }}>Keine Dienstleister gefunden.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {vendors.map(v => {
            const req = requestFor(v.id)
            return (
              <button key={v.id} onClick={() => openDetail(v.id)} style={{ textAlign: 'left', border: '1px solid #eee', borderRadius: 14, overflow: 'hidden', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                <div style={{ height: 120, background: '#f3f1ec', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {v.logo_url
                    ? <img src={v.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Store size={32} color="#cbbf99" />}
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{v.company_name || v.name}</div>
                  <div style={{ fontSize: 12, color: '#888', margin: '2px 0 6px' }}>
                    {categoryLabel(v.category)}{v.city ? ` · ${v.city}` : ''}{v.price_range ? ` · ${v.price_range}` : ''}
                  </div>
                  {v.description && <p style={{ fontSize: 12.5, color: '#666', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.description}</p>}
                  {req && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, fontWeight: 700, color: req.status === 'accepted' ? '#1E7E34' : '#B26A00' }}>
                      <Check size={12} /> {req.status === 'accepted' ? 'Angenommen' : 'Anfrage gesendet'}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {detail && (
        <VendorDetailModal
          vendor={detail}
          eventId={eventId}
          existing={requestFor(detail.id)}
          onClose={() => setDetail(null)}
          onSent={() => { setDetail(null); loadRequests() }}
        />
      )}
    </div>
  )
}

function VendorDetailModal({ vendor, eventId, existing, onClose, onSent }: {
  vendor: VendorDetail; eventId: string; existing?: Req; onClose: () => void; onSent: () => void
}) {
  const [message, setMessage] = useState('')
  const [budget, setBudget] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function send() {
    setErr(''); setBusy(true)
    try {
      const res = await fetch('/api/marketplace/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, dienstleisterId: vendor.id, message, budget }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onSent()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%', marginTop: 30, overflow: 'hidden' }}>
        <div style={{ height: 160, background: '#f3f1ec', position: 'relative' }}>
          {vendor.logo_url && <img src={vendor.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 100, border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>{vendor.company_name || vendor.name}</h2>
          <div style={{ fontSize: 13, color: '#888', margin: '4px 0 12px' }}>
            {categoryLabel(vendor.category)}{vendor.city ? ` · ${vendor.city}` : ''}{vendor.price_range ? ` · ${vendor.price_range}` : ''}
          </div>
          {vendor.description && <p style={{ fontSize: 14, color: '#333', lineHeight: 1.5 }}>{vendor.description}</p>}

          {vendor.photos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '12px 0' }}>
              {vendor.photos.map(p => p.url && <img key={p.id} src={p.url} alt="" style={{ height: 100, borderRadius: 8, flexShrink: 0 }} />)}
            </div>
          )}

          <div style={{ fontSize: 13, color: '#555', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 16 }}>
            {(vendor.street || vendor.zip || vendor.city) && <span>{[vendor.street, [vendor.zip, vendor.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>}
            {vendor.website && <a href={vendor.website} target="_blank" rel="noreferrer" style={{ color: 'var(--gold, #B89968)' }}>{vendor.website}</a>}
          </div>

          {existing ? (
            <div style={{ background: '#E6F4EA', borderRadius: 10, padding: '12px 14px', fontSize: 13.5, color: '#1E7E34', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check size={16} /> {existing.status === 'accepted' ? 'Anfrage angenommen — ihr könnt im Chat schreiben.' : 'Anfrage bereits gesendet. Du wirst benachrichtigt, sobald geantwortet wird.'}
              {existing.status === 'accepted' && existing.conversation_id && (
                <Link href={`/brautpaar/${eventId}/chats`} style={{ marginLeft: 'auto', fontWeight: 700, color: '#1E7E34' }}>Zum Chat</Link>
              )}
            </div>
          ) : (
            <div style={{ borderTop: '1px solid #eee', paddingTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Anfrage stellen</p>
              {err && <p style={{ color: '#C62828', fontSize: 12.5 }}>{err}</p>}
              <textarea className="bp-input" placeholder="Beschreibt euer Anliegen, Wünsche, offene Fragen…" value={message} onChange={e => setMessage(e.target.value)} style={{ minHeight: 90, resize: 'vertical', marginBottom: 8 }} />
              <input className="bp-input" type="number" placeholder="Budget (optional, €)" value={budget} onChange={e => setBudget(e.target.value)} style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 11.5, color: '#999', marginBottom: 12 }}>Eure Event-Eckdaten (Datum, Ort, Gästezahl) werden automatisch mitgesendet.</p>
              <button onClick={send} disabled={busy} className="bp-btn bp-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Send size={15} /> {busy ? 'Sendet…' : 'Anfrage senden'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
