'use client'

import { useState } from 'react'
import { Copy, Check, UserPlus, Briefcase } from 'lucide-react'

interface Props {
  eventId: string
}

type InviteTarget = 'veranstalter' | 'brautpaar_solo'

interface InviteState {
  code: string | null
  loading: boolean
  error: string | null
  copied: boolean
}

const EMPTY: InviteState = { code: null, loading: false, error: null, copied: false }

// Nur für brautpaar_solo sichtbar: Codes generieren, um nachträglich einen
// Veranstalter "dazuzuschalten" oder den Partner / die Partnerin einzuladen.
// Codes werden über /api/invite/create erstellt und unter /join eingelöst.
export default function SoloInviteSection({ eventId }: Props) {
  const [states, setStates] = useState<Record<InviteTarget, InviteState>>({
    veranstalter: { ...EMPTY },
    brautpaar_solo: { ...EMPTY },
  })

  const patch = (target: InviteTarget, p: Partial<InviteState>) =>
    setStates(prev => ({ ...prev, [target]: { ...prev[target], ...p } }))

  async function createCode(target: InviteTarget) {
    patch(target, { loading: true, error: null })
    try {
      const res = await fetch('/api/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, targetRole: target }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Code konnte nicht erstellt werden')
      patch(target, { code: data.code, loading: false })
    } catch (err) {
      patch(target, {
        loading: false,
        error: err instanceof Error ? err.message : 'Code konnte nicht erstellt werden',
      })
    }
  }

  async function copyLink(target: InviteTarget) {
    const state = states[target]
    if (!state.code) return
    const link = `${window.location.origin}/join?code=${state.code}`
    try {
      await navigator.clipboard.writeText(link)
      patch(target, { copied: true })
      setTimeout(() => patch(target, { copied: false }), 2000)
    } catch { /* clipboard nicht verfügbar */ }
  }

  function InviteCard({
    target, icon, title, description, buttonLabel,
  }: {
    target: InviteTarget
    icon: React.ReactNode
    title: string
    description: string
    buttonLabel: string
  }) {
    const state = states[target]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        </div>
        <p className="bp-body" style={{ fontSize: 13, margin: 0 }}>{description}</p>

        {state.code ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{
              flex: '1 1 200px', padding: '10px 12px', fontSize: 13,
              background: 'var(--bp-ivory, #faf7f2)', border: '1px solid var(--bp-border, #e5ddd0)',
              borderRadius: 8, overflowWrap: 'anywhere',
            }}>
              {`${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${state.code}`}
            </code>
            <button
              type="button"
              className="bp-btn"
              onClick={() => copyLink(target)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {state.copied ? <Check size={14} /> : <Copy size={14} />}
              {state.copied ? 'Kopiert' : 'Link kopieren'}
            </button>
          </div>
        ) : (
          <div>
            <button
              type="button"
              className="bp-btn bp-btn-primary"
              onClick={() => createCode(target)}
              disabled={state.loading}
            >
              {state.loading ? 'Erstelle Code …' : buttonLabel}
            </button>
          </div>
        )}

        {state.error && (
          <p style={{ fontSize: 13, color: 'var(--bp-red, #a04040)', margin: 0 }}>{state.error}</p>
        )}
        {state.code && (
          <p className="bp-body" style={{ fontSize: 12, margin: 0, opacity: 0.7 }}>
            Der Link ist 7 Tage gültig und kann einmal eingelöst werden.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="bp-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div className="bp-card-header">
        <h2 className="bp-section-title" style={{ margin: 0 }}>Personen einladen</h2>
      </div>
      <div className="bp-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <InviteCard
          target="brautpaar_solo"
          icon={<UserPlus size={16} />}
          title="Partner / Partnerin einladen"
          description="Lade die zweite Person eures Paares ein — sie erhält denselben vollen Zugriff auf eure Hochzeitsplanung."
          buttonLabel="Partner-Code erstellen"
        />
        <InviteCard
          target="veranstalter"
          icon={<Briefcase size={16} />}
          title="Veranstalter hinzufügen"
          description="Falls ihr euch später professionelle Unterstützung holt: Mit diesem Code kann ein registrierter Veranstalter eurem Event beitreten und die Planung im Veranstalter-Portal übernehmen."
          buttonLabel="Veranstalter-Code erstellen"
        />
      </div>
    </div>
  )
}
