'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Search } from 'lucide-react'

type EventRow = { id: string; title: string; date: string | null; venue: string | null; event_code: string | null }

export default function VendorEventsClient({ events }: { events: EventRow[] }) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? events.filter(ev => {
        const q = search.trim().toUpperCase()
        return (
          ev.title.toUpperCase().includes(q) ||
          (ev.event_code ?? '').toUpperCase().includes(q)
        )
      })
    : events

  return (
    <>
      {events.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
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
          Kein Event gefunden für „{search}"
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(event => (
            <Link
              key={event.id}
              href={`/vendor/dashboard/${event.id}`}
              style={{ display: 'block', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '20px 24px', textDecoration: 'none', color: 'inherit', transition: 'box-shadow 0.15s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', margin: 0 }}>{event.title}</p>
                {event.event_code && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                    color: 'var(--text-dim)', background: 'rgba(0,0,0,0.05)',
                    padding: '1px 7px', borderRadius: 4, fontFamily: 'monospace',
                  }}>#{event.event_code}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {event.date && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-dim)' }}>
                    <CalendarDays size={13} />
                    {new Date(event.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                )}
                {event.venue && (
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{event.venue}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
