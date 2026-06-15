'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, Check, MessageSquare, X, Euro } from 'lucide-react'
import { categoryLabel } from '@/lib/marketplace/types'

interface Req {
  id: string
  dienstleister_id: string
  message: string
  budget: number | null
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  conversation_id: string | null
  created_at: string
  dienstleister_profiles?: { name: string; company_name: string | null; category: string } | null
}

const END_REASONS = [
  'Wir haben uns für einen anderen Dienstleister entschieden',
  'Budget passt nicht',
  'Termin nicht verfügbar',
  'Keine Einigung erzielt',
  'Sonstiges',
]

export default function MeineAnfragen({ eventId }: { eventId: string }) {
  const [requests, setRequests] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [endFor, setEndFor] = useState<Req | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/marketplace/requests?eventId=${eventId}`)
    const json = await res.json()
    setRequests((json.requests ?? []).filter((r: Req) => r.status === 'pending' || r.status === 'accepted'))
    setLoading(false)
  }, [eventId])
  useEffect(() => { load() }, [load])

  async function withdraw(r: Req) {
    setBusyId(r.id)
    await fetch(`/api/marketplace/requests/${r.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }),
    })
    await load()
    setBusyId(null)
  }

  async function endCollaboration(r: Req, reason: string) {
    setBusyId(r.id)
    await fetch(`/api/marketplace/requests/${r.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end', reason }),
    })
    setEndFor(null)
    await load()
    setBusyId(null)
  }

  if (loading) return <p style={{ color: 'var(--bp-ink-3, #888)' }}>Lädt…</p>
  if (requests.length === 0) {
    return (
      <div className="bp-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <Clock size={26} style={{ opacity: 0.35, marginBottom: 10 }} />
        <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Keine offenen Anfragen</p>
        <p className="bp-caption" style={{ margin: 0 }}>Im Tab „Entdecken" findest du Dienstleister und kannst Anfragen stellen.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {requests.map(r => {
        const name = r.dienstleister_profiles?.company_name || r.dienstleister_profiles?.name || 'Dienstleister'
        const pending = r.status === 'pending'
        return (
          <div key={r.id} className="bp-card" style={{ padding: '1rem 1.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14.5, margin: 0 }}>{name}</p>
                <p className="bp-caption" style={{ margin: '2px 0 0' }}>{categoryLabel(r.dienstleister_profiles?.category)}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, padding: '4px 10px', borderRadius: 100, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: pending ? '#FEF3E0' : '#E6F4EA', color: pending ? '#B26A00' : '#1E7E34' }}>
                {pending ? <Clock size={12} /> : <Check size={12} />} {pending ? 'Offen' : 'Angenommen'}
              </span>
            </div>

            {(r.message || r.budget != null) && (
              <div style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--bp-ink-2, #555)' }}>
                {r.budget != null && <p style={{ display: 'inline-flex', alignItems: 'center', gap: 4, margin: '0 0 4px' }}><Euro size={13} /> {r.budget.toLocaleString('de-DE')} €</p>}
                {r.message && <p style={{ margin: 0, whiteSpace: 'pre-wrap', background: 'var(--bp-bg-soft, #faf9f6)', borderRadius: 8, padding: '8px 10px' }}>{r.message}</p>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {pending ? (
                <button onClick={() => withdraw(r)} disabled={busyId === r.id} className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <X size={14} /> Zurückziehen
                </button>
              ) : (
                <>
                  {r.conversation_id && (
                    <Link href={`/brautpaar/${eventId}/nachrichten`} className="bp-btn bp-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                      <MessageSquare size={14} /> Zum Chat
                    </Link>
                  )}
                  <button onClick={() => setEndFor(r)} disabled={busyId === r.id} className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#C0392B' }}>
                    <X size={14} /> Zusammenarbeit beenden
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}

      {endFor && <EndDialog req={endFor} onClose={() => setEndFor(null)} onConfirm={r => endCollaboration(endFor, r)} busy={busyId === endFor.id} />}
    </div>
  )
}

function EndDialog({ req, onClose, onConfirm, busy }: { req: Req; onClose: () => void; onConfirm: (reason: string) => void; busy: boolean }) {
  const [preset, setPreset] = useState(END_REASONS[0])
  const [freeText, setFreeText] = useState('')
  const isOther = preset === 'Sonstiges'
  const reason = isOther ? freeText.trim() : preset
  const name = req.dienstleister_profiles?.company_name || req.dienstleister_profiles?.name || 'Dienstleister'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, maxWidth: 440, width: '100%', padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Zusammenarbeit beenden</h3>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 14px' }}>Mit <strong>{name}</strong>. Der Zugriff des Dienstleisters auf euer Event wird entfernt. Bitte gib einen Grund an.</p>
        <select value={preset} onChange={e => setPreset(e.target.value)} className="bp-input" style={{ marginBottom: 10 }}>
          {END_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {isOther && (
          <textarea value={freeText} onChange={e => setFreeText(e.target.value)} placeholder="Grund eingeben…" className="bp-input" style={{ minHeight: 70, resize: 'vertical', marginBottom: 10 }} />
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="bp-btn">Abbrechen</button>
          <button onClick={() => onConfirm(reason)} disabled={busy || !reason} className="bp-btn bp-btn-primary" style={{ background: '#C0392B', borderColor: '#C0392B' }}>
            {busy ? 'Beendet…' : 'Beenden'}
          </button>
        </div>
      </div>
    </div>
  )
}
