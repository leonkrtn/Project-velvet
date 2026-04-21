'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Settings, Trash2, Plus, Pencil, X, ChevronDown, ChevronUp } from 'lucide-react'

interface PresetVendor { id: string; name: string | null; category: string | null; description: string | null; price_estimate: number; contact_email: string | null; contact_phone: string | null }
interface PresetHotel  { id: string; name: string | null; address: string | null; distance_km: number; price_per_night: number; total_rooms: number; description: string | null }
interface PresetDeko   { id: string; title: string | null; description: string | null; image_url: string | null }

const ROLE_OPTIONS = [
  { value: 'service',   label: 'Service' },
  { value: 'kueche',    label: 'Küche' },
  { value: 'bar',       label: 'Bar' },
  { value: 'technik',   label: 'Technik' },
  { value: 'deko',      label: 'Deko' },
  { value: 'security',  label: 'Security' },
  { value: 'fahrer',    label: 'Fahrer' },
  { value: 'runner',    label: 'Runner' },
  { value: 'spueler',   label: 'Spüler' },
  { value: 'empfang',   label: 'Empfang' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

const ROLE_COLORS: Record<string, string> = {
  service: '#2563EB', kueche: '#DC2626', bar: '#D97706', technik: '#7C3AED',
  deko: '#DB2777', security: '#4B5563', fahrer: '#A16207', runner: '#0891B2',
  spueler: '#059669', empfang: '#9333EA', sonstiges: '#6B7280',
}

const WEEKDAYS_LIST = [
  { key: 'mo', label: 'Mo' }, { key: 'di', label: 'Di' }, { key: 'mi', label: 'Mi' },
  { key: 'do', label: 'Do' }, { key: 'fr', label: 'Fr' }, { key: 'sa', label: 'Sa' },
  { key: 'so', label: 'So' },
]

type StaffMember = {
  id: string
  organizer_id: string
  name: string
  email: string | null
  phone: string | null
  role_category: string | null
  available_days: string[]
  responsibilities: string | null
  notes: string | null
}

const EMPTY_STAFF: Omit<StaffMember, 'id' | 'organizer_id'> = {
  name: '', email: '', phone: '', role_category: '', available_days: [], responsibilities: '', notes: '',
}

type EventSummary = {
  id: string
  title: string
  couple_name: string | null
  date: string | null
  venue: string | null
}

function displayEventName(ev: { couple_name?: string | null; title?: string | null } | null | undefined): string {
  if (!ev) return 'Unbenanntes Event'
  const cn = (ev.couple_name ?? '').trim()
  if (cn) return cn
  const t = (ev.title ?? '').trim()
  if (t) return t
  return 'Unbenanntes Event'
}

type WizardData = {
  title: string
  date: string
  ceremonyStart: string
  venue: string
  venueAddress: string
  dresscode: string
  childrenAllowed: boolean
  childrenNote: string
  maxBegleitpersonen: number
  mealOptions: string[]
}

const DEFAULT_WIZARD: WizardData = {
  title: '', date: '', ceremonyStart: '', venue: '',
  venueAddress: '', dresscode: '',
  childrenAllowed: true, childrenNote: '',
  maxBegleitpersonen: 2,
  mealOptions: ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
}

const ALL_MEALS = ['fleisch', 'fisch', 'vegetarisch', 'vegan']

function fmtDate(iso: string | null): string {
  if (!iso) return 'Kein Datum'
  try { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return iso }
}

export default function VeranstalterEventsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardData, setWizardData] = useState<WizardData>(DEFAULT_WIZARD)
  const [wizardError, setWizardError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [presetBase, setPresetBase] = useState<Partial<WizardData>>({})
  const [presetSuggestions, setPresetSuggestions] = useState<{ vendors: PresetVendor[]; hotels: PresetHotel[]; deko: PresetDeko[] }>({ vendors: [], hotels: [], deko: [] })
  const [applyVorschlaege, setApplyVorschlaege] = useState(false)

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Staff management
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [staffOpen, setStaffOpen] = useState(false)
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [staffForm, setStaffForm] = useState<Omit<StaffMember, 'id' | 'organizer_id'>>(EMPTY_STAFF)
  const [staffSubmitting, setStaffSubmitting] = useState(false)
  const [staffError, setStaffError] = useState('')
  const [deleteStaffId, setDeleteStaffId] = useState<string | null>(null)
  const [deletingStaff, setDeletingStaff] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', fontSize: 14,
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    background: '#fff', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: 'var(--text)',
  }

  useEffect(() => {
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      const [{ data: evRows, error: evErr }, { data: presetRow }, { data: staffRows }] = await Promise.all([
        supabase
          .from('event_members')
          .select('event_id, events(id, title, couple_name, date, venue)')
          .eq('user_id', user.id)
          .eq('role', 'veranstalter'),
        supabase
          .from('organizer_presets')
          .select('*')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('organizer_staff')
          .select('*')
          .eq('organizer_id', user.id)
          .order('created_at', { ascending: true }),
      ])

      if (evErr) throw evErr

      type RawRow = {
        event_id: string
        events: { id: string; title: string; couple_name: string | null; date: string | null; venue: string | null } | null
      }
      const list: EventSummary[] = ((evRows ?? []) as unknown as RawRow[]).map(row => ({
        id: row.events?.id ?? row.event_id,
        title: row.events?.title ?? '—',
        couple_name: row.events?.couple_name ?? null,
        date: row.events?.date ?? null,
        venue: row.events?.venue ?? null,
      }))
      setEvents(list)
      setStaff((staffRows ?? []) as StaffMember[])

      if (presetRow) {
        const street = presetRow.location_street ?? ''
        const zip    = presetRow.location_zip    ?? ''
        const city   = presetRow.location_city   ?? ''
        const builtAddress = [street, `${zip} ${city}`.trim()].filter(Boolean).join(', ')
        setPresetBase({
          venue:               presetRow.venue               ?? '',
          venueAddress:        builtAddress,
          dresscode:           presetRow.dresscode           ?? '',
          childrenAllowed:     presetRow.children_allowed    ?? true,
          childrenNote:        presetRow.children_note       ?? '',
          maxBegleitpersonen:  presetRow.max_begleitpersonen ?? 2,
          mealOptions:         presetRow.meal_options        ?? ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
        })
        const vendors: PresetVendor[] = presetRow.preset_vendors ?? []
        const hotels:  PresetHotel[]  = presetRow.preset_hotels  ?? []
        const deko:    PresetDeko[]   = presetRow.preset_deko    ?? []
        setPresetSuggestions({ vendors, hotels, deko })
        setApplyVorschlaege(vendors.length > 0 || hotels.length > 0 || deko.length > 0)
      }
    } catch (err) {
      console.error('[VeranstalterEvents] load failed:', err)
    } finally {
      setLoading(false)
    }
  }

  function openWizard() {
    setWizardData({ ...DEFAULT_WIZARD, ...presetBase })
    setWizardStep(1)
    setWizardError('')
    setShowWizard(true)
  }

  function closeWizard() {
    setShowWizard(false)
    setWizardError('')
  }

  function updateWizard(patch: Partial<WizardData>) {
    setWizardData(prev => ({ ...prev, ...patch }))
  }

  function validateStep(): string | null {
    if (wizardStep === 1) {
      if (!wizardData.title.trim()) return 'Eventname ist erforderlich.'
      if (!wizardData.date) return 'Datum ist erforderlich.'
    }
    if (wizardStep === 3) {
      if (wizardData.mealOptions.length === 0) return 'Mindestens eine Menüoption muss ausgewählt sein.'
    }
    return null
  }

  function handleNext() {
    const err = validateStep()
    if (err) { setWizardError(err); return }
    setWizardError('')
    setWizardStep(s => s + 1)
  }

  function handleBack() {
    setWizardError('')
    setWizardStep(s => s - 1)
  }

  async function handleSubmit() {
    const err = validateStep()
    if (err) { setWizardError(err); return }
    setSubmitting(true); setWizardError('')
    try {
      const { data, error } = await supabase.rpc('create_event_with_organizer', {
        p_title:               wizardData.title.trim(),
        p_date:                wizardData.date,
        p_venue:               wizardData.venue.trim() || null,
        p_venue_address:       wizardData.venueAddress.trim() || null,
        p_dresscode:           wizardData.dresscode.trim() || null,
        p_children_allowed:    wizardData.childrenAllowed,
        p_children_note:       wizardData.childrenNote.trim() || null,
        p_meal_options:        wizardData.mealOptions,
        p_max_begleitpersonen: wizardData.maxBegleitpersonen,
        p_ceremony_start:      wizardData.ceremonyStart
          ? `${wizardData.date}T${wizardData.ceremonyStart}:00`
          : null,
      })
      if (error) throw error
      const newId = data as string

      if (applyVorschlaege) {
        if (presetSuggestions.vendors.length)
          await supabase.from('organizer_vendor_suggestions').insert(
            presetSuggestions.vendors.map(v => ({ event_id: newId, name: v.name, category: v.category, description: v.description, price_estimate: v.price_estimate, contact_email: v.contact_email, contact_phone: v.contact_phone }))
          )
        if (presetSuggestions.hotels.length)
          await supabase.from('organizer_hotel_suggestions').insert(
            presetSuggestions.hotels.map(h => ({ event_id: newId, name: h.name, address: h.address, distance_km: h.distance_km, price_per_night: h.price_per_night, total_rooms: h.total_rooms, description: h.description }))
          )
        if (presetSuggestions.deko.length)
          await supabase.from('deko_suggestions').insert(
            presetSuggestions.deko.map(d => ({ event_id: newId, title: d.title, description: d.description, image_url: d.image_url }))
          )
      }

      const newEvent: EventSummary = {
        id: newId, title: wizardData.title.trim(),
        couple_name: wizardData.title.trim(),
        date: wizardData.date, venue: wizardData.venue.trim() || null,
      }
      setEvents(prev => [newEvent, ...prev])
      closeWizard()
      router.push(`/veranstalter/dashboard?event=${newId}`)
    } catch (err: unknown) {
      setWizardError(err instanceof Error ? err.message : 'Event konnte nicht erstellt werden.')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleMeal(meal: string) {
    setWizardData(prev => ({
      ...prev,
      mealOptions: prev.mealOptions.includes(meal)
        ? prev.mealOptions.filter(m => m !== meal)
        : [...prev.mealOptions, meal],
    }))
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return
    setDeleting(true)
    try {
      await supabase.from('events').delete().eq('id', deleteConfirmId)
      setEvents(prev => prev.filter(e => e.id !== deleteConfirmId))
    } catch (err) {
      console.error('[VeranstalterEvents] delete failed:', err)
    } finally {
      setDeleting(false)
      setDeleteConfirmId(null)
    }
  }

  const eventToDelete = events.find(e => e.id === deleteConfirmId)
  const staffToDelete = staff.find(s => s.id === deleteStaffId)

  function openAddStaff() {
    setEditingStaff(null)
    setStaffForm(EMPTY_STAFF)
    setStaffError('')
    setShowStaffModal(true)
  }

  function openEditStaff(member: StaffMember) {
    setEditingStaff(member)
    setStaffForm({
      name: member.name,
      email: member.email ?? '',
      phone: member.phone ?? '',
      role_category: member.role_category ?? '',
      available_days: member.available_days ?? [],
      responsibilities: member.responsibilities ?? '',
      notes: member.notes ?? '',
    })
    setStaffError('')
    setShowStaffModal(true)
  }

  function closeStaffModal() {
    setShowStaffModal(false)
    setStaffError('')
  }

  async function saveStaff() {
    if (!staffForm.name.trim()) { setStaffError('Name ist erforderlich.'); return }
    if (!currentUserId) return
    setStaffSubmitting(true); setStaffError('')
    try {
      const payload = {
        name: staffForm.name.trim(),
        email: staffForm.email?.trim() || null,
        phone: staffForm.phone?.trim() || null,
        role_category: staffForm.role_category?.trim() || null,
        available_days: staffForm.available_days ?? [],
        responsibilities: staffForm.responsibilities?.trim() || null,
        notes: staffForm.notes?.trim() || null,
      }
      if (editingStaff) {
        const { data, error } = await supabase
          .from('organizer_staff')
          .update(payload)
          .eq('id', editingStaff.id)
          .select()
          .single()
        if (error) throw error
        setStaff(prev => prev.map(s => s.id === editingStaff.id ? (data as StaffMember) : s))
      } else {
        const { data, error } = await supabase
          .from('organizer_staff')
          .insert({ ...payload, organizer_id: currentUserId })
          .select()
          .single()
        if (error) throw error
        setStaff(prev => [...prev, data as StaffMember])
      }
      closeStaffModal()
    } catch (err: unknown) {
      setStaffError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
    } finally {
      setStaffSubmitting(false)
    }
  }

  async function confirmDeleteStaff() {
    if (!deleteStaffId) return
    setDeletingStaff(true)
    try {
      await supabase.from('organizer_staff').delete().eq('id', deleteStaffId)
      setStaff(prev => prev.filter(s => s.id !== deleteStaffId))
    } catch (err) {
      console.error('[VeranstalterEvents] staff delete failed:', err)
    } finally {
      setDeletingStaff(false)
      setDeleteStaffId(null)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 16px 64px' }}>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24,
          }}
          onClick={() => !deleting && setDeleteConfirmId(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 'var(--radius)', padding: '28px 28px 24px',
              maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Event löschen?</p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                <strong>{displayEventName(eventToDelete)}</strong> und alle zugehörigen Daten werden unwiderruflich gelöscht.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                style={{
                  padding: '10px 18px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text-tertiary)',
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  padding: '10px 18px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: '#D94848', color: '#fff',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Wird gelöscht …' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>
            Meine Events
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
            Verwalte deine Hochzeits-Events oder erstelle ein neues.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => router.push('/veranstalter/voreinstellungen')}
            title="Voreinstellungen"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 38, height: 38,
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            <Settings size={16} />
          </button>
          {!showWizard && (
            <button
              onClick={openWizard}
              style={{
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 'var(--radius-sm)', padding: '10px 18px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              + Neues Event
            </button>
          )}
        </div>
      </div>

      {/* Wizard */}
      {showWizard && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)', padding: 28, marginBottom: 28,
        }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: s <= wizardStep ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 16 }}>
            Schritt {wizardStep} von 4
          </p>

          {/* Step 1 */}
          {wizardStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Event-Grunddaten</h2>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  Eventname <span style={{ color: 'var(--accent)' }}>*</span>
                </label>
                <input
                  required value={wizardData.title}
                  onChange={e => updateWizard({ title: e.target.value })}
                  placeholder="Hochzeit Max & Anna"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  Datum <span style={{ color: 'var(--accent)' }}>*</span>
                </label>
                <input
                  type="date" required value={wizardData.date}
                  onChange={e => updateWizard({ date: e.target.value })}
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Uhrzeit Zeremonie (optional)</label>
                <input
                  type="time" value={wizardData.ceremonyStart}
                  onChange={e => updateWizard({ ceremonyStart: e.target.value })}
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Location (optional)</label>
                <input
                  value={wizardData.venue}
                  onChange={e => updateWizard({ venue: e.target.value })}
                  placeholder="Schloss Lichtenberg"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
            </div>
          )}

          {/* Step 2 */}
          {wizardStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Details</h2>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Adresse (optional)</label>
                <input
                  value={wizardData.venueAddress}
                  onChange={e => updateWizard({ venueAddress: e.target.value })}
                  placeholder="Musterstraße 1, 12345 Musterstadt"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Dresscode (optional)</label>
                <input
                  value={wizardData.dresscode}
                  onChange={e => updateWizard({ dresscode: e.target.value })}
                  placeholder="Festlich, Cocktailkleid etc."
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 10 }}>Kinder willkommen?</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[true, false].map(val => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => updateWizard({ childrenAllowed: val })}
                      style={{
                        padding: '9px 18px', borderRadius: 'var(--radius-sm)',
                        border: `1.5px solid ${wizardData.childrenAllowed === val ? 'var(--accent)' : 'var(--border)'}`,
                        background: wizardData.childrenAllowed === val ? 'var(--accent-light)' : 'none',
                        color: wizardData.childrenAllowed === val ? 'var(--accent)' : 'var(--text-tertiary)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.15s',
                      }}
                    >
                      {val ? 'Ja' : 'Nein'}
                    </button>
                  ))}
                </div>
                {wizardData.childrenAllowed && (
                  <input
                    value={wizardData.childrenNote}
                    onChange={e => updateWizard({ childrenNote: e.target.value })}
                    placeholder="Hinweis zu Kindern (optional)"
                    style={{ ...inputStyle, marginTop: 10 }}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                  />
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>Max. Begleitpersonen pro Gast</label>
                <input
                  type="number" min={0} max={10}
                  value={wizardData.maxBegleitpersonen}
                  onChange={e => updateWizard({ maxBegleitpersonen: Math.max(0, parseInt(e.target.value) || 0) })}
                  style={{ ...inputStyle, maxWidth: 100 }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
            </div>
          )}

          {/* Step 3 */}
          {wizardStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Menüoptionen</h2>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>Welche Menüoptionen stehen zur Wahl?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {ALL_MEALS.map(meal => {
                  const active = wizardData.mealOptions.includes(meal)
                  return (
                    <button
                      key={meal}
                      type="button"
                      onClick={() => toggleMeal(meal)}
                      style={{
                        padding: '9px 18px', borderRadius: 100,
                        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent-light)' : 'none',
                        color: active ? 'var(--accent)' : 'var(--text-tertiary)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        textTransform: 'capitalize', transition: 'all 0.15s',
                      }}
                    >
                      {meal}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 4 — Summary */}
          {wizardStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Zusammenfassung</h2>
              {[
                ['Eventname', wizardData.title],
                ['Datum', fmtDate(wizardData.date)],
                ['Uhrzeit', wizardData.ceremonyStart || '—'],
                ['Location', wizardData.venue || '—'],
                ['Adresse', wizardData.venueAddress || '—'],
                ['Dresscode', wizardData.dresscode || '—'],
                ['Kinder', wizardData.childrenAllowed ? `Ja${wizardData.childrenNote ? ` — ${wizardData.childrenNote}` : ''}` : 'Nein'],
                ['Max. Begleitpersonen', String(wizardData.maxBegleitpersonen)],
                ['Menüoptionen', wizardData.mealOptions.join(', ') || '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 12, fontSize: 14 }}>
                  <span style={{ minWidth: 160, color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
              {(presetSuggestions.vendors.length + presetSuggestions.hotels.length + presetSuggestions.deko.length) > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--border)', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={applyVorschlaege}
                    onChange={e => setApplyVorschlaege(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 14, color: 'var(--text)' }}>
                    Vorschläge übernehmen
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                      ({presetSuggestions.vendors.length + presetSuggestions.hotels.length + presetSuggestions.deko.length} aus Voreinstellungen)
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Wizard error */}
          {wizardError && (
            <p style={{ fontSize: 13, color: 'var(--red)', background: 'rgba(160,64,64,0.08)', padding: '10px 14px', borderRadius: 8, marginTop: 16 }}>
              {wizardError}
            </p>
          )}

          {/* Wizard nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 12 }}>
            <button
              type="button"
              onClick={wizardStep === 1 ? closeWizard : handleBack}
              style={{
                padding: '11px 20px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text-tertiary)',
              }}
            >
              {wizardStep === 1 ? 'Abbrechen' : '← Zurück'}
            </button>
            {wizardStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  padding: '11px 24px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--text)', color: '#fff',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                }}
              >
                Weiter →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: '11px 24px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--accent)', color: '#fff',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? 'Wird erstellt …' : 'Event erstellen'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Event list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2].map(i => (
            <div key={i} style={{
              height: 80, borderRadius: 'var(--radius)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </div>
      ) : events.length === 0 && !showWizard ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
          background: 'var(--surface)',
        }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>💍</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Noch kein Event angelegt</p>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 20 }}>
            Erstelle dein erstes Event und starte mit der Planung.
          </p>
          <button
            onClick={openWizard}
            style={{
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius-sm)', padding: '12px 24px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Erstes Event erstellen
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map(ev => (
            <div
              key={ev.id}
              style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                background: 'var(--surface)', padding: '16px 18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 3px' }}>{displayEventName(ev)}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>{fmtDate(ev.date)}</p>
                  {ev.venue && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>{ev.venue}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => setDeleteConfirmId(ev.id)}
                    title="Event löschen"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 34, height: 34,
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                      transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#D94848'; e.currentTarget.style.color = '#D94848'; e.currentTarget.style.background = 'rgba(217,72,72,0.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'none' }}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => router.push(`/veranstalter/dashboard?event=${ev.id}`)}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 13, color: 'var(--text)', transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}
                  >
                    Verwalten
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Mitarbeiter-Sektion ─────────────────────────────────────────── */}
      <div style={{ marginTop: 40 }}>
        <button
          onClick={() => setStaffOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '14px 18px',
            border: '1px solid var(--border)', borderRadius: staffOpen ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
            background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Meine Mitarbeiter</span>
            {staff.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                background: 'var(--accent-light)', borderRadius: 100,
                padding: '2px 8px',
              }}>{staff.length}</span>
            )}
          </div>
          {staffOpen ? <ChevronUp size={16} color="var(--text-tertiary)" /> : <ChevronDown size={16} color="var(--text-tertiary)" />}
        </button>

        {staffOpen && (
          <div style={{
            border: '1px solid var(--border)', borderTop: 'none',
            borderRadius: '0 0 var(--radius) var(--radius)',
            background: 'var(--surface)', padding: 18,
          }}>
            {staff.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 14px', textAlign: 'center' }}>
                Noch keine Mitarbeiter angelegt.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {staff.map(member => (
                  <div
                    key={member.id}
                    style={{
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      padding: '14px 16px', background: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{member.name}</p>
                          {member.role_category && (
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20,
                              background: (ROLE_COLORS[member.role_category] ?? '#6B7280') + '20',
                              color: ROLE_COLORS[member.role_category] ?? '#6B7280',
                              border: `1px solid ${(ROLE_COLORS[member.role_category] ?? '#6B7280')}40`,
                            }}>
                              {ROLE_OPTIONS.find(r => r.value === member.role_category)?.label ?? member.role_category}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px' }}>
                          {member.email && (
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{member.email}</span>
                          )}
                          {member.phone && (
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{member.phone}</span>
                          )}
                        </div>
                        {member.available_days && member.available_days.length > 0 && (
                          <div style={{ display: 'flex', gap: 3, marginTop: 5, flexWrap: 'wrap' }}>
                            {WEEKDAYS_LIST.map(({ key, label }) => (
                              <span key={key} style={{
                                fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                                background: member.available_days.includes(key) ? 'rgba(0,0,0,0.07)' : 'transparent',
                                color: member.available_days.includes(key) ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                                opacity: member.available_days.includes(key) ? 1 : 0.35,
                              }}>{label}</span>
                            ))}
                          </div>
                        )}
                        {member.responsibilities && (
                          <p style={{
                            fontSize: 12, color: 'var(--accent)', margin: '5px 0 0',
                            background: 'var(--accent-light)', borderRadius: 4,
                            display: 'inline-block', padding: '2px 8px',
                          }}>
                            {member.responsibilities}
                          </p>
                        )}
                        {member.notes && (
                          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '5px 0 0', fontStyle: 'italic' }}>
                            {member.notes}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => openEditStaff(member)}
                          title="Bearbeiten"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 30, height: 30,
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                            background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                            transition: 'border-color 0.15s, color 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteStaffId(member.id)}
                          title="Löschen"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 30, height: 30,
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                            background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                            transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#D94848'; e.currentTarget.style.color = '#D94848'; e.currentTarget.style.background = 'rgba(217,72,72,0.06)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'none' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={openAddStaff}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)', background: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                color: 'var(--text-tertiary)', width: '100%', justifyContent: 'center',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <Plus size={14} /> Mitarbeiter hinzufügen
            </button>
          </div>
        )}
      </div>

      {/* ── Staff Add/Edit Modal ────────────────────────────────────────── */}
      {showStaffModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24,
          }}
          onClick={() => !staffSubmitting && closeStaffModal()}
        >
          <div
            style={{
              background: '#fff', borderRadius: 'var(--radius)', padding: '28px 28px 24px',
              maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                {editingStaff ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter hinzufügen'}
              </p>
              <button
                onClick={closeStaffModal}
                disabled={staffSubmitting}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {([
                { key: 'name', label: 'Name', required: true, placeholder: 'Max Mustermann' },
                { key: 'email', label: 'E-Mail', required: false, placeholder: 'max@example.de', type: 'email' },
                { key: 'phone', label: 'Telefonnummer', required: false, placeholder: '+49 151 12345678', type: 'tel' },
              ] as { key: keyof typeof staffForm; label: string; required: boolean; placeholder: string; type?: string }[]).map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    {field.label} {field.required && <span style={{ color: 'var(--accent)' }}>*</span>}
                  </label>
                  <input
                    type={field.type ?? 'text'}
                    value={staffForm[field.key] ?? ''}
                    onChange={e => setStaffForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                  />
                </div>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  Tätigkeitsbereich
                </label>
                <select
                  value={staffForm.role_category ?? ''}
                  onChange={e => setStaffForm(prev => ({ ...prev, role_category: e.target.value }))}
                  style={{ ...inputStyle, appearance: 'auto' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                >
                  <option value="">— Kein Bereich —</option>
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  Üblicherweise verfügbar
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {WEEKDAYS_LIST.map(({ key, label }) => {
                    const checked = (staffForm.available_days ?? []).includes(key)
                    return (
                      <label
                        key={key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '5px 11px', borderRadius: 20, cursor: 'pointer', userSelect: 'none',
                          border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                          background: checked ? 'var(--accent-light)' : 'none',
                          fontSize: 13, fontWeight: 600,
                          color: checked ? 'var(--accent)' : 'var(--text-tertiary)',
                          transition: 'all 0.12s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setStaffForm(prev => ({
                            ...prev,
                            available_days: checked
                              ? (prev.available_days ?? []).filter(d => d !== key)
                              : [...(prev.available_days ?? []), key],
                          }))}
                          style={{ display: 'none' }}
                        />
                        {label}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  Zuständigkeiten
                </label>
                <textarea
                  value={staffForm.responsibilities ?? ''}
                  onChange={e => setStaffForm(prev => ({ ...prev, responsibilities: e.target.value }))}
                  placeholder="z. B. Koordination Catering, Technik, Gästeempfang …"
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  Notizen
                </label>
                <textarea
                  value={staffForm.notes ?? ''}
                  onChange={e => setStaffForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Interne Notizen …"
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
            </div>

            {staffError && (
              <p style={{ fontSize: 13, color: 'var(--red)', background: 'rgba(160,64,64,0.08)', padding: '10px 14px', borderRadius: 8, marginTop: 14 }}>
                {staffError}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={closeStaffModal}
                disabled={staffSubmitting}
                style={{
                  padding: '10px 18px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text-tertiary)',
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={saveStaff}
                disabled={staffSubmitting}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--accent)', color: '#fff',
                  cursor: staffSubmitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                  opacity: staffSubmitting ? 0.6 : 1,
                }}
              >
                {staffSubmitting ? 'Wird gespeichert …' : editingStaff ? 'Speichern' : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Staff Delete Confirmation ───────────────────────────────────── */}
      {deleteStaffId && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24,
          }}
          onClick={() => !deletingStaff && setDeleteStaffId(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 'var(--radius)', padding: '28px 28px 24px',
              maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Mitarbeiter löschen?</p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                <strong>{staffToDelete?.name}</strong> wird unwiderruflich entfernt.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteStaffId(null)}
                disabled={deletingStaff}
                style={{
                  padding: '10px 18px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text-tertiary)',
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={confirmDeleteStaff}
                disabled={deletingStaff}
                style={{
                  padding: '10px 18px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: '#D94848', color: '#fff',
                  cursor: deletingStaff ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                  opacity: deletingStaff ? 0.6 : 1,
                }}
              >
                {deletingStaff ? 'Wird gelöscht …' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
