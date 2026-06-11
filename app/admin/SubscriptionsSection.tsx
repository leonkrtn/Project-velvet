'use client'

// Admin-Sektion: alle Abos (Solo-Brautpaar-Events) einsehen und verwalten.
// Zahlung ist simuliert — die Aktionen hier setzen den Abo-Zustand direkt.
import React, { useCallback, useEffect, useState } from 'react'
import { CreditCard, Loader2, RefreshCw, AlertCircle } from 'lucide-react'

interface SubRow {
  eventId: string
  eventName: string
  plan: 'trial' | 'basis' | 'pro'
  status: 'trialing' | 'active' | 'canceled'
  effectiveStatus: 'trialing' | 'active' | 'canceled' | 'expired'
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  createdAt: string | null
}

const C = {
  border: '#E2E4E8', text: '#1A1D21', text2: '#5A6068', text3: '#9AA0A8',
  red: '#B91C1C', green: '#15803D', amber: '#B45309',
}

const PLAN_LABEL: Record<string, string> = { trial: 'Trial', basis: 'Velvet (25 €)', pro: 'Velvet Pro (55 €)' }

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  trialing: { label: 'Testphase', color: C.amber, bg: '#FFFBEB' },
  active:   { label: 'Aktiv', color: C.green, bg: '#F0FDF4' },
  canceled: { label: 'Gekündigt', color: C.text2, bg: '#F4F5F7' },
  expired:  { label: 'Abgelaufen', color: C.red, bg: '#FEF2F2' },
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SubscriptionsSection({
  card, cardHeader, btnSecondary,
}: {
  card: React.CSSProperties
  cardHeader: React.CSSProperties
  btnSecondary: React.CSSProperties
}) {
  const [rows, setRows] = useState<SubRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/admin/subscriptions')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Laden fehlgeschlagen')
      setRows(data.subscriptions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function act(eventId: string, action: string, extra: Record<string, unknown> = {}) {
    setBusyId(eventId)
    setError('')
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Aktion fehlgeschlagen')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktion fehlgeschlagen')
    } finally {
      setBusyId(null)
    }
  }

  const selStyle: React.CSSProperties = {
    height: 30, fontSize: 12.5, border: `1px solid ${C.border}`, borderRadius: 6,
    background: '#fff', color: C.text, fontFamily: 'inherit', padding: '0 6px', cursor: 'pointer',
  }

  return (
    <section style={card}>
      <div style={cardHeader}>
        <CreditCard size={16} style={{ color: C.text2 }} />
        Abos (Solo-Brautpaare)
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 400, color: C.text3 }}>Zahlung aktuell simuliert</span>
          <button onClick={() => { setLoading(true); void load() }} style={{ ...btnSecondary, padding: '5px 10px' }}>
            <RefreshCw size={13} />
          </button>
        </span>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', color: C.red, fontSize: 13 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text2, fontSize: 14, padding: '24px 18px' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Wird geladen…
        </div>
      ) : rows.length === 0 ? (
        <p style={{ padding: '20px 18px', fontSize: 13.5, color: C.text2, margin: 0 }}>
          Noch keine Abos vorhanden — sie entstehen automatisch, sobald ein Solo-Brautpaar sein Portal öffnet.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 760 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Event', 'Tarif', 'Status', 'Trial bis', 'Periode bis', 'Aktion'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 18px', fontSize: 11.5, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const badge = STATUS_BADGE[r.effectiveStatus]
                const busy = busyId === r.eventId
                return (
                  <tr key={r.eventId} style={{ borderBottom: `1px solid ${C.border}`, opacity: busy ? 0.55 : 1 }}>
                    <td style={{ padding: '10px 18px', fontWeight: 500, color: C.text }}>{r.eventName}</td>
                    <td style={{ padding: '10px 18px', color: C.text2 }}>{PLAN_LABEL[r.plan] ?? r.plan}</td>
                    <td style={{ padding: '10px 18px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: badge.color, background: badge.bg, borderRadius: 999, padding: '2px 10px', whiteSpace: 'nowrap' }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 18px', color: C.text2, whiteSpace: 'nowrap' }}>{fmt(r.trialEndsAt)}</td>
                    <td style={{ padding: '10px 18px', color: C.text2, whiteSpace: 'nowrap' }}>{fmt(r.currentPeriodEnd)}</td>
                    <td style={{ padding: '10px 18px' }}>
                      <select
                        value=""
                        disabled={busy}
                        onChange={e => {
                          const v = e.target.value
                          if (!v) return
                          if (v === 'basis' || v === 'pro') void act(r.eventId, 'set_plan', { plan: v })
                          else if (v === 'trial7') void act(r.eventId, 'extend_trial', { days: 7 })
                          else if (v === 'trial30') void act(r.eventId, 'extend_trial', { days: 30 })
                          else void act(r.eventId, v)
                        }}
                        style={selStyle}
                      >
                        <option value="">Aktion wählen…</option>
                        <option value="basis">Auf Velvet setzen (aktiv)</option>
                        <option value="pro">Auf Velvet Pro setzen (aktiv)</option>
                        <option value="trial7">Trial verlängern (+7 Tage)</option>
                        <option value="trial30">Trial verlängern (+30 Tage)</option>
                        <option value="grant_free">Dauerhaft freischalten (Pro)</option>
                        {r.status === 'active' && <option value="cancel">Kündigen (zum Periodenende)</option>}
                        {r.status === 'canceled' && <option value="reactivate">Kündigung zurücknehmen</option>}
                        <option value="expire">Sofort ablaufen lassen</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
