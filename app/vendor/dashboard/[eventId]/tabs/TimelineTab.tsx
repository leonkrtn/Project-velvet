'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock } from 'lucide-react'

interface Entry {
  id: string; time: string | null; title: string | null; location: string | null
  category: string | null; duration_minutes: number | null; start_minutes: number | null
  sort_order: number
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  'Zeremonie': { bg: 'rgba(196,113,122,0.1)',  color: '#C4717A' },
  'Empfang':   { bg: 'rgba(155,127,168,0.1)',  color: '#9B7FA8' },
  'Feier':     { bg: 'rgba(29,29,31,0.07)',     color: 'var(--text-primary)' },
  'Logistik':  { bg: 'rgba(122,158,126,0.1)',   color: '#7A9E7E' },
}

function fmt(min: number | null) {
  if (min == null) return null
  const h = Math.floor(min / 60).toString().padStart(2, '0')
  const m = (min % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

export default function TimelineTab({ eventId }: { eventId: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('timeline_entries').select('*').eq('event_id', eventId).order('sort_order')
      .then(({ data }) => { setEntries(data ?? []); setLoading(false) })
  }, [eventId])

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 24 }}>Regieplan</h1>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
      ) : entries.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
          Noch kein Ablaufplan hinterlegt.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {entries.map((e, idx) => {
            const cat    = e.category ?? 'Feier'
            const colors = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Feier']
            const time   = fmt(e.start_minutes) ?? e.time
            return (
              <div key={e.id} style={{ display: 'flex', gap: 0 }}>
                {/* Zeitlinie */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 60, flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors.color, marginTop: 20, flexShrink: 0, border: '2px solid var(--surface)', boxShadow: '0 0 0 2px ' + colors.color }} />
                  {idx < entries.length - 1 && (
                    <div style={{ width: 2, flex: 1, background: 'var(--border)', minHeight: 24 }} />
                  )}
                </div>

                {/* Karte */}
                <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 10, marginLeft: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {time && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            <Clock size={11} />
                            {time}
                            {e.duration_minutes != null && ` – ${fmt((e.start_minutes ?? 0) + e.duration_minutes)}`}
                          </span>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 4, background: colors.bg, color: colors.color }}>
                          {cat}
                        </span>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: e.location ? 2 : 0 }}>
                        {e.title ?? '—'}
                      </p>
                      {e.location && (
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.location}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
