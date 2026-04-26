'use client'
import React from 'react'
import type { CateringProposalData } from '@/lib/proposals'
import { Section } from './ProposalSection'

interface Props {
  data: CateringProposalData
  onChange: (patch: Partial<CateringProposalData>) => void
  currentData?: Record<string, unknown>
  enabledSections: string[]
  onToggleSection: (key: string) => void
  readOnly?: boolean
}

const SERVICE_STYLES = [
  { value: 'klassisch', label: 'Klassisches Menü' },
  { value: 'buffet',    label: 'Buffet' },
  { value: 'family',   label: 'Family Style' },
  { value: 'foodtruck',label: 'Food Trucks' },
  { value: 'live',     label: 'Live-Cooking' },
]
const DRINKS    = ['Wein', 'Bier', 'Softdrinks', 'Cocktails', 'Longdrinks', 'Champagner']
const EQUIPMENT = ['Geschirr', 'Gläser', 'Tischdecken', 'Buffet-Tische', 'Deko']

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

function CheckChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 500,
      border: `1px solid ${on ? 'var(--gold)' : 'var(--border)'}`,
      background: on ? 'var(--gold-pale)' : 'transparent',
      color: on ? 'var(--gold)' : 'var(--text-dim)',
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
    }}>{label}</button>
  )
}

export default function ProposalFormCatering({ data, onChange, currentData, enabledSections, onToggleSection, readOnly }: Props) {
  const sec = (k: string) => enabledSections.includes(k)
  const cur = currentData ?? {}

  const toggleArr = (arr: string[] = [], val: string) =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Service & Stil */}
      <Section sectionKey="service" label="Service & Stil" enabled={sec('service')} onToggle={onToggleSection} readOnly={readOnly}>
        {typeof cur.service_style === 'string' && cur.service_style && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', marginBottom: 8 }}>
            Aktuell: {cur.service_style}
          </div>
        )}
        <Row label="Service-Stil">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SERVICE_STYLES.map(s => (
              <CheckChip key={s.value} label={s.label} on={data.service_style === s.value}
                onClick={() => onChange({ service_style: data.service_style === s.value ? '' : s.value })} />
            ))}
          </div>
        </Row>
        <Row label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <Toggle on={!!data.location_has_kitchen} onChange={v => onChange({ location_has_kitchen: v })} />
            Küche vor Ort vorhanden
          </label>
        </Row>
      </Section>

      {/* Mitternachtssnack */}
      <Section sectionKey="midnight" label="Mitternachtssnack" enabled={sec('midnight')} onToggle={onToggleSection} readOnly={readOnly}>
        <Row label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <Toggle on={!!data.midnight_snack} onChange={v => onChange({ midnight_snack: v })} />
            Mitternachtssnack gewünscht
          </label>
        </Row>
        {(data.midnight_snack || readOnly) && (
          <Row label="Was wird serviert?">
            <input style={input} value={data.midnight_snack_note ?? ''} placeholder="z.B. Suppe, Brezel, Würstchen…"
              onChange={e => onChange({ midnight_snack_note: e.target.value })} />
          </Row>
        )}
      </Section>

      {/* Getränke */}
      <Section sectionKey="drinks" label="Getränke" enabled={sec('drinks')} onToggle={onToggleSection} readOnly={readOnly}>
        <Row label="Abrechnung">
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'pauschale', l: 'Pauschale' }, { v: 'einzeln', l: 'Einzeln' }].map(o => (
              <CheckChip key={o.v} label={o.l} on={data.drinks_billing === o.v}
                onClick={() => onChange({ drinks_billing: o.v })} />
            ))}
          </div>
        </Row>
        <Row label="Getränkeauswahl">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DRINKS.map(d => (
              <CheckChip key={d} label={d} on={(data.drinks_selection ?? []).includes(d)}
                onClick={() => onChange({ drinks_selection: toggleArr(data.drinks_selection, d) })} />
            ))}
          </div>
        </Row>
        <Row label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <Toggle on={!!data.weinbegleitung} onChange={v => onChange({ weinbegleitung: v })} />
            Weinbegleitung zum Menü
          </label>
        </Row>
        {(data.weinbegleitung || readOnly) && (
          <Row label="Weinbegleitung – Details">
            <input style={input} value={data.weinbegleitung_note ?? ''} placeholder="z.B. regionaler Weißwein zur Vorspeise…"
              onChange={e => onChange({ weinbegleitung_note: e.target.value })} />
          </Row>
        )}
      </Section>

      {/* Sektempfang & Fingerfood */}
      <Section sectionKey="champagne" label="Sektempfang & Fingerfood" enabled={sec('champagne')} onToggle={onToggleSection} readOnly={readOnly}>
        <Row label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <Toggle on={!!data.sektempfang} onChange={v => onChange({ sektempfang: v })} />
            Sektempfang
          </label>
        </Row>
        {(data.sektempfang || readOnly) && (
          <Row label="Anmerkungen Sektempfang">
            <input style={input} value={data.sektempfang_note ?? ''} placeholder="z.B. Prosecco + alkoholfrei…"
              onChange={e => onChange({ sektempfang_note: e.target.value })} />
          </Row>
        )}
        <Row label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <Toggle on={!!data.champagne_finger_food} onChange={v => onChange({ champagne_finger_food: v })} />
            Fingerfood / Häppchen
          </label>
        </Row>
        {(data.champagne_finger_food || readOnly) && (
          <Row label="Was wird angeboten?">
            <input style={input} value={data.champagne_finger_food_note ?? ''} placeholder="z.B. Canapés, Bruschetta…"
              onChange={e => onChange({ champagne_finger_food_note: e.target.value })} />
          </Row>
        )}
      </Section>

      {/* Personal & Equipment */}
      <Section sectionKey="staff" label="Personal & Equipment" enabled={sec('staff')} onToggle={onToggleSection} readOnly={readOnly}>
        <Row label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <Toggle on={!!data.service_staff} onChange={v => onChange({ service_staff: v })} />
            Servicepersonal gestellt
          </label>
        </Row>
        <Row label="Equipment (wird gestellt)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EQUIPMENT.map(e => (
              <CheckChip key={e} label={e} on={(data.equipment_needed ?? []).includes(e)}
                onClick={() => onChange({ equipment_needed: toggleArr(data.equipment_needed, e) })} />
            ))}
          </div>
        </Row>
      </Section>

      {/* Budget */}
      <Section sectionKey="budget" label="Budget" enabled={sec('budget')} onToggle={onToggleSection} readOnly={readOnly}>
        {(typeof cur.budget_per_person === 'number' || typeof cur.budget_per_person === 'string') && cur.budget_per_person && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', marginBottom: 8 }}>
            Aktuell: {String(cur.budget_per_person)} € / Person
          </div>
        )}
        <Row label="Budget pro Person (€)">
          <input style={input} type="number" min="0" value={data.budget_per_person ?? ''} placeholder="z.B. 85"
            onChange={e => onChange({ budget_per_person: Number(e.target.value) })} />
        </Row>
        <Row label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <Toggle on={!!data.budget_includes_drinks} onChange={v => onChange({ budget_includes_drinks: v })} />
            Getränke im Budget enthalten
          </label>
        </Row>
        <Row label="Geplante Gästeanzahl">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle on={!!data.plan_guest_count_enabled} onChange={v => onChange({ plan_guest_count_enabled: v })} />
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Gästeanzahl angeben</span>
          </div>
        </Row>
        {(data.plan_guest_count_enabled || readOnly) && (
          <Row label="">
            <input style={input} type="number" min="0" value={data.plan_guest_count ?? ''} placeholder="z.B. 120"
              onChange={e => onChange({ plan_guest_count: Number(e.target.value) })} />
          </Row>
        )}
      </Section>

      {/* Menügänge */}
      <Section sectionKey="menu_courses" label="Menügänge" enabled={sec('menu_courses')} onToggle={onToggleSection} readOnly={readOnly}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(data.menu_courses ?? [
            { id: '1', name: 'Vorspeise', descriptions: {} },
            { id: '2', name: 'Hauptgang', descriptions: {} },
            { id: '3', name: 'Dessert',   descriptions: {} },
          ]).map((course, i) => (
            <div key={course.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input style={{ ...input, flex: 1 }} value={course.name} placeholder="Gang-Bezeichnung"
                  onChange={e => {
                    const courses = [...(data.menu_courses ?? [])]
                    courses[i] = { ...course, name: e.target.value }
                    onChange({ menu_courses: courses })
                  }}
                />
                {!readOnly && (
                  <button type="button" onClick={() => onChange({ menu_courses: (data.menu_courses ?? []).filter((_, j) => j !== i) })}
                    style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}>
                    ✕
                  </button>
                )}
              </div>
              <input style={input} placeholder="Beschreibung (optional)"
                value={Object.values(course.descriptions)[0] ?? ''}
                onChange={e => {
                  const courses = [...(data.menu_courses ?? [])]
                  courses[i] = { ...course, descriptions: { default: e.target.value } }
                  onChange({ menu_courses: courses })
                }}
              />
            </div>
          ))}
          {!readOnly && (
            <button type="button" onClick={() => {
              const newCourse = { id: Date.now().toString(), name: '', descriptions: {} }
              onChange({ menu_courses: [...(data.menu_courses ?? []), newCourse] })
            }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px dashed var(--border)', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'inherit' }}>
              + Gang hinzufügen
            </button>
          )}
        </div>
      </Section>

      {/* Kinder-Menü */}
      <Section sectionKey="kinder" label="Kinder-Menü" enabled={sec('kinder')} onToggle={onToggleSection} readOnly={readOnly}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {(data.kinder_meal_options ?? []).map(opt => (
            <span key={opt} style={{ padding: '4px 10px', borderRadius: 100, background: 'var(--gold-pale)', color: 'var(--gold)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              {opt}
              {!readOnly && (
                <button type="button" onClick={() => onChange({ kinder_meal_options: (data.kinder_meal_options ?? []).filter(x => x !== opt) })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', padding: 0, display: 'flex' }}>✕</button>
              )}
            </span>
          ))}
        </div>
        {!readOnly && (
          <input style={input} placeholder="z.B. Pasta, Schnitzel … (Enter)"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                e.preventDefault()
                const val = (e.target as HTMLInputElement).value.trim()
                onChange({ kinder_meal_options: [...(data.kinder_meal_options ?? []), val] });
                (e.target as HTMLInputElement).value = ''
              }
            }}
          />
        )}
      </Section>

      {/* Anmerkungen */}
      <Section sectionKey="notes" label="Anmerkungen" enabled={sec('notes')} onToggle={onToggleSection} readOnly={readOnly}>
        <textarea value={data.catering_notes ?? ''} onChange={e => onChange({ catering_notes: e.target.value })}
          placeholder="Weitere Anmerkungen zum Catering…" rows={4} style={{ ...input, resize: 'vertical' }} />
      </Section>

    </div>
  )
}
