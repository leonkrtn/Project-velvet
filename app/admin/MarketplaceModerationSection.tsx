'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Check, X, ShieldCheck, ShieldOff, Ban, RotateCcw, Loader2, Eye } from 'lucide-react'
import { categoryLabel, moderationLabel, type ModerationStatus } from '@/lib/marketplace/types'
import MarketplaceReviewLightbox from './MarketplaceReviewLightbox'

interface Vendor {
  id: string; name: string; company_name: string | null; category: string
  city: string | null; moderation_status: ModerationStatus
  pending_changes: Record<string, unknown> | null; verified: boolean
  published: boolean; rejected_reason: string | null; login_email: string | null
}

const btn: React.CSSProperties = { padding: '7px 13px', borderRadius: 7, border: '1px solid var(--border,#ddd)', background: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }
const btnGreen: React.CSSProperties = { ...btn, background: '#15803D', color: '#fff', border: 'none' }
const btnRed: React.CSSProperties = { ...btn, color: '#B91C1C' }

const FIELD_LABEL: Record<string, string> = {
  name: 'Name', company_name: 'Firma', category: 'Kategorie', street: 'Straße', zip: 'PLZ', city: 'Stadt', logo_r2_key: 'Logo',
}

export default function MarketplaceModerationSection({ card, cardHeader }: { card: React.CSSProperties; cardHeader: React.CSSProperties }) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/marketplace/vendors')
    const json = await res.json().catch(() => ({}))
    setVendors(json.vendors ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // Positive UX: Klick wirkt sofort. Wir aktualisieren den Zustand optimistisch
  // und feuern die Anfrage im Hintergrund — nur bei einem Fehler wird neu geladen.
  function applyOptimistic(id: string, action: string) {
    setVendors(vs => vs.map(v => {
      if (v.id !== id) return v
      const hasPending = !!v.pending_changes && Object.keys(v.pending_changes).length > 0
      switch (action) {
        case 'approve': return hasPending ? { ...v, pending_changes: null } : { ...v, moderation_status: 'approved', published: true, rejected_reason: null }
        case 'reject': return hasPending ? { ...v, pending_changes: null } : { ...v, moderation_status: 'rejected' }
        case 'verify': return { ...v, verified: true }
        case 'unverify': return { ...v, verified: false }
        case 'suspend': return { ...v, moderation_status: 'suspended' }
        case 'unsuspend': return { ...v, moderation_status: 'approved' }
        default: return v
      }
    }))
  }

  function moderate(id: string, action: string, reason?: string) {
    applyOptimistic(id, action)
    fetch(`/api/admin/marketplace/vendors/${id}/moderate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason }),
    }).then(res => { if (!res.ok) load() }).catch(() => load())
  }

  const queue = vendors.filter(v => v.moderation_status === 'pending' || (v.pending_changes && Object.keys(v.pending_changes).length > 0))
  const others = vendors.filter(v => !queue.includes(v))

  const statusColor: Record<string, string> = {
    draft: '#92600A', pending: '#1D4ED8', approved: '#15803D', rejected: '#B91C1C', suspended: '#B91C1C',
  }

  return (
    <div style={{ ...card, marginBottom: 20 }}>
      <div style={cardHeader}><ShieldCheck size={16} /> Marktplatz-Moderation {queue.length > 0 && <span style={{ marginLeft: 6, background: '#1D4ED8', color: '#fff', borderRadius: 999, padding: '1px 8px', fontSize: 11 }}>{queue.length}</span>}</div>
      <div style={{ padding: 18 }}>
        {loading ? <Loader2 className="bp-spin" /> : (
          <>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#5A6068', margin: '0 0 10px' }}>Prüf-Warteschlange</h4>
            {queue.length === 0 && <p style={{ fontSize: 13, color: '#9AA0A8', margin: '0 0 18px' }}>Nichts zu prüfen.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
              {queue.map(v => {
                const pc = v.pending_changes && Object.keys(v.pending_changes).length > 0 ? v.pending_changes : null
                return (
                  <div key={v.id} style={{ border: '1px solid var(--border,#E2E4E8)', borderRadius: 9, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <strong style={{ fontSize: 14 }}>{v.company_name || v.name}</strong>
                        <span style={{ fontSize: 12, color: '#9AA0A8', marginLeft: 8 }}>{categoryLabel(v.category)}{v.city ? ` · ${v.city}` : ''}</span>
                        <div style={{ fontSize: 12, color: '#5A6068', marginTop: 2 }}>{v.login_email}</div>
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: statusColor[v.moderation_status], alignSelf: 'flex-start' }}>
                        {pc ? 'Änderungen in Prüfung' : moderationLabel(v.moderation_status)}
                      </span>
                    </div>

                    {pc && (
                      <div style={{ marginTop: 10, background: '#F8F9FB', borderRadius: 8, padding: '8px 12px', fontSize: 12.5 }}>
                        <div style={{ fontWeight: 700, color: '#5A6068', marginBottom: 4 }}>Geänderte Felder:</div>
                        {Object.entries(pc).map(([k, val]) => (
                          <div key={k} style={{ color: '#1A1D21' }}>
                            <b>{FIELD_LABEL[k] ?? k}:</b> {k === 'logo_r2_key' ? '(neues Logo)' : String(val ?? '—')}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <button style={{ ...btn, borderColor: '#1D4ED8', color: '#1D4ED8', fontWeight: 700 }} onClick={() => setReviewing(v.id)}>
                        <Eye size={13} /> Prüfen (Vorschau)
                      </button>
                      <button style={btnGreen} onClick={() => moderate(v.id, 'approve')}>
                        <Check size={13} /> {pc ? 'Änderungen übernehmen' : 'Freigeben'}
                      </button>
                      <button style={btnRed} onClick={() => {
                        const reason = pc ? undefined : (prompt('Ablehnungsgrund (für den Anbieter sichtbar):') ?? '')
                        if (!pc && reason === '') return
                        moderate(v.id, 'reject', reason)
                      }}>
                        <X size={13} /> {pc ? 'Änderungen verwerfen' : 'Ablehnen'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#5A6068', margin: '0 0 10px' }}>Alle Marktplatz-Profile</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {others.map(v => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, border: '1px solid var(--border,#E2E4E8)', borderRadius: 9, padding: '10px 14px', flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ fontSize: 13.5 }}>{v.company_name || v.name}</strong>
                    <span style={{ fontSize: 12, color: '#9AA0A8', marginLeft: 8 }}>{categoryLabel(v.category)}</span>
                    {v.verified && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#15803D' }}>✓ Verifiziert</span>}
                    <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: statusColor[v.moderation_status] }}>{moderationLabel(v.moderation_status)}{v.published ? ' · online' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {v.verified
                      ? <button style={btn} onClick={() => moderate(v.id, 'unverify')}><ShieldOff size={13} /> Verifizierung entziehen</button>
                      : <button style={btn} onClick={() => moderate(v.id, 'verify')}><ShieldCheck size={13} /> Verifizieren</button>}
                    {v.moderation_status === 'suspended'
                      ? <button style={btn} onClick={() => moderate(v.id, 'unsuspend')}><RotateCcw size={13} /> Entsperren</button>
                      : v.moderation_status === 'approved' && <button style={btnRed} onClick={() => moderate(v.id, 'suspend')}><Ban size={13} /> Sperren</button>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {reviewing && (
        <MarketplaceReviewLightbox
          vendorId={reviewing}
          onClose={() => setReviewing(null)}
          onModerate={(action, reason) => moderate(reviewing, action, reason)}
        />
      )}
    </div>
  )
}
