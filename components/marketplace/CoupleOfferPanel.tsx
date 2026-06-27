'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Check, X, FileDown, FileText } from 'lucide-react'
import OfferView, { OFFER_STATUS_META, type OfferRow } from '@/components/vendor/OfferView'
import PdfPreviewModal from '@/components/pdf/PdfPreviewModal'
import { formatMoney } from '@/lib/vendor/questionnaire'

interface LineItem { label: string; qty: number; unitPrice: number; total: number; type?: string; selected?: boolean }
interface Variant { id: string; name: string; line_items: LineItem[]; subtotal: number; tax_amount: number; total: number; is_selected: boolean }

// Zeigt dem Brautpaar das (freigegebene) Angebot zu einer Anfrage.
export default function CoupleOfferPanel({ requestId }: { requestId: string }) {
  const [offer, setOffer] = useState<OfferRow | null>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pdfPreview, setPdfPreview] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/marketplace/offers/${requestId}`)
    const d = await res.json().catch(() => ({}))
    setOffer(d.offer ?? null)
    setVariants(Array.isArray(d.variants) ? d.variants : [])
    setLoading(false)
  }, [requestId])
  useEffect(() => { load() }, [load])

  async function act(action: 'accept' | 'decline', variantId?: string) {
    setBusy(true)
    await fetch(`/api/marketplace/offers/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, variantId }),
    })
    await load()
    setBusy(false)
  }

  if (loading) return null
  if (!offer) return null

  const meta = OFFER_STATUS_META[offer.status]
  const cur = offer.currency || 'EUR'
  const hasVariants = variants.length > 0
  const open = offer.status === 'released'

  return (
    <div className="bp-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
          <FileText size={16} style={{ color: 'var(--bp-gold-deep)' }} /> Euer Angebot
        </h4>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: meta.bg, color: meta.fg }}>{meta.label}</span>
      </div>

      {hasVariants ? (
        <>
          {open && (
            <p style={{ fontSize: 13, color: 'var(--bp-text-soft, #666)', margin: '0 0 12px' }}>
              Wählt eure bevorzugte Variante. Jede Variante könnt ihr als PDF ansehen.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {variants.map(v => {
              const isChosen = chosen === v.id
              const isSelected = v.is_selected
              return (
                <div key={v.id} style={{
                  border: `1.5px solid ${isChosen || isSelected ? 'var(--bp-gold-deep, #B89968)' : 'var(--bp-border, #e5e0d8)'}`,
                  borderRadius: 12, padding: 14,
                  background: isChosen || isSelected ? 'rgba(184,153,104,0.06)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <strong style={{ fontSize: 15 }}>{v.name}</strong>
                    <strong style={{ fontSize: 16, color: 'var(--bp-gold-deep, #B89968)' }}>{formatMoney(Number(v.total) || 0, cur)}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
                    {(v.line_items ?? []).filter(li => !(li.type === 'optional' && li.selected === false)).map((li, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--bp-text-soft, #555)' }}>
                        <span>{li.label}</span>
                        <span>{formatMoney(Number(li.total) || 0, cur)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setPdfPreview(v.id)} className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <FileDown size={14} /> PDF
                    </button>
                    {open && (
                      <button onClick={() => setChosen(v.id)} className={isChosen ? 'bp-btn bp-btn-primary' : 'bp-btn'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        {isChosen ? <><Check size={14} /> Ausgewählt</> : 'Diese wählen'}
                      </button>
                    )}
                    {isSelected && !open && (
                      <span style={{ fontSize: 12.5, color: '#15803D', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Check size={14} /> Angenommen
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <OfferView offer={offer} />
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {!hasVariants && (
          <button onClick={() => setPdfPreview('main')} className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FileDown size={15} /> PDF-Vorschau
          </button>
        )}
        {open && (
          <>
            <button onClick={() => act('decline')} disabled={busy} className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <X size={15} /> Ablehnen
            </button>
            <button
              onClick={() => act('accept', hasVariants ? chosen ?? undefined : undefined)}
              disabled={busy || (hasVariants && !chosen)}
              className="bp-btn bp-btn-primary"
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: hasVariants && !chosen ? 0.6 : 1 }}
            >
              {busy ? <Loader2 size={15} className="bp-spin" /> : <Check size={15} />}
              {hasVariants ? 'Gewählte Variante annehmen' : 'Angebot annehmen'}
            </button>
          </>
        )}
      </div>
      {offer.status === 'accepted' && (
        <p style={{ fontSize: 12.5, color: '#15803D', margin: '10px 0 0', fontWeight: 600 }}>Ihr habt dieses Angebot angenommen.</p>
      )}

      {pdfPreview && (
        <PdfPreviewModal
          url={`/api/marketplace/offers/${requestId}/pdf${pdfPreview !== 'main' ? `?variantId=${pdfPreview}` : ''}`}
          title="Angebot – Vorschau"
          fileName="Angebot.pdf"
          onClose={() => setPdfPreview(null)}
        />
      )}
    </div>
  )
}
