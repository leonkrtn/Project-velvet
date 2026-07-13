'use client'

import React from 'react'
import { formatMoney } from '@/lib/vendor/questionnaire'

export interface OfferLineItem { label: string; qty: number; unitPrice: number; total: number }
export interface OfferRow {
  status: 'draft' | 'released' | 'accepted' | 'declined'
  line_items: OfferLineItem[]
  subtotal: number
  tax_mode: 'regular' | 'kleinunternehmer' | 'none'
  tax_rate: number
  tax_amount: number
  total: number
  currency: string
  valid_until: string | null
  footer_note: string
  vendor_notes: string
}

export const OFFER_STATUS_META: Record<OfferRow['status'], { label: string; bg: string; fg: string }> = {
  draft: { label: 'Entwurf', bg: 'rgba(0,0,0,0.05)', fg: '#666' },
  released: { label: 'Angebot erhalten', bg: 'rgba(184,153,104,0.14)', fg: '#9a7b3f' },
  accepted: { label: 'Angenommen', bg: 'rgba(30,126,52,0.12)', fg: '#1E7E34' },
  declined: { label: 'Abgelehnt', bg: 'rgba(197,34,31,0.10)', fg: '#C5221F' },
}

const cell: React.CSSProperties = { fontSize: 13, color: 'var(--text, #1c1c1c)' }

export default function OfferView({ offer }: { offer: OfferRow }) {
  const cur = offer.currency || 'EUR'
  return (
    <div>
      <div style={{ borderTop: '1px solid var(--border, #e2ddd4)', marginBottom: 4 }} />
      <div style={{ display: 'flex', fontSize: 11, fontWeight: 700, color: 'var(--text-dim, #6b6b6b)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 0', borderBottom: '1px solid var(--text, #1c1c1c)' }}>
        <span style={{ flex: 1, minWidth: 0 }}>Position</span>
        <span style={{ width: 40, flexShrink: 0, textAlign: 'right' }}>Mng</span>
        <span style={{ width: 80, flexShrink: 0, textAlign: 'right' }}>Einzel</span>
        <span style={{ width: 84, flexShrink: 0, textAlign: 'right' }}>Summe</span>
      </div>
      {offer.line_items.length === 0 ? (
        <div style={{ ...cell, padding: '10px 0', color: 'var(--text-dim, #6b6b6b)' }}>Keine Positionen.</div>
      ) : offer.line_items.map((li, i) => (
        <div key={i} style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid var(--border, #e2ddd4)' }}>
          <span style={{ ...cell, flex: 1, minWidth: 0, paddingRight: 8, wordBreak: 'break-word' }}>{li.label}</span>
          <span style={{ ...cell, width: 40, flexShrink: 0, textAlign: 'right' }}>{li.qty}</span>
          <span style={{ ...cell, width: 80, flexShrink: 0, textAlign: 'right' }}>{formatMoney(li.unitPrice, cur)}</span>
          <span style={{ ...cell, width: 84, flexShrink: 0, textAlign: 'right' }}>{formatMoney(li.total, cur)}</span>
        </div>
      ))}

      <div style={{ marginLeft: 'auto', width: '100%', maxWidth: 240, marginTop: 10 }}>
        <Row label="Zwischensumme" value={formatMoney(offer.subtotal, cur)} />
        {offer.tax_mode === 'regular' && <Row label={`zzgl. USt. (${offer.tax_rate}%)`} value={formatMoney(offer.tax_amount, cur)} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--text, #1c1c1c)', marginTop: 4, paddingTop: 6 }}>
          <strong style={{ fontSize: 15 }}>Gesamt</strong>
          <strong style={{ fontSize: 15, color: 'var(--gold, #B89968)' }}>{formatMoney(offer.total, cur)}</strong>
        </div>
        {offer.tax_mode === 'kleinunternehmer' && (
          <p style={{ fontSize: 10.5, color: 'var(--text-dim, #6b6b6b)', margin: '6px 0 0' }}>Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</p>
        )}
      </div>

      {offer.vendor_notes && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim, #6b6b6b)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Anmerkungen</div>
          <p style={{ fontSize: 13, color: 'var(--text, #1c1c1c)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{offer.vendor_notes}</p>
        </div>
      )}
      {offer.valid_until && (
        <p style={{ fontSize: 12, color: 'var(--text-dim, #6b6b6b)', marginTop: 12 }}>
          Gültig bis {new Date(offer.valid_until).toLocaleDateString('de-DE')}
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim, #6b6b6b)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
