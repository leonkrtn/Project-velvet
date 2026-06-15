'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, MapPin, Check, Star, ArrowUpDown } from 'lucide-react'
import { MARKETPLACE_CATEGORIES, categoryLabel } from '@/lib/marketplace/types'
import CategoryIcon from '@/components/marketplace/CategoryIcon'

interface VendorCard {
  id: string
  name: string
  company_name: string | null
  category: string
  city: string | null
  price_range: string | null
  description: string | null
  logo_url: string | null
  cover_url: string | null
}
interface Req { id: string; dienstleister_id: string; status: string }

type Sort = 'name' | 'city' | 'price'
const PRICE_ORDER: Record<string, number> = { '€': 1, '€€': 2, '€€€': 3 }

export default function MarktplatzClient({ eventId }: { eventId: string }) {
  const [vendors, setVendors] = useState<VendorCard[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('name')
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

  const sorted = [...vendors].sort((a, b) => {
    if (sort === 'city') return (a.city ?? '').localeCompare(b.city ?? '', 'de')
    if (sort === 'price') return (PRICE_ORDER[a.price_range ?? ''] ?? 9) - (PRICE_ORDER[b.price_range ?? ''] ?? 9)
    return (a.company_name || a.name).localeCompare(b.company_name || b.name, 'de')
  })

  return (
    <div>
      <style>{`
        .mp-card { display:flex; flex-direction:column; border:1px solid var(--bp-rule,#eee); border-radius:16px; overflow:hidden; background:#fff; text-decoration:none; color:inherit; transition:box-shadow .2s ease, transform .2s ease, border-color .2s ease; }
        .mp-card:hover { box-shadow:0 14px 34px rgba(0,0,0,0.10); transform:translateY(-3px); border-color:var(--bp-gold-mist,#e5dcc6); }
        .mp-media { position:relative; aspect-ratio:4/3; overflow:hidden; background:linear-gradient(135deg, var(--bp-gold-pale,#f3efe6), var(--bp-ivory-2,#efe9dd)); }
        .mp-media img { width:100%; height:100%; object-fit:cover; transition:transform .35s ease; }
        .mp-card:hover .mp-media img { transform:scale(1.06); }
        .mp-chip { display:inline-flex; align-items:center; justify-content:center; line-height:1; gap:6px; padding:8px 14px; border-radius:999px; border:1px solid var(--bp-rule,#e5e0d8); background:#fff; cursor:pointer; font-family:inherit; font-size:13px; font-weight:600; color:var(--bp-ink-2,#555); white-space:nowrap; transition:all .15s ease; }
        .mp-chip:hover { border-color:var(--bp-gold,#b89968); color:var(--bp-gold-deep,#8a6f3f); }
        .mp-chip[data-active="true"] { background:var(--bp-gold,#b89968); border-color:var(--bp-gold,#b89968); color:#fff; }
      `}</style>

      {/* Kategorie-Schnellfilter als Chips mit Icons */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 16 }}>
        <button className="mp-chip" data-active={category === ''} onClick={() => setCategory('')}>Alle</button>
        {MARKETPLACE_CATEGORIES.map(c => (
          <button key={c.key} className="mp-chip" data-active={category === c.key} onClick={() => setCategory(category === c.key ? '' : c.key)}>
            <CategoryIcon category={c.key} size={14} /> {c.label}
          </button>
        ))}
      </div>

      {/* Suche / Ort / Sortierung */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
          <input className="bp-input" placeholder="Dienstleister suchen…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <div style={{ position: 'relative', flex: '1 1 160px' }}>
          <MapPin size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
          <input className="bp-input" placeholder="Ort / Stadt" value={city} onChange={e => setCity(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <div style={{ position: 'relative', flex: '0 0 190px' }}>
          <ArrowUpDown size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
          <select className="bp-input" value={sort} onChange={e => setSort(e.target.value as Sort)} style={{ paddingLeft: 32 }}>
            <option value="name">Name (A–Z)</option>
            <option value="city">Ort (A–Z)</option>
            <option value="price">Preis (aufsteigend)</option>
          </select>
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3,#888)', margin: '0 0 16px' }}>
        {loading ? ' ' : `${sorted.length} ${sorted.length === 1 ? 'Dienstleister' : 'Dienstleister'} gefunden`}
      </p>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ border: '1px solid var(--bp-rule,#eee)', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
              <div className="bp-skeleton" style={{ aspectRatio: '4/3', borderRadius: 0 }} />
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="bp-skeleton" style={{ height: 11, width: '40%' }} />
                <div className="bp-skeleton" style={{ height: 18, width: '75%' }} />
                <div className="bp-skeleton" style={{ height: 12, width: '55%' }} />
                <div className="bp-skeleton" style={{ height: 12, width: '90%' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <div className="bp-skeleton" style={{ height: 18, width: 64, borderRadius: 999 }} />
                  <div className="bp-skeleton" style={{ height: 18, width: 34, borderRadius: 999 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bp-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Keine Dienstleister gefunden</p>
          <p className="bp-caption" style={{ margin: 0 }}>Passe Kategorie, Ort oder Suchbegriff an.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
          {sorted.map(v => {
            const req = requestFor(v.id)
            return (
              <Link key={v.id} href={`/brautpaar/${eventId}/dienstleister/anbieter/${v.id}`} className="mp-card">
                <div className="mp-media">
                  {v.cover_url
                    ? <img src={v.cover_url} alt="" />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bp-gold-deep,#8a6f3f)', opacity: 0.5 }}><CategoryIcon category={v.category} size={48} /></div>}
                  {/* Logo-Badge unten links, wenn zusätzlich ein Logo existiert */}
                  {v.logo_url && v.cover_url && v.logo_url !== v.cover_url && (
                    <span style={{ position: 'absolute', left: 12, bottom: 12, width: 40, height: 40, borderRadius: 10, overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', background: '#fff' }}>
                      <img src={v.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </span>
                  )}
                  {req && (
                    <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 11, fontWeight: 700, lineHeight: 1, padding: '5px 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4, background: req.status === 'accepted' ? '#1E7E34' : 'rgba(0,0,0,0.65)', color: '#fff' }}>
                      <Check size={12} /> {req.status === 'accepted' ? 'Angenommen' : 'Angefragt'}
                    </span>
                  )}
                </div>
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--bp-gold-deep,#8a6f3f)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <CategoryIcon category={v.category} size={13} /> {categoryLabel(v.category)}
                  </div>
                  <h3 className="bp-font-heading" style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--bp-ink)', lineHeight: 1.2 }}>
                    {v.company_name || v.name}
                  </h3>
                  {/* Sterne-Platzhalter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--bp-gold,#b89968)' }}>
                    {[0, 1, 2, 3, 4].map(i => <Star key={i} size={13} />)}
                    <span style={{ fontSize: 11, color: 'var(--bp-ink-3,#999)', marginLeft: 2 }}>Neu</span>
                  </div>
                  {v.description && <p style={{ fontSize: 12.5, color: 'var(--bp-ink-2,#666)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.description}</p>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 6 }}>
                    {v.city && <span className="bp-badge bp-badge-neutral" style={{ gap: 4 }}><MapPin size={11} /> {v.city}</span>}
                    {v.price_range && <span className="bp-badge bp-badge-neutral">{v.price_range}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
