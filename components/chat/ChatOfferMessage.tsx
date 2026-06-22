'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { ReceiptText, Loader2, Check, X, FileDown } from 'lucide-react'
import OfferView, { OFFER_STATUS_META, type OfferRow } from '@/components/vendor/OfferView'
import { formatMoney } from '@/lib/vendor/questionnaire'
import PdfPreviewModal from '@/components/pdf/PdfPreviewModal'

// In-Chat-Angebot: Bubble + Modal, self-contained und theme-agnostisch (nutzt
// CSS-Variablen mit Fallbacks). Wird in allen Chat-Renderern (Brautpaar /
// Veranstalter / Dienstleister) bei message_type === 'offer' eingesetzt.
interface Props {
  requestId: string
  side: 'couple' | 'vendor'
  isMe: boolean
  total?: number
  currency?: string
  vendorName?: string
}

const GOLD = 'var(--bp-gold, var(--gold, #B89968))'

export default function ChatOfferMessage({ requestId, side, isMe, total, currency, vendorName }: Props) {
  const [open, setOpen] = useState(false)
  const [offer, setOffer] = useState<OfferRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pdfPreview, setPdfPreview] = useState(false)

  const apiBase = side === 'couple' ? `/api/marketplace/offers/${requestId}` : `/api/vendor/offers/${requestId}`

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const res = await fetch(apiBase)
    const d = await res.json().catch(() => ({}))
    setOffer(d.offer ?? null)
    setLoading(false)
  }, [apiBase])

  useEffect(() => { if (open) load() }, [open, load])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function act(action: 'accept' | 'decline') {
    setBusy(true); setErr('')
    const res = await fetch(apiBase, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErr(d.error ?? 'Fehler'); return }
    await load()
  }

  const meta = offer ? OFFER_STATUS_META[offer.status] : null

  return (
    <>
      {/* Bubble */}
      <button onClick={() => setOpen(true)} style={{
        display: 'block', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
        background: 'var(--surface, #fff)', border: `1px solid ${GOLD}`, borderRadius: 14,
        padding: '12px 14px', maxWidth: 260, minWidth: 200,
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: GOLD, fontWeight: 700, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <ReceiptText size={15} /> Angebot
        </div>
        {vendorName && <div style={{ fontSize: 12, color: 'var(--text-dim, #888)', marginTop: 3 }}>{vendorName}</div>}
        {total != null && (
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text, #1c1c1c)', marginTop: 4 }}>{formatMoney(total, currency || 'EUR')}</div>
        )}
        <div style={{ fontSize: 12, fontWeight: 600, color: GOLD, marginTop: 6 }}>Ansehen ›</div>
      </button>

      {/* Modal */}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface, #fff)', borderRadius: 16, width: 560, maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #eee)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <ReceiptText size={18} style={{ color: GOLD }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, flex: 1, color: 'var(--text, #1c1c1c)' }}>Angebot</h3>
              {meta && <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: meta.bg, color: meta.fg }}>{meta.label}</span>}
              <button onClick={() => setOpen(false)} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex' }}><X size={18} /></button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto' }}>
              {loading ? <div style={{ textAlign: 'center', padding: 30 }}><Loader2 size={20} className="cc-spin" /></div>
                : !offer ? <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Dieses Angebot ist nicht mehr verfügbar.</p>
                : <OfferView offer={offer} />}
              {err && <p style={{ color: '#C62828', fontSize: 12.5, margin: '12px 0 0' }}>{err}</p>}
            </div>

            {offer && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border, #eee)', display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={() => setPdfPreview(true)} style={btnGhost}><FileDown size={15} /> PDF-Vorschau</button>
                {side === 'couple' && offer.status === 'released' && (
                  <>
                    <button onClick={() => act('decline')} disabled={busy} style={btnGhost}><X size={15} /> Ablehnen</button>
                    <button onClick={() => act('accept')} disabled={busy} style={{ ...btnBase, background: '#1E7E34', color: '#fff' }}>
                      {busy ? <Loader2 size={15} className="cc-spin" /> : <Check size={15} />} Angebot annehmen
                    </button>
                  </>
                )}
                {offer.status === 'accepted' && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#15803D', alignSelf: 'center' }}>Angenommen</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {pdfPreview && (
        <PdfPreviewModal
          url={`${apiBase}/pdf`}
          title="Angebot – Vorschau"
          fileName="Angebot.pdf"
          onClose={() => setPdfPreview(false)}
        />
      )}
    </>
  )
}

const btnBase: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid transparent', textDecoration: 'none' }
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface, #fff)', color: 'var(--text, #1c1c1c)', border: '1px solid var(--border, #ddd)' }
