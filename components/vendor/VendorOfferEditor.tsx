'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, RefreshCw, Save, Check, X, FileDown, MessageSquare, ClipboardList, ReceiptText, Calendar, MapPin, Users } from 'lucide-react'
import Link from 'next/link'
import { formatMoney, type Answer } from '@/lib/vendor/questionnaire'
import PdfPreviewModal from '@/components/pdf/PdfPreviewModal'

interface LineItem { label: string; qty: number; unitPrice: number; total: number }
interface StandardInfo { coupleName?: string | null; date?: string | null; guestCount?: number | null; location?: string | null; eventType?: string | null; budget?: number | null }
interface Offer {
  status: 'draft' | 'released' | 'accepted' | 'declined'
  line_items: LineItem[]
  answers: Answer[]
  standard_info: StandardInfo
  tax_mode: 'regular' | 'kleinunternehmer' | 'none'
  tax_rate: number
  currency: string
  valid_until: string | null
  vendor_notes: string
}

const C = { border: 'var(--border)', text: 'var(--text)', dim: 'var(--text-dim)', gold: 'var(--gold)', red: 'var(--red, #C5221F)', surface: 'var(--surface)', bg: 'var(--bg)' }
const inp: React.CSSProperties = { padding: '7px 9px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: C.text }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid transparent' }
const btnGhost: React.CSSProperties = { ...btn, background: C.surface, color: C.text, border: `1px solid ${C.border}` }

type View = 'antworten' | 'angebot'

interface Props {
  requestId: string
  eventId: string
  requestStatus: 'pending' | 'accepted' | 'declined' | 'cancelled'
  onChanged: () => void
}

export default function VendorOfferEditor({ requestId, eventId, requestStatus, onChanged }: Props) {
  const [loading, setLoading] = useState(true)
  const [offer, setOffer] = useState<Offer | null>(null)
  const [items, setItems] = useState<LineItem[]>([])
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [view, setView] = useState<View>('antworten')
  const [pdfPreview, setPdfPreview] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/vendor/offers/${requestId}`)
    const d = await res.json().catch(() => ({}))
    const o: Offer | null = d.offer ?? null
    setOffer(o)
    if (o) { setItems(o.line_items ?? []); setNotes(o.vendor_notes ?? ''); setValidUntil(o.valid_until ?? '') }
    setLoading(false)
  }, [requestId])
  useEffect(() => { load() }, [load])

  const editable = offer?.status === 'draft'
  const totals = useMemo(() => {
    const cur = offer?.currency || 'EUR'
    const subtotal = items.reduce((s, li) => s + (Number(li.total) || 0), 0)
    const rate = offer?.tax_mode === 'regular' ? Number(offer?.tax_rate || 0) : 0
    const tax = subtotal * rate / 100
    return { cur, subtotal, tax, total: subtotal + tax, rate }
  }, [items, offer])

  function setItem(i: number, patch: Partial<LineItem>) {
    setItems(prev => prev.map((li, idx) => {
      if (idx !== i) return li
      const next = { ...li, ...patch }
      next.total = Math.round((Number(next.qty) || 0) * (Number(next.unitPrice) || 0) * 100) / 100
      return next
    }))
  }
  function addItem() { setItems(prev => [...prev, { label: '', qty: 1, unitPrice: 0, total: 0 }]) }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  async function patch(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setErr('')
    const res = await fetch(`/api/vendor/offers/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, lineItems: items, vendorNotes: notes, validUntil, ...extra }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { setErr(d.error ?? 'Fehler'); return false }
    await load(); onChanged()
    return true
  }

  async function recompute() {
    setBusy('recompute'); setErr('')
    const res = await fetch(`/api/vendor/offers/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'recompute' }),
    })
    setBusy(null)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error ?? 'Fehler'); return }
    await load()
  }

  // Fallback-Anfrage ohne Angebot: klassisches Annehmen/Ablehnen.
  async function requestAct(action: 'accept' | 'decline') {
    setBusy(action)
    await fetch(`/api/marketplace/requests/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    setBusy(null); onChanged()
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.dim, fontSize: 13, padding: '8px 0' }}><Loader2 size={15} className="anf-spin" /> Lädt Angebot…</div>

  // Kein Auto-Angebot → Fallback-Aktionen.
  if (!offer) {
    if (requestStatus === 'pending') {
      return (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => requestAct('decline')} disabled={!!busy} style={btnGhost}><X size={15} /> Ablehnen</button>
          <button onClick={() => requestAct('accept')} disabled={!!busy} style={{ ...btn, background: '#1E7E34', color: '#fff' }}>
            {busy ? <Loader2 size={15} className="anf-spin" /> : <Check size={15} />} Annehmen
          </button>
        </div>
      )
    }
    if (requestStatus === 'accepted') {
      return <Link href={`/vendor/dashboard/${eventId}/kommunikation`} style={{ ...btn, background: C.gold, color: '#fff', textDecoration: 'none' }}><MessageSquare size={15} /> Zur Kommunikation</Link>
    }
    return null
  }

  return (
    <div data-tour="vdr-offer-editor">
      {/* Segmented toggle (Design wie Aufgaben & Notizen) */}
      <div data-tour="vdr-offer-tabs" style={{ display: 'inline-flex', gap: 4, padding: 4, marginBottom: 16, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}>
        {([['antworten', 'Antworten', <ClipboardList key="a" size={15} />], ['angebot', 'Angebot', <ReceiptText key="o" size={15} />]] as [View, string, React.ReactNode][]).map(([key, label, icon]) => {
          const active = view === key
          return (
            <button key={key} onClick={() => setView(key)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: active ? C.surface : 'transparent', boxShadow: active ? 'var(--shadow-sm)' : 'none',
              color: active ? C.text : C.dim, fontSize: 13.5, fontWeight: active ? 600 : 450, fontFamily: 'inherit', transition: 'background 0.12s',
            }}>
              {icon}{label}
            </button>
          )
        })}
      </div>

      {err && <p style={{ color: C.red, fontSize: 12.5, margin: '0 0 8px' }}>{err}</p>}

      {view === 'antworten' ? (
        <AnswersView answers={offer.answers ?? []} info={offer.standard_info ?? {}} />
      ) : (
        <OfferBody
          offer={offer} items={items} editable={!!editable} totals={totals}
          notes={notes} setNotes={setNotes} validUntil={validUntil} setValidUntil={setValidUntil}
          setItem={setItem} addItem={addItem} removeItem={removeItem}
          busy={busy} onRecompute={recompute}
        />
      )}

      {/* Aktionen (immer sichtbar) */}
      <div data-tour="vdr-offer-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setPdfPreview(true)} style={btnGhost}><FileDown size={15} /> PDF-Vorschau</button>
        {editable ? (
          <>
            <button onClick={() => requestAct('decline')} disabled={!!busy} style={btnGhost}><X size={15} /> Anfrage ablehnen</button>
            <button onClick={() => patch('save')} disabled={!!busy} style={btnGhost}>
              {busy === 'save' ? <Loader2 size={15} className="anf-spin" /> : <Save size={15} />} Entwurf speichern
            </button>
            <button onClick={() => patch('release')} disabled={!!busy} style={{ ...btn, background: '#1E7E34', color: '#fff' }}>
              {busy === 'release' ? <Loader2 size={15} className="anf-spin" /> : <Check size={15} />} Angebot freigeben
            </button>
          </>
        ) : (
          <Link href={`/vendor/dashboard/${eventId}/kommunikation`} style={{ ...btn, background: C.gold, color: '#fff', textDecoration: 'none' }}><MessageSquare size={15} /> Zur Kommunikation</Link>
        )}
      </div>

      {pdfPreview && (
        <PdfPreviewModal
          url={`/api/vendor/offers/${requestId}/pdf`}
          title="Angebot – Vorschau"
          fileName="Angebot.pdf"
          onClose={() => setPdfPreview(false)}
        />
      )}
    </div>
  )
}

function AnswersView({ answers, info }: { answers: Answer[]; info: StandardInfo }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Answer[]>()
    for (const a of answers) {
      const key = a.sectionTitle || 'Angaben'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return Array.from(map.entries())
  }, [answers])

  return (
    <div>
      {/* Eckdaten */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 16 }}>
        {info.date && <Eck icon={<Calendar size={13} />} text={new Date(info.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })} />}
        {info.location && <Eck icon={<MapPin size={13} />} text={info.location} />}
        {info.guestCount ? <Eck icon={<Users size={13} />} text={`${info.guestCount} Gäste`} /> : null}
      </div>

      {grouped.length === 0 ? (
        <p style={{ fontSize: 13, color: C.dim, margin: 0 }}>Keine Angaben aus dem Fragebogen.</p>
      ) : grouped.map(([section, items]) => (
        <div key={section} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.dim, marginBottom: 8 }}>{section}</div>
          {items.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13, padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.dim, flex: 1 }}>{a.label}</span>
              <span style={{ color: C.text, fontWeight: 500, flex: 1, textAlign: 'right' }}>{a.display}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Eck({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.dim }}>
      <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>{text}
    </span>
  )
}

function OfferBody({ offer, items, editable, totals, notes, setNotes, validUntil, setValidUntil, setItem, addItem, removeItem, busy, onRecompute }: {
  offer: Offer; items: LineItem[]; editable: boolean
  totals: { cur: string; subtotal: number; tax: number; total: number; rate: number }
  notes: string; setNotes: (v: string) => void; validUntil: string; setValidUntil: (v: string) => void
  setItem: (i: number, patch: Partial<LineItem>) => void; addItem: () => void; removeItem: (i: number) => void
  busy: string | null; onRecompute: () => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.dim, margin: 0 }}>
          {editable ? 'Automatisches Angebot (Entwurf)' : 'Angebot'}
        </h3>
        {editable && (
          <button onClick={onRecompute} disabled={!!busy} style={{ ...btnGhost, padding: '6px 11px', fontSize: 12 }} title="Aus den Antworten neu berechnen">
            {busy === 'recompute' ? <Loader2 size={13} className="anf-spin" /> : <RefreshCw size={13} />} Neu berechnen
          </button>
        )}
      </div>

      {/* Positionen */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', fontSize: 10.5, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 10px', background: C.bg }}>
          <span style={{ flex: 1 }}>Position</span>
          <span style={{ width: 50, textAlign: 'right' }}>Menge</span>
          <span style={{ width: 80, textAlign: 'right' }}>Einzel</span>
          <span style={{ width: 84, textAlign: 'right' }}>Summe</span>
          {editable && <span style={{ width: 28 }} />}
        </div>
        {items.length === 0 && <div style={{ padding: '10px', fontSize: 13, color: C.dim }}>Keine Positionen.</div>}
        {items.map((li, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderTop: `1px solid ${C.border}` }}>
            {editable ? (
              <>
                <input style={{ ...inp, flex: 1, minWidth: 0 }} value={li.label} onChange={e => setItem(i, { label: e.target.value })} placeholder="Bezeichnung" />
                <input style={{ ...inp, width: 50, textAlign: 'right' }} type="number" value={li.qty} onChange={e => setItem(i, { qty: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                <input style={{ ...inp, width: 80, textAlign: 'right' }} type="number" value={li.unitPrice} onChange={e => setItem(i, { unitPrice: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                <span style={{ width: 84, textAlign: 'right', fontSize: 13 }}>{formatMoney(li.total, totals.cur)}</span>
                <button onClick={() => removeItem(i)} style={{ width: 28, background: 'none', border: 'none', cursor: 'pointer', color: C.red, display: 'flex', justifyContent: 'center' }}><Trash2 size={14} /></button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 13 }}>{li.label}</span>
                <span style={{ width: 50, textAlign: 'right', fontSize: 13 }}>{li.qty}</span>
                <span style={{ width: 80, textAlign: 'right', fontSize: 13 }}>{formatMoney(li.unitPrice, totals.cur)}</span>
                <span style={{ width: 84, textAlign: 'right', fontSize: 13 }}>{formatMoney(li.total, totals.cur)}</span>
              </>
            )}
          </div>
        ))}
        {editable && (
          <button onClick={addItem} style={{ ...btnGhost, margin: 8, padding: '6px 11px', fontSize: 12 }}><Plus size={13} /> Position</button>
        )}
      </div>

      {/* Summen */}
      <div style={{ marginLeft: 'auto', width: 240, marginTop: 10 }}>
        <Row label="Zwischensumme" value={formatMoney(totals.subtotal, totals.cur)} />
        {offer.tax_mode === 'regular' && <Row label={`zzgl. USt. (${totals.rate}%)`} value={formatMoney(totals.tax, totals.cur)} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.text}`, marginTop: 4, paddingTop: 6 }}>
          <strong style={{ fontSize: 15 }}>Gesamt</strong>
          <strong style={{ fontSize: 15, color: C.gold }}>{formatMoney(totals.total, totals.cur)}</strong>
        </div>
        {offer.tax_mode === 'kleinunternehmer' && <p style={{ fontSize: 10.5, color: C.dim, margin: '6px 0 0' }}>Gemäß §19 UStG keine USt.</p>}
      </div>

      {editable && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10, marginTop: 14 }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: C.dim, display: 'block', marginBottom: 5 }}>Anmerkungen ans Brautpaar</label>
            <textarea style={{ ...inp, width: '100%', minHeight: 54, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: C.dim, display: 'block', marginBottom: 5 }}>Gültig bis</label>
            <input style={{ ...inp, width: '100%' }} type="date" value={validUntil ?? ''} onChange={e => setValidUntil(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
