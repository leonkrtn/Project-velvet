'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, FileDown, Check, X, ReceiptText, ChevronRight, Clock } from 'lucide-react'
import { recomputeTotals, effectiveLineTotal, computeDeposit, type LineItem, type DepositType } from '@/lib/vendor/pricing'
import { formatMoney, type TaxMode } from '@/lib/vendor/questionnaire'

interface OfferListRow {
  id: string
  title: string
  status: 'released' | 'accepted' | 'declined'
  total: number
  currency: string
  valid_until: string | null
  vendor_name: string
  released_at: string | null
}
interface OfferDetail extends OfferListRow {
  line_items: LineItem[]
  tax_mode: TaxMode
  tax_rate: number
  footer_note: string
  vendor_notes: string
  deposit_type: DepositType
  deposit_value: number
  deposit_due_days: number | null
  balance_due_note: string
  payment_terms: string
  agb_text: string
  agb_required: boolean
  accepted_by_name: string | null
}

const STATUS_META: Record<OfferListRow['status'], { label: string; bg: string; fg: string }> = {
  released: { label: 'Zu prüfen', bg: 'rgba(184,153,104,0.16)', fg: '#9a7b3f' },
  accepted: { label: 'Angenommen', bg: 'rgba(30,126,52,0.12)', fg: '#1E7E34' },
  declined: { label: 'Abgelehnt', bg: 'rgba(197,34,31,0.10)', fg: '#C5221F' },
}

export default function BrautpaarAngeboteClient({ eventId }: { eventId: string }) {
  const [offers, setOffers] = useState<OfferListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/couple/offers?eventId=${eventId}`)
    const d = await res.json().catch(() => ({}))
    setOffers(d.offers ?? [])
    setLoading(false)
  }, [eventId])
  useEffect(() => { load() }, [load])

  const open = offers.filter(o => o.status === 'released')
  const done = offers.filter(o => o.status !== 'released')

  if (loading) {
    return (
      <section style={{ marginBottom: '1.75rem' }}>
        <div className="bp-skeleton" style={{ height: 14, width: 90, marginBottom: '0.7rem', borderRadius: 4 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bp-card" style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div className="bp-skeleton" style={{ height: 16, width: `${130 + (i * 37) % 70}px`, borderRadius: 6 }} />
                  <div className="bp-skeleton" style={{ height: 16, width: 64, borderRadius: 100 }} />
                </div>
                <div className="bp-skeleton" style={{ height: 12, width: `${150 + (i * 53) % 80}px`, marginTop: 7, borderRadius: 4 }} />
              </div>
              <div className="bp-skeleton" style={{ height: 18, width: 72, borderRadius: 6, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (offers.length === 0) {
    return (
      <div className="bp-card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
        <ReceiptText size={28} style={{ opacity: 0.35, marginBottom: 12 }} />
        <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 6px' }}>Noch keine Angebote</p>
        <p className="bp-caption" style={{ margin: 0 }}>Sobald euch ein Dienstleister ein Angebot bereitstellt, erscheint es hier.</p>
      </div>
    )
  }

  return (
    <>
      {open.length > 0 && <Group title="Zu prüfen" items={open} onOpen={setOpenId} />}
      {done.length > 0 && <Group title="Erledigt" items={done} onOpen={setOpenId} />}
      {openId && <OfferModal offerId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </>
  )
}

function Group({ title, items, onOpen }: { title: string; items: OfferListRow[]; onOpen: (id: string) => void }) {
  return (
    <section style={{ marginBottom: '1.75rem' }}>
      <p className="bp-label" style={{ marginBottom: '0.7rem' }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {items.map(o => {
          const m = STATUS_META[o.status]
          return (
            <button key={o.id} onClick={() => onOpen(o.id)} className="bp-card" style={{
              padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
              textAlign: 'left', fontFamily: 'inherit', width: '100%', border: '1px solid var(--bp-border)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{o.title}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: m.bg, color: m.fg }}>{m.label}</span>
                </div>
                <div className="bp-caption" style={{ marginTop: 3 }}>
                  {o.vendor_name}{o.valid_until ? ` · gültig bis ${new Date(o.valid_until).toLocaleDateString('de-DE')}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--bp-gold-deep)', flexShrink: 0 }}>{formatMoney(o.total, o.currency)}</div>
              <ChevronRight size={18} style={{ color: 'var(--bp-ink-3)', flexShrink: 0 }} />
            </button>
          )
        })}
      </div>
    </section>
  )
}

function OfferModal({ offerId, onClose, onChanged }: { offerId: string; onClose: () => void; onChanged: () => void }) {
  const [offer, setOffer] = useState<OfferDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [name, setName] = useState('')
  const [agbChecked, setAgbChecked] = useState(false)
  const [selections, setSelections] = useState<Record<number, boolean>>({})

  const load = useCallback(async () => {
    const res = await fetch(`/api/couple/offers/${offerId}`)
    const d = await res.json().catch(() => ({}))
    const o: OfferDetail | null = d.offer ?? null
    setOffer(o)
    if (o) {
      const sel: Record<number, boolean> = {}
      o.line_items.forEach((li, i) => { if (li.type === 'optional') sel[i] = li.selected !== false })
      setSelections(sel)
    }
    setLoading(false)
  }, [offerId])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const items = useMemo(() => {
    if (!offer) return []
    return offer.line_items.map((li, i) => li.type === 'optional' ? { ...li, selected: selections[i] !== false } : li)
  }, [offer, selections])

  const totals = useMemo(() => offer ? recomputeTotals(items, {
    taxMode: offer.tax_mode, taxRate: Number(offer.tax_rate ?? 0), currency: offer.currency, validUntil: null, footerNote: '',
  }) : null, [offer, items])
  const deposit = useMemo(() => offer && totals ? computeDeposit(totals.total, offer.deposit_type, offer.deposit_value) : null, [offer, totals])

  async function act(action: 'accept' | 'decline') {
    if (!offer) return
    setErr('')
    if (action === 'accept') {
      if (!name.trim()) { setErr('Bitte gebt euren Namen zur Bestätigung an.'); return }
      if (offer.agb_required && !agbChecked) { setErr('Bitte bestätigt die AGB / Stornobedingungen.'); return }
    }
    setBusy(action)
    const body: Record<string, unknown> = { action }
    if (action === 'accept') {
      body.acceptedByName = name.trim()
      body.agbAccepted = agbChecked
      body.selections = Object.fromEntries(Object.entries(selections).map(([k, v]) => [k, v]))
    }
    const res = await fetch(`/api/couple/offers/${offerId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { setErr(d.error ?? 'Fehler'); return }
    await load(); onChanged()
  }

  const cur = offer?.currency ?? 'EUR'
  const canAct = offer?.status === 'released'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="bp-card" style={{ width: 600, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        {loading || !offer ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bp-ink-3)' }}><Loader2 size={18} className="bp-spin" /></div>
        ) : (
          <>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--bp-border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="bp-font-heading" style={{ fontSize: '1.25rem', margin: 0 }}>{offer.title}</h2>
                <p className="bp-caption" style={{ margin: '3px 0 0' }}>{offer.vendor_name}</p>
              </div>
              <button onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bp-ink-3)', display: 'flex' }}><X size={20} /></button>
            </div>

            <div style={{ padding: 22, overflowY: 'auto' }}>
              {/* Positionen */}
              <div style={{ border: '1px solid var(--bp-border)', borderRadius: 10, overflow: 'hidden' }}>
                {offer.line_items.map((li, i) => {
                  const optional = li.type === 'optional'
                  const on = optional ? selections[i] !== false : true
                  const eff = effectiveLineTotal({ ...li, selected: on })
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: i > 0 ? '1px solid var(--bp-border)' : 'none', opacity: optional && !on ? 0.5 : 1 }}>
                      {optional && canAct ? (
                        <input type="checkbox" checked={on} onChange={e => setSelections(s => ({ ...s, [i]: e.target.checked }))} />
                      ) : optional ? (
                        <span style={{ width: 14, fontSize: 11, color: 'var(--bp-ink-3)' }}>{on ? '✓' : '—'}</span>
                      ) : null}
                      <span style={{ flex: 1, fontSize: 13.5 }}>{li.label}{optional && <span style={{ fontSize: 11, color: 'var(--bp-ink-3)', marginLeft: 6 }}>optional</span>}</span>
                      {li.type !== 'flat' && <span style={{ fontSize: 12.5, color: 'var(--bp-ink-3)' }}>{li.qty}×</span>}
                      <span style={{ width: 90, textAlign: 'right', fontSize: 13.5, fontWeight: 600, color: eff < 0 ? '#C5221F' : 'var(--bp-ink)' }}>{formatMoney(eff, cur)}</span>
                    </div>
                  )
                })}
              </div>

              {/* Summen */}
              {totals && (
                <div style={{ marginLeft: 'auto', width: 280, marginTop: 12 }}>
                  <Row label="Zwischensumme" value={formatMoney(totals.subtotal, cur)} />
                  {offer.tax_mode === 'regular' && <Row label={`zzgl. USt. (${totals.taxRate}%)`} value={formatMoney(totals.taxAmount, cur)} />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--bp-ink)', marginTop: 5, paddingTop: 7 }}>
                    <strong style={{ fontSize: 16 }}>Gesamt</strong>
                    <strong style={{ fontSize: 16, color: 'var(--bp-gold-deep)' }}>{formatMoney(totals.total, cur)}</strong>
                  </div>
                  {offer.tax_mode === 'kleinunternehmer' && <p className="bp-caption" style={{ margin: '6px 0 0' }}>Gemäß §19 UStG keine USt.</p>}
                  {deposit && offer.deposit_type !== 'none' && deposit.deposit > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--bp-border)' }}>
                      <Row label="Anzahlung" value={formatMoney(deposit.deposit, cur)} />
                      <Row label="Restbetrag" value={formatMoney(deposit.balance, cur)} />
                    </div>
                  )}
                </div>
              )}

              {(offer.balance_due_note || offer.payment_terms || (offer.deposit_due_days && offer.deposit_type !== 'none')) && (
                <Block title="Zahlung">
                  {offer.deposit_type !== 'none' && offer.deposit_due_days ? <p style={infoP}>Anzahlung fällig {offer.deposit_due_days} Tage nach Annahme.</p> : null}
                  {offer.balance_due_note && <p style={infoP}>{offer.balance_due_note}</p>}
                  {offer.payment_terms && <p style={infoP}>{offer.payment_terms}</p>}
                </Block>
              )}
              {offer.vendor_notes && <Block title="Anmerkungen"><p style={infoP}>{offer.vendor_notes}</p></Block>}
              {offer.agb_text && <Block title="AGB & Stornobedingungen"><p style={{ ...infoP, maxHeight: 140, overflowY: 'auto' }}>{offer.agb_text}</p></Block>}

              {err && <p style={{ color: '#C5221F', fontSize: 13, margin: '14px 0 0' }}>{err}</p>}

              {/* Annahme */}
              {canAct && (
                <div style={{ marginTop: 18, borderTop: '1px solid var(--bp-border)', paddingTop: 16 }}>
                  <label className="bp-label" style={{ display: 'block', marginBottom: 5 }}>Name zur Bestätigung</label>
                  <input className="bp-input" value={name} onChange={e => setName(e.target.value)} placeholder="Vor- und Nachname" style={{ width: '100%', marginBottom: 12 }} />
                  {offer.agb_required && (
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, lineHeight: 1.5, cursor: 'pointer', marginBottom: 4 }}>
                      <input type="checkbox" checked={agbChecked} onChange={e => setAgbChecked(e.target.checked)} style={{ marginTop: 2 }} />
                      <span>Ich habe die AGB / Stornobedingungen gelesen und akzeptiere sie verbindlich.</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--bp-border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={`/api/couple/offers/${offerId}/pdf`} target="_blank" rel="noreferrer" className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}><FileDown size={15} /> PDF</a>
              {canAct ? (
                <>
                  <button onClick={() => act('decline')} disabled={!!busy} className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {busy === 'decline' ? <Loader2 size={15} className="bp-spin" /> : <X size={15} />} Ablehnen
                  </button>
                  <button onClick={() => act('accept')} disabled={!!busy} className="bp-btn bp-btn-primary" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {busy === 'accept' ? <Loader2 size={15} className="bp-spin" /> : <Check size={15} />} Verbindlich annehmen
                  </button>
                </>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: offer.status === 'accepted' ? '#1E7E34' : '#C5221F', marginLeft: 'auto' }}>
                  {offer.status === 'accepted' ? <><Check size={15} /> Angenommen{offer.accepted_by_name ? ` von ${offer.accepted_by_name}` : ''}</> : <><Clock size={15} /> Abgelehnt</>}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const infoP: React.CSSProperties = { fontSize: 13, color: 'var(--bp-ink-2)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginTop: 16 }}><p className="bp-label" style={{ marginBottom: 5 }}>{title}</p>{children}</div>
}
function Row({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13.5 }}><span style={{ color: 'var(--bp-ink-3)' }}>{label}</span><span>{value}</span></div>
}
