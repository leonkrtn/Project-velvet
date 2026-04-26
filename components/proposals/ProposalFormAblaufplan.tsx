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
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function parseMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((entry, i) => (
            <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <input style={input} type="time" value={fmtMinutes(entry.start_minutes)}
                onChange={e => updateEntry(i, { start_minutes: parseMinutes(e.target.value) })} />
              <input style={input} value={entry.title} placeholder="Titel"
                onChange={e => updateEntry(i, { title: e.target.value })} />
              <input style={input} value={entry.location ?? ''} placeholder="Ort (optional)"
                onChange={e => updateEntry(i, { location: e.target.value })} />
              {!readOnly && (
                <button type="button" onClick={() => onChange({ entries: entries.filter((_, j) => j !== i) })}
                  style={{ padding: 7, borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}>
                  ✕
                </button>
              )}
            </div>
          ))}
          {!readOnly && (
            <button type="button" onClick={() => {
              const lastTime = entries.length > 0 ? entries[entries.length - 1].start_minutes + 30 : 600
              onChange({ entries: [...entries, { id: Date.now().toString(), start_minutes: lastTime, title: '', sort_order: entries.length }] })
            }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px dashed var(--border)', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'inherit' }}>
              + Eintrag hinzufügen
            </button>
          )}
        </div>
      </Section>
    </div>
  )
}
