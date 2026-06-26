'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Search, Archive, ArchiveRestore } from 'lucide-react'

type EventRow = { id: string; title: string; date: string | null; venue: string | null; event_code: string | null }

const ARCHIVE_KEY = 'vdr_archived_events'

function loadArchived(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? '[]')) }
  catch { return new Set() }
}
function saveArchived(s: Set<string>) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(Array.from(s)))
}

export default function VendorEventsClient({ events }: { events: EventRow[] }) {
  const [search, setSearch] = useState('')
  const [archived, setArchived] = useState<Set<string>>(new Set())
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => { setArchived(loadArchived()) }, [])

  function toggleArchive(id: string) {
    setArchived(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveArchived(next)
      return next
    })
  }

  const activeEvents = events.filter(e => !archived.has(e.id))
  const archivedEvents = events.filter(e => archived.has(e.id))
  const pool = showArchived ? archivedEvents : activeEvents

  const filtered = search.trim()
    ? pool.filter(ev => {
        const q = search.trim().toUpperCase()
        return (
          ev.title.toUpperCase().includes(q) ||
          (ev.event_code ?? '').toUpperCase().includes(q)
        )
      })
    : pool

  return (
    <>
      {events.length > 0 && (
        <div data-tour="vdr-events-controls" style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nach Event oder Code suchen …"
              style={{
                width: '100%', padding: '10px 14px 10px 34px', fontSize: 13,
                border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                background: 'var(--surface)', fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box', color: 'var(--text)',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
            />
          </div>
          {archivedEvents.length > 0 && (
            <button
              onClick={() => setShowArchived(v => !v)}
              title={showArchived ? 'Aktive Events anzeigen' : 'Archiv anzeigen'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)', background: showArchived ? 'var(--accent)' : 'var(--surface)',
                color: showArchived ? '#fff' : 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600, flexShrink: 0,
              }}
            >
              <Archive size={14} /> {showArchived ? 'Archiv' : `Archiv (${archivedEvents.length})`}
            </button>
          )}
        </div>
      )}

      {events.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Noch keine Events zugewiesen</p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Du erhältst vom Veranstalter einen persönlichen Einladungslink,<br />
            über den du dem Event beitreten kannst.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-dim)', textAlign: 'center', padding: '24px 0' }}>
          {search.trim() ? `Kein Event gefunden für „${search}"` : showArchived ? 'Archiv ist leer.' : 'Keine aktiven Events.'}
        </p>
      ) : (
        <div data-tour="vdr-events-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(event => (
            <div key={event.id} style={{ position: 'relative' }}>
              <Link
                href={`/vendor/dashboard/${event.id}/kommunikation`}
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px 56px 16px 24px', textDecoration: 'none', color: 'inherit', transition: 'box-shadow .15s, border-color .15s', minHeight: 84 }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', marginBottom: 5 }}>
                  <p style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</p>
                  {event.event_code && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', flexShrink: 0,
                      color: 'var(--text-dim)', background: 'rgba(0,0,0,0.05)',
                      padding: '1px 7px', borderRadius: 4, fontFamily: 'monospace',
                    }}>#{event.event_code}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, overflow: 'hidden' }}>
                  {event.date && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-dim)', flexShrink: 0 }}>
                      <CalendarDays size={13} />
                      {new Date(event.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                  {event.venue && (
                    <span style={{ fontSize: 13, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.venue}</span>
                  )}
                </div>
              </Link>
              <button
                onClick={() => toggleArchive(event.id)}
                title={archived.has(event.id) ? 'Archivierung aufheben' : 'Archivieren'}
                style={{
                  position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                  color: 'var(--text-dim)', display: 'flex', borderRadius: 6,
                  opacity: 0.6,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--bg)' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'none' }}
              >
                {archived.has(event.id) ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
