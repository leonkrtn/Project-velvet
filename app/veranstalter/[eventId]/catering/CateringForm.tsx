'use client'
import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Save, Plus, X, ChevronDown, ChevronUp, Users, TrendingUp,
  AlertTriangle, UtensilsCrossed,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface EventData {
  id: string
  meal_options: string[] | null
  menu_type: string | null
  collect_allergies: boolean | null
  children_allowed: boolean
  children_note: string | null
}

interface CateringPlan {
  id?: string
  service_style: string
  location_has_kitchen: boolean
  midnight_snack: boolean
  midnight_snack_note: string
  drinks_billing: string
  drinks_selection: string[]
  champagne_finger_food: boolean
  champagne_finger_food_note: string
  service_staff: boolean
  equipment_needed: string[]
  budget_per_person: number
  budget_includes_drinks: boolean
  catering_notes: string
  sektempfang: boolean
  sektempfang_note: string
  weinbegleitung: boolean
  weinbegleitung_note: string
  kinder_meal_options: string[]
  menu_courses: MenuCourse[]
  plan_guest_count_enabled: boolean
  plan_guest_count: number
}

interface MenuCourse {
  id: string
  name: string
  descriptions: Record<string, string>
}

interface OrganizerCost {
  id: string
  category: string
  price_per_person: number
  notes: string | null
}

interface Props {
  eventId: string
  initialEvent: EventData
  initialPlan: Record<string, unknown> | null
  initialCosts: OrganizerCost[]
  confirmedGuestCount: number
  mealCounts: Record<string, number>
  allergyCounts: Record<string, number>
  hideCosts?: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MEAL_OPTIONS = ['Fleisch', 'Fisch', 'Vegetarisch', 'Vegan']
const DEFAULT_COURSES: MenuCourse[] = [
  { id: '1', name: 'Vorspeise', descriptions: {} },
  { id: '2', name: 'Hauptgang', descriptions: {} },
  { id: '3', name: 'Dessert', descriptions: {} },
]
const MENU_TYPES = ['Mehrgängiges Menü', 'Buffet', 'À la carte', 'Fingerfood', 'BBQ']
const SERVICE_STYLES = [
  { value: 'klassisch', label: 'Klassisches Menü' },
  { value: 'buffet',    label: 'Buffet' },
  { value: 'family',   label: 'Family Style' },
  { value: 'foodtruck',label: 'Food Trucks' },
  { value: 'live',     label: 'Live-Cooking' },
]
const DRINKS_OPTIONS = [
  { value: 'wein',       label: 'Wein' },
  { value: 'bier',       label: 'Bier' },
  { value: 'softdrinks', label: 'Softdrinks' },
  { value: 'cocktails',  label: 'Cocktailbar' },
  { value: 'longdrinks', label: 'Longdrinks' },
  { value: 'alkoholfrei',label: 'Alkoholfrei-Sortiment' },
]
const EQUIPMENT_OPTIONS = [
  { value: 'geschirr',     label: 'Geschirr & Besteck' },
  { value: 'glaeser',      label: 'Gläser' },
  { value: 'tischdecken',  label: 'Tischdecken & Servietten' },
  { value: 'buffettische', label: 'Buffet-Tische' },
  { value: 'deko',         label: 'Dekoration' },
]
const CATERING_COST_CATEGORIES = [
  'Menü / Speisen',
  'Getränkepauschale',
  'Servicepersonal',
  'Equipment-Miete',
  'Mitternachtssnack',
  'Sektempfang',
]

// ── Shared styles ──────────────────────────────────────────────────────────

const input: React.CSSProperties = {
  width: '100%', padding: '10px 13px',
  background: '#fff', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.1em',
  color: 'var(--text-tertiary)', marginBottom: 5,
}
const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', marginBottom: 20,
}
const sectionHeadStyle: React.CSSProperties = {
  padding: '16px 22px', display: 'flex',
  justifyContent: 'space-between', alignItems: 'center',
  cursor: 'pointer', userSelect: 'none',
}
const sectionBodyStyle: React.CSSProperties = { padding: '0 22px 22px' }

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionWrap({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={sectionStyle}>
      <div style={sectionHeadStyle} onClick={() => setOpen(o => !o)}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        {open
          ? <ChevronUp size={16} color="var(--text-tertiary)" />
          : <ChevronDown size={16} color="var(--text-tertiary)" />}
      </div>
      {open && <div style={sectionBodyStyle}>{children}</div>}
    </div>
  )
}

function Toggle({ checked, onChange, label: lbl }: {
  checked: boolean; onChange: (v: boolean) => void; label: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 11, border: 'none',
          background: checked ? 'var(--accent)' : 'var(--border2)',
          cursor: 'pointer', position: 'relative', flexShrink: 0,
          transition: 'background 0.2s',
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

function ChipGroup({ options, selected, onChange }: {
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter(x => x !== val) : [...selected, val])
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {options.map(o => {
        const active = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid',
              borderColor: active ? 'var(--accent)' : 'var(--border)',
              background: active ? 'var(--accent-light)' : 'var(--surface)',
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >{o.label}</button>
        )
      })}
    </div>
  )
}

function StatBadge({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: '#F5F5F7', borderRadius: 'var(--radius-sm)',
      padding: '12px 16px', flex: '1 1 140px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

function parsePlan(raw: Record<string, unknown> | null): CateringPlan {
  return {
    id:                       raw?.id as string | undefined,
    service_style:            (raw?.service_style as string) ?? '',
    location_has_kitchen:     (raw?.location_has_kitchen as boolean) ?? false,
    midnight_snack:           (raw?.midnight_snack as boolean) ?? false,
    midnight_snack_note:      (raw?.midnight_snack_note as string) ?? '',
    drinks_billing:           (raw?.drinks_billing as string) ?? 'pauschale',
    drinks_selection:         (raw?.drinks_selection as string[]) ?? [],
    champagne_finger_food:    (raw?.champagne_finger_food as boolean) ?? false,
    champagne_finger_food_note:(raw?.champagne_finger_food_note as string) ?? '',
    service_staff:            (raw?.service_staff as boolean) ?? false,
    equipment_needed:         (raw?.equipment_needed as string[]) ?? [],
    budget_per_person:        (raw?.budget_per_person as number) ?? 0,
    budget_includes_drinks:   (raw?.budget_includes_drinks as boolean) ?? false,
    catering_notes:           (raw?.catering_notes as string) ?? '',
    sektempfang:              (raw?.sektempfang as boolean) ?? false,
    sektempfang_note:         (raw?.sektempfang_note as string) ?? '',
    weinbegleitung:           (raw?.weinbegleitung as boolean) ?? false,
    weinbegleitung_note:      (raw?.weinbegleitung_note as string) ?? '',
    kinder_meal_options:      (raw?.kinder_meal_options as string[]) ?? [],
    menu_courses:             ((raw?.menu_courses as any[]) ?? DEFAULT_COURSES).map((c: any) => ({
      id: c.id ?? Date.now().toString(),
      name: c.name ?? '',
      descriptions: c.descriptions ?? {},
    })),
    plan_guest_count_enabled: (raw?.plan_guest_count_enabled as boolean) ?? false,
    plan_guest_count:         (raw?.plan_guest_count as number) ?? 0,
  }
}

export default function CateringForm({
  eventId, initialEvent, initialPlan, initialCosts,
  confirmedGuestCount, mealCounts, allergyCounts, hideCosts = false,
}: Props) {
  const router = useRouter()
  const [event, setEvent] = useState(initialEvent)
  const [plan, setPlan] = useState<CateringPlan>(() => parsePlan(initialPlan))
  const [costs, setCosts] = useState<OrganizerCost[]>(initialCosts)
  const [costPrices, setCostPrices] = useState<Record<string, string>>(
    Object.fromEntries(initialCosts.map(c => [c.id, String(c.price_per_person ?? 0)]))
  )
  const [newMealOption, setNewMealOption] = useState('')
  const [newKinderOption, setNewKinderOption] = useState('')
  const [newCourseName, setNewCourseName] = useState('')
  const [customCostLabel, setCustomCostLabel] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const mealOptions = event.meal_options ?? DEFAULT_MEAL_OPTIONS
  const effectiveGuestCount = plan.plan_guest_count_enabled
    ? plan.plan_guest_count
    : confirmedGuestCount

  const updateEvent = useCallback(<K extends keyof EventData>(key: K, value: EventData[K]) => {
    setEvent(e => ({ ...e, [key]: value }))
    setDirty(true); setSuccess(false)
  }, [])

  const updatePlan = useCallback((patch: Partial<CateringPlan>) => {
    setPlan(p => ({ ...p, ...patch }))
    setDirty(true); setSuccess(false)
  }, [])

  async function handleSave() {
    setSaving(true); setError(null)
    const supabase = createClient()

    const [evErr, planErr] = await Promise.all([
      supabase.from('events').update({
        meal_options: event.meal_options,
        menu_type: event.menu_type,
        collect_allergies: event.collect_allergies,
      }).eq('id', eventId).then(r => r.error),

      supabase.from('catering_plans').upsert({
        event_id: eventId,
        service_style:              plan.service_style,
        location_has_kitchen:       plan.location_has_kitchen,
        midnight_snack:             plan.midnight_snack,
        midnight_snack_note:        plan.midnight_snack_note,
        drinks_billing:             plan.drinks_billing,
        drinks_selection:           plan.drinks_selection,
        champagne_finger_food:      plan.champagne_finger_food,
        champagne_finger_food_note: plan.champagne_finger_food_note,
        service_staff:              plan.service_staff,
        equipment_needed:           plan.equipment_needed,
        budget_per_person:          plan.budget_per_person,
        budget_includes_drinks:     plan.budget_includes_drinks,
        catering_notes:             plan.catering_notes,
        sektempfang:                plan.sektempfang,
        sektempfang_note:           plan.sektempfang_note,
        weinbegleitung:             plan.weinbegleitung,
        weinbegleitung_note:        plan.weinbegleitung_note,
        kinder_meal_options:        plan.kinder_meal_options,
        menu_courses:               plan.menu_courses,
        plan_guest_count_enabled:   plan.plan_guest_count_enabled,
        plan_guest_count:           plan.plan_guest_count,
      }, { onConflict: 'event_id' }).then(r => r.error),
    ])

    setSaving(false)
    if (evErr || planErr) {
      setError((evErr ?? planErr)!.message)
    } else {
      setDirty(false); setSuccess(true)
    }
  }

  // ── Meal options ──────────────────────────────────────────────────────────

  function addMealOption() {
    const val = newMealOption.trim()
    if (!val) return
    updateEvent('meal_options', [...mealOptions, val])
    setNewMealOption('')
  }

  function addKinderOption() {
    const val = newKinderOption.trim()
    if (!val) return
    updatePlan({ kinder_meal_options: [...plan.kinder_meal_options, val] })
    setNewKinderOption('')
  }

  // ── Menu courses ──────────────────────────────────────────────────────────

  function addCourse() {
    const name = newCourseName.trim()
    if (!name) return
    updatePlan({ menu_courses: [...plan.menu_courses, { id: Date.now().toString(), name, descriptions: {} }] })
    setNewCourseName('')
  }

  function updateCourseName(id: string, name: string) {
    updatePlan({ menu_courses: plan.menu_courses.map(c => c.id === id ? { ...c, name } : c) })
  }

  function updateCourseDescription(courseId: string, option: string, value: string) {
    updatePlan({
      menu_courses: plan.menu_courses.map(c =>
        c.id === courseId
          ? { ...c, descriptions: { ...c.descriptions, [option]: value } }
          : c
      )
    })
  }

  function copyOptionFrom(targetOption: string, sourceOption: string) {
    updatePlan({
      menu_courses: plan.menu_courses.map(c => ({
        ...c,
        descriptions: { ...c.descriptions, [targetOption]: c.descriptions[sourceOption] ?? '' },
      }))
    })
  }

  function removeCourse(id: string) {
    updatePlan({ menu_courses: plan.menu_courses.filter(c => c.id !== id) })
  }

  // ── Catering costs ────────────────────────────────────────────────────────

  async function addCost(category: string) {
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('event_organizer_costs')
      .insert({ event_id: eventId, category, price_per_person: 0, amount: 0, source: 'catering' })
      .select('id, category, price_per_person, notes')
      .single()
    if (err || !data) return
    setCosts(prev => [...prev, data])
    setCostPrices(prev => ({ ...prev, [data.id]: '0' }))
  }

  async function removeCost(id: string) {
    const supabase = createClient()
    await supabase.from('event_organizer_costs').delete().eq('id', id)
    setCosts(prev => prev.filter(c => c.id !== id))
    setCostPrices(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  async function saveCostPrice(id: string) {
    const price_per_person = parseFloat(costPrices[id] ?? '0') || 0
    const supabase = createClient()
    await supabase.from('event_organizer_costs').update({ price_per_person }).eq('id', id)
    setCosts(prev => prev.map(c => c.id === id ? { ...c, price_per_person } : c))
  }

  async function addCustomCost() {
    const lbl = customCostLabel.trim()
    if (!lbl) return
    setCustomCostLabel('')
    await addCost(lbl)
  }

  const totalPricePerPerson = costs.reduce((s, c) => s + (c.price_per_person ?? 0), 0)
  const totalCateringCosts  = totalPricePerPerson * effectiveGuestCount

  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>
        Catering & Menü
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
        Menükonzept, Service, Getränke und Kostenplanung
      </p>

      {/* ── 1. Menü & Essenskonzept ────────────────────────────────────────── */}
      <SectionWrap title="Menü & Essenskonzept">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Menü-Art</label>
            <select
              style={input}
              value={event.menu_type ?? 'Mehrgängiges Menü'}
              onChange={e => updateEvent('menu_type', e.target.value)}
            >
              {MENU_TYPES.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <Toggle
              checked={event.collect_allergies ?? true}
              onChange={v => updateEvent('collect_allergies', v)}
              label="Allergien erfassen"
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Essensoptionen (Gäste)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {mealOptions.map(opt => (
              <span key={opt} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'var(--accent-light)', border: '1px solid rgba(29,29,31,0.15)',
                borderRadius: 20, padding: '4px 10px', fontSize: 13, color: 'var(--accent)',
              }}>
                {opt}
                <button type="button" onClick={() => updateEvent('meal_options', mealOptions.filter(o => o !== opt))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--accent)' }}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...input, flex: 1 }} value={newMealOption}
              onChange={e => setNewMealOption(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMealOption()}
              placeholder="Neue Option…" />
            <button type="button" onClick={addMealOption}
              style={{ padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500 }}>
              <Plus size={14} /> Hinzufügen
            </button>
          </div>
        </div>

        {event.children_allowed && (
          <div>
            <label style={labelStyle}>Kindermenü-Optionen</label>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8, marginTop: -2 }}>
              Separate Auswahl für Kinder{event.children_note ? ` (${event.children_note})` : ''}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {plan.kinder_meal_options.map(opt => (
                <span key={opt} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'var(--bg-secondary, #F5F5F5)', border: '1px solid var(--border, #E5E5E5)',
                  borderRadius: 20, padding: '4px 10px', fontSize: 13, color: 'var(--text-primary, #2C2825)',
                }}>
                  {opt}
                  <button type="button" onClick={() => updatePlan({ kinder_meal_options: plan.kinder_meal_options.filter(o => o !== opt) })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-tertiary, #8C8076)' }}>
                    <X size={13} />
                  </button>
                </span>
              ))}
              {plan.kinder_meal_options.length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  Noch keine Kinderoptionen
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...input, flex: 1 }} value={newKinderOption}
                onChange={e => setNewKinderOption(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKinderOption()}
                placeholder="z.B. Kinderpasta, Schnitzel…" />
              <button type="button" onClick={addKinderOption}
                style={{ padding: '10px 14px', background: '#C2410C', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500 }}>
                <Plus size={14} /> Hinzufügen
              </button>
            </div>
          </div>
        )}
      </SectionWrap>

      {/* ── 2. Menüpositionen je Essensoption ────────────────────────────── */}
      {mealOptions.length > 0 && (() => {
        const isMultiCourse = event.menu_type === 'Mehrgängiges Menü'
        const posLabel = isMultiCourse ? 'Gang' : 'Position'
        const sectionTitle = isMultiCourse ? 'Menügänge je Essensoption' : 'Menüpositionen je Essensoption'
        const addPlaceholder = isMultiCourse ? 'Neuer Gang (z.B. Suppe, Käsegang…)' : 'Neue Position (z.B. Hauptgericht, Beilage…)'
        const cols = `160px repeat(${mealOptions.length}, 1fr) 32px`
        return (
          <SectionWrap title={sectionTitle}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, marginTop: -4 }}>
              Lege für jede Essensoption das konkrete Gericht fest. Mit „Von … übernehmen" kannst du eine Spalte kopieren und nur das Abweichende ändern.
            </p>

            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, marginBottom: 4, overflowX: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '0 2px' }}>
                {posLabel}
              </div>
              {mealOptions.map(opt => (
                <div key={opt} style={{ minWidth: 140 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{opt}</div>
                  {mealOptions.length > 1 && (
                    <select
                      value=""
                      onChange={e => { if (e.target.value) copyOptionFrom(opt, e.target.value) }}
                      style={{
                        width: '100%', fontSize: 11, padding: '3px 6px',
                        border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                        background: '#fff', color: 'var(--text-tertiary)', cursor: 'pointer',
                        fontFamily: 'inherit', outline: 'none',
                      }}
                    >
                      <option value="">Von … übernehmen</option>
                      {mealOptions.filter(o => o !== opt).map(o => (
                        <option key={o} value={o}>Von {o}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
              <div />
            </div>

            {/* Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {plan.menu_courses.map((course, i) => (
                <div key={course.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center' }}>
                  <input
                    style={{ ...input, fontSize: 13 }}
                    value={course.name}
                    onChange={e => updateCourseName(course.id, e.target.value)}
                    placeholder={`${posLabel} ${i + 1}`}
                  />
                  {mealOptions.map(opt => (
                    <input
                      key={opt}
                      style={{ ...input, fontSize: 13, minWidth: 140 }}
                      value={course.descriptions[opt] ?? ''}
                      onChange={e => updateCourseDescription(course.id, opt, e.target.value)}
                      placeholder="Gericht…"
                    />
                  ))}
                  <button type="button" onClick={() => removeCourse(course.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...input, flex: 1 }} value={newCourseName}
                onChange={e => setNewCourseName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCourse()}
                placeholder={addPlaceholder} />
              <button type="button" onClick={addCourse}
                style={{ padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
                <Plus size={14} /> {posLabel} hinzufügen
              </button>
            </div>
          </SectionWrap>
        )
      })()}

      {/* ── 3. Service & Ablauf ───────────────────────────────────────────── */}
      <SectionWrap title="Service & Ablauf">
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Servicestil</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {SERVICE_STYLES.map(o => {
              const active = plan.service_style === o.value
              return (
                <button key={o.value} type="button"
                  onClick={() => updatePlan({ service_style: active ? '' : o.value })}
                  style={{
                    padding: '7px 16px', borderRadius: 20, border: '1px solid',
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    background: active ? 'var(--accent-light)' : 'var(--surface)',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >{o.label}</button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
          <Toggle checked={plan.location_has_kitchen} onChange={v => updatePlan({ location_has_kitchen: v })} label="Küche an Location vorhanden" />
          <Toggle checked={plan.service_staff} onChange={v => updatePlan({ service_staff: v })} label="Servicepersonal benötigt" />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 6 }}>
          <Toggle checked={plan.sektempfang} onChange={v => updatePlan({ sektempfang: v })} label="Sektempfang / Aperitif" />
          {plan.sektempfang && (
            <input style={{ ...input, marginBottom: 12 }} value={plan.sektempfang_note}
              onChange={e => updatePlan({ sektempfang_note: e.target.value })}
              placeholder="z.B. Sekt, Orangensaft, Häppchen direkt nach der Trauung…" />
          )}
          <Toggle checked={plan.midnight_snack} onChange={v => updatePlan({ midnight_snack: v })} label="Mitternachtssnack" />
          {plan.midnight_snack && (
            <input style={{ ...input }} value={plan.midnight_snack_note}
              onChange={e => updatePlan({ midnight_snack_note: e.target.value })}
              placeholder="z.B. Currywurst, Käseplatte, Pizza…" />
          )}
        </div>
      </SectionWrap>

      {/* ── 4. Getränke ───────────────────────────────────────────────────── */}
      <SectionWrap title="Getränke">
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Abrechnung</label>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            {[{ value: 'pauschale', label: 'Getränkepauschale' }, { value: 'einzeln', label: 'Einzelabrechnung' }].map(o => {
              const active = plan.drinks_billing === o.value
              return (
                <button key={o.value} type="button"
                  onClick={() => updatePlan({ drinks_billing: o.value })}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid',
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    background: active ? 'var(--accent-light)' : 'var(--surface)',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >{o.label}</button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Sortiment</label>
          <ChipGroup options={DRINKS_OPTIONS} selected={plan.drinks_selection}
            onChange={v => updatePlan({ drinks_selection: v })} />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <Toggle checked={plan.champagne_finger_food} onChange={v => updatePlan({ champagne_finger_food: v })} label="Häppchen zum Sektempfang" />
          {plan.champagne_finger_food && (
            <input style={{ ...input, marginBottom: 12 }} value={plan.champagne_finger_food_note}
              onChange={e => updatePlan({ champagne_finger_food_note: e.target.value })}
              placeholder="Welche Häppchen? (optional)" />
          )}
          <Toggle checked={plan.weinbegleitung} onChange={v => updatePlan({ weinbegleitung: v })} label="Weinbegleitung zum Menü" />
          {plan.weinbegleitung && (
            <input style={{ ...input }} value={plan.weinbegleitung_note}
              onChange={e => updatePlan({ weinbegleitung_note: e.target.value })}
              placeholder="z.B. Weißwein zur Vorspeise, Rotwein zum Hauptgang…" />
          )}
        </div>
      </SectionWrap>

      {/* ── 5. Equipment & Ausstattung ────────────────────────────────────── */}
      <SectionWrap title="Equipment & Ausstattung">
        <label style={labelStyle}>Was muss der Caterer mitbringen?</label>
        <ChipGroup options={EQUIPMENT_OPTIONS} selected={plan.equipment_needed}
          onChange={v => updatePlan({ equipment_needed: v })} />
      </SectionWrap>

      {/* ── 6. Gästeplanung ───────────────────────────────────────────────── */}
      <SectionWrap title="Gästeplanung">
        <div style={{ background: '#F5F5F7', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ marginBottom: plan.plan_guest_count_enabled ? 12 : 0 }}>
            <Toggle
              checked={plan.plan_guest_count_enabled}
              onChange={v => updatePlan({ plan_guest_count_enabled: v })}
              label="Planzahl Gäste aktivieren"
            />
            {!plan.plan_guest_count_enabled && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, marginLeft: 50 }}>
                Aktuell: {confirmedGuestCount} bestätigte Zusagen
              </p>
            )}
          </div>
          {plan.plan_guest_count_enabled && (
            <div>
              <label style={labelStyle}>Geplante Gästezahl</label>
              <input type="number" min={0} style={input}
                value={plan.plan_guest_count || ''}
                onChange={e => updatePlan({ plan_guest_count: parseInt(e.target.value) || 0 })}
                placeholder="z.B. 120" />
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Notizen für den Caterer</label>
          <textarea style={{ ...input, minHeight: 90, resize: 'vertical' }}
            value={plan.catering_notes}
            onChange={e => updatePlan({ catering_notes: e.target.value })}
            placeholder="Besondere Wünsche, offene Fragen, Anmerkungen…" />
        </div>
      </SectionWrap>

      {/* ── 7. Gäste-Statistik ───────────────────────────────────────────── */}
      <SectionWrap title="Gäste-Statistik" defaultOpen={confirmedGuestCount > 0}>
        {confirmedGuestCount === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-tertiary)', fontSize: 14 }}>
            <Users size={16} style={{ opacity: 0.4 }} />
            Noch keine bestätigten Zusagen vorhanden.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <StatBadge label="Bestätigte Zusagen" value={confirmedGuestCount} sub="Personen" />
              {Object.entries(mealCounts).map(([key, n]) => (
                <StatBadge key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} value={n}
                  sub={`${Math.round((n / confirmedGuestCount) * 100)} %`} />
              ))}
            </div>

            {Object.keys(allergyCounts).length > 0 && (
              <div>
                <label style={labelStyle}>Allergien & Unverträglichkeiten</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {Object.entries(allergyCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([tag, n]) => (
                      <span key={tag} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.2)',
                        borderRadius: 20, padding: '4px 10px', fontSize: 12, color: '#DC2626',
                      }}>
                        <AlertTriangle size={11} />
                        {tag} · {n}×
                      </span>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </SectionWrap>

      {/* ── 8. Catering-Kosten ───────────────────────────────────────────── */}
      {!hideCosts && <SectionWrap title="Catering-Kosten">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, marginTop: -4 }}>
          Diese Kosten erscheinen auch in den Veranstalterkosten unter Allgemein.
        </p>

        {costs.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {costs.map(cost => {
              const pp   = cost.price_per_person ?? 0
              const total = pp * effectiveGuestCount
              return (
                <div key={cost.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', marginBottom: 8,
                  background: '#F5F5F7', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {cost.category}
                    </span>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input type="number" min={0} step="0.01"
                      value={costPrices[cost.id] ?? '0'}
                      onChange={e => setCostPrices(prev => ({ ...prev, [cost.id]: e.target.value }))}
                      onBlur={() => saveCostPrice(cost.id)}
                      style={{ ...input, width: 110, textAlign: 'right', background: '#fff' }} />
                    <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>€/P</span>
                  </div>
                  {effectiveGuestCount > 0 && (
                    <div style={{ minWidth: 90, textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        gesamt
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={() => removeCost(cost.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    <X size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Planzahl-Hinweis unter Kosten */}
        {costs.length > 0 && (
          <div style={{ background: '#F5F5F7', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Basis: {effectiveGuestCount} {plan.plan_guest_count_enabled ? 'Planzahl-Gäste' : 'bestätigte Zusagen'}
              {!plan.plan_guest_count_enabled && ' · Planzahl aktivierbar in "Budget & Kalkulation"'}
            </span>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
            Kategorie hinzufügen
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATERING_COST_CATEGORIES.map(cat => (
              <button key={cat} type="button" onClick={() => addCost(cat)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 20, padding: '5px 12px', fontSize: 13,
                  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget).style.borderColor = 'var(--accent)'; (e.currentTarget).style.color = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget).style.borderColor = 'var(--border)'; (e.currentTarget).style.color = 'var(--text-secondary)' }}
              >
                <Plus size={12} /> {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
            Eigener Kostenpunkt
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...input, flex: 1 }} value={customCostLabel}
              onChange={e => setCustomCostLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomCost()}
              placeholder="z.B. Brötchen-Frühstück, Weinprobe…" />
            <button type="button" onClick={addCustomCost}
              style={{ padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
              <Plus size={14} /> Hinzufügen
            </button>
          </div>
        </div>

        {costs.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>Summe pro Person</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {totalPricePerPerson.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} /P
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                Gesamt ({effectiveGuestCount} {plan.plan_guest_count_enabled ? 'Planzahl' : 'Zusagen'})
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {totalCateringCosts.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </span>
            </div>
          </div>
        )}

      </SectionWrap>}

      {/* ── Save bar ──────────────────────────────────────────────────────── */}
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
              onClick={() => { setPlan(parsePlan(initialPlan)); setEvent(initialEvent); setDirty(false) }}
              style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}
            >
              Abbrechen
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={14} />
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      {success && !dirty && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--green, #15803D)', color: '#fff',
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
