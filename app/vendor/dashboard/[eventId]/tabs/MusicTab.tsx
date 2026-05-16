'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Heart, Ban, ListMusic } from 'lucide-react'

interface Song { id: string; title: string; artist: string; type: string; moment: string }
interface Requirements {
  soundcheck_date: string; soundcheck_time: string; pa_notes: string
  stage_dimensions: string; microphone_count: number; power_required: string
  streaming_needed: boolean; streaming_notes: string; notes: string
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  wish:     { icon: <Heart size={13} />,     label: 'Wunschlied',  color: '#C4717A' },
  no_go:    { icon: <Ban size={13} />,       label: 'No-Go',       color: '#FF3B30' },
  playlist: { icon: <ListMusic size={13} />, label: 'Playlist',    color: 'var(--text-secondary)' },
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export default function MusicTab({ eventId }: { eventId: string }) {
  const [songs, setSongs]       = useState<Song[]>([])
  const [reqs, setReqs]         = useState<Requirements | null>(null)
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<string>('all')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('music_songs').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('music_requirements').select('*').eq('event_id', eventId).single(),
    ]).then(([{ data: s }, { data: r }]) => {
      setSongs(s ?? []); setReqs(r ?? null); setLoading(false)
    })
  }, [eventId])

  const visible = filter === 'all' ? songs : songs.filter(s => s.type === filter)
  const moments = Array.from(new Set(visible.map(s => s.moment))).filter(Boolean)

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 24 }}>Musik</h1>

      {loading ? (
        <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton" style={{ height: 140, borderRadius: 'var(--radius)' }} />
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--radius-sm)' }} />
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: 720, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Technische Anforderungen */}
          {reqs && (
            <div style={{ flex: '0 0 300px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Technische Anforderungen</p>
              <InfoRow label="Soundcheck"       value={[reqs.soundcheck_date, reqs.soundcheck_time].filter(Boolean).join(' ')} />
              <InfoRow label="Bühnenmaße"       value={reqs.stage_dimensions} />
              <InfoRow label="Mikrofone"        value={reqs.microphone_count} />
              <InfoRow label="Stromanschluss"   value={reqs.power_required} />
              <InfoRow label="PA-Anforderungen" value={reqs.pa_notes} />
              {reqs.streaming_needed && (
                <InfoRow label="Streaming"      value={reqs.streaming_notes || 'Erforderlich'} />
              )}
              {reqs.notes && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#F5F5F7', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {reqs.notes}
                </div>
              )}
            </div>
          )}

          {/* Songlisten */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {songs.length === 0 ? (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
                Noch keine Songliste hinterlegt.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {['all', 'wish', 'no_go', 'playlist'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: filter === f ? 'var(--accent)' : 'var(--surface)', color: filter === f ? '#fff' : 'var(--text-secondary)', fontWeight: filter === f ? 600 : 400 }}>
                      {f === 'all' ? `Alle (${songs.length})` : `${TYPE_CONFIG[f]?.label} (${songs.filter(s => s.type === f).length})`}
                    </button>
                  ))}
                </div>

                {moments.map(moment => (
                  <div key={moment} style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{moment}</p>
                    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                      {visible.filter(s => s.moment === moment).map((s, i, arr) => {
                        const cfg = TYPE_CONFIG[s.type] ?? TYPE_CONFIG.playlist
                        return (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <span style={{ color: cfg.color, flexShrink: 0 }}>{cfg.icon}</span>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</span>
                              {s.artist && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>— {s.artist}</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
