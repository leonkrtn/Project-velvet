'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Check, Plus, Trash2, Pencil, X, ChevronDown, ChevronRight, Edit2, ArrowLeft } from 'lucide-react'
import type { RaumPoint, RaumElement, RaumTablePool, ConceptPlacedTable } from '@/components/room/RaumKonfigurator'
import type { DekoOrganizerTemplate, DekoOrganizerFlatRate } from '@/lib/deko/types'

const RaumKonfigurator = dynamic(() => import('@/components/room/RaumKonfigurator'), { ssr: false })

type SeatingConcept = {
  id: string
  organizer_id: string
  name: string
  points: RaumPoint[]
  elements: RaumElement[]
  table_pool: RaumTablePool
  placed_tables: ConceptPlacedTable[]
  sort_order: number
}

/* ── Staff types ── */
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
  service:'#2563EB', kueche:'#DC2626', bar:'#D97706', technik:'#7C3AED',
  deko:'#DB2777', security:'#4B5563', fahrer:'#A16207', runner:'#0891B2',
  spueler:'#059669', empfang:'#9333EA', sonstiges:'#6B7280',
}
const WEEKDAYS = [
  { key:'mo',label:'Mo'},{key:'di',label:'Di'},{key:'mi',label:'Mi'},
  {key:'do',label:'Do'},{key:'fr',label:'Fr'},{key:'sa',label:'Sa'},{key:'so',label:'So'},
]
type StaffMember = {
  id: string; organizer_id: string; name: string; email: string | null
  phone: string | null; role_category: string | null; available_days: string[]
  hourly_rate: number | null; notes: string | null
  auth_user_id: string | null; must_change_password: boolean
}
const EMPTY_STAFF: Omit<StaffMember,'id'|'organizer_id'> = {
  name:'', email:'', phone:'', role_category:'', available_days:[], hourly_rate:0, notes:'',
  auth_user_id: null, must_change_password: true,
}

/* ── Settings types ── */
type Settings = {
  venue:string; location_name:string; location_street:string; location_zip:string
  location_city:string; location_website:string; dresscode:string
  children_allowed:boolean; children_note:string; max_begleitpersonen:number; meal_options:string[]
}
const EMPTY_SETTINGS: Settings = {
  venue:'', location_name:'', location_street:'', location_zip:'', location_city:'',
  location_website:'', dresscode:'', children_allowed:true, children_note:'', max_begleitpersonen:2,
  meal_options:['fleisch','fisch','vegetarisch','vegan'],
}
const ALL_MEALS = ['fleisch','fisch','vegetarisch','vegan']
const MEAL_LABELS: Record<string,string> = { fleisch:'Fleisch', fisch:'Fisch', vegetarisch:'Vegetarisch', vegan:'Vegan' }

type Tab = 'raum' | 'mitarbeiter' | 'einstellungen' | 'dekoration' | 'sitzplan'

// ── Deko template card ────────────────────────────────────────────────────────

const dekoInp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid var(--border)',
  borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none',
  background: 'var(--surface)', boxSizing: 'border-box',
}
const dekoIconBtn: React.CSSProperties = {
  width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6,
  background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const dekoLabel: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'var(--text-tertiary)', marginBottom: 4,
}

function TemplateCard({
  template, flatRates, onRename, onDelete, onAddFlatRate, onDeleteFlatRate,
}: {
  template: DekoOrganizerTemplate
  flatRates: DekoOrganizerFlatRate[]
  onRename: (name: string) => void
  onDelete: () => void
  onAddFlatRate: (fr: Omit<DekoOrganizerFlatRate, 'id' | 'organizer_id'>) => void
  onDeleteFlatRate: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(template.name)
  const [addingFr, setAddingFr] = useState(false)
  const [frName, setFrName] = useState('')
  const [frAmount, setFrAmount] = useState('')
  const [frDesc, setFrDesc] = useState('')

  const myFlatRates = flatRates.filter(f => f.template_id === template.id)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--surface)', gap: 10 }}>
        <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-tertiary)' }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {editingName
          ? <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
              onBlur={() => { setEditingName(false); onRename(nameDraft) }}
              onKeyDown={e => { if (e.key === 'Enter') { setEditingName(false); onRename(nameDraft) } }}
              style={{ ...dekoInp, flex: 1, height: 32 }} />
          : <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{template.name}</span>
        }
        <button onClick={() => setEditingName(true)} style={dekoIconBtn}><Edit2 size={13} /></button>
        <button onClick={onDelete} style={{ ...dekoIconBtn, color: '#E06C75' }}><Trash2 size={13} /></button>
      </div>

      {expanded && (
        <div style={{ padding: '14px 16px', background: '#fdfcfa', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Pauschalen</p>

          {myFlatRates.map(fr => (
            <div key={fr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{fr.name}</p>
                {fr.description && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{fr.description}</p>}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(fr.amount)}
              </span>
              <button onClick={() => onDeleteFlatRate(fr.id)} style={{ ...dekoIconBtn, color: '#E06C75' }}><Trash2 size={12} /></button>
            </div>
          ))}

          {!addingFr
            ? <button onClick={() => setAddingFr(true)} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                + Pauschale hinzufügen
              </button>
            : <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div><label style={dekoLabel}>Name *</label><input value={frName} onChange={e => setFrName(e.target.value)} style={dekoInp} placeholder="z.B. Blumenpauschale" /></div>
                  <div><label style={dekoLabel}>Betrag (€) *</label><input type="number" value={frAmount} onChange={e => setFrAmount(e.target.value)} style={dekoInp} placeholder="0.00" /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={dekoLabel}>Beschreibung</label><input value={frDesc} onChange={e => setFrDesc(e.target.value)} style={dekoInp} placeholder="Optional…" /></div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => {
                    if (!frName.trim() || !frAmount) return
                    onAddFlatRate({ template_id: template.id, name: frName.trim(), description: frDesc.trim() || null, amount: parseFloat(frAmount) })
                    setFrName(''); setFrAmount(''); setFrDesc(''); setAddingFr(false)
                  }} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                    Hinzufügen
                  </button>
                  <button onClick={() => setAddingFr(false)} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                    <X size={12} />
                  </button>
                </div>
              </div>
          }
        </div>
      )}
    </div>
  )
}

/* ── Shared styles ── */
const inp: React.CSSProperties = {
  width:'100%', padding:'10px 13px', background:'#fff',
  border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
  fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box', color:'var(--text)',
}
const label12: React.CSSProperties = {
  display:'block', fontSize:12, fontWeight:600, color:'var(--text-tertiary)', marginBottom:6,
}
const card: React.CSSProperties = {
  background:'var(--surface)', border:'1px solid var(--border)',
  borderRadius:'var(--radius)', padding:'20px 22px', marginBottom:16,
}

/* ════════════════════════════════════════════════════════════════════════════ */
export default function KonfigurationClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('from') ?? '/veranstalter'
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('raum')

  /* ── Room config ── */
  const [roomPoints, setRoomPoints] = useState<RaumPoint[]>([])
  const [roomElements, setRoomElements] = useState<RaumElement[]>([])
  const [roomTablePool, setRoomTablePool] = useState<RaumTablePool>({ types: [] })
  const [roomSaving, setRoomSaving] = useState(false)
  const [roomSaved, setRoomSaved] = useState(false)

  /* ── Staff ── */
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [staffForm, setStaffForm] = useState<Omit<StaffMember,'id'|'organizer_id'>>(EMPTY_STAFF)
  const [staffSubmitting, setStaffSubmitting] = useState(false)
  const [staffError, setStaffError] = useState('')
  const [deleteStaffId, setDeleteStaffId] = useState<string | null>(null)
  const [deletingStaff, setDeletingStaff] = useState(false)

  /* ── Settings ── */
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  /* ── Deko templates ── */
  const [dekoTemplates, setDekoTemplates] = useState<DekoOrganizerTemplate[]>([])
  const [dekoFlatRates, setDekoFlatRates] = useState<DekoOrganizerFlatRate[]>([])
  const [addingTemplate, setAddingTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')

  /* ── Staff auth setup ── */
  const [setupAuthStaffId, setSetupAuthStaffId] = useState<string | null>(null)
  const [setupAuthPassword, setSetupAuthPassword] = useState('')
  const [setupAuthSubmitting, setSetupAuthSubmitting] = useState(false)
  const [setupAuthError, setSetupAuthError] = useState('')
  const [setupAuthSuccess, setSetupAuthSuccess] = useState(false)

  /* ── Seating concepts ── */
  const [concepts, setConcepts] = useState<SeatingConcept[]>([])
  const [editingConceptId, setEditingConceptId] = useState<string | null>(null)
  const [conceptSaving, setConceptSaving] = useState(false)
  const [conceptSaved, setConceptSaved] = useState(false)
  const [addingConcept, setAddingConcept] = useState(false)
  const [newConceptName, setNewConceptName] = useState('')
  const [renamingConceptId, setRenamingConceptId] = useState<string | null>(null)
  const [renameConceptDraft, setRenameConceptDraft] = useState('')

  /* ── Load ── */
  useEffect(() => { load() }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [{ data: roomRow }, { data: staffRows }, { data: presetRow }, { data: tmplRows }, { data: frRows }, { data: conceptRows }] = await Promise.all([
        supabase.from('organizer_room_configs').select('*').eq('user_id', user.id).single(),
        supabase.from('organizer_staff').select('id,organizer_id,name,email,phone,role_category,available_days,hourly_rate,notes,auth_user_id,must_change_password').eq('organizer_id', user.id).order('created_at', { ascending: true }),
        supabase.from('organizer_presets').select('*').eq('user_id', user.id).single(),
        supabase.from('deko_organizer_templates').select('*').eq('organizer_id', user.id).order('sort_order'),
        supabase.from('deko_organizer_flat_rates').select('*').eq('organizer_id', user.id),
        supabase.from('organizer_seating_concepts').select('*').eq('organizer_id', user.id).order('sort_order'),
      ])

      if (roomRow) {
        setRoomPoints(roomRow.points ?? [])
        setRoomElements(roomRow.elements ?? [])
        setRoomTablePool(roomRow.table_pool ?? { types: [] })
      }
      setStaff((staffRows ?? []) as StaffMember[])
      setDekoTemplates((tmplRows ?? []) as DekoOrganizerTemplate[])
      setDekoFlatRates((frRows ?? []) as DekoOrganizerFlatRate[])
      setConcepts((conceptRows ?? []) as SeatingConcept[])
      if (presetRow) {
        setSettings({
          venue:               presetRow.venue               ?? '',
          location_name:       presetRow.location_name       ?? '',
          location_street:     presetRow.location_street     ?? '',
          location_zip:        presetRow.location_zip        ?? '',
          location_city:       presetRow.location_city       ?? '',
          location_website:    presetRow.location_website    ?? '',
          dresscode:           presetRow.dresscode           ?? '',
          children_allowed:    presetRow.children_allowed    ?? true,
          children_note:       presetRow.children_note       ?? '',
          max_begleitpersonen: presetRow.max_begleitpersonen ?? 2,
          meal_options:        presetRow.meal_options        ?? ['fleisch','fisch','vegetarisch','vegan'],
        })
      }
    } finally {
      setLoading(false)
    }
  }

  /* ── Room save ── */
  const handleRoomSave = useCallback(async (points: RaumPoint[], elements: RaumElement[]) => {
    if (!userId) return
    setRoomSaving(true)
    try {
      await supabase.from('organizer_room_configs').upsert(
        { user_id: userId, points, elements, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      setRoomPoints(points); setRoomElements(elements)
      setRoomSaved(true)
      setTimeout(() => setRoomSaved(false), 3000)
    } finally {
      setRoomSaving(false)
    }
  }, [userId, supabase])

  /* ── Staff ── */
  function openAddStaff() { setEditingStaff(null); setStaffForm(EMPTY_STAFF); setStaffError(''); setShowStaffModal(true) }
  function openEditStaff(m: StaffMember) {
    setEditingStaff(m)
    setStaffForm({ name:m.name, email:m.email??'', phone:m.phone??'', role_category:m.role_category??'', available_days:m.available_days??[], hourly_rate:m.hourly_rate??0, notes:m.notes??'', auth_user_id:m.auth_user_id, must_change_password:m.must_change_password })
    setStaffError(''); setShowStaffModal(true)
  }
  function closeStaffModal() { setShowStaffModal(false); setStaffError('') }

  async function saveStaff() {
    if (!staffForm.name.trim()) { setStaffError('Name ist erforderlich.'); return }
    if (!userId) return
    setStaffSubmitting(true); setStaffError('')
    try {
      const payload = {
        name: staffForm.name.trim(), email: staffForm.email?.trim()||null,
        phone: staffForm.phone?.trim()||null, role_category: staffForm.role_category?.trim()||null,
        available_days: staffForm.available_days??[], hourly_rate: staffForm.hourly_rate??0,
        notes: staffForm.notes?.trim()||null,
      }
      if (editingStaff) {
        const { data, error } = await supabase.from('organizer_staff').update(payload).eq('id', editingStaff.id).select().single()
        if (error) throw error
        setStaff(prev => prev.map(s => s.id === editingStaff.id ? (data as StaffMember) : s))
      } else {
        const { data, error } = await supabase.from('organizer_staff').insert({ ...payload, organizer_id: userId }).select().single()
        if (error) throw error
        setStaff(prev => [...prev, data as StaffMember])
      }
      closeStaffModal()
    } catch (err) {
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
    } finally {
      setDeletingStaff(false); setDeleteStaffId(null)
    }
  }

  async function handleSetupAuth() {
    if (!setupAuthStaffId || setupAuthPassword.length < 8) { setSetupAuthError('Passwort muss mindestens 8 Zeichen haben.'); return }
    setSetupAuthSubmitting(true); setSetupAuthError(''); setSetupAuthSuccess(false)
    try {
      const res = await fetch(`/api/staff/${setupAuthStaffId}/setup-auth`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: setupAuthPassword }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Fehler' }))
        setSetupAuthError(error); return
      }
      setSetupAuthSuccess(true)
      setSetupAuthPassword('')
      // Refresh staff to reflect auth_user_id change
      const { data } = await supabase.from('organizer_staff').select('id,organizer_id,name,email,phone,role_category,available_days,hourly_rate,notes,auth_user_id,must_change_password').eq('id', setupAuthStaffId).maybeSingle()
      if (data) setStaff(prev => prev.map(s => s.id === setupAuthStaffId ? data as StaffMember : s))
    } finally {
      setSetupAuthSubmitting(false)
    }
  }

  function toggleDay(day: string) {
    setStaffForm(f => ({
      ...f,
      available_days: f.available_days.includes(day) ? f.available_days.filter(d=>d!==day) : [...f.available_days, day],
    }))
  }

  /* ── Deko template CRUD ── */
  async function createTemplate() {
    if (!newTemplateName.trim() || !userId) return
    const { data } = await supabase.from('deko_organizer_templates').insert({
      organizer_id: userId, name: newTemplateName.trim(), sort_order: dekoTemplates.length,
    }).select().single()
    if (data) { setDekoTemplates(prev => [...prev, data as DekoOrganizerTemplate]); setNewTemplateName(''); setAddingTemplate(false) }
  }
  async function renameTemplate(id: string, name: string) {
    await supabase.from('deko_organizer_templates').update({ name }).eq('id', id)
    setDekoTemplates(prev => prev.map(t => t.id === id ? { ...t, name } : t))
  }
  async function deleteTemplate(id: string) {
    await supabase.from('deko_organizer_templates').delete().eq('id', id)
    setDekoTemplates(prev => prev.filter(t => t.id !== id))
  }
  async function addFlatRate(fr: Omit<DekoOrganizerFlatRate, 'id' | 'organizer_id'>) {
    if (!userId) return
    const { data } = await supabase.from('deko_organizer_flat_rates').insert({ ...fr, organizer_id: userId }).select().single()
    if (data) setDekoFlatRates(prev => [...prev, data as DekoOrganizerFlatRate])
  }
  async function deleteFlatRate(id: string) {
    await supabase.from('deko_organizer_flat_rates').delete().eq('id', id)
    setDekoFlatRates(prev => prev.filter(f => f.id !== id))
  }

  /* ── Seating concept CRUD ── */
  async function createConcept() {
    if (!newConceptName.trim() || !userId) return
    const { data } = await supabase.from('organizer_seating_concepts').insert({
      organizer_id: userId, name: newConceptName.trim(),
      points: roomPoints, elements: roomElements, table_pool: roomTablePool,
      placed_tables: [], sort_order: concepts.length,
    }).select().single()
    if (data) {
      setConcepts(prev => [...prev, data as SeatingConcept])
      setNewConceptName(''); setAddingConcept(false)
      setEditingConceptId(data.id)
    }
  }
  async function renameConcept(id: string, name: string) {
    await supabase.from('organizer_seating_concepts').update({ name }).eq('id', id)
    setConcepts(prev => prev.map(c => c.id === id ? { ...c, name } : c))
    setRenamingConceptId(null)
  }
  async function deleteConcept(id: string) {
    if (!confirm('Tischkonzept wirklich löschen?')) return
    await supabase.from('organizer_seating_concepts').delete().eq('id', id)
    setConcepts(prev => prev.filter(c => c.id !== id))
    if (editingConceptId === id) setEditingConceptId(null)
  }
  const handleSaveConcept = useCallback(async (points: RaumPoint[], elements: RaumElement[], tablePool: RaumTablePool, placedTables: ConceptPlacedTable[]) => {
    if (!editingConceptId) return
    setConceptSaving(true)
    try {
      await supabase.from('organizer_seating_concepts').update({
        points, elements, table_pool: tablePool, placed_tables: placedTables, updated_at: new Date().toISOString(),
      }).eq('id', editingConceptId)
      setConcepts(prev => prev.map(c => c.id === editingConceptId ? { ...c, points, elements, table_pool: tablePool, placed_tables: placedTables } : c))
      setConceptSaved(true); setTimeout(() => setConceptSaved(false), 3000)
    } finally {
      setConceptSaving(false)
    }
  }, [editingConceptId, supabase])

  /* ── Settings save ── */
  async function saveSettings() {
    if (!userId) return
    setSettingsSaving(true)
    try {
      await supabase.from('organizer_presets').upsert({
        user_id:              userId,
        venue:                settings.venue.trim()||null,
        location_name:        settings.location_name.trim()||null,
        location_street:      settings.location_street.trim()||null,
        location_zip:         settings.location_zip.trim()||null,
        location_city:        settings.location_city.trim()||null,
        location_website:     settings.location_website.trim()||null,
        dresscode:            settings.dresscode.trim()||null,
        children_allowed:     settings.children_allowed,
        children_note:        settings.children_note.trim()||null,
        max_begleitpersonen:  settings.max_begleitpersonen,
        meal_options:         settings.meal_options,
        updated_at:           new Date().toISOString(),
      }, { onConflict: 'user_id' })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2500)
    } finally {
      setSettingsSaving(false)
    }
  }

  /* ── Loading ── */
  if (loading) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="skeleton" style={{ height: 32, width: 200 }} />
      <div className="skeleton" style={{ height: 44 }} />
      <div className="skeleton" style={{ height: 320 }} />
    </div>
  )

  const TABS: { key: Tab; label: string }[] = [
    { key: 'raum',          label: 'Raum' },
    { key: 'sitzplan',      label: 'Sitzplan' },
    { key: 'mitarbeiter',   label: 'Mitarbeiter' },
    { key: 'einstellungen', label: 'Einstellungen' },
    { key: 'dekoration',    label: 'Dekoration' },
  ]

  const editingConcept = concepts.find(c => c.id === editingConceptId) ?? null

  return (
    <div style={{ maxWidth: (tab === 'raum' || (tab === 'sitzplan' && editingConceptId)) ? 1100 : 700, margin: '0 auto', padding: '28px 20px 80px', transition: 'max-width 0.3s' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => router.push(returnTo)} style={{ display:'flex', alignItems:'center', gap:4, fontSize:13, color:'var(--text-tertiary)', background:'none', border:'none', cursor:'pointer', padding:'4px 0', marginBottom:16, fontFamily:'inherit' }}>
          <ChevronLeft size={15} /> Zurück
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing:'-0.5px', color:'var(--text)', margin:'0 0 4px' }}>Konfiguration</h1>
        <p style={{ fontSize: 13, color:'var(--text-tertiary)', margin:0 }}>Globale Einstellungen für alle deine Events.</p>
      </div>

      {/* Tabs */}
      <div style={{ display:'inline-flex', background:'#EBEBEC', borderRadius:10, padding:3, marginBottom:28, gap:2 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'7px 20px', border:'none', cursor:'pointer', fontSize:13, fontWeight:500,
            borderRadius:8, transition:'all 0.15s', fontFamily:'inherit',
            background: tab===t.key ? 'var(--surface)' : 'transparent',
            color: tab===t.key ? 'var(--text)' : 'var(--text-tertiary)',
            boxShadow: tab===t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Raum ── */}
      {tab === 'raum' && (
        <div>
          <RaumKonfigurator
            initialPoints={roomPoints}
            initialElements={roomElements}
            onSave={handleRoomSave}
            saving={roomSaving}
            saved={roomSaved}
          />
        </div>
      )}

      {/* ── Sitzplan ── */}
      {tab === 'sitzplan' && (
        <div>
          {/* Concept editor view */}
          {editingConcept ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button onClick={() => { setEditingConceptId(null); setConceptSaved(false) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
                  <ArrowLeft size={14} /> Zurück
                </button>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 1px' }}>{editingConcept.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>Raumkonfiguration und Tischpool für dieses Konzept.</p>
                </div>
              </div>
              <RaumKonfigurator
                initialPoints={editingConcept.points}
                initialElements={editingConcept.elements}
                initialTablePool={editingConcept.table_pool}
                initialPlacedConceptTables={editingConcept.placed_tables ?? []}
                onSave={handleSaveConcept}
                saving={conceptSaving}
                saved={conceptSaved}
              />
            </div>
          ) : (
            /* Concept list view */
            <div style={card}>
              <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Tischkonzepte</p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 20px', lineHeight: 1.6 }}>
                Globale Vorlagen mit Raumform und Tischpool. Im Sitzplan-Editor eines Events können sie per Dropdown geladen werden.
              </p>

              {concepts.length === 0 && !addingConcept && (
                <div style={{ padding: '28px 20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--text-tertiary)', marginBottom: 16, fontSize: 13 }}>
                  Noch keine Tischkonzepte erstellt.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {concepts.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    {renamingConceptId === c.id ? (
                      <input
                        autoFocus
                        value={renameConceptDraft}
                        onChange={e => setRenameConceptDraft(e.target.value)}
                        onBlur={() => renameConcept(c.id, renameConceptDraft)}
                        onKeyDown={e => { if (e.key === 'Enter') renameConcept(c.id, renameConceptDraft); if (e.key === 'Escape') setRenamingConceptId(null) }}
                        style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--accent)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                      />
                    ) : (
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                    )}
                    <button onClick={() => setEditingConceptId(c.id)} style={{ padding: '5px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit' }}>
                      Konfigurieren
                    </button>
                    <button onClick={() => { setRenamingConceptId(c.id); setRenameConceptDraft(c.name) }} style={{ ...dekoIconBtn }}><Edit2 size={13} /></button>
                    <button onClick={() => deleteConcept(c.id)} style={{ ...dekoIconBtn, color: '#E06C75' }}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>

              {addingConcept ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    autoFocus
                    value={newConceptName}
                    onChange={e => setNewConceptName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createConcept(); if (e.key === 'Escape') setAddingConcept(false) }}
                    placeholder="Konzept benennen…"
                    style={{ ...dekoInp, flex: 1 }}
                  />
                  <button onClick={createConcept} style={{ padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                    Erstellen
                  </button>
                  <button onClick={() => setAddingConcept(false)} style={{ padding: '8px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setAddingConcept(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', border: '1px dashed var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                  <Plus size={15} /> Neues Konzept erstellen
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Mitarbeiter ── */}
      {tab === 'mitarbeiter' && (
        <div>
          {/* Delete staff confirm */}
          {deleteStaffId && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:24 }} onClick={() => !deletingStaff && setDeleteStaffId(null)}>
              <div style={{ background:'#fff', borderRadius:'var(--radius)', padding:'28px 28px 24px', maxWidth:380, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' }} onClick={e=>e.stopPropagation()}>
                <p style={{ fontSize:17, fontWeight:700, marginBottom:8 }}>Mitarbeiter löschen?</p>
                <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:20 }}>Diese Aktion kann nicht rückgängig gemacht werden.</p>
                <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                  <button onClick={() => setDeleteStaffId(null)} style={{ padding:'10px 18px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'none', cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>Abbrechen</button>
                  <button onClick={confirmDeleteStaff} disabled={deletingStaff} style={{ padding:'10px 18px', borderRadius:'var(--radius-sm)', border:'none', background:'#D94848', color:'#fff', cursor:deletingStaff?'not-allowed':'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, opacity:deletingStaff?0.6:1 }}>
                    {deletingStaff ? 'Wird gelöscht…' : 'Löschen'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div>
                <p style={{ fontSize:15, fontWeight:700, color:'var(--text)', margin:'0 0 3px' }}>Mitarbeiter</p>
                <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:0 }}>{staff.length} Mitarbeiter hinterlegt</p>
              </div>
              <button onClick={openAddStaff} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 16px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'inherit' }}>
                <Plus size={14} /> Hinzufügen
              </button>
            </div>

            {staff.length === 0 && (
              <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-tertiary)', fontSize:14 }}>
                Noch keine Mitarbeiter hinterlegt.
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {staff.map(m => (
                <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'var(--bg)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                      <span style={{ fontWeight:600, fontSize:14 }}>{m.name}</span>
                      {m.role_category && (
                        <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:4, background: `${ROLE_COLORS[m.role_category] ?? '#6B7280'}22`, color: ROLE_COLORS[m.role_category] ?? '#6B7280' }}>
                          {ROLE_OPTIONS.find(r=>r.value===m.role_category)?.label ?? m.role_category}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-tertiary)', display:'flex', gap:12, flexWrap:'wrap' }}>
                      {m.email && <span>{m.email}</span>}
                      {m.phone && <span>{m.phone}</span>}
                      {m.hourly_rate != null && m.hourly_rate > 0 && <span>{m.hourly_rate} €/h</span>}
                      {m.available_days.length > 0 && <span>{m.available_days.map(d=>d.charAt(0).toUpperCase()+d.slice(1)).join(', ')}</span>}
                    </div>
                    {m.notes && <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'4px 0 0' }}>{m.notes}</p>}
                  </div>
                  <div style={{ display:'flex', gap:6, marginLeft:12 }}>
                    <button
                      onClick={() => { setSetupAuthStaffId(m.id); setSetupAuthPassword(''); setSetupAuthError(''); setSetupAuthSuccess(false) }}
                      title={m.auth_user_id ? 'Passwort zurücksetzen' : 'Portal-Konto erstellen'}
                      style={{ padding:'6px 10px', background: m.auth_user_id ? '#EFF6FF' : 'none', border:`1px solid ${m.auth_user_id ? '#BFDBFE' : 'var(--border)'}`, borderRadius:7, cursor:'pointer', color: m.auth_user_id ? '#1D4ED8' : 'var(--text-tertiary)', display:'flex', alignItems:'center', gap:4, fontSize:11, fontFamily:'inherit', fontWeight: m.auth_user_id ? 600 : 400 }}>
                      {m.auth_user_id ? '🔑 Konto' : '+ Konto'}
                    </button>
                    <button onClick={() => openEditStaff(m)} style={{ padding:6, background:'none', border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', color:'var(--text-tertiary)', display:'flex' }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleteStaffId(m.id)} style={{ padding:6, background:'none', border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', color:'var(--text-tertiary)', display:'flex' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Staff modal */}
          {showStaffModal && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={closeStaffModal}>
              <div style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:28, width:480, maxWidth:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }} onClick={e=>e.stopPropagation()}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                  <h3 style={{ fontSize:18, fontWeight:700, letterSpacing:'-0.3px' }}>{editingStaff?'Mitarbeiter bearbeiten':'Mitarbeiter hinzufügen'}</h3>
                  <button onClick={closeStaffModal} style={{ background:'none', border:'none', cursor:'pointer', padding:4, display:'flex', color:'var(--text-tertiary)' }}><X size={18}/></button>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                  <div><label style={label12}>Name *</label><input style={inp} value={staffForm.name} onChange={e=>setStaffForm(f=>({...f,name:e.target.value}))} placeholder="Max Mustermann" /></div>
                  <div>
                    <label style={label12}>Funktion</label>
                    <select style={inp} value={staffForm.role_category??''} onChange={e=>setStaffForm(f=>({...f,role_category:e.target.value}))}>
                      <option value="">— Wählen —</option>
                      {ROLE_OPTIONS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                  <div><label style={label12}>E-Mail</label><input type="email" style={inp} value={staffForm.email??''} onChange={e=>setStaffForm(f=>({...f,email:e.target.value}))} /></div>
                  <div><label style={label12}>Telefon</label><input style={inp} value={staffForm.phone??''} onChange={e=>setStaffForm(f=>({...f,phone:e.target.value}))} /></div>
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={label12}>Stundenlohn (€)</label>
                  <input type="number" min={0} style={{ ...inp, maxWidth:120 }} value={staffForm.hourly_rate??0} onChange={e=>setStaffForm(f=>({...f,hourly_rate:parseFloat(e.target.value)||0}))} />
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={label12}>Verfügbare Tage</label>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {WEEKDAYS.map(d => (
                      <button key={d.key} type="button" onClick={() => toggleDay(d.key)} style={{ padding:'6px 12px', borderRadius:8, border:`1.5px solid ${staffForm.available_days.includes(d.key)?'var(--accent)':'var(--border)'}`, background:staffForm.available_days.includes(d.key)?'var(--accent-light)':'none', color:staffForm.available_days.includes(d.key)?'var(--accent)':'var(--text-tertiary)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={label12}>Notizen</label>
                  <textarea style={{ ...inp, minHeight:70, resize:'vertical' }} value={staffForm.notes??''} onChange={e=>setStaffForm(f=>({...f,notes:e.target.value}))} />
                </div>

                {staffError && <p style={{ fontSize:13, color:'#D94848', marginBottom:12 }}>{staffError}</p>}
                <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                  <button onClick={closeStaffModal} style={{ padding:'9px 18px', background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>Abbrechen</button>
                  <button onClick={saveStaff} disabled={staffSubmitting} style={{ padding:'9px 20px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', cursor:staffSubmitting?'not-allowed':'pointer', fontSize:14, fontWeight:500, fontFamily:'inherit', opacity:staffSubmitting?0.6:1 }}>
                    {staffSubmitting ? 'Speichern…' : editingStaff ? 'Aktualisieren' : 'Hinzufügen'}
                  </button>
                </div>
              </div>
            </div>
          )}
        {/* Setup auth modal */}
        {setupAuthStaffId && (() => {
          const m = staff.find(s => s.id === setupAuthStaffId)
          if (!m) return null
          return (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setSetupAuthStaffId(null)}>
              <div style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:28, width:380, maxWidth:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }} onClick={e=>e.stopPropagation()}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <div>
                    <h3 style={{ fontSize:16, fontWeight:700, margin:'0 0 2px' }}>{m.auth_user_id ? 'Passwort zurücksetzen' : 'Portal-Konto erstellen'}</h3>
                    <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:0 }}>{m.name} · {m.email ?? 'Keine E-Mail'}</p>
                  </div>
                  <button onClick={() => setSetupAuthStaffId(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:4, display:'flex', color:'var(--text-tertiary)' }}><X size={16}/></button>
                </div>
                {!m.email && (
                  <p style={{ fontSize:13, color:'#EF4444', marginBottom:12 }}>Dieser Mitarbeiter hat keine E-Mail-Adresse hinterlegt. Bitte zuerst bearbeiten.</p>
                )}
                {m.email && (
                  <>
                    <div style={{ marginBottom:14 }}>
                      <label style={label12}>Initiales Passwort</label>
                      <input
                        type="password"
                        value={setupAuthPassword}
                        onChange={e => setSetupAuthPassword(e.target.value)}
                        placeholder="Mindestens 8 Zeichen"
                        style={inp}
                      />
                      <p style={{ fontSize:11, color:'var(--text-tertiary)', margin:'4px 0 0' }}>
                        Der Mitarbeiter muss das Passwort beim ersten Login ändern.
                      </p>
                    </div>
                    {setupAuthError && <p style={{ fontSize:12, color:'#EF4444', marginBottom:10 }}>{setupAuthError}</p>}
                    {setupAuthSuccess && <p style={{ fontSize:12, color:'#059669', marginBottom:10 }}>✓ Konto erfolgreich {m.auth_user_id ? 'aktualisiert' : 'erstellt'}!</p>}
                    <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                      <button onClick={() => setSetupAuthStaffId(null)} style={{ padding:'9px 16px', background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>Schließen</button>
                      <button onClick={handleSetupAuth} disabled={setupAuthSubmitting} style={{ padding:'9px 18px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', cursor:setupAuthSubmitting?'not-allowed':'pointer', fontSize:13, fontWeight:500, fontFamily:'inherit', opacity:setupAuthSubmitting?0.6:1 }}>
                        {setupAuthSubmitting ? 'Wird erstellt…' : m.auth_user_id ? 'Passwort ändern' : 'Konto erstellen'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })()}
        </div>
      )}

      {/* ── Einstellungen ── */}
      {tab === 'einstellungen' && (
        <div>
          {/* Location */}
          <div style={card}>
            <p style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:16 }}>Location & Adresse</p>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div><label style={label12}>Location Name</label><input value={settings.venue} onChange={e=>setSettings(s=>({...s,venue:e.target.value}))} placeholder="Schloss Lichtenberg" style={inp} /></div>
              <div><label style={label12}>Bezeichnung / Saal</label><input value={settings.location_name} onChange={e=>setSettings(s=>({...s,location_name:e.target.value}))} placeholder="Festsaal West" style={inp} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={label12}>Straße & Hausnummer</label><input value={settings.location_street} onChange={e=>setSettings(s=>({...s,location_street:e.target.value}))} placeholder="Musterstraße 1" style={inp} /></div>
                <div><label style={label12}>PLZ</label><input value={settings.location_zip} onChange={e=>setSettings(s=>({...s,location_zip:e.target.value}))} placeholder="12345" style={inp} /></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={label12}>Stadt</label><input value={settings.location_city} onChange={e=>setSettings(s=>({...s,location_city:e.target.value}))} placeholder="Musterstadt" style={inp} /></div>
                <div><label style={label12}>Website</label><input value={settings.location_website} onChange={e=>setSettings(s=>({...s,location_website:e.target.value}))} placeholder="https://location.de" style={inp} /></div>
              </div>
            </div>
          </div>

          {/* Standard-Einstellungen */}
          <div style={card}>
            <p style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:16 }}>Standard-Einstellungen</p>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div><label style={label12}>Dresscode</label><input value={settings.dresscode} onChange={e=>setSettings(s=>({...s,dresscode:e.target.value}))} placeholder="Festlich, Cocktailkleid etc." style={inp} /></div>
              <div>
                <label style={label12}>Kinder willkommen?</label>
                <div style={{ display:'flex', gap:8 }}>
                  {([true,false] as const).map(val => (
                    <button key={String(val)} type="button" onClick={() => setSettings(s=>({...s,children_allowed:val}))} style={{ padding:'8px 18px', borderRadius:'var(--radius-sm)', border:`1.5px solid ${settings.children_allowed===val?'var(--accent)':'var(--border)'}`, background:settings.children_allowed===val?'var(--accent-light)':'none', color:settings.children_allowed===val?'var(--accent)':'var(--text-tertiary)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                      {val?'Ja':'Nein'}
                    </button>
                  ))}
                </div>
                {settings.children_allowed && (
                  <input value={settings.children_note} onChange={e=>setSettings(s=>({...s,children_note:e.target.value}))} placeholder="Hinweis zu Kindern (optional)" style={{ ...inp, marginTop:10 }} />
                )}
              </div>
              <div>
                <label style={label12}>Max. Begleitpersonen pro Gast</label>
                <input type="number" min={0} max={10} value={settings.max_begleitpersonen} onChange={e=>setSettings(s=>({...s,max_begleitpersonen:Math.max(0,parseInt(e.target.value)||0)}))} style={{ ...inp, maxWidth:100 }} />
              </div>
            </div>
          </div>

          {/* Menüoptionen */}
          <div style={card}>
            <p style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:12 }}>Standard-Menüoptionen</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {ALL_MEALS.map(meal => {
                const active = settings.meal_options.includes(meal)
                return (
                  <button key={meal} type="button" onClick={() => setSettings(s => ({ ...s, meal_options: active ? s.meal_options.filter(m=>m!==meal) : [...s.meal_options,meal] }))} style={{ padding:'8px 18px', borderRadius:100, border:`1.5px solid ${active?'var(--accent)':'var(--border)'}`, background:active?'var(--accent-light)':'none', color:active?'var(--accent)':'var(--text-tertiary)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                    {MEAL_LABELS[meal]}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={saveSettings} disabled={settingsSaving} style={{ padding:'12px 28px', borderRadius:'var(--radius-sm)', border:'none', background:'var(--accent)', color:'#fff', fontSize:14, fontWeight:600, cursor:settingsSaving?'not-allowed':'pointer', fontFamily:'inherit', opacity:settingsSaving?0.6:1 }}>
              {settingsSaving ? 'Speichern …' : 'Speichern'}
            </button>
            {settingsSaved && !settingsSaving && (
              <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, color:'var(--green)' }}>
                <Check size={14} /> Gespeichert
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dekoration ── */}
      {tab === 'dekoration' && (
        <div>
          <div style={card}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Vorlagen</p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 20px', lineHeight: 1.6 }}>
              Globale Vorlagen mit Pauschalen, die beim Erstellen eines Events auf den Dekorationsbereich angewendet werden können.
            </p>

            {dekoTemplates.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                flatRates={dekoFlatRates}
                onRename={name => renameTemplate(t.id, name)}
                onDelete={() => deleteTemplate(t.id)}
                onAddFlatRate={addFlatRate}
                onDeleteFlatRate={deleteFlatRate}
              />
            ))}

            {dekoTemplates.length === 0 && !addingTemplate && (
              <div style={{ padding: '28px 20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--text-tertiary)', marginBottom: 16, fontSize: 13 }}>
                Noch keine Vorlagen erstellt.
              </div>
            )}

            {addingTemplate
              ? <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input autoFocus value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createTemplate(); if (e.key === 'Escape') setAddingTemplate(false) }}
                    placeholder="Vorlage benennen…" style={{ ...dekoInp, flex: 1 }} />
                  <button onClick={createTemplate} style={{ padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                    Erstellen
                  </button>
                  <button onClick={() => setAddingTemplate(false)} style={{ padding: '8px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                </div>
              : <button onClick={() => setAddingTemplate(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', border: '1px dashed var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit', marginTop: 4 }}>
                  <Plus size={15} /> Neue Vorlage erstellen
                </button>
            }
          </div>
        </div>
      )}
    </div>
  )
}
