'use client'
import React from 'react'
import type { PatisserieProposalData } from '@/lib/proposals'
import { Section } from './ProposalSection'

interface Props {
  data: PatisserieProposalData
  onChange: (patch: Partial<PatisserieProposalData>) => void
  enabledSections: string[]
  onToggleSection: (key: string) => void
  readOnly?: boolean
}

const input: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--border)',
  borderRadius: 8, background: 'var(--bg)', fontFamily: 'inherit',
  color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 5 }}>{label}</label>}
      {children}
    </div>
  )
}

const COMMON_FLAVORS = ['Vanille', 'Schokolade', 'Erdbeer', 'Zitrone', 'Pistazie', 'Karamell', 'Himbeere', 'Nuss']

export default function ProposalFormPatisserie({ data, onChange, enabledSections, onToggleSection, readOnly }: Props) {
  const sec = (k: string) => enabledSections.includes(k)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Torten-Konfiguration */}
      <Section sectionKey="cake" label="Torten-Konfiguration" enabled={sec('cake')} onToggle={onToggleSection} readOnly={readOnly}>
        <Row label="Tortenbeschreibung">
          <textarea value={data.cake_description ?? ''} onChange={e => onChange({ cake_description: e.target.value })}
            placeholder="z.B. Dreistöckige Hochzeitstorte mit Fondant…" rows={3} style={{ ...input, resize: 'vertical' }} />
        </Row>
        <Row label="Anzahl Etagen">
          <input style={input} type="number" min="1" max="10" value={data.layers ?? ''}
            onChange={e => onChange({ layers: Number(e.target.value) })} placeholder="z.B. 3" />
        </Row>
        <Row label="Geschmacksrichtungen">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {COMMON_FLAVORS.map(f => (
              <button key={f} type="button" onClick={() => {
                const flavors = data.flavors ?? []
                onChange({ flavors: flavors.includes(f) ? flavors.filter(x => x !== f) : [...flavors, f] })
              }} style={{
                padding: '5px 11px', borderRadius: 100, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${(data.flavors ?? []).includes(f) ? 'var(--gold)' : 'var(--border)'}`,
                background: (data.flavors ?? []).includes(f) ? 'var(--gold-pale)' : 'transparent',
                color: (data.flavors ?? []).includes(f) ? 'var(--gold)' : 'var(--text-dim)',
              }}>{f}</button>
            ))}
          </div>
        </Row>
        <Row label="Diätetische Hinweise / Allergien">
          <input style={input} value={data.dietary_notes ?? ''} placeholder="z.B. Glutenfrei, Nussfrei…"
            onChange={e => onChange({ dietary_notes: e.target.value })} />
        </Row>
      </Section>

      {/* Lieferung & Aufbau */}
      <Section sectionKey="delivery" label="Lieferung & Aufbau" enabled={sec('delivery')} onToggle={onToggleSection} readOnly={readOnly}>
        <Row label="Lieferdatum & -uhrzeit">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input style={input} type="date" value={data.delivery_date ?? ''}
              onChange={e => onChange({ delivery_date: e.target.value })} />
            <input style={input} type="time" value={data.delivery_time ?? ''}
              onChange={e => onChange({ delivery_time: e.target.value })} />
          </div>
        </Row>
        <Row label="Aufstellungsort">
          <input style={input} value={data.setup_location ?? ''} placeholder="z.B. Eingang Festsaal, rechte Seite"
            onChange={e => onChange({ setup_location: e.target.value })} />
        </Row>
        <Row label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>
            <Toggle on={!!data.cooling_required} onChange={v => onChange({ cooling_required: v })} />
            Kühlung erforderlich
          </label>
          {(data.cooling_required || readOnly) && (
            <input style={input} value={data.cooling_notes ?? ''} placeholder="Kühlungsanforderungen…"
              onChange={e => onChange({ cooling_notes: e.target.value })} />
          )}
        </Row>
        <Row label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <Toggle on={!!data.cake_table_provided} onChange={v => onChange({ cake_table_provided: v })} />
            Tisch für Torte wird gestellt
          </label>
        </Row>
      </Section>

      {/* Dessert-Buffet */}
      <Section sectionKey="dessert" label="Dessert-Buffet" enabled={sec('dessert')} onToggle={onToggleSection} readOnly={readOnly}>
        <Row label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <Toggle on={!!data.dessert_buffet} onChange={v => onChange({ dessert_buffet: v })} />
            Dessert-Buffet angeboten
          </label>
        </Row>
        {(data.dessert_buffet || readOnly) && (
          <Row label="Dessert-Positionen (Enter zum Hinzufügen)">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {(data.dessert_items ?? []).map(item => (
                <span key={item} style={{ padding: '4px 10px', borderRadius: 100, background: 'var(--gold-pale)', color: 'var(--gold)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {item}
                  {!readOnly && (
                    <button type="button" onClick={() => onChange({ dessert_items: (data.dessert_items ?? []).filter(x => x !== item) })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', padding: 0 }}>✕</button>
                  )}
                </span>
              ))}
            </div>
            {!readOnly && (
              <input style={input} placeholder="z.B. Macarons, Petit Fours… (Enter)"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                    e.preventDefault()
                    const val = (e.target as HTMLInputElement).value.trim()
                    onChange({ dessert_items: [...(data.dessert_items ?? []), val] });
                    (e.target as HTMLInputElement).value = ''
                  }
                }}
              />
            )}
          </Row>
        )}
      </Section>

      {/* Preise & Anmerkungen */}
      <Section sectionKey="notes" label="Preise & Anmerkungen" enabled={sec('notes')} onToggle={onToggleSection} readOnly={readOnly}>
        <Row label="Gesamtpreis (€)">
          <input style={input} type="number" min="0" value={data.price ?? ''}
            onChange={e => onChange({ price: Number(e.target.value) })} placeholder="z.B. 1200" />
        </Row>
        <Row label="Sonstige Anmerkungen">
          <textarea value={data.vendor_notes ?? ''} onChange={e => onChange({ vendor_notes: e.target.value })}
            placeholder="Weitere Informationen…" rows={3} style={{ ...input, resize: 'vertical' }} />
        </Row>
      </Section>

    </div>
  )
}
