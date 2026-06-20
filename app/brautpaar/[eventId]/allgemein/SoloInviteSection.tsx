'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, UserPlus, Briefcase, Trash2, Clock, ChevronDown } from 'lucide-react'

interface Props {
  eventId: string
  /** Eigene User-ID — um den Partner vom eigenen Eintrag zu unterscheiden */
  currentUserId: string
  /**
   * Ziel-Rolle der Partner-Einladung. Solo-Paare laden ein zweites
   * brautpaar_solo ein (voller Admin-Zugriff); veranstalter-verwaltete Paare
   * laden ein zweites brautpaar in dasselbe Event ein.
   */
  partnerTarget?: 'brautpaar_solo' | 'brautpaar'
  /**
   * Den "Veranstalter hinzufügen"-Block anzeigen. Nur für Solo-Paare sinnvoll —
   * veranstalter-verwaltete Paare haben bereits einen Veranstalter.
   */
  showOrganizer?: boolean
}

type InviteTarget = 'veranstalter' | 'brautpaar_solo' | 'brautpaar'

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

function initials(name: string | null, email: string | null): string {
  const src = (name ?? email ?? '?').trim()
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

// Nur für brautpaar_solo sichtbar: Onboarding weiterer Personen.
//   1. Partner / Partnerin als zweites brautpaar_solo (voller Zugriff)
//   2. Veranstalter nachträglich "dazuschalten" — der Code ist nur von
//      registrierten UND freigeschalteten Veranstalter-Konten einlösbar
//      (erzwungen durch redeem_invite_code, Migration 0089). Nach dem
//      Einlösen erscheint das Event im Veranstalter-Dashboard.
// Bereits verbundene Personen werden angezeigt; der Veranstalter kann vom
// Solo-Paar auch wieder entfernt werden (DELETE /api/members/[memberId]).
export default function SoloInviteSection({
  eventId, currentUserId, partnerTarget = 'brautpaar_solo', showOrganizer = true,
}: Props) {
  const [states, setStates] = useState<Record<string, InviteState>>({
    veranstalter:   { ...EMPTY },
    brautpaar_solo: { ...EMPTY },
    brautpaar:      { ...EMPTY },
  })
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [orgHelpOpen, setOrgHelpOpen] = useState(false)

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

  const partner   = members.find(m => m.role === partnerTarget && m.user_id !== currentUserId)
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

  function PersonCard({
    member, roleLabel, onRemove, removing,
  }: {
    member: Member
    roleLabel: string
    onRemove?: () => void
    removing?: boolean
  }) {
    return (
      <div className="bp-person">
        <span className="bp-person-avatar">{initials(member.name, member.email)}</span>
        <div className="bp-person-info">
          <p className="bp-person-name">{member.name ?? member.email ?? 'Verbunden'}</p>
          {member.name && member.email && <p className="bp-person-sub">{member.email}</p>}
        </div>
        <span className="bp-chip bp-chip-gold"><Check size={11} /> {roleLabel}</span>
        {onRemove && (
          <button
            type="button"
            className="bp-btn bp-btn-icon bp-btn-sm bp-btn-ghost"
            onClick={onRemove}
            disabled={removing}
            aria-label="Veranstalter entfernen"
            title="Veranstalter entfernen"
            style={{ color: 'var(--bp-red)' }}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    )
  }

  function InviteControls({ target, buttonLabel }: { target: InviteTarget; buttonLabel: string }) {
    const state = states[target]
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return (
      <>
        {state.code ? (
          <>
            <span className="bp-chip bp-chip-pending" style={{ marginBottom: 8 }}>
              <Clock size={11} /> Wartet auf Beitritt
            </span>
            <div className="bp-invite-actions">
              <code className="bp-code-box">{`${origin}/join?code=${state.code}`}</code>
              <button
                type="button"
                className="bp-btn bp-btn-secondary bp-btn-sm"
                onClick={() => copyLink(target)}
              >
                {state.copied ? <Check size={14} /> : <Copy size={14} />}
                {state.copied ? 'Kopiert' : 'Link kopieren'}
              </button>
            </div>
            <p className="bp-invite-note">Der Link ist 7 Tage gültig und kann einmal eingelöst werden.</p>
          </>
        ) : (
          <button
            type="button"
            className="bp-btn bp-btn-primary bp-btn-sm"
            onClick={() => createCode(target)}
            disabled={state.loading}
          >
            {state.loading ? 'Erstelle Code …' : buttonLabel}
          </button>
        )}

        {state.error && (
          <p className="bp-invite-error">
            {state.error}
            {state.error.includes('Forevr Pro') && (
              <> <a href={`/brautpaar/${eventId}/abo`}>Zum Abo</a></>
            )}
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
      <div className="bp-card-body">
        <div className="bp-invite-group">

          {/* ── Partner / Partnerin ── */}
          <div className="bp-invite-block">
            <div className="bp-invite-head">
              <span className="bp-invite-badge"><UserPlus size={18} /></span>
              <div style={{ minWidth: 0 }}>
                <p className="bp-invite-title">Partner / Partnerin einladen</p>
                <p className="bp-invite-desc">
                  {partner
                    ? 'Bereits mit eurer Planung verbunden — mit vollem Zugriff.'
                    : 'Lade die zweite Person eures Paares ein. Sie erhält denselben vollen Zugriff auf eure Hochzeitsplanung.'}
                </p>
              </div>
            </div>
            {partner
              ? <PersonCard member={partner} roleLabel="Partner" />
              : membersLoaded && <InviteControls target={partnerTarget} buttonLabel="Partner-Code erstellen" />}
          </div>

          {/* ── Veranstalter dazuschalten (nur Solo) ── */}
          {showOrganizer && (
          <div className="bp-invite-block">
            <div className="bp-invite-head">
              <span className="bp-invite-badge"><Briefcase size={18} /></span>
              <div style={{ minWidth: 0 }}>
                <p className="bp-invite-title">Veranstalter hinzufügen</p>
                <p className="bp-invite-desc">
                  {organizer
                    ? 'Ein Veranstalter betreut euer Event und sieht es in seinem Veranstalter-Portal.'
                    : 'Optional: Holt euch professionelle Unterstützung dazu.'}
                </p>
              </div>
            </div>

            {organizer ? (
              <>
                <PersonCard
                  member={organizer}
                  roleLabel="Veranstalter"
                  onRemove={() => removeOrganizer(organizer.id)}
                  removing={removingId === organizer.id}
                />
                {removeError && <p className="bp-invite-error">{removeError}</p>}
              </>
            ) : (
              <>
                {membersLoaded && <InviteControls target="veranstalter" buttonLabel="Veranstalter-Code erstellen" />}
                <button
                  type="button"
                  className="bp-btn bp-btn-ghost bp-btn-sm"
                  onClick={() => setOrgHelpOpen(o => !o)}
                  style={{ marginTop: 10, paddingLeft: 0, paddingRight: 8 }}
                >
                  <ChevronDown
                    size={14}
                    style={{ transform: orgHelpOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  />
                  Wie funktioniert das?
                </button>
                {orgHelpOpen && (
                  <p className="bp-invite-desc" style={{ marginTop: 8 }}>
                    Mit diesem Code kann ein registrierter und freigeschalteter Veranstalter eurem Event beitreten
                    und die Planung in seinem Veranstalter-Portal übernehmen. Hat euer Veranstalter noch kein
                    Forevr-Konto, muss er sich zuerst registrieren und freischalten lassen. Ihr könnt ihn jederzeit
                    wieder entfernen.
                  </p>
                )}
              </>
            )}
          </div>
          )}

        </div>
      </div>
    </div>
  )
}
