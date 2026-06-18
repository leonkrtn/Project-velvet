'use client'

import React, { useEffect, useState } from 'react'
import { X, Check, Loader2, ShieldCheck } from 'lucide-react'
import VendorMarketplacePreview, { type PreviewVendor, type PreviewPackage, type PreviewFaq, type PreviewReview } from '@/components/marketplace/VendorMarketplacePreview'

interface PreviewData {
  vendor: PreviewVendor
  packages: PreviewPackage[]; faqs: PreviewFaq[]; reviews: PreviewReview[]
  reviewAvg: number; reviewCount: number; availability: string[]
  meta: { moderation_status: string; has_pending: boolean; pending_fields: string[]; login_email: string | null }
}

// Prüf-Checkliste (nur Orientierung — blockiert die Freigabe nicht).
const CHECKLIST = [
  'Firmenname / Anzeigename passend',
  'Kategorie korrekt',
  'Beschreibung aussagekräftig & seriös',
  'Fotos & Titelbild in Ordnung',
  'Stadt / Adresse plausibel',
  'Preisklasse gesetzt',
  'Pakete & Preise sinnvoll',
  'Keine unzulässigen Inhalte / Kontaktdaten im Text',
]

export default function MarketplaceReviewLightbox({ vendorId, onClose, onModerate }: {
  vendorId: string; onClose: () => void; onModerate: (action: string, reason?: string) => void
}) {
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  useEffect(() => {
    (async () => {
      setLoading(true)
      const res = await fetch(`/api/admin/marketplace/vendors/${vendorId}/preview`)
      const json = await res.json().catch(() => null)
      setData(res.ok ? json : null)
      setLoading(false)
    })()
  }, [vendorId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Positive UX: Aktion sofort an den Eltern delegieren (optimistisch) und
  // Lightbox direkt schließen — kein Warten auf den Request.
  function moderate(action: string, reason?: string) {
    onModerate(action, reason); onClose()
  }

  const isChange = data?.meta.has_pending
  const allChecked = checked.size === CHECKLIST.length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(20,22,26,0.55)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 1180, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.3)' }}>
        {/* Kopf */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #E2E4E8', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={18} />
            <strong style={{ fontSize: 15 }}>Profil prüfen</strong>
            {isChange && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', borderRadius: 999, padding: '2px 10px' }}>Änderungen in Prüfung</span>}
            {data?.meta.login_email && <span style={{ fontSize: 12.5, color: '#9AA0A8' }}>{data.meta.login_email}</span>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A6068', display: 'flex' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          {/* Kundenansicht */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--bp-ivory,#f8f8f6)' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 className="bp-spin" /></div>
            ) : data ? (
              <>
                {isChange && (
                  <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#EFF6FF', color: '#1D4ED8', fontSize: 12.5, fontWeight: 600 }}>
                    Vorschau zeigt die vorgeschlagene Version. Geänderte Felder: {data.meta.pending_fields.join(', ') || '—'}
                  </div>
                )}
                <VendorMarketplacePreview
                  vendor={data.vendor} packages={data.packages} faqs={data.faqs}
                  reviews={data.reviews} reviewAvg={data.reviewAvg} reviewCount={data.reviewCount}
                  availability={data.availability}
                />
              </>
            ) : (
              <p style={{ color: '#B91C1C' }}>Vorschau konnte nicht geladen werden.</p>
            )}
          </div>

          {/* Prüf-Panel */}
          <div style={{ width: 300, borderLeft: '1px solid #E2E4E8', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5A6068', marginBottom: 4 }}>Prüf-Checkliste</div>
              <p style={{ fontSize: 11.5, color: '#9AA0A8', margin: '0 0 12px' }}>Zur Orientierung — blockiert die Freigabe nicht.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CHECKLIST.map((item, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#1A1D21', cursor: 'pointer' }}>
                    <input type="checkbox" checked={checked.has(i)} onChange={() => setChecked(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })} style={{ marginTop: 2 }} />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ padding: 16, borderTop: '1px solid #E2E4E8', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11.5, color: allChecked ? '#15803D' : '#9AA0A8', marginBottom: 2 }}>
                {checked.size}/{CHECKLIST.length} geprüft
              </div>
              <button onClick={() => moderate('approve')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 14px', borderRadius: 8, border: 'none', background: '#15803D', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Check size={15} /> {isChange ? 'Änderungen übernehmen' : 'Freigeben & live'}
              </button>
              <button onClick={() => {
                const reason = isChange ? undefined : (prompt('Ablehnungsgrund (für den Anbieter sichtbar):') ?? '')
                if (!isChange && reason === '') return
                moderate('reject', reason)
              }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1px solid #E2E4E8', background: '#fff', color: '#B91C1C', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <X size={15} /> {isChange ? 'Änderungen verwerfen' : 'Ablehnen'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
