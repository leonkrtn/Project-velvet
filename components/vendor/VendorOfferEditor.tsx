'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, RefreshCw, Save, Check, X, FileDown, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { formatMoney } from '@/lib/vendor/questionnaire'

interface LineItem { label: string; qty: number; unitPrice: number; total: number }
interface Offer {
  status: 'draft' | 'released' | 'accepted' | 'declined'
  line_items: LineItem[]
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.dim, margin: 0 }}>
          {editable ? 'Automatisches Angebot (Entwurf)' : 'Angebot'}
        </h3>
        {editable && (
          <button onClick={recompute} disabled={!!busy} style={{ ...btnGhost, padding: '6px 11px', fontSize: 12 }} title="Aus den Antworten neu berechnen">
            {busy === 'recompute' ? <Loader2 size={13} className="anf-spin" /> : <RefreshCw size={13} />} Neu berechnen
          </button>
        )}
      </div>

      {err && <p style={{ color: C.red, fontSize: 12.5, margin: '0 0 8px' }}>{err}</p>}

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

      {/* Aktionen */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
        <a href={`/api/vendor/offers/${requestId}/pdf`} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: 'none' }}><FileDown size={15} /> PDF</a>
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
