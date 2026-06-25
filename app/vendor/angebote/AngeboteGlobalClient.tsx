'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ReceiptText, FileText, Check, X, Clock, Copy, ChevronRight, Loader2 } from 'lucide-react'
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
  event_id: string
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

export default function AngeboteGlobalClient() {
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch('/api/vendor/global-offers')
    const d = await res.json().catch(() => ({}))
    setOffers(d.offers ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const grouped = useMemo(() => {
    const map: Record<string, OfferRow[]> = {}
    for (const o of offers) (map[o.status] ??= []).push(o)
    return map
  }, [offers])

  const hasAny = offers.length > 0

  return (
    <div style={{ background: 'var(--bg)', flex: 1, padding: '28px 24px 48px', overflow: 'auto' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ReceiptText size={20} style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Angebote</h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 2 }}>Alle Angebote über alle Events hinweg.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 8 }}>
            {[3, 2].map((count, gi) => (
              <section key={gi}>
                <div className="ang-skel" style={{ height: 11, width: 90, borderRadius: 4, margin: '0 0 10px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Array.from({ length: count }).map((_, i) => (
                    <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
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
        ) : !hasAny ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.4 }}><ReceiptText size={30} /></div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch kein Angebot</p>
            <p style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
              Angebote erstellst du direkt im jeweiligen Event unter &ldquo;Angebote&rdquo;.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {GROUPS.map(g => {
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
      <style>{`.ang-skel{background:linear-gradient(90deg,var(--bg) 25%,var(--border) 50%,var(--bg) 75%);background-size:200% 100%;animation:ang-shimmer 1.4s ease infinite}@keyframes ang-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  )
}

function GlobalOfferTile({ o }: { o: OfferRow }) {
  const m = STATUS_META[o.status]
  const ev = o.events
  const eventLabel = ev?.couple_name ?? ev?.title ?? 'Event'
  return (
    <Link href={`/vendor/dashboard/${o.event_id}/angebote/${o.id}`} style={{
      textAlign: 'left', textDecoration: 'none', fontFamily: 'inherit', width: '100%',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13,
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
      transition: 'box-shadow .15s, border-color .15s', color: 'inherit',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm, 0 4px 16px rgba(0,0,0,0.06))'; e.currentTarget.style.borderColor = 'var(--gold)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</span>
          {o.version > 1 && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>v{o.version}</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: m.bg, color: m.fg }}>{m.icon} {m.label}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 4 }}>
          {eventLabel} · Aktualisiert {new Date(o.updated_at).toLocaleDateString('de-DE')}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{formatMoney(o.total, o.currency)}</div>
      </div>
      <ChevronRight size={18} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
    </Link>
  )
}
