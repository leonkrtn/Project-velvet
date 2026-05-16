'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Star, MinusCircle, XCircle } from 'lucide-react'

interface Briefing { photo_briefing: string; video_briefing: string; photo_restrictions: string; upload_instructions: string; delivery_deadline: string }
interface ShotItem  { id: string; title: string; description: string; type: string; category: string; sort_order: number }

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; bg: string; color: string }> = {
  must_have: { icon: <Star size={13} />,        label: 'Pflichtaufnahme', bg: 'rgba(52,199,89,0.1)',   color: '#34A853' },
  optional:  { icon: <MinusCircle size={13} />, label: 'Optional',       bg: 'rgba(29,29,31,0.06)',   color: 'var(--text-tertiary)' },
  forbidden: { icon: <XCircle size={13} />,     label: 'Verboten',       bg: 'rgba(255,59,48,0.08)',  color: '#FF3B30' },
}

export default function MediaTab({ eventId }: { eventId: string }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [shots, setShots]       = useState<ShotItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [typeFilter, setFilter] = useState<string>('all')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('media_briefing').select('*').eq('event_id', eventId).single(),
      supabase.from('media_shot_items').select('*').eq('event_id', eventId).order('sort_order'),
    ]).then(([{ data: b }, { data: s }]) => {
      setBriefing(b ?? null); setShots(s ?? []); setLoading(false)
    })
  }, [eventId])

  const visible = typeFilter === 'all' ? shots : shots.filter(s => s.type === typeFilter)
  const categories = Array.from(new Set(visible.map(s => s.category))).filter(Boolean)

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 24 }}>Foto & Videograf</h1>

      {loading ? (
        <div>
          {/* Briefing card: label + 2-column text grid + restrictions box */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 20 }}>
            <div className="skeleton" style={{ height: 9, width: 70, marginBottom: 16, borderRadius: 4 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[0, 1].map(col => (
                <div key={col}>
                  <div className="skeleton" style={{ height: 12, width: 60, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 13, width: '100%', marginBottom: 5 }} />
                  <div className="skeleton" style={{ height: 13, width: '85%', marginBottom: 5 }} />
                  <div className="skeleton" style={{ height: 13, width: '70%' }} />
                </div>
              ))}
            </div>
            {/* Restrictions box */}
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,59,48,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,59,48,0.15)' }}>
              <div className="skeleton" style={{ height: 12, width: 140, marginBottom: 5 }} />
              <div className="skeleton" style={{ height: 12, width: '80%' }} />
            </div>
          </div>
          {/* Type filter pills: Alle / Pflichtaufnahme / Optional / Verboten */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {[80, 130, 80, 90].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: 32, width: w, borderRadius: 'var(--radius-sm)' }} />
            ))}
          </div>
          {/* Two category groups */}
          {[3, 4].map((count, gi) => (
            <div key={gi} style={{ marginBottom: 16 }}>
              <div className="skeleton" style={{ height: 9, width: 90, marginBottom: 10, borderRadius: 4 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', gap: 10 }}>
                    {/* Type icon badge */}
                    <div className="skeleton" style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton" style={{ height: 13, width: `${50 + (i * 13) % 30}%`, marginBottom: 5 }} />
                      <div className="skeleton" style={{ height: 12, width: `${35 + (i * 9) % 25}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Briefing */}
          {briefing && (briefing.photo_briefing || briefing.video_briefing) && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 14 }}>Briefing</p>
              <div style={{ display: 'grid', gridTemplateColumns: briefing.video_briefing ? '1fr 1fr' : '1fr', gap: 16 }}>
                {briefing.photo_briefing && (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Fotografie</p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{briefing.photo_briefing}</p>
                  </div>
                )}
                {briefing.video_briefing && (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Video</p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{briefing.video_briefing}</p>
                  </div>
                )}
              </div>
              {briefing.photo_restrictions && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,59,48,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,59,48,0.15)' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#FF3B30', marginBottom: 3 }}>Aufnahmebeschränkungen</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{briefing.photo_restrictions}</p>
                </div>
              )}
              {briefing.delivery_deadline && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
                  <strong>Lieferfrist:</strong> {briefing.delivery_deadline}
                </p>
              )}
              {briefing.upload_instructions && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#F5F5F7', borderRadius: 'var(--radius-sm)' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>Upload-Anleitung</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{briefing.upload_instructions}</p>
                </div>
              )}
            </div>
          )}

          {/* Shot-Liste */}
          {shots.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {['all', 'must_have', 'optional', 'forbidden'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: typeFilter === f ? 'var(--accent)' : 'var(--surface)', color: typeFilter === f ? '#fff' : 'var(--text-secondary)', fontWeight: typeFilter === f ? 600 : 400 }}>
                    {f === 'all' ? `Alle (${shots.length})` : `${TYPE_CONFIG[f]?.label} (${shots.filter(s => s.type === f).length})`}
                  </button>
                ))}
              </div>

              {categories.map(cat => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{cat}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {visible.filter(s => s.category === cat).map(s => {
                      const cfg = TYPE_CONFIG[s.type] ?? TYPE_CONFIG.optional
                      return (
                        <div key={s.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', gap: 10 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {cfg.icon}
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: s.description ? 3 : 0 }}>{s.title}</p>
                            {s.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.description}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {!briefing && shots.length === 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
              Noch kein Briefing hinterlegt.
            </div>
          )}
        </>
      )}
    </div>
  )
}
