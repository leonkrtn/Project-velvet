'use client'
import React from 'react'
import type { MusikProposalData } from '@/lib/proposals'
import { Section } from './ProposalSection'

interface Props {
  data: MusikProposalData
  onChange: (patch: Partial<MusikProposalData>) => void
  enabledSections: string[]
  onToggleSection: (key: string) => void
  readOnly?: boolean
}

const input: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--border)',
  borderRadius: 8, background: 'var(--bg)', fontFamily: 'inherit',
  color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

const SONG_TYPES = [
  { value: 'wish',     label: 'Wunschlied',   color: '#C4717A' },
  { value: 'no_go',   label: 'No-Go',         color: '#FF3B30' },
  { value: 'playlist',label: 'Playlist',      color: 'var(--text-dim)' },
]

const MOMENTS = ['Einzug', 'Erster Tanz', 'Vater-Tochter-Tanz', 'Hintergrund', 'Party', 'Auszug', 'Sonstiges']

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} style={{
      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
      background: on ? 'var(--gold)' : 'var(--border)', position: 'relative', flexShrink: 0,
    }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left 0.2s' }} />
    </button>
  )
}

export default function ProposalFormMusik({ data, onChange, enabledSections, onToggleSection, readOnly }: Props) {
  const sec = (k: string) => enabledSections.includes(k)
  const songs = data.songs ?? []
  const reqs  = data.requirements ?? {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Musikwünsche */}
      <Section sectionKey="songs" label="Musikwünsche & No-Gos" enabled={sec('songs')} onToggle={onToggleSection} readOnly={readOnly}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {songs.map((song, i) => (
            <div key={song.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                <input style={input} value={song.title} placeholder="Titel"
                  onChange={e => { const next = [...songs]; next[i] = { ...song, title: e.target.value }; onChange({ songs: next }) }}
                />
                <input style={input} value={song.artist} placeholder="Interpret"
                  onChange={e => { const next = [...songs]; next[i] = { ...song, artist: e.target.value }; onChange({ songs: next }) }}
                />
                {!readOnly && (
                  <button type="button" onClick={() => onChange({ songs: songs.filter((_, j) => j !== i) })}
                    style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}>
                    ✕
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SONG_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => { const next = [...songs]; next[i] = { ...song, type: t.value }; onChange({ songs: next }) }}
                    style={{
                      padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${song.type === t.value ? t.color : 'var(--border)'}`,
                      background: song.type === t.value ? `${t.color}20` : 'transparent',
                      color: song.type === t.value ? t.color : 'var(--text-dim)',
                    }}>
                    {t.label}
                  </button>
                ))}
                <select value={song.moment ?? ''} onChange={e => { const next = [...songs]; next[i] = { ...song, moment: e.target.value }; onChange({ songs: next }) }}
                  style={{ ...input, flex: 1, minWidth: 120 }}>
                  <option value="">Moment wählen…</option>
                  {MOMENTS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          ))}
          {!readOnly && (
            <button type="button" onClick={() => onChange({ songs: [...songs, { id: Date.now().toString(), title: '', artist: '', type: 'wish' }] })}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px dashed var(--border)', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'inherit' }}>
              + Song hinzufügen
            </button>
          )}
        </div>
      </Section>

      {/* Technische Anforderungen */}
      <Section sectionKey="requirements" label="Technische Anforderungen" enabled={sec('requirements')} onToggle={onToggleSection} readOnly={readOnly}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { key: 'pa_notes',         label: 'PA-Anlage / Beschallung',  placeholder: 'z.B. 2× 12" Tops + Sub…' },
            { key: 'stage_dimensions', label: 'Bühnenmaße',               placeholder: 'z.B. 4×6 m' },
            { key: 'power_required',   label: 'Strombedarf',              placeholder: 'z.B. 2× CEE 32A' },
            { key: 'streaming_notes',  label: 'Streaming / Livestream',   placeholder: 'Besonderheiten…' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 5 }}>{f.label}</label>
              <input style={input} value={(reqs as Record<string,string>)[f.key] ?? ''} placeholder={f.placeholder}
                onChange={e => onChange({ requirements: { ...reqs, [f.key]: e.target.value } })} />
            </div>
          ))}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <Toggle on={!!reqs.streaming_needed} onChange={v => onChange({ requirements: { ...reqs, streaming_needed: v } })} />
              Livestream / Aufnahme gewünscht
            </label>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 5 }}>Soundcheck — Datum & Uhrzeit</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input style={input} type="date" value={reqs.soundcheck_date ?? ''}
                onChange={e => onChange({ requirements: { ...reqs, soundcheck_date: e.target.value } })} />
              <input style={input} type="time" value={reqs.soundcheck_time ?? ''}
                onChange={e => onChange({ requirements: { ...reqs, soundcheck_time: e.target.value } })} />
            </div>
          </div>
        </div>
      </Section>

      {/* Anmerkungen */}
      <Section sectionKey="notes" label="Anmerkungen" enabled={sec('notes')} onToggle={onToggleSection} readOnly={readOnly}>
        <textarea value={data.setlist_notes ?? ''} onChange={e => onChange({ setlist_notes: e.target.value })}
          placeholder="Weitere Anmerkungen zur Musik…" rows={4} style={{ ...input, resize: 'vertical' }} />
      </Section>

    </div>
  )
}
