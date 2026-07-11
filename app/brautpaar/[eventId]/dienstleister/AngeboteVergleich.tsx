'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText, Check, Clock, X, Download, ExternalLink, Euro, Layers, Tag, Columns3, Minus } from 'lucide-react'
import { categoryLabel } from '@/lib/marketplace/types'
import CategoryIcon from '@/components/marketplace/CategoryIcon'

interface OfferLine { label: string; total: number | null }
interface Offer {
  id: string
  request_id: string
  dienstleister_id: string
  vendor_name: string
  category: string | null
  status: 'released' | 'accepted' | 'declined'
  subtotal: number | null
  tax_amount: number | null
  total: number | null
  line_item_count: number
  line_items: OfferLine[]
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
  // Gegenüberstellung: welche Kategorie wird gerade nebeneinander verglichen?
  const [compareCategory, setCompareCategory] = useState<string | null>(null)

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
              {list.length >= 2 && (
                <button
                  onClick={() => setCompareCategory(category)}
                  className="bp-btn"
                  style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '5px 11px', textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}
                >
                  <Columns3 size={13} /> Nebeneinander vergleichen
                </button>
              )}
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

      {compareCategory && (
        <CompareLightbox
          eventId={eventId}
          category={compareCategory}
          offers={(byCategory.find(([c]) => c === compareCategory)?.[1]) ?? []}
          onClose={() => setCompareCategory(null)}
        />
      )}
    </div>
  )
}

// ── Gegenüberstellung: Angebote eines Gewerks als Spalten nebeneinander ───────
// Zeilen: Gesamtpreis, Netto/USt., Positionen (vereinigt) und Meta. Das
// günstigste (nicht abgelehnte) Angebot wird als „Bester Preis" hervorgehoben.
function CompareLightbox({ eventId, category, offers, onClose }: {
  eventId: string; category: string; offers: Offer[]; onClose: () => void
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  // Vereinigte, stabil sortierte Positionsliste über alle Angebote (nach Label).
  const allLabels = useMemo(() => {
    const seen = new Map<string, number>()
    offers.forEach(o => o.line_items.forEach((li, i) => { if (li.label && !seen.has(li.label)) seen.set(li.label, i) }))
    return Array.from(seen.keys())
  }, [offers])

  const priced = offers.filter(o => o.status !== 'declined' && o.total != null)
  const bestTotal = priced.length >= 2 ? Math.min(...priced.map(o => Number(o.total))) : null

  // Positions-Summe je Angebot als schnelle Lookup-Map.
  const lineFor = (o: Offer, label: string) => o.line_items.find(li => li.label === label) ?? null

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={`Angebote vergleichen: ${categoryLabel(category)}`}
      style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(20,22,26,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 3vw' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(1120px, 96vw)', height: 'min(880px, 92vh)', background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 30px 90px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 22px', borderBottom: '1px solid var(--bp-rule,#E8E8E6)', flexShrink: 0 }}>
          <CategoryIcon category={category} size={18} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="bp-font-heading" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--bp-ink)' }}>Angebote vergleichen</p>
            <p className="bp-caption" style={{ margin: 0 }}>{categoryLabel(category)} · {offers.length} Angebote nebeneinander</p>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px' }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 320 + offers.length * 220, fontSize: 13.5 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 3, background: '#fff', textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--bp-rule,#E8E8E6)', minWidth: 200 }} />
                {offers.map(o => {
                  const meta = STATUS_META[o.status]
                  const isBest = bestTotal != null && o.status !== 'declined' && o.total != null && Number(o.total) === bestTotal
                  return (
                    <th key={o.id} style={{ position: 'sticky', top: 0, zIndex: 2, background: isBest ? 'var(--bp-gold-pale,#F5F0E8)' : '#fff', textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--bp-rule,#E8E8E6)', borderLeft: '1px solid var(--bp-rule,#E8E8E6)', minWidth: 200, verticalAlign: 'top', opacity: o.status === 'declined' ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{o.vendor_name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, padding: '4px 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4, background: meta.bg, color: meta.color, width: 'fit-content' }}>{meta.icon} {meta.label}</span>
                        {isBest && <span style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1, padding: '4px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', color: 'var(--bp-gold-deep,#9C7F4F)', border: '1px solid var(--bp-rule-gold,#D4BC9A)', width: 'fit-content' }}><Tag size={11} /> Bester Preis</span>}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Gesamtpreis" strong>
                {offers.map(o => <td key={o.id} style={compareCell}><span className="bp-font-heading" style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--bp-ink)' }}>{euro(o.total)}</span></td>)}
              </CompareRow>
              <CompareRow label="Netto">
                {offers.map(o => <td key={o.id} style={compareCell}>{euro(o.subtotal)}</td>)}
              </CompareRow>
              <CompareRow label="USt.">
                {offers.map(o => <td key={o.id} style={compareCell}>{o.tax_amount != null && Number(o.tax_amount) > 0 ? euro(o.tax_amount) : '—'}</td>)}
              </CompareRow>
              <CompareRow label="Positionen">
                {offers.map(o => <td key={o.id} style={compareCell}>{o.line_item_count}</td>)}
              </CompareRow>
              <CompareRow label="Varianten">
                {offers.map(o => <td key={o.id} style={compareCell}>{o.variant_count > 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Layers size={12} /> {o.variant_count}</span> : '—'}</td>)}
              </CompareRow>
              <CompareRow label="Status seit">
                {offers.map(o => <td key={o.id} style={compareCell}>{(o.status === 'accepted' ? dateLabel(o.accepted_at) : dateLabel(o.released_at)) ?? '—'}</td>)}
              </CompareRow>

              {allLabels.length > 0 && (
                <tr>
                  <td colSpan={offers.length + 1} style={{ padding: '16px 16px 6px', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--bp-gold-deep,#9C7F4F)', background: '#fff', position: 'sticky', left: 0 }}>Enthaltene Positionen</td>
                </tr>
              )}
              {allLabels.map(label => (
                <CompareRow key={label} label={label}>
                  {offers.map(o => {
                    const li = lineFor(o, label)
                    return <td key={o.id} style={compareCell}>{li ? (li.total != null ? euro(li.total) : <Check size={15} style={{ color: '#1E7E34' }} />) : <Minus size={14} style={{ color: 'var(--bp-ink-3)' }} />}</td>
                  })}
                </CompareRow>
              ))}

              <tr>
                <td style={{ ...compareLabelCell, borderBottom: 'none' }} />
                {offers.map(o => (
                  <td key={o.id} style={{ ...compareCell, borderBottom: 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Link href={`/brautpaar/${eventId}/dienstleister/anbieter/${o.dienstleister_id}`} className="bp-btn bp-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', fontSize: 12, padding: '7px 10px' }}><ExternalLink size={13} /> Zum Angebot</Link>
                      <a href={`/api/marketplace/offers/${o.request_id}/pdf`} target="_blank" rel="noreferrer" className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', fontSize: 12, padding: '7px 10px' }}><Download size={13} /> PDF</a>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const compareLabelCell: React.CSSProperties = {
  position: 'sticky', left: 0, zIndex: 1, background: '#fff', textAlign: 'left', padding: '11px 16px',
  borderBottom: '1px solid var(--bp-rule,#E8E8E6)', fontWeight: 600, color: 'var(--bp-ink-2)', whiteSpace: 'nowrap',
}
const compareCell: React.CSSProperties = {
  padding: '11px 16px', borderBottom: '1px solid var(--bp-rule,#E8E8E6)', borderLeft: '1px solid var(--bp-rule,#E8E8E6)',
  color: 'var(--bp-ink)', verticalAlign: 'top',
}

function CompareRow({ label, strong, children }: { label: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <tr>
      <td style={{ ...compareLabelCell, fontWeight: strong ? 700 : 600, color: strong ? 'var(--bp-ink)' : 'var(--bp-ink-2)' }}>{label}</td>
      {children}
    </tr>
  )
}
