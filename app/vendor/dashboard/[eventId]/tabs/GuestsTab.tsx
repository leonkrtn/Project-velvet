'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search } from 'lucide-react'

interface Guest {
  id: string; name: string; status: string
  side: string | null; allergy_tags: string[]; allergy_custom: string | null
  meal_choice: string | null
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

export default function GuestsTab({ eventId }: { eventId: string }) {
  const [guests, setGuests] = useState<Guest[]>([])
  const [query, setQuery]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('guests').select('id, name, status, side, allergy_tags, allergy_custom, meal_choice').eq('event_id', eventId).order('name')
      .then(({ data }) => { setGuests(data ?? []); setLoading(false) })
  }, [eventId])

  const filtered = guests.filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
  const zugesagt = guests.filter(g => g.status === 'zugesagt').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Gästeliste</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{zugesagt} zugesagt · {guests.length} gesamt</p>
        </div>
      </div>

      {/* Suche */}
      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 320 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Gast suchen…"
          style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 160px', padding: '10px 20px', background: '#F5F5F7', borderBottom: '1px solid var(--border)' }}>
            {['Name', 'Seite', 'Menü', 'Allergien'].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>{h}</span>
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, fontStyle: 'italic' }}>Keine Gäste gefunden</div>
          )}
          {filtered.map(g => {
            const st = STATUS_STYLE[g.status] ?? STATUS_STYLE.angelegt
            return (
              <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 160px', padding: '12px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{g.name}</div>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>
                    {STATUS_LABELS[g.status] ?? g.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{g.side ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{g.meal_choice ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {[...(g.allergy_tags ?? []), g.allergy_custom].filter(Boolean).join(', ') || '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
