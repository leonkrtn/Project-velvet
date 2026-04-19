'use client'
import React, { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'

interface EventData {
  id: string
  title: string
  couple_name: string | null
  date: string | null
  ceremony_start: string | null
  description: string | null
  venue: string | null
  venue_address: string | null
  location_name: string | null
  location_street: string | null
  location_zip: string | null
  location_city: string | null
  location_website: string | null
  max_begleitpersonen: number
  children_allowed: boolean
  children_note: string | null
  meal_options: string[] | null
  menu_type: string | null
  collect_allergies: boolean | null
  budget_total: number | null
  organizer_fee: number | null
  organizer_fee_type: string | null
  internal_notes: string | null
  dresscode: string | null
}

interface BpMember {
  id: string
  user_id: string
  profiles: { id: string; name: string; email: string } | null
}

interface Props {
  eventId: string
  initialData: EventData
  bpMembers: BpMember[]
}

const input: React.CSSProperties = {
  width: '100%', padding: '10px 13px',
  background: '#fff', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
}
const label: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.1em',
  color: 'var(--text-tertiary)', marginBottom: 5,
}
const section: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', marginBottom: 20,
}
const sectionHead: React.CSSProperties = {
  padding: '16px 22px', display: 'flex',
  justifyContent: 'space-between', alignItems: 'center',
  cursor: 'pointer', userSelect: 'none',
}
const sectionBody: React.CSSProperties = {
  padding: '0 22px 22px',
}
const row: React.CSSProperties = {
  display: 'grid', gap: 16, marginBottom: 16,
}

const DEFAULT_MEAL_OPTIONS = ['Fleisch', 'Fisch', 'Vegetarisch', 'Vegan']

function SectionWrap({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={section}>
      <div style={sectionHead} onClick={() => setOpen(o => !o)}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        {open ? <ChevronUp size={16} color="var(--text-tertiary)" /> : <ChevronDown size={16} color="var(--text-tertiary)" />}
      </div>
      {open && <div style={sectionBody}>{children}</div>}
    </div>
  )
}

function Toggle({ checked, onChange, label: lbl }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 11, border: 'none',
          background: checked ? 'var(--accent)' : 'var(--border2)', cursor: 'pointer',
          position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 20 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>
      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{lbl}</span>
    </div>
  )
}

export default function AllgemeinForm({ eventId, initialData, bpMembers }: Props) {
  const [form, setForm] = useState(initialData)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [newMealOption, setNewMealOption] = useState('')

  const update = useCallback(<K extends keyof EventData>(key: K, value: EventData[K]) => {
    setForm(f => ({ ...f, [key]: value }))
    setDirty(true)
    setSuccess(false)
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('events')
      .update({
        title: form.title,
        couple_name: form.couple_name,
        date: form.date,
        ceremony_start: form.ceremony_start,
        description: form.description,
        location_name: form.location_name,
        location_street: form.location_street,
        location_zip: form.location_zip,
        location_city: form.location_city,
        location_website: form.location_website,
        max_begleitpersonen: form.max_begleitpersonen,
        children_allowed: form.children_allowed,
        children_note: form.children_note,
        meal_options: form.meal_options,
        menu_type: form.menu_type,
        collect_allergies: form.collect_allergies,
        budget_total: form.budget_total,
        organizer_fee: form.organizer_fee,
        organizer_fee_type: form.organizer_fee_type,
        internal_notes: form.internal_notes,
        dresscode: form.dresscode,
      })
      .eq('id', eventId)

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setDirty(false)
      setSuccess(true)
    }
  }

  const mealOptions = form.meal_options ?? DEFAULT_MEAL_OPTIONS

  function addMealOption() {
    const val = newMealOption.trim()
    if (!val) return
    update('meal_options', [...mealOptions, val])
    setNewMealOption('')
  }

  function removeMealOption(opt: string) {
    update('meal_options', mealOptions.filter(o => o !== opt))
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>
        Allgemein
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
        Event-Einstellungen und Details
      </p>

      {/* 1. Event-Details */}
      <SectionWrap title="Event-Details">
        <div style={{ ...row, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={label}>Eventname *</label>
            <input style={input} value={form.title} onChange={e => update('title', e.target.value)} />
          </div>
          <div>
            <label style={label}>Brautpaar-Name</label>
            <input style={input} value={form.couple_name ?? ''} onChange={e => update('couple_name', e.target.value || null)} placeholder="Max & Maria Mustermann" />
          </div>
        </div>
        <div style={{ ...row, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={label}>Datum</label>
            <input type="date" style={input} value={form.date ?? ''} onChange={e => update('date', e.target.value || null)} />
          </div>
          <div>
            <label style={label}>Uhrzeit Beginn</label>
            <input type="datetime-local" style={input} value={form.ceremony_start?.slice(0, 16) ?? ''} onChange={e => update('ceremony_start', e.target.value ? e.target.value + ':00+00:00' : null)} />
          </div>
        </div>
        <div>
          <label style={label}>Beschreibung</label>
          <textarea style={{ ...input, minHeight: 90, resize: 'vertical' }} value={form.description ?? ''} onChange={e => update('description', e.target.value || null)} placeholder="Kurze Beschreibung des Events…" />
        </div>
        <div>
          <label style={label}>Dresscode</label>
          <input style={input} value={form.dresscode ?? ''} onChange={e => update('dresscode', e.target.value || null)} placeholder="z.B. Black Tie, Smart Casual" />
        </div>
      </SectionWrap>

      {/* 2. Location */}
      <SectionWrap title="Location">
        <div style={{ ...row, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={label}>Location Name</label>
            <input style={input} value={form.location_name ?? ''} onChange={e => update('location_name', e.target.value || null)} placeholder="Schloss Musterburg" />
          </div>
          <div>
            <label style={label}>Straße & Hausnummer</label>
            <input style={input} value={form.location_street ?? ''} onChange={e => update('location_street', e.target.value || null)} placeholder="Musterstraße 1" />
          </div>
        </div>
        <div style={{ ...row, gridTemplateColumns: '120px 1fr 1fr' }}>
          <div>
            <label style={label}>PLZ</label>
            <input style={input} value={form.location_zip ?? ''} onChange={e => update('location_zip', e.target.value || null)} placeholder="12345" />
          </div>
          <div>
            <label style={label}>Stadt</label>
            <input style={input} value={form.location_city ?? ''} onChange={e => update('location_city', e.target.value || null)} placeholder="Berlin" />
          </div>
          <div>
            <label style={label}>Website</label>
            <input type="url" style={input} value={form.location_website ?? ''} onChange={e => update('location_website', e.target.value || null)} placeholder="https://…" />
          </div>
        </div>
      </SectionWrap>

      {/* 3. Gäste */}
      <SectionWrap title="Gäste">
        <div style={{ ...row, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={label}>Max. Begleitpersonen pro Gast</label>
            <input type="number" min={0} max={10} style={input} value={form.max_begleitpersonen} onChange={e => update('max_begleitpersonen', parseInt(e.target.value) || 0)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 2 }}>
            <Toggle checked={form.children_allowed} onChange={v => update('children_allowed', v)} label="Kinder willkommen" />
          </div>
        </div>
        {form.children_allowed && (
          <div>
            <label style={label}>Hinweis Kinder</label>
            <input style={input} value={form.children_note ?? ''} onChange={e => update('children_note', e.target.value || null)} placeholder="z.B. Kindertisch vorhanden" />
          </div>
        )}
      </SectionWrap>

      {/* 4. Catering & Menü */}
      <SectionWrap title="Catering & Menü">
        <div style={{ ...row, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={label}>Menü-Art</label>
            <select style={input} value={form.menu_type ?? 'Mehrgängiges Menü'} onChange={e => update('menu_type', e.target.value)}>
              {['Mehrgängiges Menü', 'Buffet', 'À la carte', 'Fingerfood', 'BBQ'].map(o => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <Toggle checked={form.collect_allergies ?? true} onChange={v => update('collect_allergies', v)} label="Allergien erfassen" />
          </div>
        </div>
        <div>
          <label style={label}>Essensoptionen</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {mealOptions.map(opt => (
              <span key={opt} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'var(--accent-light)', border: '1px solid rgba(29,29,31,0.15)',
                borderRadius: 20, padding: '4px 10px', fontSize: 13, color: 'var(--accent)',
              }}>
                {opt}
                <button type="button" onClick={() => removeMealOption(opt)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--accent)' }}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...input, flex: 1 }} value={newMealOption} onChange={e => setNewMealOption(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMealOption()} placeholder="Neue Option…" />
            <button type="button" onClick={addMealOption} style={{ padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500 }}>
              <Plus size={14} /> Hinzufügen
            </button>
          </div>
        </div>
      </SectionWrap>

      {/* 5. Budget */}
      <SectionWrap title="Budget">
        <div style={{ ...row, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div>
            <label style={label}>Gesamtbudget (€)</label>
            <input type="number" min={0} style={input} value={form.budget_total ?? ''} onChange={e => update('budget_total', e.target.value ? parseFloat(e.target.value) : null)} placeholder="0" />
          </div>
          <div>
            <label style={label}>Veranstalter-Honorar (€)</label>
            <input type="number" min={0} style={input} value={form.organizer_fee ?? ''} onChange={e => update('organizer_fee', e.target.value ? parseFloat(e.target.value) : null)} placeholder="0" />
          </div>
          <div>
            <label style={label}>Zahlungsart Honorar</label>
            <select style={input} value={form.organizer_fee_type ?? 'Pauschal'} onChange={e => update('organizer_fee_type', e.target.value)}>
              {['Pauschal', 'Pro Person', 'Prozentual', 'Stundensatz'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </SectionWrap>

      {/* 6. Kontakt Brautpaar */}
      <SectionWrap title="Kontakt Brautpaar">
        {bpMembers.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Noch kein Brautpaar eingeladen.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bpMembers.map((m, i) => (
              <div key={m.id} style={{ background: '#F5F5F7', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  Person {i + 1}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={label}>Name</label>
                    <input style={{ ...input, background: '#fff' }} value={m.profiles?.name ?? ''} readOnly />
                  </div>
                  <div>
                    <label style={label}>E-Mail</label>
                    <input style={{ ...input, background: '#fff' }} value={m.profiles?.email ?? ''} readOnly />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionWrap>

      {/* 7. Interne Notizen */}
      <SectionWrap title="Interne Notizen">
        <textarea
          style={{ ...input, minHeight: 120, resize: 'vertical' }}
          value={form.internal_notes ?? ''}
          onChange={e => update('internal_notes', e.target.value || null)}
          placeholder="Nur für dich sichtbar…"
        />
      </SectionWrap>

      {/* Save bar */}
      {dirty && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
          padding: '14px 36px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', zIndex: 100,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Ungespeicherte Änderungen</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {error && <span style={{ fontSize: 13, color: 'var(--red)' }}>{error}</span>}
            <button
              onClick={() => { setForm(initialData); setDirty(false) }}
              style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Save size={14} />
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      {success && !dirty && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--green)', color: '#fff',
          padding: '12px 20px', borderRadius: 'var(--radius-sm)',
          fontSize: 14, fontWeight: 500, zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          Änderungen gespeichert ✓
        </div>
      )}
    </div>
  )
}
