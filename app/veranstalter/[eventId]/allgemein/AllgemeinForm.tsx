'use client'
import React, { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import TimeInput from '@/components/ui/TimeInput'
import DateInput from '@/components/ui/DateInput'

const FIXED_COST_CATEGORIES = [
  'Miete / Locationkosten',
  'Getränke',
  'Dekoration',
  'Technik (Licht, Ton, Bühne)',
  'Catering-Zuschüsse',
  'Transport / Logistik',
  'Versicherungen',
  'Genehmigungen',
  'Reinigung',
]

interface OrganizerCost {
  id: string
  category: string
  amount: number
  notes: string | null
}

type Projektphase = 'Planung' | 'Finalisierung' | 'Durchführung' | 'Nachbereitung'
const PROJEKTPHASEN: Projektphase[] = ['Planung', 'Finalisierung', 'Durchführung', 'Nachbereitung']

const PHASE_COLORS: Record<Projektphase, { bg: string; color: string }> = {
  'Planung':        { bg: '#EEF2FF', color: '#4F46E5' },
  'Finalisierung':  { bg: '#FFF7ED', color: '#C2410C' },
  'Durchführung':   { bg: '#F0FDF4', color: '#15803D' },
  'Nachbereitung':  { bg: '#F5F3FF', color: '#7C3AED' },
}

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
  projektphase: Projektphase | null
}

interface BpMember {
  id: string
  user_id: string
  profiles: { id: string; name: string; email: string } | null
}

const BP_NAV_ITEMS = [
  { key: 'bp-gaeste',      label: 'Gäste',           group: 'PLANUNG' },
  { key: 'bp-sitzplan',    label: 'Sitzplan',         group: 'PLANUNG' },
  { key: 'bp-ablaufplan',  label: 'Ablaufplan',        group: 'PLANUNG' },
  { key: 'bp-catering',    label: 'Catering & Menü',   group: 'DETAILS' },
  { key: 'bp-dekoration',  label: 'Dekoration',        group: 'DETAILS' },
  { key: 'bp-musik',       label: 'Musik',             group: 'DETAILS' },
  { key: 'bp-patisserie',  label: 'Patisserie',        group: 'DETAILS' },
  { key: 'bp-medien',      label: 'Foto & Videograf',  group: 'DETAILS' },
  { key: 'bp-budget',      label: 'Budget',            group: 'VERWALTUNG' },
  { key: 'bp-aufgaben',    label: 'Aufgaben',          group: 'VERWALTUNG' },
  { key: 'bp-nachrichten', label: 'Nachrichten',       group: 'KOMMUNIKATION' },
  { key: 'bp-dateien',     label: 'Dateien',           group: 'KOMMUNIKATION' },
] as const

const RSVP_ITEMS = [
  { key: 'rsvp-musikwunsch',    label: 'Musikwünsche',        desc: 'Schritt zum Hinzufügen von Musikwünschen' },
  { key: 'rsvp-geschenke',      label: 'Geschenkliste',       desc: 'Geschenkliste im Bestätigungs-Schritt' },
  { key: 'rsvp-hotel',          label: 'Hotel-Buchung',       desc: 'Hotel-Auswahl-Schritt während der Anmeldung' },
  { key: 'rsvp-begleitpersonen',label: 'Begleitpersonen',     desc: 'Mitreisende Personen angeben' },
  { key: 'rsvp-menu',           label: 'Menüauswahl',         desc: 'Essensauswahl im Detail-Schritt' },
] as const

interface Props {
  eventId: string
  initialData: EventData
  bpMembers: BpMember[]
  initialCosts: OrganizerCost[]
  initialToggles: Record<string, boolean>
  initialGalleryUnlockAt: string | null
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

export default function AllgemeinForm({ eventId, initialData, bpMembers, initialCosts, initialToggles, initialGalleryUnlockAt }: Props) {
  const [form, setForm] = useState(initialData)
  const [ceremonyTimeStr, setCeremonyTimeStr] = useState(initialData.ceremony_start?.slice(11, 16) ?? '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [costs, setCosts] = useState<OrganizerCost[]>(initialCosts)
  const [toggles, setToggles] = useState<Record<string, boolean>>(initialToggles)
  const [galleryUnlockAt, setGalleryUnlockAt] = useState<string | null>(initialGalleryUnlockAt)
  const [seitenOpen, setSeitenOpen] = useState(false)
  const [customCostLabel, setCustomCostLabel] = useState('')

  // derived gallery mode
  const galleryEnabled = toggles['gaeste-fotos'] ?? true
  const galleryScheduled = !!galleryUnlockAt
  const [costAmounts, setCostAmounts] = useState<Record<string, string>>(
    Object.fromEntries(initialCosts.map(c => [c.id, String(c.amount)]))
  )

  const formRef = useRef(form)
  formRef.current = form
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>()
  const handleSaveRef = useRef<() => Promise<void>>()

  const update = useCallback(<K extends keyof EventData>(key: K, value: EventData[K]) => {
    setForm(f => ({ ...f, [key]: value }))
    setSuccess(false)
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => handleSaveRef.current?.(), 800)
  }, [])

  async function handleSave() {
    const f = formRef.current
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('events')
      .update({
        title: f.title,
        couple_name: f.couple_name,
        date: f.date,
        ceremony_start: f.ceremony_start,
        description: f.description,
        location_name: f.location_name,
        location_street: f.location_street,
        location_zip: f.location_zip,
        location_city: f.location_city,
        location_website: f.location_website,
        max_begleitpersonen: f.max_begleitpersonen,
        children_allowed: f.children_allowed,
        children_note: f.children_note,
        budget_total: f.budget_total,
        organizer_fee: f.organizer_fee,
        organizer_fee_type: f.organizer_fee_type,
        internal_notes: f.internal_notes,
        dresscode: f.dresscode,
        projektphase: f.projektphase,
      })
      .eq('id', eventId)
    setSaving(false)
    if (!err) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    }
  }
  handleSaveRef.current = handleSave

  async function addCost(category: string) {
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('event_organizer_costs')
      .insert({ event_id: eventId, category, amount: 0 })
      .select('id, category, amount, notes')
      .single()
    if (err || !data) return
    setCosts(prev => [...prev, data])
    setCostAmounts(prev => ({ ...prev, [data.id]: '0' }))
  }

  async function removeCost(id: string) {
    const supabase = createClient()
    await supabase.from('event_organizer_costs').delete().eq('id', id)
    setCosts(prev => prev.filter(c => c.id !== id))
    setCostAmounts(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  async function saveCostAmount(id: string) {
    const amount = parseFloat(costAmounts[id] ?? '0') || 0
    const supabase = createClient()
    await supabase.from('event_organizer_costs').update({ amount }).eq('id', id)
    setCosts(prev => prev.map(c => c.id === id ? { ...c, amount } : c))
  }

  async function addCustomCost() {
    const label = customCostLabel.trim()
    if (!label) return
    setCustomCostLabel('')
    await addCost(label)
  }

  async function setFeatureToggle(key: string, enabled: boolean) {
    setToggles(t => ({ ...t, [key]: enabled }))
    const supabase = createClient()
    await supabase.from('feature_toggles').upsert(
      { event_id: eventId, key, enabled },
      { onConflict: 'event_id,key' }
    )
  }

  async function setGallerySchedule(date: string | null) {
    setGalleryUnlockAt(date)
    const supabase = createClient()
    if (date) {
      // scheduled mode: save the date, mark gaeste-fotos as "false" (API checks date)
      await Promise.all([
        supabase.from('feature_toggles').upsert(
          { event_id: eventId, key: 'gaeste-fotos-unlock-at', enabled: false, value: date },
          { onConflict: 'event_id,key' }
        ),
        supabase.from('feature_toggles').upsert(
          { event_id: eventId, key: 'gaeste-fotos', enabled: false },
          { onConflict: 'event_id,key' }
        ),
      ])
      setToggles(t => ({ ...t, 'gaeste-fotos': false }))
    } else {
      // immediate mode: delete unlock-at, enable gaeste-fotos now
      await Promise.all([
        supabase.from('feature_toggles').delete()
          .eq('event_id', eventId).eq('key', 'gaeste-fotos-unlock-at'),
        supabase.from('feature_toggles').upsert(
          { event_id: eventId, key: 'gaeste-fotos', enabled: true },
          { onConflict: 'event_id,key' }
        ),
      ])
      setToggles(t => ({ ...t, 'gaeste-fotos': true }))
    }
  }

  async function toggleGalleryEnabled(enabled: boolean) {
    if (!enabled) {
      // disable completely — clear schedule too
      setGalleryUnlockAt(null)
      const supabase = createClient()
      await Promise.all([
        supabase.from('feature_toggles').upsert(
          { event_id: eventId, key: 'gaeste-fotos', enabled: false },
          { onConflict: 'event_id,key' }
        ),
        supabase.from('feature_toggles').delete()
          .eq('event_id', eventId).eq('key', 'gaeste-fotos-unlock-at'),
      ])
      setToggles(t => ({ ...t, 'gaeste-fotos': false }))
    } else {
      // enable immediately
      await setFeatureToggle('gaeste-fotos', true)
    }
  }

  const activeCategoryNames = new Set(costs.map(c => c.category))
  const availableFixed = FIXED_COST_CATEGORIES.filter(c => !activeCategoryNames.has(c))

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>
        Allgemein
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
        Event-Einstellungen und Details
      </p>

      {/* 1. Event-Details */}
      <SectionWrap title="Event-Details">
        {/* Projektphase */}
        <div style={{ marginBottom: 20 }}>
          <label style={label}>Projektphase</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PROJEKTPHASEN.map(phase => {
              const active = (form.projektphase ?? 'Planung') === phase
              const colors = PHASE_COLORS[phase]
              return (
                <button
                  key={phase}
                  type="button"
                  onClick={() => update('projektphase', phase)}
                  style={{
                    padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                    fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s',
                    border: active ? `1.5px solid ${colors.color}` : '1.5px solid var(--border)',
                    background: active ? colors.bg : 'var(--surface)',
                    color: active ? colors.color : 'var(--text-secondary)',
                  }}
                >
                  {phase}
                </button>
              )
            })}
          </div>
        </div>

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
            <DateInput style={input} value={form.date} onChange={v => update('date', v)} />
          </div>
          <div>
            <label style={label}>Uhrzeit Beginn</label>
            <TimeInput
              style={input}
              value={ceremonyTimeStr}
              onChange={val => {
                setCeremonyTimeStr(val)
                if (val === '' || /^\d{2}:\d{2}$/.test(val)) {
                  const baseDate = formRef.current.date ?? formRef.current.ceremony_start?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
                  update('ceremony_start', val ? `${baseDate}T${val}:00+00:00` : null)
                }
              }}
            />
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

      {/* 4. Veranstalterkosten */}
      <SectionWrap title="Veranstalterkosten">
        {/* Aktive Kostenpositionen */}
        {costs.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {costs.map(cost => (
              <div key={cost.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', marginBottom: 8,
                background: '#F5F5F7', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {cost.category}
                </span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: 10, fontSize: 14, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>€</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={costAmounts[cost.id] ?? '0'}
                    onChange={e => setCostAmounts(prev => ({ ...prev, [cost.id]: e.target.value }))}
                    onBlur={() => saveCostAmount(cost.id)}
                    style={{ ...input, width: 130, paddingLeft: 26, background: '#fff' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCost(cost.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-tertiary)', flexShrink: 0 }}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Fixe Kategorien als Chips */}
        {availableFixed.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
              Kategorie hinzufügen
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {availableFixed.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => addCost(cat)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 20, padding: '5px 12px', fontSize: 13,
                    color: 'var(--text-secondary)', cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
                >
                  <Plus size={12} /> {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Eigener Kostenpunkt */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
            Eigener Kostenpunkt
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...input, flex: 1 }}
              value={customCostLabel}
              onChange={e => setCustomCostLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomCost()}
              placeholder="z.B. Blumenschmuck, Fotodruck…"
            />
            <button
              type="button"
              onClick={addCustomCost}
              style={{ padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, flexShrink: 0 }}
            >
              <Plus size={14} /> Hinzufügen
            </button>
          </div>
        </div>

        {/* Summe */}
        {costs.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>Summe Veranstalterkosten</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {costs.reduce((s, c) => s + (c.amount ?? 0), 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </span>
            </div>
          </div>
        )}
      </SectionWrap>

      {/* 6. Budget */}
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

      {/* 7. Funktionen */}
      <SectionWrap title="Funktionen">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Aktiviere oder deaktiviere Features für dieses Event.
        </p>

        {/* ── Seiten (Brautpaar) ── */}
        <div style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          <button
            type="button"
            onClick={() => setSeitenOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, margin: 0, textAlign: 'left' }}>Seiten (Brautpaar-Portal)</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', textAlign: 'left' }}>
                Blende einzelne Menüpunkte im Brautpaar-Portal aus
              </p>
            </div>
            {seitenOpen ? <ChevronUp size={16} color="var(--text-tertiary)" /> : <ChevronDown size={16} color="var(--text-tertiary)" />}
          </button>
          {seitenOpen && (
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10, marginBottom: 10 }}>
                Nur für das Brautpaar-Portal — Berechtigungen für Dienstleister bleiben unverändert.
              </p>
              {(['PLANUNG', 'DETAILS', 'VERWALTUNG', 'KOMMUNIKATION'] as const).map(group => {
                const items = BP_NAV_ITEMS.filter(i => i.group === group)
                return (
                  <div key={group} style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                      {group}
                    </p>
                    {items.map(item => (
                      <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.label}</span>
                        <Toggle
                          checked={toggles[item.key] ?? true}
                          onChange={v => setFeatureToggle(item.key, v)}
                          label=""
                        />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Gästefotos ── */}
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: galleryEnabled || galleryScheduled ? 12 : 0 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>Gästefotos</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gäste können über ihren RSVP-Link Fotos hochladen und ansehen.</p>
            </div>
            <Toggle checked={galleryEnabled || galleryScheduled} onChange={toggleGalleryEnabled} label="" />
          </div>
          {(galleryEnabled || galleryScheduled) && (
            <div style={{ background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="galleryMode"
                    checked={!galleryScheduled}
                    onChange={() => setGallerySchedule(null)}
                    style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Sofort aktiv</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="galleryMode"
                    checked={galleryScheduled}
                    onChange={() => {
                      const tomorrow = new Date()
                      tomorrow.setDate(tomorrow.getDate() + 1)
                      setGallerySchedule(tomorrow.toISOString().slice(0, 10))
                    }}
                    style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Ab Datum aktivieren</span>
                  {galleryScheduled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
                      <Clock size={12} color="var(--accent)" />
                      <DateInput
                        value={galleryUnlockAt}
                        onChange={v => setGallerySchedule(v)}
                        style={{ ...input, width: 'auto', padding: '4px 8px', fontSize: 13 }}
                      />
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ── Nachrichten / Chat ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>Nachrichten / Chat</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Chat-Funktion für alle Beteiligten aktivieren.</p>
          </div>
          <Toggle checked={toggles['messaging'] ?? false} onChange={v => setFeatureToggle('messaging', v)} label="" />
        </div>

        {/* ── RSVP-Optionen ── */}
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
            RSVP-Optionen
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Blendet den jeweiligen Schritt im RSVP-Prozess für Gäste aus.
          </p>
          {RSVP_ITEMS.map((item, i) => (
            <div
              key={item.key}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: i < RSVP_ITEMS.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{item.label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.desc}</p>
              </div>
              <Toggle checked={toggles[item.key] ?? true} onChange={v => setFeatureToggle(item.key, v)} label="" />
            </div>
          ))}
        </div>
      </SectionWrap>

      {/* 8. Interne Notizen */}
      <SectionWrap title="Interne Notizen">
        <textarea
          style={{ ...input, minHeight: 120, resize: 'vertical' }}
          value={form.internal_notes ?? ''}
          onChange={e => update('internal_notes', e.target.value || null)}
          placeholder="Nur für dich sichtbar…"
        />
      </SectionWrap>

      {(saving || success) && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 100,
          background: success ? 'var(--green)' : 'var(--surface)',
          color: success ? '#fff' : 'var(--text-secondary)',
          padding: '8px 16px', borderRadius: 'var(--radius-sm)',
          fontSize: 13, fontWeight: 500,
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          border: success ? 'none' : '1px solid var(--border)',
          pointerEvents: 'none',
        }}>
          {saving ? 'Speichert…' : 'Gespeichert ✓'}
        </div>
      )}
    </div>
  )
}
