'use client'
import React, { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, X, ChevronDown, ChevronUp, ChevronRight, Users, TrendingUp,
  AlertTriangle, UtensilsCrossed, Baby,
  Utensils, HandPlatter, BookOpen, Sandwich, Flame, Trash2,
} from 'lucide-react'
import { titleCaseName, capitalizeFirst, allergyLabel } from '@/lib/text'

// ── Types ──────────────────────────────────────────────────────────────────

export interface EventData {
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
  menu_structure: MenuStructure
  plan_guest_count_enabled: boolean
  plan_guest_count: number
}

interface MenuCourse {
  id: string
  name: string
  descriptions: Record<string, string>
}

interface BuffetStation {
  id: string
  name: string
  items: string[]
}

interface CarteCourse {
  id: string
  name: string
  dishes: string[]
}

interface MenuStructure {
  buffet_stations: BuffetStation[]
  carte_courses: CarteCourse[]
  simple_items: string[]
}

export interface OrganizerCost {
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
  /** Im kombinierten "Catering & Getränke"-Reiter rendert die Hülle die Überschrift. */
  embedded?: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MEAL_OPTIONS = ['Fleisch', 'Fisch', 'Vegetarisch', 'Vegan']
const DEFAULT_COURSES: MenuCourse[] = [
  { id: '1', name: 'Vorspeise', descriptions: {} },
  { id: '2', name: 'Hauptgang', descriptions: {} },
  { id: '3', name: 'Dessert', descriptions: {} },
]
const MENU_TYPES = ['Mehrgängiges Menü', 'Buffet', 'À la carte', 'Fingerfood', 'BBQ']
const MENU_TYPE_CARDS: { value: string; icon: typeof Utensils }[] = [
  { value: 'Mehrgängiges Menü', icon: Utensils },
  { value: 'Buffet',            icon: HandPlatter },
  { value: 'À la carte',        icon: BookOpen },
  { value: 'Fingerfood',        icon: Sandwich },
  { value: 'BBQ',               icon: Flame },
]
const MEAL_LABELS: Record<string, string> = {
  fleisch: 'Fleisch', fisch: 'Fisch', vegetarisch: 'Vegetarisch', vegan: 'Vegan',
}
// Anzeige-Label für meal_options / meal_choice-Werte: Label-Map bevorzugt, sonst capitalizeFirst
const mealLabel = (v: string) => MEAL_LABELS[v.toLowerCase()] ?? capitalizeFirst(v)
const DEFAULT_CARTE_COURSES = ['Vorspeisen', 'Hauptgänge', 'Desserts']
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

function Toggle({ checked, onChange, label: lbl, noMargin = false }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; noMargin?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: noMargin ? 0 : 8 }}>
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

// Einheitliche Toggle-Zeile: Toggle + Label, darunter (eingerückt) das Notizfeld nur wenn aktiv.
function ToggleRow({ checked, onChange, label, children }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Toggle checked={checked} onChange={onChange} label={label} noMargin />
      {checked && children && (
        <div style={{ marginLeft: 28 }}>{children}</div>
      )}
    </div>
  )
}

function SummaryChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 999, padding: '4px 12px', fontSize: 12,
      color: 'var(--text-secondary)', whiteSpace: 'nowrap',
    }}>{children}</span>
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

function parseMenuStructure(raw: unknown): MenuStructure {
  const m = (raw ?? {}) as Record<string, unknown>
  return {
    buffet_stations: ((m.buffet_stations as any[]) ?? []).map((s: any) => ({
      id: s.id ?? crypto.randomUUID(),
      name: s.name ?? '',
      items: Array.isArray(s.items) ? s.items : [],
    })),
    carte_courses: ((m.carte_courses as any[]) ?? []).map((c: any) => ({
      id: c.id ?? crypto.randomUUID(),
      name: c.name ?? '',
      dishes: Array.isArray(c.dishes) ? c.dishes : [],
    })),
    simple_items: Array.isArray(m.simple_items) ? (m.simple_items as string[]) : [],
  }
}

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
    menu_structure:           parseMenuStructure(raw?.menu_structure),
    plan_guest_count_enabled: (raw?.plan_guest_count_enabled as boolean) ?? false,
    plan_guest_count:         (raw?.plan_guest_count as number) ?? 0,
  }
}

export default function CateringForm({
  eventId, initialEvent, initialPlan, initialCosts,
  confirmedGuestCount, mealCounts, allergyCounts, hideCosts = false, embedded = false,
}: Props) {
  const [event, setEvent] = useState(initialEvent)
  const [plan, setPlan] = useState<CateringPlan>(() => parsePlan(initialPlan))
  const [costs, setCosts] = useState<OrganizerCost[]>(initialCosts)
  const [costPrices, setCostPrices] = useState<Record<string, string>>(
    Object.fromEntries(initialCosts.map(c => [c.id, String(c.price_per_person ?? 0)]))
  )
  const [newMealOption, setNewMealOption] = useState('')
  const [newKinderOption, setNewKinderOption] = useState('')
  const [newCourseName, setNewCourseName] = useState('')
  const [stationItemDrafts, setStationItemDrafts] = useState<Record<string, string>>({})
  const [carteDishDrafts, setCarteDishDrafts] = useState<Record<string, string>>({})
  const [newSimpleItem, setNewSimpleItem] = useState('')
  const [customCostLabel, setCustomCostLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [showAllAllergies, setShowAllAllergies] = useState(false)

  const eventRef = useRef(event)
  eventRef.current = event
  const planRef = useRef(plan)
  planRef.current = plan
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const handleSaveRef = useRef<(() => Promise<void>) | undefined>(undefined)

  const mealOptions = event.meal_options ?? DEFAULT_MEAL_OPTIONS
  const effectiveGuestCount = plan.plan_guest_count_enabled
    ? plan.plan_guest_count
    : confirmedGuestCount

  const updateEvent = useCallback(<K extends keyof EventData>(key: K, value: EventData[K]) => {
    setEvent(e => ({ ...e, [key]: value }))
    setSuccess(false)
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => handleSaveRef.current?.(), 800)
  }, [])

  const updatePlan = useCallback((patch: Partial<CateringPlan>) => {
    setPlan(p => ({ ...p, ...patch }))
    setSuccess(false)
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => handleSaveRef.current?.(), 800)
  }, [])

  async function handleSave() {
    const ev = eventRef.current
    const pl = planRef.current
    setSaving(true)
    const supabase = createClient()

    const [evErr, planErr] = await Promise.all([
      supabase.from('events').update({
        meal_options: ev.meal_options,
        menu_type: ev.menu_type,
        collect_allergies: ev.collect_allergies,
      }).eq('id', eventId).then(r => r.error),

      supabase.from('catering_plans').upsert({
        event_id: eventId,
        service_style:              pl.service_style,
        location_has_kitchen:       pl.location_has_kitchen,
        midnight_snack:             pl.midnight_snack,
        midnight_snack_note:        pl.midnight_snack_note,
        drinks_billing:             pl.drinks_billing,
        drinks_selection:           pl.drinks_selection,
        champagne_finger_food:      pl.champagne_finger_food,
        champagne_finger_food_note: pl.champagne_finger_food_note,
        service_staff:              pl.service_staff,
        equipment_needed:           pl.equipment_needed,
        budget_per_person:          pl.budget_per_person,
        budget_includes_drinks:     pl.budget_includes_drinks,
        catering_notes:             pl.catering_notes,
        sektempfang:                pl.sektempfang,
        sektempfang_note:           pl.sektempfang_note,
        weinbegleitung:             pl.weinbegleitung,
        weinbegleitung_note:        pl.weinbegleitung_note,
        kinder_meal_options:        pl.kinder_meal_options,
        menu_courses:               pl.menu_courses,
        menu_structure:             pl.menu_structure,
        plan_guest_count_enabled:   pl.plan_guest_count_enabled,
        plan_guest_count:           pl.plan_guest_count,
      }, { onConflict: 'event_id' }).then(r => r.error),
    ])

    setSaving(false)
    if (!evErr && !planErr) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    }
  }
  handleSaveRef.current = handleSave

  // ── Meal options ──────────────────────────────────────────────────────────

  function addMealOption() {
    const val = titleCaseName(newMealOption)
    if (!val) return
    updateEvent('meal_options', [...mealOptions, val])
    setNewMealOption('')
  }

  function addKinderOption() {
    const val = titleCaseName(newKinderOption)
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

  // ── Menu structure (Buffet / À la carte / Fingerfood / BBQ) ────────────────

  function patchStructure(patch: Partial<MenuStructure>) {
    updatePlan({ menu_structure: { ...plan.menu_structure, ...patch } })
  }

  // Buffet stations
  function addStation() {
    patchStructure({
      buffet_stations: [
        ...plan.menu_structure.buffet_stations,
        { id: crypto.randomUUID(), name: '', items: [] },
      ],
    })
  }
  function updateStationName(id: string, name: string) {
    patchStructure({
      buffet_stations: plan.menu_structure.buffet_stations.map(s => s.id === id ? { ...s, name } : s),
    })
  }
  function removeStation(id: string) {
    patchStructure({ buffet_stations: plan.menu_structure.buffet_stations.filter(s => s.id !== id) })
  }
  function addStationItem(id: string) {
    const val = capitalizeFirst((stationItemDrafts[id] ?? '').trim())
    if (!val) return
    patchStructure({
      buffet_stations: plan.menu_structure.buffet_stations.map(s =>
        s.id === id ? { ...s, items: [...s.items, val] } : s),
    })
    setStationItemDrafts(d => ({ ...d, [id]: '' }))
  }
  function removeStationItem(id: string, idx: number) {
    patchStructure({
      buffet_stations: plan.menu_structure.buffet_stations.map(s =>
        s.id === id ? { ...s, items: s.items.filter((_, i) => i !== idx) } : s),
    })
  }

  // À la carte courses
  function startDefaultCarte() {
    patchStructure({
      carte_courses: DEFAULT_CARTE_COURSES.map(name => ({ id: crypto.randomUUID(), name, dishes: [] })),
    })
  }
  function addCarteCourse() {
    patchStructure({
      carte_courses: [
        ...plan.menu_structure.carte_courses,
        { id: crypto.randomUUID(), name: '', dishes: [] },
      ],
    })
  }
  function updateCarteName(id: string, name: string) {
    patchStructure({
      carte_courses: plan.menu_structure.carte_courses.map(c => c.id === id ? { ...c, name } : c),
    })
  }
  function removeCarteCourse(id: string) {
    patchStructure({ carte_courses: plan.menu_structure.carte_courses.filter(c => c.id !== id) })
  }
  function addCarteDish(id: string) {
    const val = capitalizeFirst((carteDishDrafts[id] ?? '').trim())
    if (!val) return
    patchStructure({
      carte_courses: plan.menu_structure.carte_courses.map(c =>
        c.id === id ? { ...c, dishes: [...c.dishes, val] } : c),
    })
    setCarteDishDrafts(d => ({ ...d, [id]: '' }))
  }
  function removeCarteDish(id: string, idx: number) {
    patchStructure({
      carte_courses: plan.menu_structure.carte_courses.map(c =>
        c.id === id ? { ...c, dishes: c.dishes.filter((_, i) => i !== idx) } : c),
    })
  }

  // Simple items (Fingerfood / BBQ)
  function addSimpleItem() {
    const val = capitalizeFirst(newSimpleItem.trim())
    if (!val) return
    patchStructure({ simple_items: [...plan.menu_structure.simple_items, val] })
    setNewSimpleItem('')
  }
  function removeSimpleItem(idx: number) {
    patchStructure({ simple_items: plan.menu_structure.simple_items.filter((_, i) => i !== idx) })
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
      {!embedded && (
        <>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>
            Catering & Menü
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
            Menükonzept, Service, Getränke und Kostenplanung
          </p>
        </>
      )}

      {/* ── Zusammenfassung ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
        {event.menu_type && <SummaryChip>Menüart: {event.menu_type}</SummaryChip>}
        {event.menu_type === 'Buffet' && plan.menu_structure.buffet_stations.length > 0 && (
          <SummaryChip>{plan.menu_structure.buffet_stations.length} Station{plan.menu_structure.buffet_stations.length === 1 ? '' : 'en'}</SummaryChip>
        )}
        {event.menu_type === 'À la carte' && plan.menu_structure.carte_courses.length > 0 && (
          <SummaryChip>
            {plan.menu_structure.carte_courses.length} Gang{plan.menu_structure.carte_courses.length === 1 ? '' : 'änge'}
            {' · '}
            {plan.menu_structure.carte_courses.reduce((s, c) => s + c.dishes.length, 0)} Gericht{plan.menu_structure.carte_courses.reduce((s, c) => s + c.dishes.length, 0) === 1 ? '' : 'e'}
          </SummaryChip>
        )}
        {(event.menu_type === 'Fingerfood' || event.menu_type === 'BBQ') && plan.menu_structure.simple_items.length > 0 && (
          <SummaryChip>{plan.menu_structure.simple_items.length} Speise{plan.menu_structure.simple_items.length === 1 ? '' : 'n'}</SummaryChip>
        )}
        <SummaryChip>{mealOptions.length} Essensoption{mealOptions.length === 1 ? '' : 'en'}</SummaryChip>
        <SummaryChip>{confirmedGuestCount} Gäste zugesagt</SummaryChip>
        {Object.keys(allergyCounts).length > 0 && (
          <SummaryChip>{Object.keys(allergyCounts).length} Allergie{Object.keys(allergyCounts).length === 1 ? '' : 'n'}</SummaryChip>
        )}
      </div>

      {/* ── 1. Menü & Essenskonzept ────────────────────────────────────────── */}
      <SectionWrap title="Menü & Essenskonzept">
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Menü-Art</label>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 10, marginTop: 6,
          }}>
            {MENU_TYPE_CARDS.map(({ value, icon: Icon }) => {
              const active = (event.menu_type ?? 'Mehrgängiges Menü') === value
              return (
                <button key={value} type="button"
                  onClick={() => updateEvent('menu_type', value)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    padding: '16px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid',
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    background: active ? 'var(--accent-light)' : 'var(--surface)',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  <Icon size={22} />
                  <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>{value}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Toggle
            checked={event.collect_allergies ?? true}
            onChange={v => updateEvent('collect_allergies', v)}
            label="Allergien erfassen"
          />
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
                {mealLabel(opt)}
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
          {event.menu_type && event.menu_type !== 'Mehrgängiges Menü' && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, marginBottom: 0 }}>
              Optional — wird Gästen bei der Rückmeldung zur Auswahl angezeigt. Leer lassen, wenn keine Vorauswahl nötig ist.
            </p>
          )}
        </div>

        {event.children_allowed && (
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: 16,
          }}>
            <label style={{ ...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Baby size={13} /> Kindermenü-Optionen
            </label>
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
                  {mealLabel(opt)}
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
                style={{ padding: '10px 14px', background: '#fff', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500 }}>
                <Plus size={14} /> Hinzufügen
              </button>
            </div>
          </div>
        )}
      </SectionWrap>

      {/* ── 2. Menüpositionen je Essensoption (nur Mehrgängiges Menü) ─────── */}
      {mealOptions.length > 0 && event.menu_type === 'Mehrgängiges Menü' && (() => {
        const isMultiCourse = event.menu_type === 'Mehrgängiges Menü'
        const posLabel = isMultiCourse ? 'Gang' : 'Position'
        const sectionTitle = isMultiCourse ? 'Menügänge je Essensoption' : 'Menüpositionen je Essensoption'
        const addPlaceholder = isMultiCourse ? 'Neuer Gang (z.B. Suppe, Käsegang…)' : 'Neue Position (z.B. Hauptgericht, Beilage…)'
        return (
          <SectionWrap title={sectionTitle}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, marginTop: -4 }}>
              Lege für jede Essensoption das konkrete Gericht fest. Mit &quot;Übernehmen von…&quot; kannst du eine andere Option kopieren und nur das Abweichende ändern.
            </p>

            {/* Globale Gang-/Positions-Verwaltung (eine Zeile pro Gang über alle Karten) */}
            {plan.menu_courses.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {plan.menu_courses.map((course, i) => (
                  <span key={course.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', padding: '5px 8px 5px 10px',
                  }}>
                    <input
                      style={{
                        border: 'none', outline: 'none', background: 'transparent',
                        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                        fontFamily: 'inherit', width: `${Math.max(8, (course.name.length || (`${posLabel} ${i + 1}`).length)) + 1}ch`,
                      }}
                      value={course.name}
                      onChange={e => updateCourseName(course.id, e.target.value)}
                      placeholder={`${posLabel} ${i + 1}`}
                    />
                    <button type="button" onClick={() => removeCourse(course.id)}
                      title={`${posLabel} entfernen`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-tertiary)' }}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Eine Karte pro Essensoption */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 14, marginBottom: 16,
            }}>
              {mealOptions.map(opt => (
                <div key={opt} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{mealLabel(opt)}</span>
                    {mealOptions.length > 1 && (
                      <select
                        value=""
                        onChange={e => { if (e.target.value) copyOptionFrom(opt, e.target.value) }}
                        style={{
                          fontSize: 11, padding: '3px 6px',
                          border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                          background: '#fff', color: 'var(--text-tertiary)', cursor: 'pointer',
                          fontFamily: 'inherit', outline: 'none', maxWidth: 160,
                        }}
                      >
                        <option value="">Übernehmen von…</option>
                        {mealOptions.filter(o => o !== opt).map(o => (
                          <option key={o} value={o}>Von {mealLabel(o)}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {plan.menu_courses.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', margin: 0 }}>
                      Noch keine {isMultiCourse ? 'Gänge' : 'Positionen'} angelegt.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {plan.menu_courses.map((course, i) => (
                        <div key={course.id}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                            {course.name || `${posLabel} ${i + 1}`}
                          </div>
                          <input
                            style={{ ...input, fontSize: 13 }}
                            value={course.descriptions[opt] ?? ''}
                            onChange={e => updateCourseDescription(course.id, opt, e.target.value)}
                            placeholder="Gericht…"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add row (global — fügt einen Gang in allen Karten hinzu) */}
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

      {/* ── 2b. Buffet-Stationen ──────────────────────────────────────────── */}
      {event.menu_type === 'Buffet' && (
        <SectionWrap title="Buffet-Stationen">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, marginTop: -4 }}>
            Lege die Stationen deines Buffets fest (z.B. Vorspeisenbuffet, Grillstation, Dessertbuffet) und ordne ihnen die Speisen zu.
          </p>
          {plan.menu_structure.buffet_stations.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 16 }}>
              Noch keine Stationen angelegt.
            </p>
          )}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 14, marginBottom: 16,
          }}>
            {plan.menu_structure.buffet_stations.map((station, i) => (
              <div key={station.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <input
                    style={{ ...input, fontWeight: 700, fontSize: 14 }}
                    value={station.name}
                    onChange={e => updateStationName(station.id, e.target.value)}
                    placeholder={`Station ${i + 1} (z.B. Grillstation)`}
                  />
                  <button type="button" onClick={() => removeStation(station.id)} title="Station entfernen"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {station.items.length === 0 && (
                    <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Noch keine Speisen</span>
                  )}
                  {station.items.map((dish, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-primary)',
                    }}>
                      <span>{dish}</span>
                      <button type="button" onClick={() => removeStationItem(station.id, idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...input, flex: 1, fontSize: 13 }}
                    value={stationItemDrafts[station.id] ?? ''}
                    onChange={e => setStationItemDrafts(d => ({ ...d, [station.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addStationItem(station.id)}
                    placeholder="Speise hinzufügen…" />
                  <button type="button" onClick={() => addStationItem(station.id)}
                    style={{ padding: '10px 12px', background: '#fff', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addStation}
            style={{ padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
            <Plus size={14} /> Station hinzufügen
          </button>
        </SectionWrap>
      )}

      {/* ── 2c. Speisekarte (À la carte) ──────────────────────────────────── */}
      {event.menu_type === 'À la carte' && (
        <SectionWrap title="Speisekarte">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, marginTop: -4 }}>
            Gliedere deine Speisekarte in Gänge (z.B. Vorspeisen, Hauptgänge, Desserts) und füge die jeweiligen Gerichte hinzu.
          </p>
          {plan.menu_structure.carte_courses.length === 0 ? (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 12 }}>
                Noch keine Gänge angelegt.
              </p>
              <button type="button" onClick={startDefaultCarte}
                style={{ padding: '10px 14px', background: 'var(--surface)', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
                <Plus size={14} /> Mit Standard-Gängen starten
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 14, marginBottom: 16,
            }}>
              {plan.menu_structure.carte_courses.map((course, i) => (
                <div key={course.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <input
                      style={{ ...input, fontWeight: 700, fontSize: 14 }}
                      value={course.name}
                      onChange={e => updateCarteName(course.id, e.target.value)}
                      placeholder={`Gang ${i + 1} (z.B. Vorspeisen)`}
                    />
                    <button type="button" onClick={() => removeCarteCourse(course.id)} title="Gang entfernen"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {course.dishes.length === 0 && (
                      <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Noch keine Gerichte</span>
                    )}
                    {course.dishes.map((dish, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-primary)',
                      }}>
                        <span>{dish}</span>
                        <button type="button" onClick={() => removeCarteDish(course.id, idx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...input, flex: 1, fontSize: 13 }}
                      value={carteDishDrafts[course.id] ?? ''}
                      onChange={e => setCarteDishDrafts(d => ({ ...d, [course.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addCarteDish(course.id)}
                      placeholder="Gericht hinzufügen…" />
                    <button type="button" onClick={() => addCarteDish(course.id)}
                      style={{ padding: '10px 12px', background: '#fff', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {plan.menu_structure.carte_courses.length > 0 && (
            <button type="button" onClick={addCarteCourse}
              style={{ padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
              <Plus size={14} /> Gang hinzufügen
            </button>
          )}
        </SectionWrap>
      )}

      {/* ── 2d. Speisenliste (Fingerfood / BBQ) ───────────────────────────── */}
      {(event.menu_type === 'Fingerfood' || event.menu_type === 'BBQ') && (
        <SectionWrap title={event.menu_type === 'BBQ' ? 'BBQ-Speisen' : 'Fingerfood-Speisen'}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, marginTop: -4 }}>
            Liste die geplanten Speisen auf.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {plan.menu_structure.simple_items.length === 0 && (
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Noch keine Speisen</span>
            )}
            {plan.menu_structure.simple_items.map((dish, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-primary)',
              }}>
                <span>{dish}</span>
                <button type="button" onClick={() => removeSimpleItem(idx)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...input, flex: 1 }}
              value={newSimpleItem}
              onChange={e => setNewSimpleItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSimpleItem()}
              placeholder={event.menu_type === 'BBQ' ? 'z.B. Spareribs, Grillgemüse…' : 'z.B. Mini-Quiches, Wraps…'} />
            <button type="button" onClick={addSimpleItem}
              style={{ padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
              <Plus size={14} /> Hinzufügen
            </button>
          </div>
        </SectionWrap>
      )}

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow checked={plan.location_has_kitchen} onChange={v => updatePlan({ location_has_kitchen: v })} label="Küche an Location vorhanden" />
          <ToggleRow checked={plan.service_staff} onChange={v => updatePlan({ service_staff: v })} label="Servicepersonal benötigt" />

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ToggleRow checked={plan.sektempfang} onChange={v => updatePlan({ sektempfang: v })} label="Sektempfang / Aperitif">
              <input style={input} value={plan.sektempfang_note}
                onChange={e => updatePlan({ sektempfang_note: e.target.value })}
                placeholder="z.B. Sekt, Orangensaft, Häppchen direkt nach der Trauung…" />
            </ToggleRow>
            <ToggleRow checked={plan.midnight_snack} onChange={v => updatePlan({ midnight_snack: v })} label="Mitternachtssnack">
              <input style={input} value={plan.midnight_snack_note}
                onChange={e => updatePlan({ midnight_snack_note: e.target.value })}
                placeholder="z.B. Currywurst, Käseplatte, Pizza…" />
            </ToggleRow>
          </div>
        </div>
      </SectionWrap>

      {/* ── 4. Sektempfang & Weinbegleitung ───────────────────────────────── */}
      <SectionWrap title="Sektempfang & Weinbegleitung">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow checked={plan.champagne_finger_food} onChange={v => updatePlan({ champagne_finger_food: v })} label="Häppchen zum Sektempfang">
            <input style={input} value={plan.champagne_finger_food_note}
              onChange={e => updatePlan({ champagne_finger_food_note: e.target.value })}
              placeholder="Welche Häppchen? (optional)" />
          </ToggleRow>
          <ToggleRow checked={plan.weinbegleitung} onChange={v => updatePlan({ weinbegleitung: v })} label="Weinbegleitung zum Menü">
            <input style={input} value={plan.weinbegleitung_note}
              onChange={e => updatePlan({ weinbegleitung_note: e.target.value })}
              placeholder="z.B. Weißwein zur Vorspeise, Rotwein zum Hauptgang…" />
          </ToggleRow>
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

      {/* ── 7. Gäste-Statistik (Accordion) ───────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeadStyle} onClick={() => setStatsOpen(o => !o)}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15 }}>
            {statsOpen
              ? <ChevronDown size={16} color="var(--text-tertiary)" />
              : <ChevronRight size={16} color="var(--text-tertiary)" />}
            Gäste-Statistik
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            {confirmedGuestCount} zugesagt
          </span>
        </div>
        {statsOpen && (
          <div style={sectionBodyStyle}>
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
                    <StatBadge key={key} label={mealLabel(key)} value={n}
                      sub={`${Math.round((n / confirmedGuestCount) * 100)} %`} />
                  ))}
                </div>

                {Object.keys(allergyCounts).length > 0 && (() => {
                  const sorted = Object.entries(allergyCounts).sort((a, b) => b[1] - a[1])
                  const visible = showAllAllergies ? sorted : sorted.slice(0, 6)
                  const hidden = sorted.length - visible.length
                  return (
                    <div>
                      <label style={labelStyle}>Allergien & Unverträglichkeiten</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        {visible.map(([tag, n]) => (
                          <span key={tag} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.2)',
                            borderRadius: 20, padding: '4px 10px', fontSize: 12, color: '#DC2626',
                          }}>
                            <AlertTriangle size={11} />
                            {allergyLabel(tag)} · {n}×
                          </span>
                        ))}
                        {hidden > 0 && (
                          <button type="button" onClick={() => setShowAllAllergies(true)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                            +{hidden} weitere
                          </button>
                        )}
                        {showAllAllergies && sorted.length > 6 && (
                          <button type="button" onClick={() => setShowAllAllergies(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                            weniger anzeigen
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}
      </div>

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
