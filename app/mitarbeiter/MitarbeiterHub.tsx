'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, TrendingUp, LogOut } from 'lucide-react'
import MitarbeiterKalender from './MitarbeiterKalender'
import AbrechnungModal from './AbrechnungModal'
import type { ShiftDay } from './page'
import type { AbrechnungLog } from './AbrechnungModal'

type EventInfo = { id: string; title: string; date: string | null; shiftCount: number }

function fmtDate(iso: string | null) {
  if (!iso) return 'Kein Datum'
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch { return iso }
}

export default function MitarbeiterHub({
  staffName,
  staffHourlyRate,
  events,
  shiftDays,
  abrechnungLogs,
}: {
  staffName: string
  staffHourlyRate: number | null
  events: EventInfo[]
  shiftDays: ShiftDay[]
  abrechnungLogs: AbrechnungLog[]
}) {
  const router = useRouter()
  const [showKalender, setShowKalender] = useState(false)
  const [showAbrechnung, setShowAbrechnung] = useState(false)

  async function handleLogout() {
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 16px 64px', fontFamily: 'inherit' }}>
      <style>{`
        @media (max-width: 600px) {
          .ma-header { flex-wrap: wrap !important; }
          .ma-header-main { flex: 1 1 100%; }
          .ma-header-actions { flex: 1 1 100% !important; flex-shrink: 1 !important; }
          .ma-action-btn { flex: 1; justify-content: center !important; }
          .ma-logout-label { display: none; }
          .ma-logout-btn { padding: 8px 10px !important; }
        }
      `}</style>

      {/* Modals */}
      {showKalender && (
        <MitarbeiterKalender shiftDays={shiftDays} onClose={() => setShowKalender(false)} />
      )}
      {showAbrechnung && (
        <AbrechnungModal
          logs={abrechnungLogs}
          staffHourlyRate={staffHourlyRate}
          staffName={staffName}
          onClose={() => setShowAbrechnung(false)}
        />
      )}

      {/* Header */}
      <div className="ma-header" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 28 }}>

        {/* Title + logout icon (icon-only on mobile) */}
        <div className="ma-header-main" style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 500, color: 'var(--text, #111827)', margin: '0 0 4px' }}>
              Mein Bereich
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary, #9CA3AF)', margin: 0 }}>
              Willkommen, {staffName}.
            </p>
          </div>
          <button
            className="ma-logout-btn mob-touch"
            onClick={handleLogout}
            aria-label="Abmelden"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', flexShrink: 0,
              border: '1px solid var(--border, #E5E7EB)', borderRadius: 'var(--radius-sm, 8px)',
              background: 'none', cursor: 'pointer', color: 'var(--text-secondary, #6B7280)',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            }}
          >
            <LogOut size={14} />
            <span className="ma-logout-label">Abmelden</span>
          </button>
        </div>

        {/* Action buttons — same row on desktop, full-width below on mobile */}
        <div className="ma-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button
            className="ma-action-btn"
            onClick={() => setShowAbrechnung(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px',
              border: '1px solid var(--border, #E5E7EB)', borderRadius: 'var(--radius-sm, 8px)',
              background: 'none', cursor: 'pointer', color: 'var(--text-secondary, #6B7280)',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text, #111827)'; e.currentTarget.style.color = 'var(--text, #111827)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #E5E7EB)'; e.currentTarget.style.color = 'var(--text-secondary, #6B7280)' }}
          >
            <TrendingUp size={14} /> Abrechnung
          </button>
          <button
            className="ma-action-btn"
            onClick={() => setShowKalender(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px',
              border: '1px solid var(--border, #E5E7EB)', borderRadius: 'var(--radius-sm, 8px)',
              background: 'none', cursor: 'pointer', color: 'var(--text-secondary, #6B7280)',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text, #111827)'; e.currentTarget.style.color = 'var(--text, #111827)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #E5E7EB)'; e.currentTarget.style.color = 'var(--text, #111827)' }}
          >
            <CalendarDays size={14} /> Kalender
          </button>
        </div>
      </div>

      {/* Event list */}
      {events.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          border: '2px dashed var(--border, #E5E7EB)', borderRadius: 'var(--radius, 12px)',
          background: 'var(--surface, #FAFAFA)',
        }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text, #111827)', marginBottom: 8 }}>
            Noch keine Einsätze geplant
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary, #9CA3AF)', margin: 0 }}>
            Du wurdest noch keinem Event zugeteilt.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map(ev => (
            <div
              key={ev.id}
              style={{
                border: '1px solid var(--border, #E5E7EB)',
                borderRadius: 'var(--radius, 12px)',
                background: 'var(--surface, #fff)',
                padding: '16px 18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text, #111827)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.title}
                  </p>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-tertiary, #9CA3AF)' }}>{fmtDate(ev.date)}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--accent, #6366F1)',
                      background: 'var(--accent-light, #EEF2FF)', padding: '2px 8px', borderRadius: 20,
                    }}>
                      {ev.shiftCount} Einsatz{ev.shiftCount !== 1 ? 'tage' : 'tag'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/mitarbeiter/${ev.id}/schichtplan`)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid var(--border, #E5E7EB)',
                    borderRadius: 'var(--radius-sm, 8px)',
                    background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 13, color: 'var(--text, #111827)',
                    transition: 'border-color 0.15s, color 0.15s',
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent, #6366F1)'; e.currentTarget.style.color = 'var(--accent, #6366F1)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #E5E7EB)'; e.currentTarget.style.color = 'var(--text, #111827)' }}
                >
                  Schichtplan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
