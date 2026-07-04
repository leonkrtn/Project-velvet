'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText, Check, Clock, X, Download, ExternalLink, Euro, Layers } from 'lucide-react'
import { categoryLabel } from '@/lib/marketplace/types'
import CategoryIcon from '@/components/marketplace/CategoryIcon'

interface Offer {
  id: string
  request_id: string
  dienstleister_id: string
  vendor_name: string
  category: string | null
  status: 'released' | 'accepted' | 'declined'
  total: number | null
  line_item_count: number
  variant_count: number
  released_at: string | null
  accepted_at: string | null
}

const STATUS_META: Record<Offer['status'], { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  released: { label: 'Offen',      bg: '#FEF3E0', color: '#B26A00', icon: <Clock size={12} /> },
  accepted: { label: 'Angenommen', bg: '#E6F4EA', color: '#1E7E34', icon: <Check size={12} /> },
  declined: { label: 'Abgelehnt',  bg: '#FDECEA', color: '#C0392B', icon: <X size={12} /> },
}

function euro(n: number | null) {
  return n != null ? `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '—'
}

// Angebotsvergleich: alle freigegebenen Angebote des Events, nach Gewerk
// gruppiert — Preise nebeneinander, damit das Brautpaar entscheiden kann.
export default function AngeboteVergleich({ eventId }: { eventId: string }) {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/marketplace/offers?eventId=${eventId}`)
    if (res.ok) setOffers((await res.json()).offers ?? [])
    setLoading(false)
  }, [eventId])
  useEffect(() => { load() }, [load])

  const { byCategory, acceptedSum, openCount } = useMemo(() => {
    const groups = new Map<string, Offer[]>()
    let sum = 0
    let open = 0
    for (const o of offers) {
      const key = o.category ?? 'sonstiges'
      const list = groups.get(key) ?? []
      list.push(o)
      groups.set(key, list)
      if (o.status === 'accepted' && o.total != null) sum += Number(o.total)
      if (o.status === 'released') open += 1
    }
    // Innerhalb eines Gewerks: Angenommene zuerst, dann Offene nach Preis aufsteigend.
    const rank: Record<Offer['status'], number> = { accepted: 0, released: 1, declined: 2 }
    groups.forEach(list => {
      list.sort((a, b) => (rank[a.status] - rank[b.status]) || ((a.total ?? Infinity) - (b.total ?? Infinity)))
    })
    return { byCategory: Array.from(groups.entries()), acceptedSum: sum, openCount: open }
  }, [offers])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bp-card" style={{ padding: '1rem 1.1rem' }}>
            <div className="bp-skeleton" style={{ height: 14, width: '30%', marginBottom: 12 }} />
            <div className="bp-skeleton" style={{ height: 60, width: '100%' }} />
          </div>
        ))}
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <div className="bp-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <FileText size={26} style={{ opacity: 0.35, marginBottom: 10 }} />
        <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Noch keine Angebote</p>
        <p className="bp-caption" style={{ margin: 0 }}>
          Sobald ein Dienstleister ein Angebot freigibt, erscheint es hier zum Vergleich.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Summenleiste */}
      <div className="bp-card" style={{ padding: '0.9rem 1.1rem', marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: '#E6F4EA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E7E34' }}><Euro size={16} /></span>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--bp-ink)' }}>{euro(acceptedSum)}</p>
            <p className="bp-caption" style={{ margin: 0 }}>Zugesagt (angenommene Angebote)</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: '#FEF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B26A00' }}><Clock size={16} /></span>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--bp-ink)' }}>{openCount}</p>
            <p className="bp-caption" style={{ margin: 0 }}>Offene Angebote</p>
          </div>
        </div>
      </div>

      {/* Gruppen je Gewerk */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {byCategory.map(([category, list]) => (
          <div key={category}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, fontSize: 12.5, fontWeight: 700, color: 'var(--bp-gold-deep,#9C7F4F)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <CategoryIcon category={category} size={14} /> {categoryLabel(category)}
              <span style={{ fontWeight: 500, color: 'var(--bp-ink-3)', textTransform: 'none', letterSpacing: 0 }}>· {list.length} Angebot{list.length === 1 ? '' : 'e'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              {list.map(o => {
                const meta = STATUS_META[o.status]
                return (
                  <div key={o.id} className="bp-card" style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 8, opacity: o.status === 'declined' ? 0.65 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <p style={{ fontWeight: 600, fontSize: 14.5, margin: 0, minWidth: 0 }}>{o.vendor_name}</p>
                      <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, padding: '4px 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4, background: meta.bg, color: meta.color, flexShrink: 0 }}>
                        {meta.icon} {meta.label}
                      </span>
                    </div>
                    <p className="bp-font-heading" style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: 'var(--bp-ink)' }}>{euro(o.total)}</p>
                    <p className="bp-caption" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span>{o.line_item_count} Position{o.line_item_count === 1 ? '' : 'en'}</span>
                      {o.variant_count > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Layers size={12} /> {o.variant_count} Variante{o.variant_count === 1 ? '' : 'n'}
                        </span>
                      )}
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4, flexWrap: 'wrap' }}>
                      <Link
                        href={`/brautpaar/${eventId}/dienstleister/anbieter/${o.dienstleister_id}`}
                        className="bp-btn bp-btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 12.5, padding: '7px 12px' }}
                      >
                        <ExternalLink size={13} /> Zum Angebot
                      </Link>
                      <a
                        href={`/api/marketplace/offers/${o.request_id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="bp-btn"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 12.5, padding: '7px 12px' }}
                      >
                        <Download size={13} /> PDF
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
