'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2, Plus, Trash2, RefreshCw, Save, Check, X, FileDown, ChevronLeft,
  ReceiptText, Layers, BookmarkPlus, MessageSquare, Copy, AlertTriangle,
} from 'lucide-react'
import {
  recomputeTotals, effectiveLineTotal, computeDeposit,
  type LineItem, type LineItemType, type DepositType,
} from '@/lib/vendor/pricing'
import { formatMoney, type TaxMode } from '@/lib/vendor/questionnaire'
import { blocksForCategory, blockToLineItem } from '@/lib/vendor/offer-blocks'
import PdfPreviewModal from '@/components/pdf/PdfPreviewModal'

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
}
interface OwnBlock { id: string; label: string; item_type: LineItemType; default_qty: number; unit_price: number }

const C = { border: 'var(--border)', text: 'var(--text)', dim: 'var(--text-dim)', gold: 'var(--gold)', red: 'var(--red, #C5221F)', surface: 'var(--surface)', bg: 'var(--bg)' }
const inp: React.CSSProperties = { padding: '8px 10px', fontSize: 13.5, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: C.text }
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

export default function OfferEditorFull({ eventId, offerId }: { eventId: string; offerId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [offer, setOffer] = useState<Offer | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [ownBlocks, setOwnBlocks] = useState<OwnBlock[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [blockMenu, setBlockMenu] = useState(false)
  const [pdfPreview, setPdfPreview] = useState(false)
  const [pdfKey, setPdfKey] = useState(0)

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
    return {
      title, lineItems: items, vendorNotes: notes, validUntil,
      depositType, depositValue, depositDueDays, balanceDueNote, paymentTerms, agbText, agbRequired,
    }
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
    if (action === 'release') { router.push(`/vendor/dashboard/${eventId}/angebote`); return }
    setPdfKey(k => k + 1)
    await load()
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
    if (d.id) router.push(`/vendor/dashboard/${eventId}/angebote/${d.id}`)
  }

  async function remove() {
    if (!confirm('Diesen Entwurf löschen?')) return
    setBusy('delete')
    await fetch(`/api/vendor/event-offers/${offerId}`, { method: 'DELETE' })
    router.push(`/vendor/dashboard/${eventId}/angebote`)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.dim, fontSize: 14, padding: '40px 0', justifyContent: 'center' }}><Loader2 size={16} className="ofe-spin" /> Lädt…</div>
  if (!offer) return <div style={{ padding: 40, textAlign: 'center', color: C.dim }}>Angebot nicht gefunden.</div>

  const gewerkBlocks = blocksForCategory(category)

  const pdfUrl = `/api/vendor/event-offers/${offerId}/pdf`

  return (
    <div style={{ paddingBottom: 40 }}>
      <Link href={`/vendor/dashboard/${eventId}/angebote`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: C.dim, textDecoration: 'none', marginBottom: 16 }}>
        <ChevronLeft size={15} /> Alle Angebote
      </Link>

      <div className="ofe-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20, alignItems: 'start' }}>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '26px 30px' }}>
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
                    <select value={type} onChange={e => setItem(i, { type: e.target.value as LineItemType, selected: e.target.value === 'optional' ? true : undefined })} style={{ ...inp, width: 104, padding: '7px 6px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 150px', gap: 10 }}>
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
              <textarea style={{ ...inp, width: '100%', minHeight: 56, resize: 'vertical' }} value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="z. B. Überweisung, Zahlungsziel, Bankverbindung …" />
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
            <textarea style={{ ...inp, width: '100%', minHeight: 90, resize: 'vertical' }} value={agbText} onChange={e => setAgbText(e.target.value)} placeholder="AGB, Stornobedingungen, Leistungsumfang … Das Brautpaar bestätigt diese bei der Annahme." />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={agbRequired} onChange={e => setAgbRequired(e.target.checked)} />
              Bestätigung der AGB ist für die Annahme verpflichtend
            </label>
          </div>
        ) : (
          agbText ? <p style={{ fontSize: 13, color: C.text, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{agbText}</p> : <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>Keine AGB hinterlegt.</p>
        )}
      </Section>

      {/* Anmerkungen + Gültigkeit */}
      <Section title="Anmerkungen & Gültigkeit">
        {editable ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 170px', gap: 12 }}>
            <Field label="Anmerkungen ans Brautpaar">
              <textarea style={{ ...inp, width: '100%', minHeight: 56, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
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
        <button onClick={() => setPdfPreview(true)} style={btnGhost}><FileDown size={15} /> PDF-Vorschau</button>
        {editable ? (
          <>
            <button onClick={remove} disabled={!!busy} style={{ ...btnGhost, color: C.red, borderColor: 'rgba(197,34,31,0.3)' }}><Trash2 size={15} /> Löschen</button>
            <button onClick={() => patch('save')} disabled={!!busy} style={btnGhost}>
              {busy === 'save' ? <Loader2 size={15} className="ofe-spin" /> : <Save size={15} />} Entwurf speichern
            </button>
            <button onClick={() => patch('release')} disabled={!!busy} style={{ ...btn, background: '#1E7E34', color: '#fff' }}>
              {busy === 'release' ? <Loader2 size={15} className="ofe-spin" /> : <Check size={15} />} Freigeben & senden
            </button>
          </>
        ) : (
          <>
            <Link href={`/vendor/dashboard/${eventId}/kommunikation`} style={{ ...btnGhost, textDecoration: 'none' }}><MessageSquare size={15} /> Zur Kommunikation</Link>
            {offer.status !== 'superseded' && (
              <button onClick={supersede} disabled={!!busy} style={{ ...btn, background: C.gold, color: '#fff' }}>
                {busy === 'supersede' ? <Loader2 size={15} className="ofe-spin" /> : <Copy size={15} />} Neue Version
              </button>
            )}
          </>
        )}
      </div>
      </div>

      {/* ── Right column: PDF preview ── */}
      <div className="ofe-preview" style={{ position: 'sticky', top: 20 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vorschau</span>
            <button onClick={() => setPdfKey(k => k + 1)} title="Aktualisieren" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, display: 'flex', padding: 4 }}>
              <RefreshCw size={14} />
            </button>
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

    {pdfPreview && (
      <PdfPreviewModal
        url={pdfUrl}
        title={`${title} – Vorschau`}
        fileName={`${title || 'Angebot'}.pdf`}
        onClose={() => setPdfPreview(false)}
      />
    )}

    <style>{`.ofe-spin { animation: ofespin 1s linear infinite; } @keyframes ofespin { to { transform: rotate(360deg); } } @media(max-width:900px){.ofe-grid{grid-template-columns:1fr!important}.ofe-preview{display:none!important}}`}</style>
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
