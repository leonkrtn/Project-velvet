'use client'
import React from 'react'
import type { AblaufplanProposalData } from '@/lib/proposals'
import { Section } from './ProposalSection'

interface Props {
  data: AblaufplanProposalData
  onChange: (patch: Partial<AblaufplanProposalData>) => void
  enabledSections: string[]
  onToggleSection: (key: string) => void
  readOnly?: boolean
}

const input: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid var(--border)',
  borderRadius: 8, background: 'var(--bg)', fontFamily: 'inherit',
  color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, '0')
  const min = (m % 60).toString().padStart(2, '0')
  return `${h}:${min}`
}

function parseMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function endMinutes(start: number, duration?: number): number {
  return start + (duration ?? 60)
}

export default function ProposalFormAblaufplan({ data, onChange, enabledSections, onToggleSection, readOnly }: Props) {
  const entries = data.entries ?? []
  const sec = (k: string) => enabledSections.includes(k)

  const updateEntry = (i: number, patch: Partial<typeof entries[0]>) => {
    const next = [...entries]; next[i] = { ...next[i], ...patch }; onChange({ entries: next })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section sectionKey="entries" label="Ablaufplan-Einträge" enabled={sec('entries')} onToggle={onToggleSection} readOnly={readOnly}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Header row */}
          {entries.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '90px 90px 80px 1fr 1fr auto', gap: 8, padding: '0 0 4px' }}>
              {(['Start', 'Ende', 'Dauer (min)', 'Titel', 'Ort'] as const).map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>
          )}

          {entries.map((entry, i) => {
            const end = endMinutes(entry.start_minutes, entry.duration_minutes)
            return (
              <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: '90px 90px 80px 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                {/* Start */}
                {readOnly ? (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', padding: '8px 0' }}>
                    {fmtMinutes(entry.start_minutes)}
                  </span>
                ) : (
                  <input style={input} type="time" value={fmtMinutes(entry.start_minutes)}
                    onChange={e => updateEntry(i, { start_minutes: parseMinutes(e.target.value) })} />
                )}

                {/* End (calculated, always read-only display) */}
                <span style={{
                  fontSize: 13, color: 'var(--text-secondary)', padding: readOnly ? '8px 0' : '8px 12px',
                  border: readOnly ? 'none' : '1px solid var(--border)', borderRadius: 8,
                  background: readOnly ? 'transparent' : 'var(--surface)',
                }}>
                  {fmtMinutes(end)}
                </span>

                {/* Duration */}
                {readOnly ? (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0' }}>
                    {entry.duration_minutes ?? 60} min
                  </span>
                ) : (
                  <input style={input} type="number" min="5" step="5"
                    value={entry.duration_minutes ?? 60}
                    onChange={e => updateEntry(i, { duration_minutes: Math.max(5, Number(e.target.value)) })} />
                )}

                {/* Title */}
                {readOnly ? (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', padding: '8px 0' }}>
                    {entry.title || '—'}
                  </span>
                ) : (
                  <input style={input} value={entry.title} placeholder="Titel"
                    onChange={e => updateEntry(i, { title: e.target.value })} />
                )}

                {/* Location */}
                {readOnly ? (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0' }}>
                    {entry.location || '—'}
                  </span>
                ) : (
                  <input style={input} value={entry.location ?? ''} placeholder="Ort (optional)"
                    onChange={e => updateEntry(i, { location: e.target.value })} />
                )}

                {!readOnly && (
                  <button type="button" onClick={() => onChange({ entries: entries.filter((_, j) => j !== i) })}
                    style={{ padding: 7, borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}>
                    ✕
                  </button>
                )}
              </div>
            )
          })}

          {!readOnly && (
            <button type="button" onClick={() => {
              const lastEntry = entries[entries.length - 1]
              const lastTime = lastEntry
                ? lastEntry.start_minutes + (lastEntry.duration_minutes ?? 60)
                : 600
              onChange({
                entries: [...entries, {
                  id: Date.now().toString(),
                  start_minutes: lastTime,
                  duration_minutes: 60,
                  title: '',
                  sort_order: entries.length,
                }]
              })
            }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px dashed var(--border)', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'inherit', marginTop: 4 }}>
              + Eintrag hinzufügen
            </button>
          )}

          {entries.length === 0 && readOnly && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Keine Einträge.</p>
          )}
        </div>
      </Section>
    </div>
  )
}
