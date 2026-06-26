'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Check, Star, BadgeCheck, SlidersHorizontal, X, MapPin } from 'lucide-react'
import { MARKETPLACE_CATEGORIES, categoryLabel } from '@/lib/marketplace/types'
import CategoryIcon from '@/components/marketplace/CategoryIcon'

interface VendorCard {
  id: string
  company_name: string | null
  category: string
  city: string | null
  price_range: string | null
  description: string | null
  logo_url: string | null
  cover_url: string | null
  verified?: boolean
  tier?: string
  service_cities: string[]
  service_radius_km: number | null
}
interface Req { id: string; dienstleister_id: string; status: string }

type SortField = 'name' | 'city' | 'price'
const PRICE_ORDER: Record<string, number> = { '€': 1, '€€': 2, '€€€': 3 }

interface FilterState {
  category: string
  sortKey: string
}
const DEFAULT_FILTER: FilterState = { category: '', sortKey: 'name_asc' }
const STORAGE_KEY = 'mk_filter'

const SORT_OPTIONS: { key: string; label: string; field: SortField; dir: 'asc' | 'desc' }[] = [
  { key: 'name_asc',   label: 'Name (A–Z)',             field: 'name',  dir: 'asc' },
  { key: 'name_desc',  label: 'Name (Z–A)',             field: 'name',  dir: 'desc' },
  { key: 'city_asc',   label: 'Ort (A–Z)',              field: 'city',  dir: 'asc' },
  { key: 'price_asc',  label: 'Preis (aufsteigend)',    field: 'price', dir: 'asc' },
  { key: 'price_desc', label: 'Preis (absteigend)',     field: 'price', dir: 'desc' },
]

const SORTED_CATEGORIES = [...MARKETPLACE_CATEGORIES].sort((a, b) => a.label.localeCompare(b.label, 'de'))

function loadStored(): FilterState {
  try { return { ...DEFAULT_FILTER, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } }
  catch { return DEFAULT_FILTER }
}

export default function MarktplatzClient({ eventId }: { eventId: string }) {
  const [vendors, setVendors] = useState<VendorCard[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [requests, setRequests] = useState<Req[]>([])
  const [eventCity, setEventCity] = useState<string | null>(null)

  const [panelOpen, setPanelOpen] = useState(false)
  const [applied, setApplied] = useState<FilterState>(DEFAULT_FILTER)
  const [pending, setPending] = useState<FilterState>(DEFAULT_FILTER)

  useEffect(() => {
    setApplied(loadStored())
  }, [])

  function openPanel() { setPending(applied); setPanelOpen(true) }
  function applyFilter() {
    setApplied(pending)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
    setPanelOpen(false)
  }
  function resetFilter() {
    setApplied(DEFAULT_FILTER)
    setPending(DEFAULT_FILTER)
    localStorage.removeItem(STORAGE_KEY)
    setPanelOpen(false)
  }

  useEffect(() => {
    if (!panelOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanelOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [panelOpen])

  const loadRequests = useCallback(async () => {
    const res = await fetch(`/api/marketplace/requests?eventId=${eventId}`)
    if (res.ok) setRequests((await res.json()).requests ?? [])
  }, [eventId])

  const loadEvent = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}`)
    if (res.ok) {
      const d = await res.json()
      setEventCity(d.location_city ?? null)
    }
  }, [eventId])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/marketplace/vendors')
    const json = await res.json()
    setVendors(json.vendors ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadRequests(); loadEvent() }, [loadRequests, loadEvent])
  useEffect(() => { load() }, [load])

  function requestFor(vendorId: string): Req | undefined {
    return requests.find(r => r.dienstleister_id === vendorId && (r.status === 'pending' || r.status === 'accepted'))
  }

  const hasActiveFilter = applied.category !== '' || applied.sortKey !== 'name_asc'

  const sortOpt = useMemo(() => SORT_OPTIONS.find(s => s.key === applied.sortKey) ?? SORT_OPTIONS[0], [applied.sortKey])

  const filtered = useMemo(() => {
    let list = vendors

    if (q.trim()) {
      const qLow = q.trim().toLowerCase()
      list = list.filter(v =>
        (v.company_name?.toLowerCase().includes(qLow)) ||
        (v.description?.toLowerCase().includes(qLow))
      )
    }

    if (applied.category) {
      list = list.filter(v => v.category === applied.category)
    }

    // Automatic location filter: vendors with service_cities must include event city
    if (eventCity) {
      const ecLow = eventCity.toLowerCase().trim()
      list = list.filter(v => {
        if (!v.service_cities || v.service_cities.length === 0) return true
        return v.service_cities.some(c =>
          c.toLowerCase().includes(ecLow) || ecLow.includes(c.toLowerCase())
        )
      })
    }

    const sorted = [...list]
    if (sortOpt.field === 'city') {
      sorted.sort((a, b) => {
        const cmp = (a.city ?? '').localeCompare(b.city ?? '', 'de')
        return sortOpt.dir === 'asc' ? cmp : -cmp
      })
    } else if (sortOpt.field === 'price') {
      sorted.sort((a, b) => {
        const cmp = (PRICE_ORDER[a.price_range ?? ''] ?? 9) - (PRICE_ORDER[b.price_range ?? ''] ?? 9)
        return sortOpt.dir === 'asc' ? cmp : -cmp
      })
    } else {
      sorted.sort((a, b) => {
        const cmp = (a.company_name || '').localeCompare(b.company_name || '', 'de')
        return sortOpt.dir === 'asc' ? cmp : -cmp
      })
    }

    return sorted
  }, [vendors, q, applied, eventCity, sortOpt])

  return (
    <div>
      <style>{`
        .mp-card { display:flex; flex-direction:column; border:1px solid var(--bp-rule,#eee); border-radius:16px; overflow:hidden; background:#fff; text-decoration:none; color:inherit; transition:box-shadow .2s ease, transform .2s ease, border-color .2s ease; }
        .mp-card:hover { box-shadow:0 14px 34px rgba(0,0,0,0.10); transform:translateY(-3px); border-color:var(--bp-gold-mist,#e5dcc6); }
        .mp-media { position:relative; aspect-ratio:4/3; overflow:hidden; background:linear-gradient(135deg, var(--bp-gold-pale,#f3efe6), var(--bp-ivory-2,#efe9dd)); }
        .mp-media img { width:100%; height:100%; object-fit:cover; transition:transform .35s ease; }
        .mp-card:hover .mp-media img { transform:scale(1.06); }
        .mp-radio { display:flex; flex-direction:column; gap:2px; }
        .mp-radio-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:8px; cursor:pointer; border:none; background:none; width:100%; text-align:left; font-family:inherit; font-size:13.5px; color:var(--bp-ink,#2C2825); transition:background .12s; }
        .mp-radio-item:hover { background:var(--bp-ivory-2,#F0F0EE); }
        .mp-radio-item[data-active="true"] { background:var(--bp-gold-pale,#F5F0E8); font-weight:600; }
        .mp-radio-dot { width:16px; height:16px; border-radius:50%; border:2px solid var(--bp-rule-gold,#D4BC9A); flex-shrink:0; display:flex; align-items:center; justify-content:center; }
        .mp-radio-item[data-active="true"] .mp-radio-dot { border-color:var(--bp-gold,#B89968); background:var(--bp-gold,#B89968); }
        .mp-radio-dot-inner { width:6px; height:6px; border-radius:50%; background:#fff; }
        .mp-panel-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--bp-ink-3,#8C8076); margin:0 0 6px; padding:0 12px; }
        .mp-divider { height:1px; background:var(--bp-rule,#E8E8E6); margin:16px 0; }
      `}</style>

      {/* Search + Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--bp-ink-3,#8C8076)', pointerEvents: 'none' }} />
          <input
            className="bp-input"
            placeholder="Dienstleister suchen…"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <button
          onClick={openPanel}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '10px 16px', flexShrink: 0, position: 'relative',
            border: `1px solid ${hasActiveFilter ? 'var(--bp-rule-gold,#D4BC9A)' : 'var(--bp-rule,#E8E8E6)'}`,
            background: hasActiveFilter ? 'var(--bp-gold-pale,#F5F0E8)' : '#fff',
            borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13.5, fontWeight: 600, color: 'var(--bp-ink,#2C2825)',
          }}
          onMouseEnter={e => { if (!hasActiveFilter) e.currentTarget.style.borderColor = 'var(--bp-rule-gold,#D4BC9A)' }}
          onMouseLeave={e => { if (!hasActiveFilter) e.currentTarget.style.borderColor = 'var(--bp-rule,#E8E8E6)' }}
        >
          {hasActiveFilter && (
            <span style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: '50%', background: 'var(--bp-gold,#B89968)', border: '1.5px solid #fff' }} />
          )}
          <SlidersHorizontal size={15} />
          Filter
        </button>
      </div>

      {/* Result counter */}
      <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3,#8C8076)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {loading ? ' ' : (
          <>
            <span>{filtered.length} {filtered.length === 1 ? 'Dienstleister' : 'Dienstleister'} gefunden</span>
            {hasActiveFilter && (
              <button onClick={resetFilter} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--bp-gold-deep,#9C7F4F)', padding: 0, fontWeight: 600 }}>
                Zurücksetzen
              </button>
            )}
          </>
        )}
      </p>

      {/* Grid */}
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
      ) : filtered.length === 0 ? (
        <div className="bp-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Keine Dienstleister gefunden</p>
          <p className="bp-caption" style={{ margin: 0 }}>Passe Kategorie oder Suchbegriff an.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
          {filtered.map(v => {
            const req = requestFor(v.id)
            return (
              <Link key={v.id} href={`/brautpaar/${eventId}/dienstleister/anbieter/${v.id}`} className="mp-card">
                <div className="mp-media">
                  {v.cover_url
                    ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.cover_url} alt="" />
                    )
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bp-gold-deep,#8a6f3f)', opacity: 0.5 }}><CategoryIcon category={v.category} size={48} /></div>}
                  {v.logo_url && v.cover_url && v.logo_url !== v.cover_url && (
                    <span style={{ position: 'absolute', left: 12, bottom: 12, width: 40, height: 40, borderRadius: 10, overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', background: '#fff' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  <h3 className="bp-font-heading" style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--bp-ink)', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {v.company_name || 'Anbieter'}
                    {v.verified && <BadgeCheck size={16} style={{ color: '#15803D', flexShrink: 0 }} aria-label="Verifiziert" />}
                  </h3>
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

      {/* Overlay */}
      <div
        onClick={() => setPanelOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)',
          opacity: panelOpen ? 1 : 0,
          pointerEvents: panelOpen ? 'auto' : 'none',
          transition: 'opacity .22s ease',
        }}
      />

      {/* Filter flyout */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 320,
        background: '#fff', zIndex: 50,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .26s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid var(--bp-rule,#E8E8E6)' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--bp-ink,#2C2825)' }}>Filter & Sortierung</span>
          <button onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--bp-ink-3,#8C8076)', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 8px' }}>

          {/* Kategorie */}
          <p className="mp-panel-section-title">Kategorie</p>
          <div className="mp-radio">
            <button
              className="mp-radio-item"
              data-active={pending.category === ''}
              onClick={() => setPending(p => ({ ...p, category: '' }))}
            >
              <span className="mp-radio-dot">{pending.category === '' && <span className="mp-radio-dot-inner" />}</span>
              Alle Kategorien
            </button>
            {SORTED_CATEGORIES.map(c => (
              <button
                key={c.key}
                className="mp-radio-item"
                data-active={pending.category === c.key}
                onClick={() => setPending(p => ({ ...p, category: c.key }))}
              >
                <span className="mp-radio-dot">{pending.category === c.key && <span className="mp-radio-dot-inner" />}</span>
                {c.label}
              </button>
            ))}
          </div>

          <div className="mp-divider" />

          {/* Sortierung */}
          <p className="mp-panel-section-title">Sortierung</p>
          <div className="mp-radio">
            {SORT_OPTIONS.map(s => (
              <button
                key={s.key}
                className="mp-radio-item"
                data-active={pending.sortKey === s.key}
                onClick={() => setPending(p => ({ ...p, sortKey: s.key }))}
              >
                <span className="mp-radio-dot">{pending.sortKey === s.key && <span className="mp-radio-dot-inner" />}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--bp-rule,#E8E8E6)', display: 'flex', gap: 10 }}>
          <button
            onClick={resetFilter}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--bp-rule,#E8E8E6)',
              background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13.5, fontWeight: 600, color: 'var(--bp-ink-2,#5C534A)',
            }}
          >
            Zurücksetzen
          </button>
          <button
            onClick={applyFilter}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 10, border: 'none',
              background: 'var(--bp-gold,#B89968)', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13.5, fontWeight: 600, color: '#fff',
            }}
          >
            Anwenden
          </button>
        </div>
      </aside>
    </div>
  )
}
