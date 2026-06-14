'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Check } from 'lucide-react'
import TimeInput from '@/components/ui/TimeInput'
import SoloInviteSection from './SoloInviteSection'

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
  collect_allergies: boolean | null
  budget_total: number | null
  dresscode: string | null
}

interface Props {
  eventId: string
  initialData: EventData
  /** true für brautpaar_solo: zeigt die Invite-Sektion (Partner / Veranstalter) */
  isSolo?: boolean
  /** Eigene User-ID — von SoloInviteSection benötigt (Partner vs. eigener Eintrag) */
  currentUserId?: string
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bp-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div className="bp-card-header">
        <h2 className="bp-section-title" style={{ margin: 0 }}>{title}</h2>
      </div>
      <div className="bp-card-body">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bp-field">
      <label className="bp-label-text">{label}</label>
      {children}
    </div>
  )
}

export default function BrautpaarAllgemein({ eventId, initialData, isSolo, currentUserId }: Props) {
  const [data, setData] = useState<EventData>(initialData)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [ceremonyTimeStr, setCeremonyTimeStr] = useState(() => {
    const cs = initialData.ceremony_start
    if (!cs) return ''
    const m = cs.match(/T(\d{2}:\d{2})/)
    return m ? m[1] : ''
  })

  const set = useCallback(<K extends keyof EventData>(key: K, value: EventData[K]) => {
    setData(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('events')
      .update({
        title:                data.title,
        couple_name:          data.couple_name,
        date:                 data.date || null,
        ceremony_start:       data.ceremony_start || null,
        description:          data.description,
        venue:                data.venue,
        venue_address:        data.venue_address,
        location_name:        data.location_name,
        location_street:      data.location_street,
        location_zip:         data.location_zip,
        location_city:        data.location_city,
        location_website:     data.location_website,
        max_begleitpersonen:  data.max_begleitpersonen,
        children_allowed:     data.children_allowed,
        children_note:        data.children_note,
        meal_options:         data.meal_options,
        collect_allergies:    data.collect_allergies,
        budget_total:         data.budget_total,
        dresscode:            data.dresscode,
      })
      .eq('id', eventId)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="bp-page">
      <div className="bp-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 className="bp-page-title">Einstellungen</h1>
          <p className="bp-page-subtitle">Grundlegende Details eurer Hochzeit</p>
        </div>
        <button
          className="bp-btn bp-btn-primary bp-btn-mobile-full"
          onClick={save}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? 'Speichert…' : saved ? 'Gespeichert' : 'Speichern'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 'var(--bp-r-sm)', padding: '0.875rem 1rem', marginBottom: '1.5rem', color: '#B91C1C', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Event Details */}
      <Section title="Event-Details">
        <div className="bp-grid-2">
          <Field label="Titel des Events">
            <input className="bp-input" value={data.title} onChange={e => set('title', e.target.value)} />
          </Field>
          <Field label="Namen des Brautpaars">
            <input className="bp-input" value={data.couple_name ?? ''} onChange={e => set('couple_name', e.target.value || null)} placeholder="z.B. Anna & Max" />
          </Field>
          <Field label="Hochzeitsdatum">
            <input className="bp-input" type="date" value={data.date ?? ''} onChange={e => set('date', e.target.value || null)} />
          </Field>
          <Field label="Beginn der Zeremonie">
            <TimeInput
              className="bp-input"
              value={ceremonyTimeStr}
              onChange={v => {
                setCeremonyTimeStr(v)
                const baseDate = data.date ?? data.ceremony_start?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
                set('ceremony_start', v ? `${baseDate}T${v}:00+00:00` : null)
              }}
            />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Beschreibung">
              <textarea className="bp-textarea" value={data.description ?? ''} onChange={e => set('description', e.target.value || null)} rows={3} placeholder="Kurze Beschreibung eurer Feier…" />
            </Field>
          </div>
        </div>
      </Section>

      {/* Location */}
      <Section title="Location">
        <div className="bp-grid-2">
          <Field label="Name der Location">
            <input className="bp-input" value={data.location_name ?? ''} onChange={e => set('location_name', e.target.value || null)} placeholder="z.B. Schloss Elmau" />
          </Field>
          <Field label="Website der Location">
            <input className="bp-input" value={data.location_website ?? ''} onChange={e => set('location_website', e.target.value || null)} placeholder="https://…" />
          </Field>
          <Field label="Straße">
            <input className="bp-input" value={data.location_street ?? ''} onChange={e => set('location_street', e.target.value || null)} />
          </Field>
          <div className="bp-grid-zip">
            <Field label="PLZ">
              <input className="bp-input" value={data.location_zip ?? ''} onChange={e => set('location_zip', e.target.value || null)} />
            </Field>
            <Field label="Stadt">
              <input className="bp-input" value={data.location_city ?? ''} onChange={e => set('location_city', e.target.value || null)} />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Zusätzliche Venue-Info">
              <input className="bp-input" value={data.venue ?? ''} onChange={e => set('venue', e.target.value || null)} placeholder="Interne Bezeichnung oder Notiz zur Location" />
            </Field>
          </div>
        </div>
      </Section>

      {/* Gäste-Einstellungen */}
      <Section title="Gäste-Einstellungen">
        <div className="bp-grid-2">
          <Field label="Max. Begleitpersonen pro Gast">
            <input className="bp-input" type="number" min={0} max={10} value={data.max_begleitpersonen} onChange={e => set('max_begleitpersonen', parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Dresscode">
            <input className="bp-input" value={data.dresscode ?? ''} onChange={e => set('dresscode', e.target.value || null)} placeholder="z.B. Elegant, Business Casual" />
          </Field>
        </div>

        <div className="bp-divider" />

        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9375rem', color: 'var(--bp-ink-2)' }}>
            <input type="checkbox" className="bp-checkbox" checked={data.children_allowed} onChange={e => set('children_allowed', e.target.checked)} />
            Kinder erlaubt
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9375rem', color: 'var(--bp-ink-2)' }}>
            <input type="checkbox" className="bp-checkbox" checked={data.collect_allergies ?? false} onChange={e => set('collect_allergies', e.target.checked)} />
            Allergien abfragen
          </label>
        </div>

        {data.children_allowed && (
          <Field label="Hinweis zu Kindern">
            <input className="bp-input" value={data.children_note ?? ''} onChange={e => set('children_note', e.target.value || null)} placeholder="z.B. Kinder bis 12 Jahre kostenfrei" />
          </Field>
        )}

      </Section>

      {isSolo && currentUserId && <SoloInviteSection eventId={eventId} currentUserId={currentUserId} />}

      {/* Save footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '0.5rem', paddingBottom: '2rem' }}>
        <button
          className="bp-btn bp-btn-primary bp-btn-lg bp-btn-mobile-full"
          onClick={save}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? 'Speichert…' : saved ? 'Gespeichert' : 'Änderungen speichern'}
        </button>
      </div>
    </div>
  )
}
