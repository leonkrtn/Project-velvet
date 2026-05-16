'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search } from 'lucide-react'

type Access = 'none' | 'read' | 'write'

interface SeatingTable { name: string }
interface SeatingAssignment { seating_tables: SeatingTable | SeatingTable[] | null }

interface Guest {
  id: string; name: string; status: string
  side: string | null; allergy_tags: string[]; allergy_custom: string | null
  meal_choice: string | null
  seating_assignments?: SeatingAssignment[]
}

interface Props {
  eventId: string
  tabAccess?: Access
  sectionPerms?: Record<string, Access>
}

const STATUS_LABELS: Record<string, string> = {
  angelegt:    'Angelegt',
  eingeladen:  'Eingeladen',
  zugesagt:    'Zugesagt',
  abgesagt:    'Abgesagt',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  zugesagt:   { bg: '#EAF5EE', color: '#3D7A56' },
  abgesagt:   { bg: '#FDEAEA', color: '#A04040' },
  eingeladen: { bg: '#FFF8E6', color: '#B8860B' },
  angelegt:   { bg: '#F0F0F0', color: '#666' },
}

function sectionVisible(sectionPerms: Record<string, Access> | undefined, tabAccess: Access, key: string): boolean {
  const access = sectionPerms?.[key] ?? tabAccess
  return access !== 'none'
}

export default function GuestsTab({ eventId, tabAccess = 'read', sectionPerms }: Props) {
  const [guests, setGuests] = useState<Guest[]>([])
  const [query, setQuery]   = useState('')
  const [loading, setLoading] = useState(true)

  const showNamen = sectionVisible(sectionPerms, tabAccess, 'namen')
  const showEssen = sectionVisible(sectionPerms, tabAccess, 'essen')
  const showAllergien = sectionVisible(sectionPerms, tabAccess, 'allergien')
  const showTische = sectionVisible(sectionPerms, tabAccess, 'tische')
  const showStatus = sectionVisible(sectionPerms, tabAccess, 'status')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('guests').select('id, name, status, side, allergy_tags, allergy_custom, meal_choice, seating_assignments(seating_tables(name))').eq('event_id', eventId).order('name')
      .then(({ data }) => { setGuests(data ?? []); setLoading(false) })
  }, [eventId])

  const filtered = guests.filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
  const zugesagt = guests.filter(g => g.status === 'zugesagt').length

  const columns: { key: string; label: string; visible: boolean }[] = [
    { key: 'name', label: 'Name', visible: showNamen },
    { key: 'side', label: 'Seite', visible: showNamen },
    { key: 'meal', label: 'Menü', visible: showEssen },
    { key: 'allergy', label: 'Allergien', visible: showAllergien },
    { key: 'tisch', label: 'Tisch', visible: showTische },
  ]
  const visibleCols = columns.filter(c => c.visible)
  const gridCols = visibleCols.map(c => {
    if (c.key === 'name') return '1fr'
    if (c.key === 'side' || c.key === 'tisch') return '100px'
    if (c.key === 'meal') return '120px'
    return '160px'
  }).join(' ')

  if (!showNamen && !showEssen && !showAllergien && !showStatus) {
    return <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Keine Berechtigung für diese Inhalte.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Gästeliste</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{zugesagt} zugesagt · {guests.length} gesamt</p>
        </div>
      </div>

      {showNamen && (
        <div style={{ position: 'relative', marginBottom: 16, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Gast suchen…"
            style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div className="skeleton" style={{ height: 40, borderRadius: 0, borderBottom: '1px solid var(--border)' }} />
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton" style={{ flex: 1, height: 16 }} />
              <div className="skeleton" style={{ width: 80, height: 16 }} />
              <div className="skeleton" style={{ width: 100, height: 16 }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {visibleCols.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '10px 20px', background: '#F5F5F7', borderBottom: '1px solid var(--border)' }}>
              {visibleCols.map(c => (
                <span key={c.key} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>{c.label}</span>
              ))}
            </div>
          )}
          {filtered.length === 0 && (
            <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, fontStyle: 'italic' }}>Keine Gäste gefunden</div>
          )}
          {filtered.map(g => {
            const st = STATUS_STYLE[g.status] ?? STATUS_STYLE.angelegt
            return (
              <div key={g.id} style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '12px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                {showNamen && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{g.name}</div>
                    {showStatus && (
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>
                        {STATUS_LABELS[g.status] ?? g.status}
                      </span>
                    )}
                  </div>
                )}
                {showNamen && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{g.side ?? '—'}</div>}
                {showEssen && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{g.meal_choice ?? '—'}</div>}
                {showAllergien && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {[...(g.allergy_tags ?? []), g.allergy_custom].filter(Boolean).join(', ') || '—'}
                  </div>
                )}
                {showTische && (() => {
                  const assignment = g.seating_assignments?.[0]
                  const table = Array.isArray(assignment?.seating_tables)
                    ? assignment?.seating_tables?.[0]
                    : assignment?.seating_tables
                  return <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{table?.name ?? '—'}</div>
                })()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
