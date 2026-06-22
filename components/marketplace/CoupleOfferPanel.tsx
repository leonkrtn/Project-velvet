'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Check, X, FileDown, FileText } from 'lucide-react'
import OfferView, { OFFER_STATUS_META, type OfferRow } from '@/components/vendor/OfferView'
import PdfPreviewModal from '@/components/pdf/PdfPreviewModal'

// Zeigt dem Brautpaar das (freigegebene) Angebot zu einer Anfrage.
export default function CoupleOfferPanel({ requestId }: { requestId: string }) {
  const [offer, setOffer] = useState<OfferRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pdfPreview, setPdfPreview] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/marketplace/offers/${requestId}`)
    const d = await res.json().catch(() => ({}))
    setOffer(d.offer ?? null)
    setLoading(false)
  }, [requestId])
  useEffect(() => { load() }, [load])

  async function act(action: 'accept' | 'decline') {
    setBusy(true)
    await fetch(`/api/marketplace/offers/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    await load()
    setBusy(false)
  }

  if (loading) return null
  if (!offer) return null

  const meta = OFFER_STATUS_META[offer.status]
  return (
    <div className="bp-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
          <FileText size={16} style={{ color: 'var(--bp-gold-deep)' }} /> Euer Angebot
        </h4>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: meta.bg, color: meta.fg }}>{meta.label}</span>
      </div>

      <OfferView offer={offer} />

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setPdfPreview(true)} className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FileDown size={15} /> PDF-Vorschau
        </button>
        {offer.status === 'released' && (
          <>
            <button onClick={() => act('decline')} disabled={busy} className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <X size={15} /> Ablehnen
            </button>
            <button onClick={() => act('accept')} disabled={busy} className="bp-btn bp-btn-primary" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {busy ? <Loader2 size={15} className="bp-spin" /> : <Check size={15} />} Angebot annehmen
            </button>
          </>
        )}
      </div>
      {offer.status === 'accepted' && (
        <p style={{ fontSize: 12.5, color: '#15803D', margin: '10px 0 0', fontWeight: 600 }}>Ihr habt dieses Angebot angenommen.</p>
      )}

      {pdfPreview && (
        <PdfPreviewModal
          url={`/api/marketplace/offers/${requestId}/pdf`}
          title="Angebot – Vorschau"
          fileName="Angebot.pdf"
          onClose={() => setPdfPreview(false)}
        />
      )}
    </div>
  )
}
