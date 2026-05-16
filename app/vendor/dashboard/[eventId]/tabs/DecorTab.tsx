'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MapPin, Clock } from 'lucide-react'

interface SetupItem { id: string; title: string; description: string; location_in_venue: string; setup_by: string; teardown_at: string; sort_order: number }
interface DekorWish  { id: string; title: string; notes: string | null; image_url: string | null }

export default function DecorTab({ eventId }: { eventId: string }) {
  const [items, setItems]   = useState<SetupItem[]>([])
  const [wishes, setWishes] = useState<DekorWish[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('decor_setup_items').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('deko_wishes').select('id, title, notes, image_url').eq('event_id', eventId).order('created_at'),
    ]).then(([{ data: i }, { data: w }]) => {
      setItems(i ?? []); setWishes(w ?? []); setLoading(false)
    })
  }, [eventId])

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 24 }}>Dekoration</h1>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-sm)' }} />
          ))}
        </div>
      ) : (
        <>
          {/* Aufbau-Checkliste */}
          {items.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Aufbau-Aufgaben</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((item, idx) => (
                  <div key={item.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '14px 16px', display: 'flex', gap: 14 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: item.description ? 3 : 6 }}>{item.title}</p>
                      {item.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>{item.description}</p>}
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {item.location_in_venue && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                            <MapPin size={11} />{item.location_in_venue}
                          </span>
                        )}
                        {item.setup_by && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                            <Clock size={11} />bis {item.setup_by}
                          </span>
                        )}
                        {item.teardown_at && (
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Abbau: {item.teardown_at}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dekor-Wünsche / Moodboard */}
          {wishes.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Dekor-Wünsche</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {wishes.map(w => (
                  <div key={w.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    {w.image_url && (
                      <img src={w.image_url} alt={w.title} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                    )}
                    <div style={{ padding: '12px 14px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: w.notes ? 4 : 0 }}>{w.title}</p>
                      {w.notes && <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{w.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 && wishes.length === 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
              Noch keine Dekoration-Informationen hinterlegt.
            </div>
          )}
        </>
      )}
    </div>
  )
}
