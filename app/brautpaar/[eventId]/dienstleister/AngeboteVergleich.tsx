'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText, Check, Clock, X, Download, ExternalLink, Euro, Layers, Tag } from 'lucide-react'
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

function dateLabel(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null
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
      <div className="bp-card" style={{ padding: '0.9rem 1.1rem', marginBottom: 16, display: 'flex', gap: 0, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {[
          { icon: <Euro size={16} />, bg: '#E6F4EA', color: '#1E7E34', value: euro(acceptedSum), label: 'Zugesagt (angenommen)' },
          { icon: <Clock size={16} />, bg: '#FEF3E0', color: '#B26A00', value: String(openCount), label: `Offene${openCount === 1 ? 's' : ''} Angebot${openCount === 1 ? '' : 'e'}` },
          { icon: <FileText size={16} />, bg: 'var(--bp-gold-pale,#F5F0E8)', color: 'var(--bp-gold-deep,#9C7F4F)', value: String(offers.length), label: `Angebot${offers.length === 1 ? '' : 'e'} insgesamt` },
        ].map((s, i) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 22px 4px 0', marginRight: 22, borderRight: i < 2 ? '1px solid var(--bp-rule,#E8E8E6)' : 'none' }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>{s.icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--bp-ink)', whiteSpace: 'nowrap' }}>{s.value}</p>
              <p className="bp-caption" style={{ margin: 0, whiteSpace: 'nowrap' }}>{s.label}</p>
            </div>
          </div>
        ))}
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
                // "Bester Preis" nur, wenn es im Gewerk echte Auswahl gibt (>=2 nicht
                // abgelehnte Angebote mit Preis) — markiert das günstigste davon.
                const priced = list.filter(x => x.status !== 'declined' && x.total != null)
                const isBestPrice = priced.length >= 2 && o.status !== 'declined' && o.total != null
                  && Number(o.total) === Math.min(...priced.map(x => Number(x.total)))
                const date = o.status === 'accepted' ? dateLabel(o.accepted_at) : dateLabel(o.released_at)
                return (
                  <div key={o.id} className="bp-card" style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 8, opacity: o.status === 'declined' ? 0.65 : 1, borderColor: isBestPrice ? 'var(--bp-rule-gold,#D4BC9A)' : undefined }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <p style={{ fontWeight: 600, fontSize: 14.5, margin: 0, minWidth: 0 }}>{o.vendor_name}</p>
                      <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, padding: '4px 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4, background: meta.bg, color: meta.color, flexShrink: 0 }}>
                        {meta.icon} {meta.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <p className="bp-font-heading" style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: 'var(--bp-ink)' }}>{euro(o.total)}</p>
                      {isBestPrice && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1, padding: '4px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bp-gold-pale,#F5F0E8)', color: 'var(--bp-gold-deep,#9C7F4F)', border: '1px solid var(--bp-rule-gold,#D4BC9A)' }}>
                          <Tag size={11} /> Bester Preis
                        </span>
                      )}
                    </div>
                    <p className="bp-caption" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span>{o.line_item_count} Position{o.line_item_count === 1 ? '' : 'en'}</span>
                      {o.variant_count > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Layers size={12} /> {o.variant_count} Variante{o.variant_count === 1 ? '' : 'n'}
                        </span>
                      )}
                      {date && <span>{o.status === 'accepted' ? 'Angenommen' : 'Erhalten'} am {date}</span>}
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
