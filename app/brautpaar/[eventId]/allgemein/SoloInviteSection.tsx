'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, UserPlus, Briefcase, Trash2 } from 'lucide-react'

interface Props {
  eventId: string
  /** Eigene User-ID — um den Partner vom eigenen Eintrag zu unterscheiden */
  currentUserId: string
}

type InviteTarget = 'veranstalter' | 'brautpaar_solo'

interface Member {
  id: string
  user_id: string
  role: string
  name: string | null
  email: string | null
}

interface InviteState {
  code: string | null
  loading: boolean
  error: string | null
  copied: boolean
}

const EMPTY: InviteState = { code: null, loading: false, error: null, copied: false }

// Nur für brautpaar_solo sichtbar: Onboarding weiterer Personen.
//   1. Partner / Partnerin als zweites brautpaar_solo (voller Zugriff)
//   2. Veranstalter nachträglich "dazuschalten" — der Code ist nur von
//      registrierten UND freigeschalteten Veranstalter-Konten einlösbar
//      (erzwungen durch redeem_invite_code, Migration 0089). Nach dem
//      Einlösen erscheint das Event im Veranstalter-Dashboard.
// Bereits verbundene Personen werden angezeigt; der Veranstalter kann vom
// Solo-Paar auch wieder entfernt werden (DELETE /api/members/[memberId]).
export default function SoloInviteSection({ eventId, currentUserId }: Props) {
  const [states, setStates] = useState<Record<InviteTarget, InviteState>>({
    veranstalter: { ...EMPTY },
    brautpaar_solo: { ...EMPTY },
  })
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const patch = useCallback((target: InviteTarget, p: Partial<InviteState>) =>
    setStates(prev => ({ ...prev, [target]: { ...prev[target], ...p } })), [])

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/members?eventId=${encodeURIComponent(eventId)}`)
      const data = await res.json()
      if (res.ok && Array.isArray(data.members)) setMembers(data.members)
    } catch { /* nicht kritisch — Invite-Buttons funktionieren trotzdem */ }
    setMembersLoaded(true)
  }, [eventId])

  useEffect(() => { void loadMembers() }, [loadMembers])

  const partner   = members.find(m => m.role === 'brautpaar_solo' && m.user_id !== currentUserId)
  const organizer = members.find(m => m.role === 'veranstalter')

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

  async function removeOrganizer(memberId: string) {
    if (!window.confirm('Veranstalter wirklich aus eurem Event entfernen? Er verliert den Zugriff auf eure Planung.')) return
    setRemovingId(memberId)
    setRemoveError(null)
    try {
      const res = await fetch(`/api/members/${memberId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Entfernen fehlgeschlagen')
      await loadMembers()
      // Frischer Invite-Code-Slot, falls erneut eingeladen werden soll
      patch('veranstalter', { ...EMPTY })
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen')
    } finally {
      setRemovingId(null)
    }
  }

  function ConnectedBadge({ name, email }: { name: string | null; email: string | null }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '10px 14px', borderRadius: 8,
        background: 'var(--bp-ivory, #faf7f2)', border: '1px solid var(--bp-border, #e5ddd0)',
      }}>
        <Check size={15} style={{ color: 'var(--bp-gold, #b09a6d)', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{name ?? email ?? 'Verbunden'}</p>
          {name && email && <p style={{ fontSize: 12, margin: 0, opacity: 0.65 }}>{email}</p>}
        </div>
      </div>
    )
  }

  function InviteControls({ target, buttonLabel }: { target: InviteTarget; buttonLabel: string }) {
    const state = states[target]
    return (
      <>
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
          <p style={{ fontSize: 13, color: 'var(--bp-red, #a04040)', margin: 0 }}>
            {state.error}
            {state.error.includes('Velvet Pro') && (
              <>
                {' '}
                <a href={`/brautpaar/${eventId}/abo`} style={{ color: 'var(--bp-gold, #B8923A)', fontWeight: 600 }}>
                  Zum Abo
                </a>
              </>
            )}
          </p>
        )}
        {state.code && (
          <p className="bp-body" style={{ fontSize: 12, margin: 0, opacity: 0.7 }}>
            Der Link ist 7 Tage gültig und kann einmal eingelöst werden.
          </p>
        )}
      </>
    )
  }

  return (
    <div className="bp-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div className="bp-card-header">
        <h2 className="bp-section-title" style={{ margin: 0 }}>Personen einladen</h2>
      </div>
      <div className="bp-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        {/* ── Partner / Partnerin ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={16} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Partner / Partnerin einladen</span>
          </div>
          {partner ? (
            <>
              <p className="bp-body" style={{ fontSize: 13, margin: 0 }}>
                Euer Partner / eure Partnerin ist bereits mit der Planung verbunden.
              </p>
              <ConnectedBadge name={partner.name} email={partner.email} />
            </>
          ) : (
            <>
              <p className="bp-body" style={{ fontSize: 13, margin: 0 }}>
                Lade die zweite Person eures Paares ein — sie erhält denselben vollen Zugriff auf eure Hochzeitsplanung.
              </p>
              {membersLoaded && <InviteControls target="brautpaar_solo" buttonLabel="Partner-Code erstellen" />}
            </>
          )}
        </div>

        {/* ── Veranstalter dazuschalten ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={16} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Veranstalter hinzufügen</span>
          </div>
          {organizer ? (
            <>
              <p className="bp-body" style={{ fontSize: 13, margin: 0 }}>
                Ein Veranstalter betreut euer Event und sieht es in seinem Veranstalter-Portal.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <ConnectedBadge name={organizer.name} email={organizer.email} />
                </div>
                <button
                  type="button"
                  className="bp-btn"
                  onClick={() => removeOrganizer(organizer.id)}
                  disabled={removingId === organizer.id}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--bp-red, #a04040)' }}
                >
                  <Trash2 size={14} />
                  {removingId === organizer.id ? 'Entferne …' : 'Entfernen'}
                </button>
              </div>
              {removeError && (
                <p style={{ fontSize: 13, color: 'var(--bp-red, #a04040)', margin: 0 }}>{removeError}</p>
              )}
            </>
          ) : (
            <>
              <p className="bp-body" style={{ fontSize: 13, margin: 0 }}>
                Falls ihr euch später professionelle Unterstützung holt: Mit diesem Code kann ein registrierter und freigeschalteter Veranstalter eurem Event beitreten und die Planung in seinem Veranstalter-Portal übernehmen. Hat euer Veranstalter noch kein Velvet-Konto, muss er sich zuerst registrieren und freischalten lassen.
              </p>
              {membersLoaded && <InviteControls target="veranstalter" buttonLabel="Veranstalter-Code erstellen" />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
