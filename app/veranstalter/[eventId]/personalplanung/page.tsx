'use client'
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────
const HOUR_START = 8
const HOUR_END = 24
const HOURS = HOUR_END - HOUR_START

const ROLES: Record<string, { label: string; color: string }> = {
  service:   { label: 'Service',   color: '#2563EB' },
  kueche:    { label: 'Küche',     color: '#DC2626' },
  bar:       { label: 'Bar',       color: '#D97706' },
  technik:   { label: 'Technik',   color: '#7C3AED' },
  deko:      { label: 'Deko',      color: '#DB2777' },
  security:  { label: 'Security',  color: '#4B5563' },
  fahrer:    { label: 'Fahrer',    color: '#A16207' },
  runner:    { label: 'Runner',    color: '#0891B2' },
  spueler:   { label: 'Spüler',    color: '#059669' },
  empfang:   { label: 'Empfang',   color: '#9333EA' },
  sonstiges: { label: 'Sonstiges', color: '#6B7280' },
}

const WEEKDAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] as const
const WEEKDAY_LABEL: Record<string, string> = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' }
const DOW_MAP: Record<string, number> = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 }

// ── Types ────────────────────────────────────────────────────────────────────
type StaffMember = {
  id: string
  name: string
  role_category: string | null
  available_days: string[] | null
  phone: string | null
}

type PlanDay = {
  id: string
  event_id: string
  label: string
  date: string
  sort_order: number
}

type Assignment = {
  id: string
  day_id: string
  staff_id: string
}

type Shift = {
  id: string
  day_id: string
  staff_id: string
  task: string
  start_hour: number
  end_hour: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtHour(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + (m || 0) / 60
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase()
}

function colorFor(role: string | null | undefined): string {
  return ROLES[role ?? '']?.color ?? '#8E8E93'
}

function dayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00').getDay()
}

function isUsuallyAvailable(available_days: string[] | null | undefined, dateStr: string): boolean {
  if (!available_days?.length) return true
  const dow = dayOfWeek(dateStr)
  return available_days.some(d => DOW_MAP[d] === dow)
}

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return dateStr }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function EmptyState({ icon, title, desc, action }: { icon: string; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px', border: '2px dashed var(--border)', borderRadius: 14, background: '#fff' }}>
      <p style={{ fontSize: 36, marginBottom: 14 }}>{icon}</p>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>{title}</p>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 auto', maxWidth: 360 }}>{desc}</p>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ width: 460, maxWidth: '92vw', maxHeight: '88vh', background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

function ModalHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.2px', margin: 0 }}>{title}</h3>
        {sub && <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>{sub}</p>}
      </div>
      <button
        onClick={onClose}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 7, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

function ModalFoot({ onCancel, onSave, saving, saveLabel }: { onCancel: () => void; onSave: () => void; saving: boolean; saveLabel?: string }) {
  return (
    <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <button onClick={onCancel} disabled={saving} style={{ fontSize: 13, fontWeight: 500, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(0,0,0,0.13)', background: '#fff', color: 'var(--text)', fontFamily: 'inherit' }}>
        Abbrechen
      </button>
      <button onClick={onSave} disabled={saving} style={{ fontSize: 13, fontWeight: 500, padding: '8px 18px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', border: 'none', background: 'var(--text)', color: '#fff', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Speichert …' : (saveLabel ?? 'Speichern')}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PersonalplanungPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // ── State ─────────────────────────────────────────────────────────────────
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [days, setDays] = useState<PlanDay[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDayId, setActiveDayId] = useState<string | null>(null)

  // Day modal
  const [showDayModal, setShowDayModal] = useState(false)
  const [editingDayId, setEditingDayId] = useState<string | null>(null)
  const [dayLabel, setDayLabel] = useState('')
  const [dayDate, setDayDate] = useState('')
  const [daySubmitting, setDaySubmitting] = useState(false)
  const [deleteDayId, setDeleteDayId] = useState<string | null>(null)

  // Shift modal
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [shiftStaffId, setShiftStaffId] = useState('')
  const [shiftTask, setShiftTask] = useState('')
  const [shiftStart, setShiftStart] = useState('14:00')
  const [shiftEnd, setShiftEnd] = useState('18:00')
  const [shiftSubmitting, setShiftSubmitting] = useState(false)
  const [shiftError, setShiftError] = useState('')

  const inputS: React.CSSProperties = {
    width: '100%', padding: '9px 11px', fontSize: 13.5,
    border: '1px solid rgba(0,0,0,0.13)', borderRadius: 8,
    background: '#fff', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: 'var(--text)',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }
  const labelS: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }
  const btnPrimary: React.CSSProperties = { fontSize: 13, fontWeight: 500, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--text)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', whiteSpace: 'nowrap' }
  const btnGhost: React.CSSProperties = { fontSize: 13, fontWeight: 500, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(0,0,0,0.13)', background: '#fff', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', whiteSpace: 'nowrap' }
  const btnGhostSm: React.CSSProperties = { fontSize: 12, fontWeight: 500, padding: '6px 10px', borderRadius: 7, cursor: 'pointer', border: '1px solid rgba(0,0,0,0.13)', background: '#fff', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', whiteSpace: 'nowrap' }

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadData() }, [eventId])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: staffRows }, { data: dayRows }] = await Promise.all([
        supabase.from('organizer_staff').select('id,name,role_category,available_days,phone').eq('organizer_id', user.id).order('name'),
        supabase.from('personalplanung_days').select('*').eq('event_id', eventId).order('sort_order'),
      ])

      const staffList = (staffRows ?? []) as StaffMember[]
      const dayList = (dayRows ?? []) as PlanDay[]
      setStaff(staffList)
      setDays(dayList)

      if (dayList.length > 0) {
        const dayIds = dayList.map(d => d.id)
        const [{ data: aRows }, { data: sRows }] = await Promise.all([
          supabase.from('personalplanung_assignments').select('*').in('day_id', dayIds),
          supabase.from('personalplanung_shifts').select('*').in('day_id', dayIds).order('start_hour'),
        ])
        setAssignments((aRows ?? []) as Assignment[])
        setShifts((sRows ?? []) as Shift[])
        setActiveDayId(prev => prev ?? dayList[0].id)
      }
    } catch (err) {
      console.error('[Personalplanung] load:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeDay = days.find(d => d.id === activeDayId) ?? null
  const dayAssignments = assignments.filter(a => a.day_id === activeDayId)
  const workingIds = new Set(dayAssignments.map(a => a.staff_id))
  const dayShifts = shifts.filter(s => s.day_id === activeDayId)
  const workingStaff = staff.filter(s => workingIds.has(s.id))
  const totalHours = dayShifts.reduce((sum, s) => sum + (s.end_hour - s.start_hour), 0)
  const rolesCovered = new Set(workingStaff.map(s => s.role_category).filter(Boolean)).size
  const coverageCounts = Array.from({ length: HOURS }, (_, i) => {
    const h = HOUR_START + i
    return dayShifts.filter(s => workingIds.has(s.staff_id) && s.start_hour <= h && s.end_hour > h).length
  })
  const maxCoverage = Math.max(1, ...coverageCounts)
  const usedRoles = new Set(workingStaff.map(s => s.role_category).filter(Boolean) as string[])
  const deleteDayItem = days.find(d => d.id === deleteDayId)

  // ── Day CRUD ─────────────────────────────────────────────────────────────
  function openAddDay() {
    setEditingDayId(null)
    setDayLabel('')
    setDayDate('')
    setShowDayModal(true)
  }

  function openEditDay(day: PlanDay) {
    setEditingDayId(day.id)
    setDayLabel(day.label)
    setDayDate(day.date)
    setShowDayModal(true)
  }

  async function saveDay() {
    if (!dayLabel.trim() || !dayDate) return
    setDaySubmitting(true)
    try {
      if (editingDayId) {
        const { data, error } = await supabase
          .from('personalplanung_days').update({ label: dayLabel.trim(), date: dayDate })
          .eq('id', editingDayId).select().single()
        if (!error && data) setDays(prev => prev.map(d => d.id === editingDayId ? data as PlanDay : d))
      } else {
        const maxOrder = days.reduce((m, d) => Math.max(m, d.sort_order), -1)
        const { data, error } = await supabase
          .from('personalplanung_days')
          .insert({ event_id: eventId, label: dayLabel.trim(), date: dayDate, sort_order: maxOrder + 1 })
          .select().single()
        if (!error && data) {
          const nd = data as PlanDay
          setDays(prev => [...prev, nd].sort((a, b) => a.sort_order - b.sort_order))
          setActiveDayId(nd.id)
        }
      }
      setShowDayModal(false)
    } finally {
      setDaySubmitting(false)
    }
  }

  async function confirmDeleteDay() {
    if (!deleteDayId) return
    const remaining = days.filter(d => d.id !== deleteDayId)
    setDays(remaining)
    setAssignments(prev => prev.filter(a => a.day_id !== deleteDayId))
    setShifts(prev => prev.filter(s => s.day_id !== deleteDayId))
    if (activeDayId === deleteDayId) setActiveDayId(remaining[0]?.id ?? null)
    setDeleteDayId(null)
    await supabase.from('personalplanung_days').delete().eq('id', deleteDayId)
  }

  // ── Assignments ───────────────────────────────────────────────────────────
  async function toggleWorking(staffId: string) {
    if (!activeDayId) return
    const existing = dayAssignments.find(a => a.staff_id === staffId)
    if (existing) {
      setAssignments(prev => prev.filter(a => a.id !== existing.id))
      await supabase.from('personalplanung_assignments').delete().eq('id', existing.id)
    } else {
      const { data, error } = await supabase
        .from('personalplanung_assignments')
        .insert({ day_id: activeDayId, staff_id: staffId }).select().single()
      if (!error && data) setAssignments(prev => [...prev, data as Assignment])
    }
  }

  // ── Shift CRUD ────────────────────────────────────────────────────────────
  function openAddShift(preselectId?: string) {
    if (!activeDayId || workingStaff.length === 0) return
    setEditingShiftId(null)
    setShiftStaffId(preselectId ?? workingStaff[0].id)
    setShiftTask('')
    setShiftStart('14:00')
    setShiftEnd('18:00')
    setShiftError('')
    setShowShiftModal(true)
  }

  function openEditShift(shift: Shift) {
    setEditingShiftId(shift.id)
    setShiftStaffId(shift.staff_id)
    setShiftTask(shift.task)
    setShiftStart(fmtHour(shift.start_hour))
    setShiftEnd(fmtHour(shift.end_hour))
    setShiftError('')
    setShowShiftModal(true)
  }

  async function saveShift() {
    const start = parseTime(shiftStart)
    const end = parseTime(shiftEnd)
    if (end <= start) { setShiftError('Endzeit muss nach Startzeit liegen.'); return }
    setShiftSubmitting(true); setShiftError('')
    try {
      const payload = { day_id: activeDayId!, staff_id: shiftStaffId, task: shiftTask.trim() || 'Schicht', start_hour: start, end_hour: end }
      if (editingShiftId) {
        const { data, error } = await supabase.from('personalplanung_shifts').update(payload).eq('id', editingShiftId).select().single()
        if (error) throw error
        setShifts(prev => prev.map(s => s.id === editingShiftId ? data as Shift : s))
      } else {
        const { data, error } = await supabase.from('personalplanung_shifts').insert(payload).select().single()
        if (error) throw error
        setShifts(prev => [...prev, data as Shift])
      }
      setShowShiftModal(false)
    } catch (err: unknown) {
      setShiftError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
    } finally {
      setShiftSubmitting(false)
    }
  }

  async function deleteShift(shiftId: string) {
    setShifts(prev => prev.filter(s => s.id !== shiftId))
    await supabase.from('personalplanung_shifts').delete().eq('id', shiftId)
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Lade Personalplanung …</p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text)', margin: '0 0 4px' }}>Personalplanung</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            Mitarbeiter, Tätigkeitsbereiche und Schichten für das Event planen.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={openAddDay} style={btnGhost}>
            <Plus size={13} /> Tag
          </button>
          {activeDay && workingStaff.length > 0 && (
            <button onClick={() => openAddShift()} style={btnPrimary}>
              <Plus size={13} /> Schicht
            </button>
          )}
        </div>
      </div>

      {/* Empty states */}
      {staff.length === 0 ? (
        <EmptyState
          icon="👥"
          title="Keine Mitarbeiter angelegt"
          desc='Lege zuerst Mitarbeiter unter "Meine Events → Mitarbeiter" an, um hier mit der Planung zu beginnen.'
        />
      ) : days.length === 0 ? (
        <EmptyState
          icon="📅"
          title="Noch keine Planungstage"
          desc='Füge Tage hinzu (z.B. Aufbau, Hochzeitstag, Abbau) um mit der Schichtplanung zu beginnen.'
          action={<button onClick={openAddDay} style={btnPrimary}><Plus size={13} /> Ersten Tag hinzufügen</button>}
        />
      ) : (
        <>
          {/* Day tabs */}
          <div style={{ display: 'flex', gap: 6, background: '#fff', padding: 6, borderRadius: 10, border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20, width: 'fit-content', flexWrap: 'wrap' }}>
            {days.map(d => (
              <button
                key={d.id}
                onClick={() => setActiveDayId(d.id)}
                style={{
                  padding: '8px 16px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: d.id === activeDayId ? 'var(--text)' : 'transparent',
                  color: d.id === activeDayId ? '#fff' : 'var(--text-secondary)',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s',
                }}
              >
                <span>{d.label}</span>
                <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 400 }}>{fmtDate(d.date)}</span>
              </button>
            ))}
          </div>

          {/* Summary strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {([
              { label: 'Im Einsatz', value: workingStaff.length, sub: `von ${staff.length} Mitarbeitern`, colorVal: '#1B5E20' },
              { label: 'Bereiche abgedeckt', value: rolesCovered, sub: `${Object.keys(ROLES).length} Bereiche gesamt`, colorVal: undefined },
              { label: 'Geplante Stunden', value: totalHours.toFixed(1), sub: `${dayShifts.length} Schichten`, unit: 'h', colorVal: undefined },
              { label: 'Nicht im Einsatz', value: staff.length - workingStaff.length, sub: 'frei an diesem Tag', colorVal: staff.length - workingStaff.length > 0 ? '#FF9500' : undefined },
            ] as { label: string; value: string | number; sub: string; unit?: string; colorVal?: string }[]).map((c, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: c.colorVal ?? 'var(--text)' }}>
                  {c.value}
                  {c.unit && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 2 }}>{c.unit}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Content grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

            {/* Timeline panel */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Schichtplan · {activeDay?.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{activeDay ? fmtDate(activeDay.date) : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {activeDay && (
                    <button onClick={() => openEditDay(activeDay)} style={btnGhostSm}>
                      <Pencil size={12} /> Bearbeiten
                    </button>
                  )}
                  {activeDay && (
                    <button
                      onClick={() => setDeleteDayId(activeDay.id)}
                      style={{ ...btnGhostSm, color: '#D94848', borderColor: 'rgba(217,72,72,0.3)' }}
                    >
                      <Trash2 size={12} /> Tag löschen
                    </button>
                  )}
                  {workingStaff.length > 0 && (
                    <button onClick={() => openAddShift()} style={btnGhostSm}>
                      <Plus size={12} /> Schicht
                    </button>
                  )}
                </div>
              </div>

              {/* Timeline grid */}
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 860, display: 'grid', gridTemplateColumns: '190px 1fr' }}>
                  {/* Header row */}
                  <div style={{ background: '#FAFAFA', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: '1px solid var(--border)' }}>
                    Mitarbeiter
                  </div>
                  <div style={{ background: '#FAFAFA', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: `repeat(${HOURS}, 1fr)` }}>
                    {Array.from({ length: HOURS }, (_, i) => (
                      <div key={i} style={{ fontSize: 10.5, color: 'var(--text-tertiary)', padding: '10px 0 8px', textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                        {String(HOUR_START + i).padStart(2, '0')}
                      </div>
                    ))}
                  </div>

                  {/* Employee rows */}
                  {staff.map(member => {
                    const isW = workingIds.has(member.id)
                    const empShifts = dayShifts.filter(s => s.staff_id === member.id)
                    const color = colorFor(member.role_category)
                    const usuallyAvail = activeDay ? isUsuallyAvailable(member.available_days, activeDay.date) : true
                    const activeDow = activeDay ? dayOfWeek(activeDay.date) : -1

                    return (
                      <React.Fragment key={member.id}>
                        {/* Info cell */}
                        <div
                          onClick={() => toggleWorking(member.id)}
                          title={isW ? 'Klicken: aus Einsatz entfernen' : 'Klicken: zum Einsatz hinzufügen'}
                          style={{ padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fff', cursor: 'pointer' }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: isW ? color : '#D1D1D6', color: isW ? '#fff' : '#8E8E93', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                            {initials(member.name)}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isW ? 'var(--text)' : 'var(--text-tertiary)' }}>
                              {member.name}
                            </div>
                            <div style={{ fontSize: 11.5, color: isW ? 'var(--text-secondary)' : 'var(--text-tertiary)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span>{ROLES[member.role_category ?? '']?.label ?? '—'}</span>
                              {!usuallyAvail && <span style={{ color: '#FF9500', fontSize: 10.5, fontWeight: 600 }}>· übl. frei</span>}
                            </div>
                            {/* Available days chips */}
                            {member.available_days && member.available_days.length > 0 && (
                              <div style={{ display: 'flex', gap: 2, marginTop: 4, flexWrap: 'wrap' }}>
                                {WEEKDAYS.map(wd => {
                                  const avail = member.available_days!.includes(wd)
                                  const isToday = DOW_MAP[wd] === activeDow
                                  return (
                                    <span
                                      key={wd}
                                      style={{
                                        fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                                        background: avail ? (isToday ? color + '30' : 'rgba(0,0,0,0.06)') : 'transparent',
                                        color: avail ? (isToday ? color : 'var(--text-secondary)') : 'var(--text-tertiary)',
                                        border: `1px solid ${avail ? (isToday ? color + '50' : 'rgba(0,0,0,0.08)') : 'transparent'}`,
                                        opacity: avail ? 1 : 0.35,
                                      }}
                                    >
                                      {WEEKDAY_LABEL[wd]}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Track cell */}
                        {!isW ? (
                          <div
                            onClick={() => toggleWorking(member.id)}
                            style={{
                              borderBottom: '1px solid rgba(0,0,0,0.05)',
                              background: 'repeating-linear-gradient(135deg,#FAFAFA 0 8px,#F2F2F4 8px 16px)',
                              height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            }}
                          >
                            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                              Nicht im Einsatz · klicken zum Einteilen
                            </span>
                          </div>
                        ) : (
                          <div
                            onClick={() => openAddShift(member.id)}
                            style={{
                              position: 'relative',
                              borderBottom: '1px solid rgba(0,0,0,0.05)',
                              background: `repeating-linear-gradient(90deg,transparent 0,transparent calc((100%/${HOURS}) - 1px),rgba(0,0,0,0.04) calc((100%/${HOURS}) - 1px),rgba(0,0,0,0.04) calc(100%/${HOURS}))`,
                              height: 68, cursor: 'pointer',
                            }}
                          >
                            {empShifts.map(shift => {
                              const leftPct = ((shift.start_hour - HOUR_START) / HOURS) * 100
                              const widthPct = ((shift.end_hour - shift.start_hour) / HOURS) * 100
                              return (
                                <div
                                  key={shift.id}
                                  onClick={e => { e.stopPropagation(); openEditShift(shift) }}
                                  style={{
                                    position: 'absolute', top: 9, bottom: 9,
                                    left: `${leftPct}%`, width: `${widthPct}%`,
                                    minWidth: 24, borderRadius: 8, padding: '4px 10px',
                                    background: color, color: '#fff',
                                    fontSize: 11.5, fontWeight: 600,
                                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                    overflow: 'hidden', cursor: 'pointer',
                                  }}
                                >
                                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shift.task}</div>
                                  <div style={{ fontSize: 10.5, opacity: 0.9 }}>{fmtHour(shift.start_hour)} – {fmtHour(shift.end_hour)}</div>
                                  <button
                                    onClick={e => { e.stopPropagation(); deleteShift(shift.id) }}
                                    style={{ position: 'absolute', top: 3, right: 4, width: 16, height: 16, borderRadius: 4, background: 'rgba(255,255,255,0.25)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', padding: 0 }}
                                    title="Schicht löschen"
                                  >
                                    <X size={9} />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </React.Fragment>
                    )
                  })}

                  {/* Add row */}
                  <div style={{ gridColumn: '1 / -1', padding: '14px 20px', display: 'flex', justifyContent: 'center', borderTop: '1px solid rgba(0,0,0,0.06)', background: '#FCFCFC' }}>
                    <button
                      onClick={() => openAddShift()}
                      disabled={workingStaff.length === 0}
                      style={{
                        background: 'transparent', border: '1px dashed rgba(0,0,0,0.13)',
                        color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: 8,
                        fontSize: 13, fontWeight: 500, cursor: workingStaff.length > 0 ? 'pointer' : 'not-allowed',
                        display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit',
                        opacity: workingStaff.length > 0 ? 1 : 0.5,
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                    >
                      {workingStaff.length > 0 ? '+ Schicht hinzufügen' : 'Erst Mitarbeiter einteilen'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Role legend */}
              {usedRoles.size > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 20px', background: '#FAFAFA', borderTop: '1px solid var(--border)' }}>
                  {Array.from(usedRoles).map(r => (
                    <div key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: colorFor(r), flexShrink: 0 }} />
                      {ROLES[r]?.label ?? r}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Side panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Team list */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Team am Tag</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                    {workingStaff.length} im Einsatz · {staff.length - workingStaff.length} frei
                  </div>
                </div>
                {[...staff].sort((a, b) => {
                  const aw = workingIds.has(a.id) ? 0 : 1
                  const bw = workingIds.has(b.id) ? 0 : 1
                  return aw !== bw ? aw - bw : a.name.localeCompare(b.name)
                }).map(member => {
                  const isW = workingIds.has(member.id)
                  const color = colorFor(member.role_category)
                  return (
                    <div
                      key={member.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer' }}
                      onClick={() => toggleWorking(member.id)}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: isW ? color : '#D1D1D6', color: isW ? '#fff' : '#8E8E93', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        {initials(member.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{member.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 }}>{ROLES[member.role_category ?? '']?.label ?? '—'}</div>
                      </div>
                      {/* Toggle */}
                      <label
                        style={{ position: 'relative', width: 36, height: 20, flexShrink: 0, cursor: 'pointer' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <input type="checkbox" checked={isW} onChange={() => toggleWorking(member.id)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                        <span style={{ position: 'absolute', inset: 0, background: isW ? '#34C759' : '#D1D1D6', borderRadius: 999, transition: 'background 0.2s' }} />
                        <span style={{ position: 'absolute', top: 2, left: isW ? 18 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', pointerEvents: 'none' }} />
                      </label>
                    </div>
                  )
                })}
              </div>

              {/* Coverage heatmap */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Abdeckung nach Uhrzeit</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Mitarbeiter pro Stunde</div>
                </div>
                <div style={{ padding: '14px 18px 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${HOURS}, 1fr)`, height: 26, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {coverageCounts.map((n, i) => {
                      const intensity = n === 0 ? 0 : 0.15 + 0.85 * (n / maxCoverage)
                      const bg = n === 0 ? '#F2F2F4' : `rgba(29,29,31,${intensity.toFixed(2)})`
                      return (
                        <div key={i} style={{ background: bg, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.5)' : 'none', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={`${String(HOUR_START + i).padStart(2, '0')}:00 — ${n} Mitarbeiter`}>
                          {n > 0 && <span style={{ fontSize: 9.5, fontWeight: 700, color: intensity > 0.5 ? '#fff' : '#555' }}>{n}</span>}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${HOURS}, 1fr)`, marginTop: 4 }}>
                    {Array.from({ length: HOURS }, (_, i) => (
                      <span key={i} style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        {i % 2 === 0 ? String(HOUR_START + i).padStart(2, '0') : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Day modal ── */}
      {showDayModal && (
        <ModalOverlay onClose={() => !daySubmitting && setShowDayModal(false)}>
          <Modal>
            <ModalHead title={editingDayId ? 'Tag bearbeiten' : 'Tag hinzufügen'} onClose={() => setShowDayModal(false)} />
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
              <div>
                <label style={labelS}>Bezeichnung <span style={{ color: 'var(--accent)' }}>*</span></label>
                <input
                  value={dayLabel} onChange={e => setDayLabel(e.target.value)}
                  placeholder="z.B. Aufbau, Hochzeitstag, Abbau"
                  style={inputS}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-light)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.13)'; e.target.style.boxShadow = 'none' }}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelS}>Datum <span style={{ color: 'var(--accent)' }}>*</span></label>
                <input
                  type="date" value={dayDate} onChange={e => setDayDate(e.target.value)}
                  style={inputS}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-light)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.13)'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>
            <ModalFoot onCancel={() => setShowDayModal(false)} onSave={saveDay} saving={daySubmitting} />
          </Modal>
        </ModalOverlay>
      )}

      {/* ── Delete day confirm ── */}
      {deleteDayId && (
        <ModalOverlay onClose={() => setDeleteDayId(null)}>
          <Modal>
            <div style={{ padding: '28px 26px 22px' }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px' }}>Tag löschen?</p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                <strong>{deleteDayItem?.label}</strong> ({deleteDayItem ? fmtDate(deleteDayItem.date) : ''}) und alle Schichten für diesen Tag werden unwiderruflich gelöscht.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
                <button onClick={() => setDeleteDayId(null)} style={btnGhost}>Abbrechen</button>
                <button onClick={confirmDeleteDay} style={{ ...btnPrimary, background: '#D94848' }}>Löschen</button>
              </div>
            </div>
          </Modal>
        </ModalOverlay>
      )}

      {/* ── Shift modal ── */}
      {showShiftModal && (
        <ModalOverlay onClose={() => !shiftSubmitting && setShowShiftModal(false)}>
          <Modal>
            <ModalHead
              title={editingShiftId ? 'Schicht bearbeiten' : 'Schicht anlegen'}
              sub="Uhrzeit und Aufgabe für einen Mitarbeiter festlegen."
              onClose={() => setShowShiftModal(false)}
            />
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
              <div>
                <label style={labelS}>Mitarbeiter</label>
                <select value={shiftStaffId} onChange={e => setShiftStaffId(e.target.value)} style={{ ...inputS, appearance: 'auto' }}>
                  {workingStaff.map(m => (
                    <option key={m.id} value={m.id}>{m.name} · {ROLES[m.role_category ?? '']?.label ?? '—'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelS}>Aufgabe / Position</label>
                <input
                  value={shiftTask} onChange={e => setShiftTask(e.target.value)}
                  placeholder="z.B. Empfang, Bar-Shift, Kameracrew …"
                  style={inputS}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-light)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.13)'; e.target.style.boxShadow = 'none' }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelS}>Von</label>
                  <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} style={inputS} />
                </div>
                <div>
                  <label style={labelS}>Bis</label>
                  <input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} style={inputS} />
                </div>
              </div>
              {shiftError && (
                <p style={{ fontSize: 13, color: '#D94848', background: 'rgba(217,72,72,0.08)', padding: '8px 12px', borderRadius: 8, margin: 0 }}>
                  {shiftError}
                </p>
              )}
            </div>
            <ModalFoot onCancel={() => setShowShiftModal(false)} onSave={saveShift} saving={shiftSubmitting} />
          </Modal>
        </ModalOverlay>
      )}
    </div>
  )
}
