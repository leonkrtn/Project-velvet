'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2, Plus, Trash2, RefreshCw, Save, Check, X,
  ReceiptText, Layers, BookmarkPlus, MessageSquare, Copy, AlertTriangle, CalendarPlus, Download,
} from 'lucide-react'
import {
  recomputeTotals, effectiveLineTotal, computeDeposit,
  type LineItem, type LineItemType, type DepositType,
} from '@/lib/vendor/pricing'
import { formatMoney, type TaxMode } from '@/lib/vendor/questionnaire'
import { blocksForCategory, blockToLineItem } from '@/lib/vendor/offer-blocks'
import ToggleSwitch from '@/components/ui/ToggleSwitch'

interface Offer {
  id: string
  title: string
  status: 'draft' | 'released' | 'accepted' | 'declined' | 'superseded'
  version: number
  line_items: LineItem[]
  tax_mode: TaxMode
  tax_rate: number
  currency: string
  valid_until: string | null
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
  request_id: string | null
  event_id: string | null
  standard_info: Record<string, string> | null
}
interface OwnBlock { id: string; label: string; item_type: LineItemType; default_qty: number; unit_price: number }

const C = { border: 'var(--border)', text: 'var(--text)', dim: 'var(--text-dim)', gold: 'var(--gold)', red: 'var(--red, #C5221F)', surface: 'var(--surface)', bg: 'var(--bg)' }
const inp: React.CSSProperties = { height: 36, padding: '0 10px', fontSize: 13.5, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: C.text }
// Für Textareas: Höhe/Padding von `inp` zurücknehmen (mehrzeilig).
const txt: React.CSSProperties = { ...inp, height: 'auto', padding: '8px 10px', resize: 'vertical' }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid transparent' }
const btnGhost: React.CSSProperties = { ...btn, background: C.surface, color: C.text, border: `1px solid ${C.border}` }

const TYPE_LABELS: Record<LineItemType, string> = { qty: 'Menge', flat: 'Pauschale', discount: 'Rabatt', optional: 'Optional' }
const DEPOSIT_LABELS: Record<DepositType, string> = { none: 'Keine Anzahlung', percent: 'Prozent vom Gesamt', fixed: 'Fester Betrag' }
const STATUS_META: Record<Offer['status'], { label: string; bg: string; fg: string }> = {
  draft:      { label: 'Entwurf',    bg: 'rgba(0,0,0,0.06)',       fg: '#666' },
  released:   { label: 'Versendet',  bg: 'rgba(184,153,104,0.16)', fg: '#9a7b3f' },
  accepted:   { label: 'Angenommen', bg: 'rgba(30,126,52,0.12)',   fg: '#1E7E34' },
  declined:   { label: 'Abgelehnt',  bg: 'rgba(197,34,31,0.10)',   fg: '#C5221F' },
  superseded: { label: 'Ersetzt',    bg: 'rgba(0,0,0,0.05)',       fg: '#999' },
}

export default function OfferEditorFull({ eventId, offerId }: { eventId: string | null; offerId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [offer, setOffer] = useState<Offer | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [ownBlocks, setOwnBlocks] = useState<OwnBlock[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [blockMenu, setBlockMenu] = useState(false)
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [pdfKey, setPdfKey] = useState(0)
  // Split pane: leftPct is the % width of the form column (30–80)
  const [leftPct, setLeftPct] = useState(55)
  const splitRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  function onDividerPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onDividerPointerMove(e: React.PointerEvent) {
    if (!dragging.current || !splitRef.current) return
    const rect = splitRef.current.getBoundingClientRect()
    const pct = ((e.clientX - rect.left) / rect.width) * 100
    setLeftPct(Math.min(80, Math.max(20, pct)))
  }
  function onDividerPointerUp() { dragging.current = false }

  // Editierbare Felder
  const [title, setTitle] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [depositType, setDepositType] = useState<DepositType>('none')
  const [depositValue, setDepositValue] = useState(0)
  const [depositDueDays, setDepositDueDays] = useState<string>('')
  const [balanceDueNote, setBalanceDueNote] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [agbText, setAgbText] = useState('')
  const [agbRequired, setAgbRequired] = useState(true)

  // Kundeninfo (nur für Angebote ohne Event-Verknüpfung)
  const [clientName, setClientName] = useState('')
  const [clientAddr1, setClientAddr1] = useState('')
  const [clientAddr2, setClientAddr2] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')

  const hydrate = useCallback((o: Offer) => {
    setOffer(o)
    setTitle(o.title ?? 'Angebot')
    setItems((o.line_items ?? []).map(li => ({ ...li, type: li.type ?? 'qty' })))
    setNotes(o.vendor_notes ?? '')
    setValidUntil(o.valid_until ?? '')
    setDepositType((o.deposit_type as DepositType) ?? 'none')
    setDepositValue(Number(o.deposit_value ?? 0))
    setDepositDueDays(o.deposit_due_days != null ? String(o.deposit_due_days) : '')
    setBalanceDueNote(o.balance_due_note ?? '')
    setPaymentTerms(o.payment_terms ?? '')
    setAgbText(o.agb_text ?? '')
    setAgbRequired(o.agb_required ?? true)
    const si = (o.standard_info ?? {}) as Record<string, string>
    setClientName(si.client_name ?? '')
    setClientAddr1(si.client_address_line1 ?? '')
    setClientAddr2(si.client_address_line2 ?? '')
    setClientEmail(si.client_email ?? '')
    setClientPhone(si.client_phone ?? '')
  }, [])

  const load = useCallback(async () => {
    const [oRes, bRes] = await Promise.all([
      fetch(`/api/vendor/event-offers/${offerId}`),
      fetch('/api/vendor/offer-blocks'),
    ])
    const d = await oRes.json().catch(() => ({}))
    const b = await bRes.json().catch(() => ({}))
    if (d.offer) { hydrate(d.offer); setCategory(d.category ?? null) }
    setOwnBlocks(b.blocks ?? [])
    setLoading(false)
  }, [offerId, hydrate])
  useEffect(() => { load() }, [load])

  const editable = offer?.status === 'draft'

  const totals = useMemo(() => recomputeTotals(items, {
    taxMode: offer?.tax_mode ?? 'regular', taxRate: Number(offer?.tax_rate ?? 0),
    currency: offer?.currency ?? 'EUR', validUntil: null, footerNote: '',
  }), [items, offer])
  const deposit = useMemo(() => computeDeposit(totals.total, depositType, depositValue), [totals.total, depositType, depositValue])
  const cur = offer?.currency ?? 'EUR'

  // ── Positionen ──
  function setItem(i: number, patch: Partial<LineItem>) {
    setItems(prev => prev.map((li, idx) => {
      if (idx !== i) return li
      const next = { ...li, ...patch }
      next.total = effectiveLineTotal(next)
      return next
    }))
  }
  function addItem(li?: LineItem) {
    const item = li ?? { label: '', qty: 1, unitPrice: 0, total: 0, type: 'qty' as LineItemType }
    item.total = effectiveLineTotal(item)
    setItems(prev => [...prev, item])
  }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  async function saveOwnBlock(li: LineItem) {
    if (!li.label.trim()) return
    await fetch('/api/vendor/offer-blocks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: li.label, itemType: li.type ?? 'qty', defaultQty: li.qty, unitPrice: li.unitPrice }),
    })
    const b = await (await fetch('/api/vendor/offer-blocks')).json().catch(() => ({}))
    setOwnBlocks(b.blocks ?? [])
  }

  function editFieldsBody() {
    const base = {
      title, lineItems: items, vendorNotes: notes, validUntil,
      depositType, depositValue, depositDueDays, balanceDueNote, paymentTerms, agbText, agbRequired,
    }
    if (eventId === null) {
      return { ...base, clientInfo: { client_name: clientName, client_address_line1: clientAddr1, client_address_line2: clientAddr2, client_email: clientEmail, client_phone: clientPhone } }
    }
    return base
  }

  async function patch(action: 'save' | 'release') {
    setBusy(action); setErr('')
    const res = await fetch(`/api/vendor/event-offers/${offerId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...editFieldsBody() }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { setErr(d.error ?? 'Fehler'); return }
    if (action === 'release') { router.push(eventId ? `/vendor/dashboard/${eventId}/angebote` : '/vendor/angebote'); return }
    setPdfKey(k => k + 1)
    await load()
  }

  async function acceptStandalone(fields: Record<string, string>) {
    setBusy('accept'); setErr('')
    const res = await fetch(`/api/vendor/event-offers/${offerId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', ...fields }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { setErr(d.error ?? 'Fehler'); return }
    setAcceptOpen(false)
    if (d.eventId) router.push(`/vendor/dashboard/${d.eventId}/angebote/${offerId}`)
  }

  async function recompute() {
    setBusy('recompute'); setErr('')
    const res = await fetch(`/api/vendor/event-offers/${offerId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'recompute' }),
    })
    setBusy(null)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error ?? 'Fehler'); return }
    await load()
  }

  async function supersede() {
    setBusy('supersede')
    const res = await fetch(`/api/vendor/event-offers/${offerId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'supersede' }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (d.id) router.push(eventId ? `/vendor/dashboard/${eventId}/angebote/${d.id}` : `/vendor/angebote/${d.id}`)
  }

  async function remove() {
    if (!confirm('Diesen Entwurf löschen?')) return
    setBusy('delete')
    await fetch(`/api/vendor/event-offers/${offerId}`, { method: 'DELETE' })
    router.push(eventId ? `/vendor/dashboard/${eventId}/angebote` : '/vendor/angebote')
  }

  if (loading) return (
    <div style={{ paddingBottom: 40 }}>
      <div className="skeleton" style={{ height: 14, width: 110, borderRadius: 6, marginBottom: 16 }} />
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '26px 30px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 22, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 20, width: '55%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 18, width: 80, borderRadius: 100 }} />
          </div>
        </div>
        {[100, 80, 120, 90].map((h, i) => (
          <div key={i} className="skeleton" style={{ height: h, marginBottom: 14, borderRadius: 10 }} />
        ))}
      </div>
    </div>
  )
  if (!offer) return <div style={{ padding: 40, textAlign: 'center', color: C.dim }}>Angebot nicht gefunden.</div>

  const gewerkBlocks = blocksForCategory(category)

  const pdfUrl = `/api/vendor/event-offers/${offerId}/pdf`

  return (
    <div className="ofe-outer" style={{ paddingBottom: 40 }}>
      <div
        ref={splitRef}
        className="ofe-grid"
        onPointerMove={onDividerPointerMove}
        onPointerUp={onDividerPointerUp}
        style={{ display: 'flex', gap: 0, alignItems: 'start', userSelect: dragging.current ? 'none' : undefined }}
      >

      <div className="ofe-left" style={{ width: `${leftPct}%`, flexShrink: 0, minWidth: 0 }}>
      <div className="ofe-card-inner" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '26px 30px' }}>
      {/* Kopf */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ReceiptText size={20} style={{ color: C.gold }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editable ? (
            <input value={title} onChange={e => setTitle(e.target.value)} style={{ ...inp, fontSize: 20, fontWeight: 700, width: '100%', border: 'none', padding: '2px 0', background: 'transparent', letterSpacing: '-0.3px' }} placeholder="Angebotstitel" />
          ) : (
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: STATUS_META[offer.status].bg, color: STATUS_META[offer.status].fg }}>{STATUS_META[offer.status].label}</span>
            {offer.version > 1 && <span style={{ fontSize: 12, color: C.dim }}>Version {offer.version}</span>}
          </div>
        </div>
      </div>

      {err && <p style={{ color: C.red, fontSize: 13, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> {err}</p>}

      {/* Kundeninfo — nur für Angebote ohne Event-Verknüpfung */}
      {eventId === null && (
        <Section title="Kundeninfo">
          {editable ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="ofe-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Name / Firma">
                  <input style={{ ...inp, width: '100%' }} value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Max Mustermann" />
                </Field>
                <Field label="E-Mail">
                  <input style={{ ...inp, width: '100%' }} type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="max@beispiel.de" />
                </Field>
              </div>
              <div className="ofe-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Straße & Hausnummer">
                  <input style={{ ...inp, width: '100%' }} value={clientAddr1} onChange={e => setClientAddr1(e.target.value)} placeholder="Musterstraße 1" />
                </Field>
                <Field label="PLZ & Stadt">
                  <input style={{ ...inp, width: '100%' }} value={clientAddr2} onChange={e => setClientAddr2(e.target.value)} placeholder="12345 Musterstadt" />
                </Field>
              </div>
              <Field label="Telefon">
                <input style={{ ...inp, width: '100%' }} type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+49 123 456789" />
              </Field>
            </div>
          ) : (
            <ReadList rows={[
              clientName ? ['Name / Firma', clientName] : null,
              clientAddr1 || clientAddr2 ? ['Adresse', [clientAddr1, clientAddr2].filter(Boolean).join(', ')] : null,
              clientEmail ? ['E-Mail', clientEmail] : null,
              clientPhone ? ['Telefon', clientPhone] : null,
            ]} empty="Keine Kundendaten hinterlegt." />
          )}
        </Section>
      )}

      {!editable && (
        <div style={{ background: 'rgba(184,153,104,0.10)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 18, fontSize: 13, color: C.text }}>
          {offer.status === 'released' && 'Dieses Angebot ist versendet und beim Brautpaar einsehbar. Für Änderungen erstelle eine neue Version.'}
          {offer.status === 'accepted' && `Angenommen${offer.accepted_by_name ? ` von ${offer.accepted_by_name}` : ''} — der Auftrag gilt als bestätigt.`}
          {offer.status === 'declined' && 'Dieses Angebot wurde vom Brautpaar abgelehnt.'}
          {offer.status === 'superseded' && 'Dieses Angebot wurde durch eine neuere Version ersetzt.'}
        </div>
      )}

      {/* Positionen */}
      <Section title="Positionen" action={editable && (
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <button onClick={recompute} disabled={!!busy} style={{ ...btnGhost, padding: '6px 11px', fontSize: 12 }} title="Aus Preislogik neu berechnen">
            {busy === 'recompute' ? <Loader2 size={13} className="ofe-spin" /> : <RefreshCw size={13} />} Aus Preislogik
          </button>
          <button onClick={() => setBlockMenu(o => !o)} style={{ ...btnGhost, padding: '6px 11px', fontSize: 12 }}>
            <Layers size={13} /> Baustein
          </button>
          {blockMenu && (
            <>
              <div onClick={() => setBlockMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, width: 300, maxHeight: 360, overflowY: 'auto', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: 'var(--shadow-md, 0 12px 40px rgba(0,0,0,0.16))' }}>
                {ownBlocks.length > 0 && <BlockGroup label="Meine Bausteine">
                  {ownBlocks.map(b => <BlockRow key={b.id} label={b.label} type={b.item_type} sub={`${b.default_qty} × ${formatMoney(b.unit_price, cur)}`} onClick={() => { addItem(blockToLineItem({ label: b.label, type: b.item_type, qty: b.default_qty, unitPrice: b.unit_price })); setBlockMenu(false) }} />)}
                </BlockGroup>}
                <BlockGroup label="Branchen-Vorlagen">
                  {gewerkBlocks.map((b, i) => <BlockRow key={i} label={b.label} type={b.type} sub={b.type === 'qty' ? `${b.qty ?? 1} × ${formatMoney(b.unitPrice ?? 0, cur)}` : formatMoney(b.unitPrice ?? 0, cur)} onClick={() => { addItem(blockToLineItem(b)); setBlockMenu(false) }} />)}
                </BlockGroup>
              </div>
            </>
          )}
        </div>
      )}>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {items.length === 0 && <div style={{ padding: 14, fontSize: 13, color: C.dim }}>Noch keine Positionen. Füge Bausteine hinzu oder lege eine Position an.</div>}
          {items.map((li, i) => {
            const type = li.type ?? 'qty'
            return (
              <div key={i} style={{ padding: '10px 12px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', background: type === 'discount' ? 'rgba(197,34,31,0.03)' : 'transparent' }}>
                {editable ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <select value={type} onChange={e => setItem(i, { type: e.target.value as LineItemType, selected: e.target.value === 'optional' ? true : undefined })} style={{ ...inp, width: 104, padding: '0 6px' }}>
                      {(Object.keys(TYPE_LABELS) as LineItemType[]).map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                    </select>
                    <input style={{ ...inp, flex: 1, minWidth: 140 }} value={li.label} onChange={e => setItem(i, { label: e.target.value })} placeholder="Bezeichnung" />
                    {type !== 'flat' && <input style={{ ...inp, width: 56, textAlign: 'right' }} type="number" value={li.qty} onChange={e => setItem(i, { qty: e.target.value === '' ? 0 : parseFloat(e.target.value) })} title="Menge" />}
                    <input style={{ ...inp, width: 88, textAlign: 'right' }} type="number" value={li.unitPrice} onChange={e => setItem(i, { unitPrice: e.target.value === '' ? 0 : parseFloat(e.target.value) })} title={type === 'discount' ? 'Nachlass' : 'Einzelpreis'} />
                    <span style={{ width: 90, textAlign: 'right', fontSize: 13.5, fontWeight: 600, color: effectiveLineTotal(li) < 0 ? C.red : C.text }}>{formatMoney(effectiveLineTotal(li), cur)}</span>
                    <button onClick={() => saveOwnBlock(li)} title="Als Baustein merken" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, display: 'flex', padding: 2 }}><BookmarkPlus size={15} /></button>
                    <button onClick={() => removeItem(i)} title="Entfernen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, display: 'flex', padding: 2 }}><Trash2 size={15} /></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 13.5 }}>{li.label}{type === 'optional' && <span style={{ fontSize: 11, color: C.dim, marginLeft: 6 }}>(optional)</span>}</span>
                    {type !== 'flat' && <span style={{ width: 50, textAlign: 'right', fontSize: 13, color: C.dim }}>{li.qty}×</span>}
                    <span style={{ width: 90, textAlign: 'right', fontSize: 13.5, fontWeight: 600, color: effectiveLineTotal(li) < 0 ? C.red : C.text }}>{formatMoney(effectiveLineTotal(li), cur)}</span>
                  </div>
                )}
              </div>
            )
          })}
          {editable && (
            <div style={{ borderTop: `1px solid ${C.border}`, padding: 8 }}>
              <button onClick={() => addItem()} style={{ ...btnGhost, padding: '6px 11px', fontSize: 12 }}><Plus size={13} /> Position</button>
            </div>
          )}
        </div>

        {/* Summen */}
        <div style={{ marginLeft: 'auto', width: 280, marginTop: 14 }}>
          <SumRow label="Zwischensumme" value={formatMoney(totals.subtotal, cur)} />
          {offer.tax_mode === 'regular' && <SumRow label={`zzgl. USt. (${totals.taxRate}%)`} value={formatMoney(totals.taxAmount, cur)} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.text}`, marginTop: 5, paddingTop: 7 }}>
            <strong style={{ fontSize: 16 }}>Gesamt</strong>
            <strong style={{ fontSize: 16, color: C.gold }}>{formatMoney(totals.total, cur)}</strong>
          </div>
          {offer.tax_mode === 'kleinunternehmer' && <p style={{ fontSize: 10.5, color: C.dim, margin: '6px 0 0' }}>Gemäß §19 UStG keine USt.</p>}
          {depositType !== 'none' && deposit.deposit > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.border}` }}>
              <SumRow label="Anzahlung" value={formatMoney(deposit.deposit, cur)} />
              <SumRow label="Restbetrag" value={formatMoney(deposit.balance, cur)} />
            </div>
          )}
        </div>
      </Section>

      {/* Anzahlung & Zahlung */}
      <Section title="Anzahlung & Zahlung">
        {editable ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="ofe-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 130px 150px', gap: 10 }}>
              <Field label="Anzahlung">
                <select value={depositType} onChange={e => setDepositType(e.target.value as DepositType)} style={{ ...inp, width: '100%' }}>
                  {(Object.keys(DEPOSIT_LABELS) as DepositType[]).map(t => <option key={t} value={t}>{DEPOSIT_LABELS[t]}</option>)}
                </select>
              </Field>
              {depositType !== 'none' && (
                <Field label={depositType === 'percent' ? 'Prozent (%)' : `Betrag (${cur})`}>
                  <input style={{ ...inp, width: '100%' }} type="number" value={depositValue} onChange={e => setDepositValue(e.target.value === '' ? 0 : parseFloat(e.target.value))} />
                </Field>
              )}
              {depositType !== 'none' && (
                <Field label="Fällig (Tage n. Annahme)">
                  <input style={{ ...inp, width: '100%' }} type="number" value={depositDueDays} onChange={e => setDepositDueDays(e.target.value)} placeholder="z. B. 14" />
                </Field>
              )}
            </div>
            <Field label="Restzahlung / Hinweis">
              <input style={{ ...inp, width: '100%' }} value={balanceDueNote} onChange={e => setBalanceDueNote(e.target.value)} placeholder="z. B. Restbetrag bis 14 Tage vor dem Event" />
            </Field>
            <Field label="Zahlungsbedingungen">
              <textarea style={{ ...txt, width: '100%', minHeight: 56 }} value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="z. B. Überweisung, Zahlungsziel, Bankverbindung …" />
            </Field>
          </div>
        ) : (
          <ReadList rows={[
            depositType !== 'none' ? ['Anzahlung', `${formatMoney(deposit.deposit, cur)}${depositDueDays ? ` (fällig ${depositDueDays} Tage nach Annahme)` : ''}`] : null,
            balanceDueNote ? ['Restzahlung', balanceDueNote] : null,
            paymentTerms ? ['Zahlungsbedingungen', paymentTerms] : null,
          ]} empty="Keine Zahlungsangaben." />
        )}
      </Section>

      {/* AGB / Stornobedingungen */}
      <Section title="AGB & Stornobedingungen">
        {editable ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea style={{ ...txt, width: '100%', minHeight: 90 }} value={agbText} onChange={e => setAgbText(e.target.value)} placeholder="AGB, Stornobedingungen, Leistungsumfang … Das Brautpaar bestätigt diese bei der Annahme." />
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text }}>
              <ToggleSwitch checked={agbRequired} onChange={v => setAgbRequired(v)} size="sm" aria-label="AGB-Bestätigung verpflichtend" />
              Bestätigung der AGB ist für die Annahme verpflichtend
            </span>
          </div>
        ) : (
          agbText ? <p style={{ fontSize: 13, color: C.text, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{agbText}</p> : <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>Keine AGB hinterlegt.</p>
        )}
      </Section>

      {/* Anmerkungen + Gültigkeit */}
      <Section title="Anmerkungen & Gültigkeit">
        {editable ? (
          <div className="ofe-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 170px', gap: 12 }}>
            <Field label={eventId === null ? 'Anmerkungen an den Kunden' : 'Anmerkungen ans Brautpaar'}>
              <textarea style={{ ...txt, width: '100%', minHeight: 56 }} value={notes} onChange={e => setNotes(e.target.value)} />
            </Field>
            <Field label="Gültig bis">
              <input style={{ ...inp, width: '100%' }} type="date" value={validUntil ?? ''} onChange={e => setValidUntil(e.target.value)} />
            </Field>
          </div>
        ) : (
          <ReadList rows={[
            notes ? ['Anmerkungen', notes] : null,
            validUntil ? ['Gültig bis', new Date(validUntil).toLocaleDateString('de-DE')] : null,
          ]} empty="Keine Anmerkungen." />
        )}
      </Section>

      {/* Aktionen */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 22, borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {editable ? (
          <>
            <button onClick={remove} disabled={!!busy} style={{ ...btnGhost, color: C.red, borderColor: 'rgba(197,34,31,0.3)' }}><Trash2 size={15} /> Löschen</button>
            <button onClick={() => patch('save')} disabled={!!busy} style={btnGhost}>
              {busy === 'save' ? <Loader2 size={15} className="ofe-spin" /> : <Save size={15} />} Entwurf speichern
            </button>
            {eventId === null && (
              <button onClick={() => setAcceptOpen(true)} disabled={!!busy} style={btnGhost} title="Als angenommen markieren und ein Event daraus anlegen">
                <CalendarPlus size={15} /> Annehmen & Event anlegen
              </button>
            )}
            <button onClick={() => patch('release')} disabled={!!busy} style={{ ...btn, background: '#1E7E34', color: '#fff' }}>
              {busy === 'release' ? <Loader2 size={15} className="ofe-spin" /> : <Check size={15} />} Freigeben & senden
            </button>
          </>
        ) : (
          <>
            {eventId && <Link href={`/vendor/dashboard/${eventId}/kommunikation`} style={{ ...btnGhost, textDecoration: 'none' }}><MessageSquare size={15} /> Zur Kommunikation</Link>}
            {eventId === null && offer.status === 'released' && (
              <button onClick={() => setAcceptOpen(true)} disabled={!!busy} style={{ ...btn, background: '#1E7E34', color: '#fff' }} title="Als angenommen markieren und ein Event daraus anlegen">
                <CalendarPlus size={15} /> Annehmen & Event anlegen
              </button>
            )}
            {offer.status !== 'superseded' && (
              <button onClick={supersede} disabled={!!busy} style={{ ...btn, background: C.gold, color: '#fff' }}>
                {busy === 'supersede' ? <Loader2 size={15} className="ofe-spin" /> : <Copy size={15} />} Neue Version
              </button>
            )}
          </>
        )}
      </div>

      {acceptOpen && (
        <AcceptDialog
          defaults={{ eventTitle: title, coupleName: clientName }}
          busy={busy === 'accept'}
          onClose={() => setAcceptOpen(false)}
          onConfirm={acceptStandalone}
        />
      )}
      </div>
      </div>{/* end left wrapper */}

      {/* ── Drag divider ── */}
      <div
        className="ofe-divider"
        onPointerDown={onDividerPointerDown}
        style={{
          width: 16, flexShrink: 0, cursor: 'col-resize',
          display: 'flex', alignItems: 'stretch', justifyContent: 'center',
          alignSelf: 'stretch', position: 'relative',
        }}
      >
        <div style={{ width: 4, borderRadius: 4, background: 'var(--border2, rgba(35,82,200,0.18))', transition: 'background 0.15s' }} className="ofe-divider-bar" />
      </div>

      {/* ── Right column: PDF preview ── */}
      <div className="ofe-preview" style={{ flex: 1, minWidth: 0, position: 'sticky', top: 20 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vorschau</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button onClick={() => setPdfKey(k => k + 1)} title="Aktualisieren" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, display: 'flex', padding: 4 }}>
                <RefreshCw size={14} />
              </button>
              <a
                href={pdfUrl}
                download={`${(title || 'Angebot').replace(/[^\w-]+/g, '_')}.pdf`}
                title="PDF herunterladen"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, display: 'flex', padding: 4, textDecoration: 'none' }}
              >
                <Download size={14} />
              </a>
            </div>
          </div>
          <iframe
            key={pdfKey}
            src={pdfUrl}
            style={{ flex: 1, border: 'none', background: '#f8f8f6' }}
            title="PDF-Vorschau"
          />
        </div>
      </div>

    </div>{/* end grid */}



    <style>{`
      .ofe-spin{animation:ofespin 1s linear infinite}@keyframes ofespin{to{transform:rotate(360deg)}}
      .ofe-divider-bar{background:var(--border2,rgba(35,82,200,0.18))}
      .ofe-divider:hover .ofe-divider-bar,.ofe-divider:active .ofe-divider-bar{background:var(--accent,#2352C8)!important}
      @media(max-width:900px){.ofe-preview{display:none!important}.ofe-divider{display:none!important}}
    `}</style>
  </div>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24, paddingTop: 22, borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.dim, margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ fontSize: 11.5, fontWeight: 600, color: C.dim, display: 'block', marginBottom: 5 }}>{label}</label>{children}</div>
}
function SumRow({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13.5 }}><span style={{ color: C.dim }}>{label}</span><span>{value}</span></div>
}
function ReadList({ rows, empty }: { rows: (string[] | null)[]; empty: string }) {
  const visible = rows.filter((r): r is string[] => !!r)
  if (visible.length === 0) return <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>{empty}</p>
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{visible.map(([l, v], i) => (
    <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13.5 }}>
      <span style={{ color: C.dim, width: 150, flexShrink: 0 }}>{l}</span>
      <span style={{ color: C.text, flex: 1, whiteSpace: 'pre-wrap' }}>{v}</span>
    </div>
  ))}</div>
}
function BlockGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.dim, padding: '10px 12px 4px' }}>{label}</div>{children}</div>
}
function BlockRow({ label, type, sub, onClick }: { label: string; type: LineItemType; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
      onMouseEnter={e => (e.currentTarget.style.background = C.bg)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
      <Plus size={13} style={{ color: C.gold, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 11, color: C.dim }}>{TYPE_LABELS[type]} · {sub}</span>
      </span>
    </button>
  )
}

// Dialog: eigenständiges Angebot annehmen -> Event anlegen. Vorbefüllt aus dem
// Angebot, restliche Felder optional.
function AcceptDialog({ defaults, busy, onClose, onConfirm }: {
  defaults: { eventTitle: string; coupleName: string }
  busy: boolean
  onClose: () => void
  onConfirm: (fields: Record<string, string>) => void
}) {
  const [eventTitle, setEventTitle] = useState(defaults.eventTitle || '')
  const [coupleName, setCoupleName] = useState(defaults.coupleName || '')
  const [eventDate, setEventDate] = useState('')
  const [venue, setVenue] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [eventType, setEventType] = useState('hochzeit')

  const lblS: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: C.dim, marginBottom: 5 }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 16, width: 520, maxWidth: '100%', maxHeight: '90dvh', overflow: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <CalendarPlus size={18} style={{ color: C.gold }} />
          <h3 style={{ flex: 1, margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>Angebot annehmen &amp; Event anlegen</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 12.5, color: C.dim, margin: 0, lineHeight: 1.5 }}>
            Aus diesem Angebot wird ein Event erstellt. Die Daten sind aus dem Angebot vorausgefüllt — du kannst sie ergänzen. Alle Felder außer dem Titel sind optional und später im Event anpassbar.
          </p>
          <div>
            <label style={lblS}>Event-Titel *</label>
            <input style={{ ...inp, width: '100%' }} value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="z. B. Hochzeit Müller" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lblS}>Kunde / Brautpaar</label>
              <input style={{ ...inp, width: '100%' }} value={coupleName} onChange={e => setCoupleName(e.target.value)} placeholder="Name" />
            </div>
            <div>
              <label style={lblS}>Datum</label>
              <input style={{ ...inp, width: '100%' }} type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lblS}>Location</label>
              <input style={{ ...inp, width: '100%' }} value={venue} onChange={e => setVenue(e.target.value)} placeholder="z. B. Schloss Eichberg" />
            </div>
            <div>
              <label style={lblS}>Adresse</label>
              <input style={{ ...inp, width: '100%' }} value={venueAddress} onChange={e => setVenueAddress(e.target.value)} placeholder="Straße, PLZ Ort" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lblS}>Gästezahl</label>
              <input style={{ ...inp, width: '100%' }} type="number" min={0} value={guestCount} onChange={e => setGuestCount(e.target.value)} placeholder="z. B. 80" />
            </div>
            <div>
              <label style={lblS}>Event-Typ</label>
              <select style={{ ...inp, width: '100%' }} value={eventType} onChange={e => setEventType(e.target.value)}>
                <option value="hochzeit">Hochzeit</option>
                <option value="firmenevent">Firmenevent</option>
                <option value="intern">Sonstiges</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={onClose} style={btnGhost}>Abbrechen</button>
          <button
            onClick={() => onConfirm({ eventTitle, coupleName, eventDate, venue, venueAddress, guestCount, eventType })}
            disabled={busy || !eventTitle.trim()}
            style={{ ...btn, background: '#1E7E34', color: '#fff', opacity: busy || !eventTitle.trim() ? 0.6 : 1 }}
          >
            {busy ? <Loader2 size={15} className="ofe-spin" /> : <Check size={15} />} Event anlegen
          </button>
        </div>
      </div>
    </div>
  )
}
