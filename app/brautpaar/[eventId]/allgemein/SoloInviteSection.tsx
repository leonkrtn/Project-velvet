'use client'

import { useState, useCallback } from 'react'
import { Copy, Check, UserPlus } from 'lucide-react'

interface Props {
  eventId: string
}

type InviteTarget = 'brautpaar_solo'

interface InviteState {
  code: string | null
  loading: boolean
  error: string | null
  copied: boolean
}

const EMPTY: InviteState = { code: null, loading: false, error: null, copied: false }

// Nur für brautpaar_solo: Partner / Partnerin einladen.
// Veranstalter macht für Solo-Events keinen Sinn (Solo = autonom ohne Organizer).
// Wer administrative Hilfe braucht, fügt einen Trauzeuge (im klassischen Event) hinzu
// oder den Partner als zweite brautpaar_solo.
export default function SoloInviteSection({ eventId }: Props) {
  const [state, setState] = useState<InviteState>(EMPTY)

  const patch = useCallback((p: Partial<InviteState>) =>
    setState(prev => ({ ...prev, ...p })), [])

  async function createCode() {
    patch({ loading: true, error: null })
    try {
      const res = await fetch('/api/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, targetRole: 'brautpaar_solo' }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Code konnte nicht erstellt werden')
      patch({ code: data.code, loading: false })
    } catch (err) {
      patch({
        loading: false,
        error: err instanceof Error ? err.message : 'Code konnte nicht erstellt werden',
      })
    }
  }

  async function copyLink() {
    if (!state.code) return
    const link = `${window.location.origin}/join?code=${state.code}`
    try {
      await navigator.clipboard.writeText(link)
      patch({ copied: true })
      setTimeout(() => patch({ copied: false }), 2000)
    } catch { /* clipboard nicht verfügbar */ }
  }

  return (
    <div className="bp-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div className="bp-card-header">
        <h2 className="bp-section-title" style={{ margin: 0 }}>Partner / Partnerin einladen</h2>
      </div>
      <div className="bp-card-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={16} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Zweite Person des Paares</span>
          </div>
          <p className="bp-body" style={{ fontSize: 13, margin: 0 }}>
            Lade die zweite Person eures Paares ein — sie erhält denselben vollen Zugriff auf eure Hochzeitsplanung. Beide könnten unabhängig voneinander arbeiten und sehen alle Änderungen in Echtzeit.
          </p>

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
                onClick={copyLink}
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
                onClick={createCode}
                disabled={state.loading}
              >
                {state.loading ? 'Erstelle Code …' : 'Partner-Code erstellen'}
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
      </div>
    </div>
  )
}
