'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ReceiptText, FileText, Check, X, Clock, Copy, ChevronRight,
  Loader2, Search, SlidersHorizontal, ArrowUp, ArrowDown, RotateCcw, Plus,
} from 'lucide-react'
import { formatMoney } from '@/lib/vendor/questionnaire'

interface OfferRow {
  id: string
  title: string
  status: 'draft' | 'released' | 'accepted' | 'declined' | 'superseded'
  version: number
  total: number
  currency: string
  valid_until: string | null
  request_id: string | null
  updated_at: string
  event_id: string | null
  events: { title: string; date: string | null; couple_name: string | null } | null
}

const STATUS_META: Record<OfferRow['status'], { label: string; bg: string; fg: string; icon: React.ReactNode }> = {
  draft:      { label: 'Entwurf',    bg: 'rgba(0,0,0,0.05)',       fg: '#666',    icon: <FileText size={13} /> },
  released:   { label: 'Versendet',  bg: 'rgba(184,153,104,0.16)', fg: '#9a7b3f', icon: <Clock size={13} /> },
  accepted:   { label: 'Angenommen', bg: 'rgba(30,126,52,0.12)',   fg: '#1E7E34', icon: <Check size={13} /> },
  declined:   { label: 'Abgelehnt',  bg: 'rgba(197,34,31,0.10)',   fg: '#C5221F', icon: <X size={13} /> },
  superseded: { label: 'Ersetzt',    bg: 'rgba(0,0,0,0.04)',       fg: '#999',    icon: <Copy size={13} /> },
}

const GROUPS: { key: OfferRow['status']; label: string }[] = [
  { key: 'draft',    label: 'Entwürfe' },
  { key: 'released', label: 'Versendet' },
  { key: 'accepted', label: 'Angenommen' },
  { key: 'declined', label: 'Abgelehnt' },
]

const ALL_STATUSES: OfferRow['status'][] = ['draft', 'released', 'accepted', 'declined']

const PRICE_RANGES = [
  { key: '',           label: 'Alle Preise' },
  { key: 'lt1000',     label: 'Unter 1.000 €' },
  { key: '1000-5000',  label: '1.000 – 5.000 €' },
  { key: '5000-10000', label: '5.000 – 10.000 €' },
  { key: 'gt10000',    label: 'Über 10.000 €' },
]

const DATE_RANGES = [
  { key: '',          label: 'Alle Zeiträume' },
  { key: 'past',      label: 'Vergangene Events' },
  { key: 'this_year', label: 'Dieses Jahr' },
  { key: 'next_year', label: 'Nächstes Jahr' },
  { key: 'future',    label: 'Zukünftige Events' },
]

const SORT_OPTIONS = [
  { key: 'updated_at',  label: 'Zuletzt aktualisiert', defaultDir: 'desc' as const },
  { key: 'total',       label: 'Angebotswert',          defaultDir: 'desc' as const },
  { key: 'event_date',  label: 'Event-Datum',           defaultDir: 'asc'  as const },
  { key: 'couple_name', label: 'Brautpaar-Name',        defaultDir: 'asc'  as const },
] as const

type SortField = typeof SORT_OPTIONS[number]['key']

interface FilterState {
  statuses: OfferRow['status'][]
  priceRange: string
  dateRange: string
  sortField: SortField
  sortDir: 'asc' | 'desc'
}

const DEFAULT_FILTER: FilterState = {
  statuses: [],
  priceRange: '',
  dateRange: '',
  sortField: 'updated_at',
  sortDir: 'desc',
}

const STORAGE_KEY = 'vdr_angebote_filter'

function loadFilter(): FilterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_FILTER
    return { ...DEFAULT_FILTER, ...JSON.parse(raw) }
  } catch { return DEFAULT_FILTER }
}

function isDefaultFilter(f: FilterState): boolean {
  return (
    f.statuses.length === 0 &&
    f.priceRange === '' &&
    f.dateRange === '' &&
    f.sortField === 'updated_at' &&
    f.sortDir === 'desc'
  )
}

function matchesPrice(total: number, range: string): boolean {
  if (!range) return true
  if (range === 'lt1000')     return total < 1000
  if (range === '1000-5000')  return total >= 1000 && total <= 5000
  if (range === '5000-10000') return total > 5000 && total <= 10000
  if (range === 'gt10000')    return total > 10000
  return true
}

function matchesDate(eventDate: string | null, range: string): boolean {
  if (!range) return true
  if (!eventDate) return false
  const d = new Date(eventDate)
  const now = new Date()
  const thisYear = now.getFullYear()
  if (range === 'past')      return d < now
  if (range === 'this_year') return d.getFullYear() === thisYear
  if (range === 'next_year') return d.getFullYear() === thisYear + 1
  if (range === 'future')    return d >= now
  return true
}

interface EventOption { id: string; title: string | null; date: string | null; couple_name: string | null }

export default function AngeboteGlobalClient() {
  const router = useRouter()
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [applied, setApplied] = useState<FilterState>(DEFAULT_FILTER)
  const [pending, setPending] = useState<FilterState>(DEFAULT_FILTER)

  // New offer creation
  const [createOpen, setCreateOpen] = useState(false)
  const [events, setEvents] = useState<EventOption[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  // null = standalone (no event), EventOption = event-linked
  const [pickedEvent, setPickedEvent] = useState<EventOption | 'standalone' | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const saved = loadFilter()
    setApplied(saved)
    setPending(saved)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch('/api/vendor/global-offers')
    const d = await res.json().catch(() => ({}))
    setOffers(d.offers ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!panelOpen && !createOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPanelOpen(false); setCreateOpen(false); setPickedEvent(null) } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [panelOpen, createOpen])

  async function openCreate() {
    setCreateOpen(true)
    setPickedEvent(null)
    if (events.length === 0) {
      setEventsLoading(true)
      const res = await fetch('/api/vendor/my-events')
      const d = await res.json().catch(() => ({}))
      setEvents(d.events ?? [])
      setEventsLoading(false)
    }
  }

  async function createOffer(source: 'questionnaire' | 'blank') {
    if (pickedEvent === null) return
    setCreating(true)
    const isStandalone = pickedEvent === 'standalone'
    const res = await fetch('/api/vendor/event-offers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: isStandalone ? null : pickedEvent.id, source }),
    })
    const d = await res.json().catch(() => ({}))
    setCreating(false)
    if (d.id) {
      if (isStandalone) {
        router.push(`/vendor/angebote/${d.id}`)
      } else {
        router.push(`/vendor/dashboard/${(pickedEvent as EventOption).id}/angebote/${d.id}`)
      }
    }
  }

  function openPanel() { setPending(applied); setPanelOpen(true) }

  function applyFilter() {
    setApplied(pending)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
    setPanelOpen(false)
  }

  function resetPending() { setPending(DEFAULT_FILTER) }

  function resetApplied() {
    setApplied(DEFAULT_FILTER)
    setPending(DEFAULT_FILTER)
    localStorage.removeItem(STORAGE_KEY)
  }

  function toggleStatus(s: OfferRow['status']) {
    setPending(prev => ({
      ...prev,
      statuses: prev.statuses.includes(s)
        ? prev.statuses.filter(x => x !== s)
        : [...prev.statuses, s],
    }))
  }

  function toggleSort(field: SortField, defaultDir: 'asc' | 'desc') {
    setPending(prev => ({
      ...prev,
      sortField: field,
      sortDir: prev.sortField === field
        ? (prev.sortDir === 'asc' ? 'desc' : 'asc')
        : defaultDir,
    }))
  }

  const result = useMemo(() => {
    let list = offers

    if (search.trim()) {
      const q = search.trim().toUpperCase()
      list = list.filter(o => {
        const ev = o.events
        return (
          o.title.toUpperCase().includes(q) ||
          (ev?.couple_name ?? '').toUpperCase().includes(q) ||
          (ev?.title ?? '').toUpperCase().includes(q) ||
          o.id.toUpperCase().includes(q) ||
          (ev?.date ? new Date(ev.date).toLocaleDateString('de-DE') : '').includes(q)
        )
      })
    }

    if (applied.statuses.length > 0)
      list = list.filter(o => applied.statuses.includes(o.status))

    if (applied.priceRange)
      list = list.filter(o => matchesPrice(o.total, applied.priceRange))

    if (applied.dateRange)
      list = list.filter(o => matchesDate(o.events?.date ?? null, applied.dateRange))

    return [...list].sort((a, b) => {
      let cmp = 0
      if (applied.sortField === 'updated_at') {
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      } else if (applied.sortField === 'total') {
        cmp = a.total - b.total
      } else if (applied.sortField === 'event_date') {
        const da = a.events?.date ? new Date(a.events.date).getTime() : 0
        const db = b.events?.date ? new Date(b.events.date).getTime() : 0
        cmp = da - db
      } else if (applied.sortField === 'couple_name') {
        const na = (a.events?.couple_name ?? a.events?.title ?? '').toLowerCase()
        const nb = (b.events?.couple_name ?? b.events?.title ?? '').toLowerCase()
        cmp = na.localeCompare(nb, 'de')
      }
      return applied.sortDir === 'asc' ? cmp : -cmp
    })
  }, [offers, search, applied])

  const grouped = useMemo(() => {
    const map: Record<string, OfferRow[]> = {}
    for (const o of result) (map[o.status] ??= []).push(o)
    return map
  }, [result])

  const hasAny = offers.length > 0
  const hasActiveFilter = !isDefaultFilter(applied)
  const visibleGroups = applied.statuses.length > 0
    ? GROUPS.filter(g => applied.statuses.includes(g.key))
    : GROUPS

  return (
    <>
      <div style={{ background: 'var(--bg)', flex: 1, padding: '28px 24px 48px', overflow: 'auto' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ReceiptText size={20} style={{ color: 'var(--gold)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Angebote</h1>
              <p style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 2 }}>Alle Angebote über alle Events hinweg.</p>
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={openCreate}
                disabled={creating}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9,
                  background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
                }}
              >
                {creating ? <Loader2 size={15} className="ang-spin" /> : <Plus size={16} />} Neues Angebot
              </button>
            </div>
          </div>

          {/* Search + Filter trigger */}
          {!loading && hasAny && (
            <div data-tour="vdr-angebote-search" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Nach Brautpaar, Datum oder Angebots-ID suchen …"
                  style={{ width: '100%', padding: '10px 14px 10px 34px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: 'var(--text)' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <button
                onClick={openPanel}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 16px', flexShrink: 0,
                  border: `1px solid ${hasActiveFilter ? 'var(--accent)' : 'var(--border)'}`,
                  background: hasActiveFilter ? 'rgba(35,82,200,0.07)' : 'var(--bg)',
                  borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 600,
                  color: hasActiveFilter ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'border-color .15s, box-shadow .15s',
                  position: 'relative',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = hasActiveFilter ? 'var(--accent)' : 'var(--border)' }}
              >
                <SlidersHorizontal size={14} />
                Filter & Sortierung
                {hasActiveFilter && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                )}
              </button>
            </div>
          )}

          {/* Result counter + reset */}
          {!loading && hasAny && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, minHeight: 20 }}>
              {(search.trim() || hasActiveFilter) ? (
                <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: 0 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{result.length}</span>
                  {' '}von {offers.length} Angeboten
                </p>
              ) : <span />}
              {hasActiveFilter && (
                <button
                  onClick={resetApplied}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 500 }}
                >
                  <RotateCcw size={11} /> Zurücksetzen
                </button>
              )}
            </div>
          )}

          {/* Content */}
          {loading ? (
            <SkeletonList />
          ) : !hasAny ? (
            <EmptyState />
          ) : result.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Keine Angebote für diese Filtereinstellungen.</p>
            </div>
          ) : (
            <div data-tour="vdr-angebote-list" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {visibleGroups.map(g => {
                const items = grouped[g.key] ?? []
                if (items.length === 0) return null
                return (
                  <section key={g.key}>
                    <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', margin: '0 0 10px' }}>
                      {g.label} <span style={{ opacity: 0.6 }}>· {items.length}</span>
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {items.map(o => <GlobalOfferTile key={o.id} o={o} />)}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Overlay */}
      <div
        onClick={() => setPanelOpen(false)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.30)',
          backdropFilter: 'blur(3px)', zIndex: 200,
          opacity: panelOpen ? 1 : 0,
          pointerEvents: panelOpen ? 'auto' : 'none',
          transition: 'opacity 0.24s',
        }}
      />

      {/* Filter & Sort Flyout */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 340,
        background: 'var(--surface)',
        borderLeft: '1px solid rgba(35,82,200,0.18)',
        boxShadow: '-6px 0 32px rgba(35,82,200,0.10)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Panel header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <SlidersHorizontal size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, flex: 1, margin: 0, letterSpacing: '-0.2px' }}>Filter & Sortierung</h2>
          <button
            onClick={() => setPanelOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-dim)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* ── Sortierung ── */}
          <PanelSection title="Sortieren nach">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {SORT_OPTIONS.map(opt => {
                const active = pending.sortField === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggleSort(opt.key, opt.defaultDir)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                      borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: active ? 'rgba(35,82,200,0.07)' : 'transparent',
                      textAlign: 'left', width: '100%',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg)' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: active ? 600 : 450, color: active ? 'var(--accent)' : 'var(--text)' }}>
                      {opt.label}
                    </span>
                    {active ? (
                      <span style={{ color: 'var(--accent)', display: 'flex' }}>
                        {pending.sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                      </span>
                    ) : (
                      <span style={{ width: 14 }} />
                    )}
                  </button>
                )
              })}
            </div>
          </PanelSection>

          <Divider />

          {/* ── Status ── */}
          <PanelSection title="Status">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {ALL_STATUSES.map(s => {
                const m = STATUS_META[s]
                const active = pending.statuses.includes(s)
                return (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                      borderRadius: 100,
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'rgba(35,82,200,0.08)' : 'var(--bg)',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5,
                      fontWeight: active ? 600 : 450,
                    }}
                  >
                    {active && <Check size={11} />}
                    {m.label}
                  </button>
                )
              })}
            </div>
            {pending.statuses.length === 0 && (
              <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 8 }}>Alle Status werden angezeigt.</p>
            )}
          </PanelSection>

          <Divider />

          {/* ── Preisspanne ── */}
          <PanelSection title="Preisspanne">
            <RadioList
              options={PRICE_RANGES}
              value={pending.priceRange}
              onChange={v => setPending(prev => ({ ...prev, priceRange: v }))}
            />
          </PanelSection>

          <Divider />

          {/* ── Event-Datum ── */}
          <PanelSection title="Event-Datum">
            <RadioList
              options={DATE_RANGES}
              value={pending.dateRange}
              onChange={v => setPending(prev => ({ ...prev, dateRange: v }))}
            />
          </PanelSection>
        </div>

        {/* Panel footer */}
        <div style={{ padding: '14px 20px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
          <button
            onClick={resetPending}
            style={{
              flex: 1, padding: '10px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--bg)',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
              fontWeight: 600, color: 'var(--text-secondary)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
          >
            Zurücksetzen
          </button>
          <button
            onClick={applyFilter}
            style={{
              flex: 2, padding: '10px', borderRadius: 10,
              border: 'none', background: 'var(--accent)',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
              fontWeight: 600, color: '#fff',
            }}
          >
            Anwenden
          </button>
        </div>
      </aside>

      {/* Create offer modal */}
      {createOpen && (
        <>
          <div onClick={() => { setCreateOpen(false); setPickedEvent(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.40)', backdropFilter: 'blur(4px)', zIndex: 300 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 301, width: 460, maxWidth: 'calc(100vw - 32px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Neues Angebot erstellen</span>
              <button onClick={() => { setCreateOpen(false); setPickedEvent(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ padding: '16px 20px 20px', maxHeight: '70vh', overflowY: 'auto' }}>
              {pickedEvent === null ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 12px' }}>Angebot mit oder ohne Event verknüpfen?</p>

                  {/* Standalone option */}
                  <button
                    onClick={() => setPickedEvent('standalone')}
                    style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: '2px solid var(--accent)', borderRadius: 10, padding: '11px 14px', background: 'rgba(35,82,200,0.04)', width: '100%', marginBottom: 10 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(35,82,200,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(35,82,200,0.04)' }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>Ohne Event-Verknüpfung</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>Für Interessenten, Kaltakquise oder allgemeine Angebote</div>
                  </button>

                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '10px 0 8px' }}>Oder Event wählen</p>

                  {eventsLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[1,2,3].map(i => <div key={i} className="ang-skel" style={{ height: 52, borderRadius: 10 }} />)}
                    </div>
                  ) : events.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-dim)', padding: '8px 0' }}>Noch kein Event verknüpft.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {events.map(ev => (
                        <button key={ev.id} onClick={() => setPickedEvent(ev)} style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', background: 'var(--bg)', width: '100%' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(35,82,200,0.04)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{ev.couple_name || ev.title || 'Event'}</div>
                          {ev.title && ev.couple_name && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{ev.title}</div>}
                          {ev.date && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 1 }}>{new Date(ev.date).toLocaleDateString('de-DE')}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 14px' }}>
                    {pickedEvent === 'standalone'
                      ? <><strong style={{ color: 'var(--text)' }}>Ohne Event-Verknüpfung</strong></>
                      : <>Event: <strong style={{ color: 'var(--text)' }}>{pickedEvent.couple_name || pickedEvent.title || 'Event'}</strong></>
                    }
                    <button onClick={() => setPickedEvent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent)', marginLeft: 8, padding: 0 }}>ändern</button>
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={() => createOffer('questionnaire')} disabled={creating} style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 10, padding: '13px 14px', background: 'var(--bg)', width: '100%' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(35,82,200,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Aus Preislogik</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>Vorbefüllt aus deinem Fragebogen (Grundpreis, pro Gast …)</div>
                    </button>
                    <button onClick={() => createOffer('blank')} disabled={creating} style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 10, padding: '13px 14px', background: 'var(--bg)', width: '100%' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(35,82,200,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Leeres Angebot</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>Positionen selbst zusammenstellen</div>
                    </button>
                  </div>
                  {creating && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)', marginTop: 12, justifyContent: 'center' }}><Loader2 size={14} className="ang-spin" /> Wird erstellt…</div>}
                </>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        .ang-skel{background:linear-gradient(90deg,var(--bg) 25%,var(--border) 50%,var(--bg) 75%);background-size:200% 100%;animation:ang-shimmer 1.4s ease infinite}
        @keyframes ang-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .ang-spin{animation:angspin 1s linear infinite}@keyframes angspin{to{transform:rotate(360deg)}}
        @media(max-width:480px){aside[style*="width: 340"]{width:100%!important}}
      `}</style>
    </>
  )
}

/* ── Sub-components ── */

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-dim)', margin: '0 0 10px' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />
}

function RadioList({ options, value, onChange }: {
  options: { key: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {options.map(opt => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: active ? 'rgba(35,82,200,0.07)' : 'transparent',
              textAlign: 'left', width: '100%',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              background: active ? 'var(--accent)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color .12s, background .12s',
            }}>
              {active && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', display: 'block' }} />}
            </span>
            <span style={{ fontSize: 13.5, color: active ? 'var(--accent)' : 'var(--text)', fontWeight: active ? 600 : 450 }}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 8 }}>
      {[3, 2].map((count, gi) => (
        <section key={gi}>
          <div className="ang-skel" style={{ height: 11, width: 90, borderRadius: 4, margin: '0 0 10px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, minHeight: 76 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div className="ang-skel" style={{ height: 15, width: `${120 + (i * 41) % 80}px`, borderRadius: 6 }} />
                    <div className="ang-skel" style={{ height: 16, width: 70, borderRadius: 100 }} />
                  </div>
                  <div className="ang-skel" style={{ height: 12, width: `${150 + (i * 57) % 90}px`, marginTop: 6, borderRadius: 4 }} />
                </div>
                <div className="ang-skel" style={{ height: 15, width: 64, borderRadius: 6, flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.4 }}><ReceiptText size={30} /></div>
      <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch kein Angebot</p>
      <p style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
        Angebote erstellst du direkt im jeweiligen Event unter &ldquo;Angebote&rdquo;.
      </p>
    </div>
  )
}

function GlobalOfferTile({ o }: { o: OfferRow }) {
  const m = STATUS_META[o.status]
  const ev = o.events
  const coupleName = ev?.couple_name ?? ev?.title ?? null
  const dateStr = ev?.date ? new Date(ev.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null
  const displayTitle = o.event_id === null
    ? 'Ohne Event-Verknüpfung'
    : (dateStr ? `${coupleName ?? 'Event'} | ${dateStr}` : (coupleName ?? 'Event'))
  const href = o.event_id ? `/vendor/dashboard/${o.event_id}/angebote/${o.id}` : `/vendor/angebote/${o.id}`
  return (
    <Link
      href={href}
      style={{
        textAlign: 'left', textDecoration: 'none', fontFamily: 'inherit', width: '100%',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13,
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
        minHeight: 76,
        transition: 'box-shadow .15s, border-color .15s', color: 'inherit',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, overflow: 'hidden' }}>
          <span style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0 }}>{displayTitle}</span>
          {o.version > 1 && <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>v{o.version}</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: m.bg, color: m.fg, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {m.icon} {m.label}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {o.title} · #{o.id.slice(0, 8).toUpperCase()} · Aktualisiert {new Date(o.updated_at).toLocaleDateString('de-DE')}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{formatMoney(o.total, o.currency)}</div>
      </div>
      <ChevronRight size={18} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
    </Link>
  )
}
