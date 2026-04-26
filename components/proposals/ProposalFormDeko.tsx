'use client'
import React from 'react'
import type { DekoProposalData } from '@/lib/proposals'
import { Section } from './ProposalSection'

interface Props {
  data: DekoProposalData
  onChange: (patch: Partial<DekoProposalData>) => void
  enabledSections: string[]
  onToggleSection: (key: string) => void
  readOnly?: boolean
}

const input: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--border)',
  borderRadius: 8, background: 'var(--bg)', fontFamily: 'inherit',
  color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

export default function ProposalFormDeko({ data, onChange, enabledSections, onToggleSection, readOnly }: Props) {
  const sec = (k: string) => enabledSections.includes(k)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Dekowünsche */}
      <Section sectionKey="wishes" label="Dekorationswünsche" enabled={sec('wishes')} onToggle={onToggleSection} readOnly={readOnly}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data.wishes ?? []).map((w, i) => (
            <div key={w.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...input, flex: 1 }} value={w.title} placeholder="Wunsch-Titel"
                  onChange={e => {
                    const next = [...(data.wishes ?? [])]
                    next[i] = { ...w, title: e.target.value }
                    onChange({ wishes: next })
                  }}
                />
                {!readOnly && (
                  <button type="button" onClick={() => onChange({ wishes: (data.wishes ?? []).filter((_, j) => j !== i) })}
                    style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}>
                    ✕
                  </button>
                )}
              </div>
              <input style={input} value={w.notes ?? ''} placeholder="Notizen (optional)"
                onChange={e => {
                  const next = [...(data.wishes ?? [])]
                  next[i] = { ...w, notes: e.target.value }
                  onChange({ wishes: next })
                }}
              />
            </div>
          ))}
          {!readOnly && (
            <button type="button" onClick={() => onChange({ wishes: [...(data.wishes ?? []), { id: Date.now().toString(), title: '' }] })}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px dashed var(--border)', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'inherit' }}>
              + Wunsch hinzufügen
            </button>
          )}
        </div>
      </Section>

      {/* Stil & Farbe */}
      <Section sectionKey="style" label="Stil & Farbpalette" enabled={sec('style')} onToggle={onToggleSection} readOnly={readOnly}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 5 }}>Dekorationsstil</label>
          <input style={input} value={data.general_style ?? ''} placeholder="z.B. Rustikal, Minimalistisch, Romantisch…"
            onChange={e => onChange({ general_style: e.target.value })} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 5 }}>Farbpalette</label>
          <input style={input} value={data.color_palette ?? ''} placeholder="z.B. Weiß, Blush, Gold…"
            onChange={e => onChange({ color_palette: e.target.value })} />
        </div>
      </Section>

      {/* Budget */}
      <Section sectionKey="budget" label="Budget" enabled={sec('budget')} onToggle={onToggleSection} readOnly={readOnly}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 5 }}>Gesamtbudget Dekoration (€)</label>
        <input style={input} type="number" min="0" value={data.budget ?? ''} placeholder="z.B. 2500"
          onChange={e => onChange({ budget: Number(e.target.value) })} />
      </Section>

      {/* Anmerkungen */}
      <Section sectionKey="notes" label="Anmerkungen" enabled={sec('notes')} onToggle={onToggleSection} readOnly={readOnly}>
        <textarea value={data.notes ?? ''} onChange={e => onChange({ notes: e.target.value })}
          placeholder="Weitere Anmerkungen zur Dekoration…" rows={4} style={{ ...input, resize: 'vertical' }} />
      </Section>

    </div>
  )
}
