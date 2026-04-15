'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEvent } from '@/lib/event-context'

type EventSummary = {
  id: string
  title: string
  coupleName: string | null
  date: string | null
  venue: string | null
  onboardingComplete: boolean
  createdAt: string
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Kein Datum'
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

export default function VeranstalterHubPage() {
  const router = useRouter()
  const { currentRole, currentUserId, hasLoaded } = useEvent()
  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasLoaded || !currentUserId) return
    if (currentRole !== null && currentRole !== 'veranstalter') return

    async function load() {
      try {
        const { fetchEventSummariesForVeranstalter } = await import('@/lib/db/events')
        const list = await fetchEventSummariesForVeranstalter(currentUserId!)
        setEvents(list)
      } catch (err) {
        console.error('[VeranstalterHub] load failed:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [hasLoaded, currentUserId, currentRole])

  // Show access denied for non-veranstalter once role is known
  if (hasLoaded && currentRole !== null && currentRole !== 'veranstalter') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24, textAlign: 'center' }}>
        <div>
          <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Kein Zugriff</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Dieser Bereich ist nur für Veranstalter zugänglich.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--heading-font)', fontSize: 26, fontWeight: 500, color: 'var(--text)', margin: '0 0 6px' }}>
            Meine Events
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
            Verwalte deine Hochzeits-Events oder erstelle ein neues.
          </p>
        </div>
        <button
          onClick={() => router.push('/onboarding')}
          style={{
            flexShrink: 0,
            background: 'var(--gold)', color: '#fff', border: 'none',
            borderRadius: 'var(--r-sm)', padding: '10px 18px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          + Neues Event
        </button>
      </div>

      {/* Event list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2].map(i => (
            <div key={i} style={{
              height: 96, borderRadius: 'var(--r-md)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </div>
      ) : events.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          border: '2px dashed var(--border)', borderRadius: 'var(--r-md)',
          background: 'var(--surface)',
        }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>💍</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Noch kein Event</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 20 }}>
            Erstelle dein erstes Hochzeits-Event und beginne mit der Planung.
          </p>
          <button
            onClick={() => router.push('/onboarding')}
            style={{
              background: 'var(--gold)', color: '#fff', border: 'none',
              borderRadius: 'var(--r-sm)', padding: '12px 24px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Erstes Event erstellen
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map(ev => (
            <div
              key={ev.id}
              style={{
                border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                background: 'var(--surface)', overflow: 'hidden',
              }}
            >
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                        {ev.coupleName ?? ev.title}
                      </p>
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                        padding: '2px 8px', borderRadius: 20,
                        background: ev.onboardingComplete ? 'rgba(61,122,86,0.1)' : 'var(--bg)',
                        color: ev.onboardingComplete ? 'var(--green)' : 'var(--text-dim)',
                        border: `1px solid ${ev.onboardingComplete ? 'rgba(61,122,86,0.2)' : 'var(--border)'}`,
                        flexShrink: 0,
                      }}>
                        {ev.onboardingComplete ? 'Aktiv' : 'Einrichtung'}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 2px' }}>
                      {fmtDate(ev.date)}
                    </p>
                    {ev.venue && (
                      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>{ev.venue}</p>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/veranstalter/${ev.id}`)}
                    style={{
                      flexShrink: 0,
                      padding: '8px 16px', border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)', background: 'none',
                      cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 13, color: 'var(--text)',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}
                  >
                    Verwalten
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
