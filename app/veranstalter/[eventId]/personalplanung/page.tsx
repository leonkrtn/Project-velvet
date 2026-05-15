'use client'
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Pencil, Trash2, AlertTriangle, Check, ArrowLeftRight, MessageSquare, Send, Clock } from 'lucide-react'
import TimeInput from '@/components/ui/TimeInput'

// ── Constants ────────────────────────────────────────────────────────────────
const HOUR_START = 8
const HOUR_END = 28 // 04:00 next day
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
  hourly_rate: number | null
  auth_user_id: string | null
}

type ShiftTimeLog = {
  staff_id: string
  actual_start: string
  actual_end: string | null
}

type ChatMessage = {
  id: string
  conversation_id: string
  sender_id: string | null
  content: string
  created_at: string
  sender?: { name: string } | null
}

type EventInfo = {
  title: string
  date: string | null
}

type TimelineEntry = {
  id: string
  event_id: string
  title: string
  start_minutes: number
  end_minutes: number | null
  location: string | null
  category: string | null
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
  backup_staff_id: string | null
}

type Swap = {
  id: string
  shift_id: string
  from_staff_id: string
  to_staff_id: string | null
  status: string
  notes: string | null
}

type DragState = {
  shiftId: string
  type: 'move' | 'resize-left' | 'resize-right'
  startX: number
  origStart: number
  origEnd: number
  containerWidth: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const TIMELINE_COLORS: Record<string, string> = {
  Zeremonie: '#7C3AED',
  Empfang:   '#2563EB',
  Feier:     '#D97706',
  Logistik:  '#6B7280',
}

function minutesToTime(m: number): string {
  const hh = Math.floor(m / 60)
  const mm = m % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function tlColor(cat: string | null | undefined): string {
  return TIMELINE_COLORS[cat ?? ''] ?? '#6B7280'
}

function fmtHour(h: number): string {
  const norm = h >= 24 ? h - 24 : h
  const hh = Math.floor(norm)
  const mm = Math.round((norm - hh) * 60)
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
      <button onClick={onSave} disabled={saving} style={{ fontSize: 13, fontWeight: 500, padding: '8px 18px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
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
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null)
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([])

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
  const [shiftBackupId, setShiftBackupId] = useState('')
  const [shiftSubmitting, setShiftSubmitting] = useState(false)
  const [shiftError, setShiftError] = useState('')

  // Swap requests
  const [swaps, setSwaps] = useState<Swap[]>([])
  const [showSwapsPanel, setShowSwapsPanel] = useState(false)

  // Monthly time logs
  const [timeLogs, setTimeLogs] = useState<ShiftTimeLog[]>([])

  // Staff chat panel
  const [activeChatStaff, setActiveChatStaff] = useState<StaffMember | null>(null)
  const [chatConvId, setChatConvId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = React.useRef<HTMLDivElement>(null)
  const chatConvIdRef = React.useRef<string | null>(null)

  const [hoveredShiftId, setHoveredShiftId] = useState<string | null>(null)
  const [showAblaufplan, setShowAblaufplan] = useState(true)

  // Drag-to-move / resize
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragMovedRef = React.useRef(false)
  const shiftsRef = React.useRef<Shift[]>([])
  React.useEffect(() => { shiftsRef.current = shifts }, [shifts])

  const inputS: React.CSSProperties = {
    width: '100%', padding: '9px 11px', fontSize: 13.5,
    border: '1px solid rgba(0,0,0,0.13)', borderRadius: 8,
    background: '#fff', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: 'var(--text)',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }
  const labelS: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }
  const btnPrimary: React.CSSProperties = { fontSize: 13, fontWeight: 500, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', whiteSpace: 'nowrap' }
  const btnGhost: React.CSSProperties = { fontSize: 13, fontWeight: 500, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(0,0,0,0.13)', background: '#fff', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', whiteSpace: 'nowrap' }
  const btnGhostSm: React.CSSProperties = { fontSize: 12, fontWeight: 500, padding: '6px 10px', borderRadius: 7, cursor: 'pointer', border: '1px solid rgba(0,0,0,0.13)', background: '#fff', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', whiteSpace: 'nowrap' }

  // ── Drag effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!drag) return
    const cursor = drag.type === 'move' ? 'grabbing' : drag.type === 'resize-left' ? 'w-resize' : 'e-resize'
    document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'

    function onMouseMove(e: MouseEvent) {
      dragMovedRef.current = true
      const deltaHours = ((e.clientX - drag!.startX) / drag!.containerWidth) * HOURS
      setShifts(prev => prev.map(s => {
        if (s.id !== drag!.shiftId) return s
        const dur = drag!.origEnd - drag!.origStart
        if (drag!.type === 'move') {
          const snapped = Math.round((drag!.origStart + deltaHours) * 4) / 4
          const clamped = Math.max(HOUR_START, Math.min(HOUR_END - dur, snapped))
          return { ...s, start_hour: clamped, end_hour: clamped + dur }
        }
        if (drag!.type === 'resize-left') {
          const snapped = Math.round((drag!.origStart + deltaHours) * 4) / 4
          return { ...s, start_hour: Math.max(HOUR_START, Math.min(drag!.origEnd - 0.25, snapped)) }
        }
        const snapped = Math.round((drag!.origEnd + deltaHours) * 4) / 4
        return { ...s, end_hour: Math.min(HOUR_END, Math.max(drag!.origStart + 0.25, snapped)) }
      }))
    }

    async function onMouseUp() {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (dragMovedRef.current) {
        const s = shiftsRef.current.find(s => s.id === drag!.shiftId)
        if (s) await supabase.from('personalplanung_shifts').update({ start_hour: s.start_hour, end_hour: s.end_hour }).eq('id', s.id)
      }
      setDrag(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [drag])

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadData() }, [eventId])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: staffRows }, { data: dayRows }, { data: eventRow }, { data: tlRows }] = await Promise.all([
        supabase.from('organizer_staff').select('id,name,role_category,available_days,phone,hourly_rate,auth_user_id').eq('organizer_id', user.id).order('name'),
        supabase.from('personalplanung_days').select('*').eq('event_id', eventId).order('sort_order'),
        supabase.from('events').select('title,date').eq('id', eventId).single(),
        supabase.from('timeline_entries').select('*').eq('event_id', eventId).order('start_minutes'),
      ])
      setEventInfo(eventRow ? { title: (eventRow as { title: string; date: string | null }).title, date: (eventRow as { title: string; date: string | null }).date } : null)
      setTimelineEntries((tlRows ?? []) as TimelineEntry[])

      const staffList = (staffRows ?? []) as StaffMember[]
      const dayList = (dayRows ?? []) as PlanDay[]
      setStaff(staffList)
      setDays(dayList)

      if (dayList.length > 0) {
        const dayIds = dayList.map(d => d.id)
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
        const [{ data: aRows }, { data: sRows }, { data: swapRows }, { data: logRows }] = await Promise.all([
          supabase.from('personalplanung_assignments').select('*').in('day_id', dayIds),
          supabase.from('personalplanung_shifts').select('*').in('day_id', dayIds).order('start_hour'),
          supabase.from('personalplanung_shift_swaps').select('*').eq('event_id', eventId).in('status', ['pending', 'accepted']),
          supabase.from('shift_time_logs').select('staff_id,actual_start,actual_end').eq('event_id', eventId).not('actual_end', 'is', null).gte('actual_start', monthStart).lt('actual_start', monthEnd),
        ])
        setAssignments((aRows ?? []) as Assignment[])
        setShifts((sRows ?? []) as Shift[])
        setSwaps((swapRows ?? []) as typeof swaps)
        setTimeLogs((logRows ?? []) as ShiftTimeLog[])
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
  const totalCost = dayShifts
    .filter(s => workingIds.has(s.staff_id))
    .reduce((sum, s) => {
      const member = staff.find(m => m.id === s.staff_id)
      return sum + (s.end_hour - s.start_hour) * (member?.hourly_rate ?? 0)
    }, 0)
  const rolesCovered = new Set(workingStaff.map(s => s.role_category).filter(Boolean)).size
  const coverageCounts = Array.from({ length: HOURS }, (_, i) => {
    const h = HOUR_START + i
    return dayShifts.filter(s => workingIds.has(s.staff_id) && s.start_hour <= h && s.end_hour > h).length
  })
  const maxCoverage = Math.max(1, ...coverageCounts)
  const usedRoles = new Set(workingStaff.map(s => s.role_category).filter(Boolean) as string[])
  const deleteDayItem = days.find(d => d.id === deleteDayId)

  // Monthly hours per staff member (from actual time logs)
  const monthlyHoursMap = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const log of timeLogs) {
      if (!log.actual_end) continue
      const h = (new Date(log.actual_end).getTime() - new Date(log.actual_start).getTime()) / 3600000
      map.set(log.staff_id, (map.get(log.staff_id) ?? 0) + h)
    }
    return map
  }, [timeLogs])

  const currentMonthLabel = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const acceptedSwaps = swaps.filter(s => s.status === 'accepted')

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
    setShiftBackupId('')
    setShiftError('')
    setShowShiftModal(true)
  }

  function openEditShift(shift: Shift) {
    setEditingShiftId(shift.id)
    setShiftStaffId(shift.staff_id)
    setShiftTask(shift.task)
    setShiftStart(fmtHour(shift.start_hour))
    setShiftEnd(fmtHour(shift.end_hour))
    setShiftBackupId(shift.backup_staff_id ?? '')
    setShiftError('')
    setShowShiftModal(true)
  }

  async function saveShift() {
    const start = parseTime(shiftStart)
    let end = parseTime(shiftEnd)
    if (end < start) end += 24
    if (end <= start) { setShiftError('Endzeit muss nach Startzeit liegen.'); return }
    setShiftSubmitting(true); setShiftError('')
    try {
      const payload = { day_id: activeDayId!, staff_id: shiftStaffId, task: shiftTask.trim() || 'Schicht', start_hour: start, end_hour: end, backup_staff_id: shiftBackupId || null }
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

  async function approveSwap(swapId: string) {
    const swap = swaps.find(s => s.id === swapId)
    const res = await fetch(`/api/staff/swaps/${swapId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    if (res.ok) {
      setSwaps(prev => prev.filter(s => s.id !== swapId))
      // Reflect staff change in shift state without full reload
      if (swap?.to_staff_id) {
        setShifts(prev => prev.map(s => s.id === swap.shift_id ? { ...s, staff_id: swap.to_staff_id! } : s))
      }
    }
  }

  async function rejectSwap(swapId: string) {
    const res = await fetch(`/api/staff/swaps/${swapId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    })
    if (res.ok) setSwaps(prev => prev.filter(s => s.id !== swapId))
  }

  // ── Staff chat ────────────────────────────────────────────────────────────
  async function openStaffChat(member: StaffMember) {
    if (!member.auth_user_id) return
    setActiveChatStaff(member)
    setChatConvId(null)
    setChatMessages([])
    setChatLoading(true)
    try {
      const res = await fetch('/api/staff/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, staffId: member.id }),
      })
      if (!res.ok) { setChatLoading(false); return }
      const { conversationId } = await res.json()
      chatConvIdRef.current = conversationId
      setChatConvId(conversationId)

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at, sender:profiles(name)')
        .eq('conversation_id', conversationId)
        .order('created_at')
      setChatMessages((msgs ?? []) as unknown as ChatMessage[])

      // Realtime subscription
      supabase.channel(`chat-${conversationId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          async payload => {
            const newMsg = payload.new as ChatMessage
            const { data: profile } = await supabase.from('profiles').select('name').eq('id', newMsg.sender_id).maybeSingle()
            setChatMessages(prev => [...prev, { ...newMsg, sender: profile }])
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          })
        .subscribe()
    } finally {
      setChatLoading(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView(), 100)
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || !chatConvId || chatSending) return
    const content = chatInput.trim()
    setChatInput('')
    setChatSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('messages').insert({
        conversation_id: chatConvId,
        event_id: eventId,
        sender_id: user?.id,
        content,
      })
    } finally {
      setChatSending(false)
    }
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
          {swaps.length > 0 && (
            <button
              onClick={() => setShowSwapsPanel(true)}
              style={{
                ...btnGhost,
                color: swaps.some(s => s.status === 'accepted') ? '#D97706' : 'var(--text)',
                borderColor: swaps.some(s => s.status === 'accepted') ? '#FCD34D' : 'rgba(0,0,0,0.13)',
                background: swaps.some(s => s.status === 'accepted') ? '#FFFBEB' : '#fff',
              }}
            >
              <ArrowLeftRight size={13} />
              {swaps.length} Tausch{swaps.length > 1 ? 'anfragen' : 'anfrage'}
            </button>
          )}
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
                {...(d.id === activeDayId ? { 'data-sel': '' } : {})}
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
          <div className="pp-stats-grid">
            {([
              { label: 'Im Einsatz', value: workingStaff.length, colorVal: '#1B5E20' },
              { label: 'Bereiche', value: rolesCovered, colorVal: undefined },
              { label: 'Geplante Stunden', value: totalHours.toFixed(1), unit: 'h', colorVal: undefined },
              { label: 'Gesamtkosten', value: totalCost.toFixed(2), unit: '€', colorVal: totalCost > 0 ? '#1B5E20' : undefined },
            ] as { label: string; value: string | number; unit?: string; colorVal?: string }[]).map((c, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: c.colorVal ?? 'var(--text)' }}>
                  {c.value}
                  {c.unit && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 2 }}>{c.unit}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Content grid */}
          <div className="pp-content-grid">

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
                        {String((HOUR_START + i) % 24).padStart(2, '0')}
                      </div>
                    ))}
                  </div>

                  {/* Ablaufplan row — only when active day = event date */}
                  {showAblaufplan && activeDay && eventInfo?.date && activeDay.date === eventInfo.date && timelineEntries.length > 0 && (
                    <React.Fragment>
                      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#F8F4FF', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Ablaufplan</span>
                      </div>
                      <div style={{
                        position: 'relative',
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                        background: '#F8F4FF',
                        height: 44,
                      }}>
                        {timelineEntries.map((entry, idx) => {
                          const startH = entry.start_minutes / 60
                          const nextStartMinutes = timelineEntries[idx + 1]?.start_minutes
                          const endH = entry.end_minutes != null
                            ? entry.end_minutes / 60
                            : nextStartMinutes != null ? nextStartMinutes / 60 : startH + 1
                          const leftPct = Math.max(0, ((startH - HOUR_START) / HOURS) * 100)
                          const widthPct = Math.max(0.5, ((endH - startH) / HOURS) * 100)
                          const col = tlColor(entry.category)
                          return (
                            <div
                              key={entry.id}
                              title={`${entry.title}${entry.location ? ' · ' + entry.location : ''} (${minutesToTime(entry.start_minutes)}${entry.end_minutes != null ? '–' + minutesToTime(entry.end_minutes) : ''})`}
                              style={{
                                position: 'absolute', top: 7, bottom: 7,
                                left: `${leftPct}%`, width: `${widthPct}%`,
                                minWidth: 8, borderRadius: 6,
                                background: col,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                              }}
                            />
                          )
                        })}
                      </div>
                    </React.Fragment>
                  )}

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
                          </div>
                        </div>

                        {/* Track cell */}
                        {!isW ? (
                          <div
                            onClick={() => toggleWorking(member.id)}
                            style={{
                              borderBottom: '1px solid rgba(0,0,0,0.05)',
                              background: 'repeating-linear-gradient(135deg,#FAFAFA 0 8px,#F2F2F4 8px 16px)',
                              minHeight: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            }}
                          >
                            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                              Nicht im Einsatz · klicken zum Einteilen
                            </span>
                          </div>
                        ) : (
                          <div
                            data-track
                            onClick={() => { if (!dragMovedRef.current) openAddShift(member.id) }}
                            style={{
                              position: 'relative',
                              borderBottom: '1px solid rgba(0,0,0,0.05)',
                              background: '#fff',
                              minHeight: 68, cursor: 'pointer',
                            }}
                          >
                            {/* Grid lines aligned to header */}
                            <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${HOURS}, 1fr)`, pointerEvents: 'none' }}>
                              {Array.from({ length: HOURS }, (_, i) => (
                                <div key={i} style={{ borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.04)' : 'none' }} />
                              ))}
                            </div>
                            {empShifts.map(shift => {
                              const leftPct = ((shift.start_hour - HOUR_START) / HOURS) * 100
                              const widthPct = ((shift.end_hour - shift.start_hour) / HOURS) * 100
                              const isActive = drag?.shiftId === shift.id

                              function startDrag(type: DragState['type'], e: React.MouseEvent) {
                                e.stopPropagation()
                                dragMovedRef.current = false
                                const rect = (e.currentTarget.closest('[data-track]') as HTMLElement).getBoundingClientRect()
                                setDrag({ shiftId: shift.id, type, startX: e.clientX, origStart: shift.start_hour, origEnd: shift.end_hour, containerWidth: rect.width })
                              }

                              return (
                                <div
                                  key={shift.id}
                                  onMouseDown={e => startDrag('move', e)}
                                  onClick={e => { e.stopPropagation(); if (!dragMovedRef.current) openEditShift(shift) }}
                                  onMouseEnter={() => setHoveredShiftId(shift.id)}
                                  onMouseLeave={() => setHoveredShiftId(null)}
                                  style={{
                                    position: 'absolute', top: 9, bottom: 9,
                                    left: `${leftPct}%`, width: `${widthPct}%`,
                                    minWidth: 28, borderRadius: 8,
                                    background: color, color: '#fff',
                                    fontSize: 11.5, fontWeight: 600,
                                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                                    boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.28)' : '0 1px 3px rgba(0,0,0,0.15)',
                                    overflow: 'hidden',
                                    cursor: isActive ? 'grabbing' : 'grab',
                                    userSelect: 'none',
                                    zIndex: isActive ? 10 : 1,
                                    transform: isActive ? 'scaleY(1.04)' : 'none',
                                    transition: isActive ? 'none' : 'box-shadow 0.15s',
                                  }}
                                >
                                  {/* Left resize handle */}
                                  <div
                                    onMouseDown={e => startDrag('resize-left', e)}
                                    style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 10, cursor: 'w-resize', zIndex: 2 }}
                                  />
                                  {/* Content */}
                                  <div style={{ padding: '0 10px', overflow: 'hidden' }}>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shift.task}</div>
                                    <div style={{ fontSize: 10.5, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      {fmtHour(shift.start_hour)} – {fmtHour(shift.end_hour)}
                                      {(shift.end_hour - shift.start_hour) > 6 && (
                                        <span title="Über 6 h – Pause planen!">
                                          <AlertTriangle size={9} style={{ color: '#FCD34D', flexShrink: 0 }} />
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {/* Right resize handle */}
                                  <div
                                    onMouseDown={e => startDrag('resize-right', e)}
                                    style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 10, cursor: 'e-resize', zIndex: 2 }}
                                  />
                                  <button
                                    onClick={e => { e.stopPropagation(); deleteShift(shift.id) }}
                                    style={{
                                      position: 'absolute', top: 5, right: 5,
                                      width: 16, height: 16, borderRadius: 4,
                                      background: 'rgba(255,255,255,0.25)', color: '#fff',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      cursor: 'pointer', border: 'none', padding: 0, zIndex: 3,
                                      opacity: hoveredShiftId === shift.id ? 1 : 0,
                                      pointerEvents: hoveredShiftId === shift.id ? 'auto' : 'none',
                                      transition: 'opacity 0.1s',
                                    }}
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
                        {i % 2 === 0 ? String((HOUR_START + i) % 24).padStart(2, '0') : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {/* Ablaufplan panel */}
              {timelineEntries.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>Ablaufplan</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                        {eventInfo?.date
                          ? new Date(eventInfo.date + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
                          : 'Hochzeitsprogramm'}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAblaufplan(v => !v)}
                      title={showAblaufplan ? 'Im Schichtplan ausblenden' : 'Im Schichtplan anzeigen'}
                      style={{
                        flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 6,
                        cursor: 'pointer', fontFamily: 'inherit', border: '1px solid',
                        borderColor: showAblaufplan ? '#7C3AED44' : 'rgba(0,0,0,0.1)',
                        background: showAblaufplan ? '#F3EEFF' : '#F5F5F7',
                        color: showAblaufplan ? '#7C3AED' : 'var(--text-secondary)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {showAblaufplan ? 'Eingeblendet' : 'Ausgeblendet'}
                    </button>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {timelineEntries.map((entry, i) => {
                      const col = tlColor(entry.category)
                      return (
                        <div
                          key={entry.id}
                          style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: i < timelineEntries.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', alignItems: 'flex-start' }}
                        >
                          <div style={{ width: 4, borderRadius: 4, background: col, alignSelf: 'stretch', flexShrink: 0, minHeight: 36 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{entry.title}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                              {minutesToTime(entry.start_minutes)}
                              {entry.end_minutes != null ? ` – ${minutesToTime(entry.end_minutes)}` : ''}
                              {entry.location && <span style={{ marginLeft: 6, opacity: 0.7 }}>· {entry.location}</span>}
                            </div>
                          </div>
                          {entry.category && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: col, background: col + '18', padding: '2px 7px', borderRadius: 5, flexShrink: 0, alignSelf: 'center' }}>
                              {entry.category}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ── Monatsübersicht ── */}
          <div style={{ marginTop: 24, background: '#fff', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Clock size={14} style={{ color: 'var(--text-secondary)' }} /> Monatsübersicht · {currentMonthLabel}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Tatsächlich geleistete Stunden (via Einstempeln)</div>
              </div>
            </div>
            <div>
              {staff.map(member => {
                const hours = monthlyHoursMap.get(member.id) ?? 0
                const cost = hours * (member.hourly_rate ?? 0)
                const color = colorFor(member.role_category)
                return (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {initials(member.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{member.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{ROLES[member.role_category ?? '']?.label ?? '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: hours > 0 ? 'var(--text)' : 'var(--text-tertiary)' }}>
                        {hours > 0 ? hours.toFixed(1).replace('.0', '') + ' h' : '—'}
                      </div>
                      {member.hourly_rate && hours > 0 && (
                        <div style={{ fontSize: 11.5, color: '#16A34A', fontWeight: 600 }}>{cost.toFixed(2)} €</div>
                      )}
                    </div>
                    <button
                      onClick={() => member.auth_user_id ? openStaffChat(member) : undefined}
                      disabled={!member.auth_user_id}
                      title={member.auth_user_id ? `Chat mit ${member.name}` : 'Mitarbeiter hat noch kein Login'}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: activeChatStaff?.id === member.id ? 'var(--accent)' : 'none', color: activeChatStaff?.id === member.id ? '#fff' : 'var(--text-secondary)', border: '1px solid', borderColor: activeChatStaff?.id === member.id ? 'var(--accent)' : 'rgba(0,0,0,0.13)', borderRadius: 7, cursor: member.auth_user_id ? 'pointer' : 'not-allowed', fontSize: 12, fontFamily: 'inherit', flexShrink: 0, opacity: member.auth_user_id ? 1 : 0.4, transition: 'all 0.15s' }}
                    >
                      <MessageSquare size={12} /> Chat
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Tausch-Anfragen (accepted = beide einig, Veranstalter muss genehmigen) ── */}
          {acceptedSwaps.length > 0 && (
            <div style={{ marginTop: 16, background: '#FFFBEB', borderRadius: 14, border: '1px solid #FCD34D', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowLeftRight size={14} style={{ color: '#D97706' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#92400E' }}>Tausch-Anfragen · Genehmigung erforderlich</span>
                <span style={{ fontSize: 12, color: '#D97706', marginLeft: 2 }}>({acceptedSwaps.length})</span>
              </div>
              {acceptedSwaps.map(swap => {
                const shift = shifts.find(s => s.id === swap.shift_id)
                const fromStaff = staff.find(s => s.id === swap.from_staff_id)
                const toStaff = swap.to_staff_id ? staff.find(s => s.id === swap.to_staff_id) : null
                return (
                  <div key={swap.id} style={{ padding: '12px 18px', borderBottom: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {fromStaff?.name ?? '—'} → {toStaff?.name ?? '?'}
                      </div>
                      {shift && (
                        <div style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>
                          {shift.task} · {fmtHour(shift.start_hour)}–{fmtHour(shift.end_hour)}
                        </div>
                      )}
                      {swap.notes && <div style={{ fontSize: 11.5, color: '#A16207', marginTop: 2, fontStyle: 'italic' }}>{swap.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => approveSwap(swap.id)} style={{ ...btnGhostSm, color: '#16A34A', borderColor: 'rgba(22,163,74,0.3)', background: '#F0FDF4', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Check size={12} /> Genehmigen
                      </button>
                      <button onClick={() => rejectSwap(swap.id)} style={{ ...btnGhostSm, color: '#D94848', borderColor: 'rgba(217,72,72,0.3)', background: '#FEF2F2' }}>
                        Ablehnen
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Staff Chat Panel ── */}
          {activeChatStaff && (
            <div style={{ marginTop: 16, background: '#fff', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 460 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: colorFor(activeChatStaff.role_category), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {initials(activeChatStaff.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Chat · {activeChatStaff.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ROLES[activeChatStaff.role_category ?? '']?.label ?? '—'}</div>
                </div>
                <button onClick={() => { setActiveChatStaff(null); setChatConvId(null); setChatMessages([]) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 7, background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 320, background: '#FAFAFA' }}>
                {chatLoading ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 40 }}>Lade Chat …</p>
                ) : chatMessages.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 40 }}>Noch keine Nachrichten. Sende eine Nachricht an {activeChatStaff.name}.</p>
                ) : chatMessages.map(msg => {
                  const isMine = msg.sender_id !== activeChatStaff.auth_user_id
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: 2 }}>
                      <div style={{ maxWidth: '72%', padding: '9px 13px', borderRadius: isMine ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: isMine ? 'var(--text)' : '#fff', color: isMine ? '#fff' : 'var(--text)', fontSize: 13.5, lineHeight: 1.4, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                        {msg.content}
                      </div>
                      <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                        {msg.sender?.name ?? '—'} · {new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                  placeholder={`Nachricht an ${activeChatStaff.name} …`}
                  style={{ flex: 1, padding: '9px 12px', fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', outline: 'none', background: '#fff', color: 'var(--text)' }}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || chatSending || !chatConvId}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 9, border: 'none', background: chatInput.trim() && chatConvId ? 'var(--text)' : '#D1D5DB', color: '#fff', cursor: chatInput.trim() && chatConvId ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'background 0.15s' }}
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Day modal ── */}
      {showDayModal && (
        <ModalOverlay onClose={() => !daySubmitting && setShowDayModal(false)}>
          <Modal>
            <ModalHead title={editingDayId ? 'Tag bearbeiten' : 'Tag hinzufügen'} onClose={() => setShowDayModal(false)} />
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
              {/* Quick-fill from event */}
              {!editingDayId && eventInfo?.date && (
                <button
                  type="button"
                  onClick={() => { setDayLabel('Hochzeitstag'); setDayDate(eventInfo.date ?? '') }}
                  style={{ ...btnGhost, justifyContent: 'center', fontSize: 12.5, padding: '9px 14px', borderStyle: 'dashed', color: '#7C3AED', borderColor: '#7C3AED55', background: '#F8F4FF' }}
                >
                  ✨ Vom Event übernehmen — {new Date(eventInfo.date + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                </button>
              )}
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

      {/* ── Swap requests panel ── */}
      {showSwapsPanel && (
        <ModalOverlay onClose={() => setShowSwapsPanel(false)}>
          <Modal>
            <ModalHead title="Tausch-Anfragen" sub="Offene Anfragen deiner Mitarbeiter" onClose={() => setShowSwapsPanel(false)} />
            <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
              {swaps.length === 0 ? (
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 24px' }}>
                  Keine offenen Anfragen.
                </p>
              ) : swaps.map(swap => {
                const shift = shifts.find(s => s.id === swap.shift_id)
                const fromStaff = staff.find(s => s.id === swap.from_staff_id)
                const toStaff = swap.to_staff_id ? staff.find(s => s.id === swap.to_staff_id) : null
                const canApprove = swap.status === 'accepted'
                return (
                  <div key={swap.id} style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          {fromStaff?.name ?? '—'}
                          {toStaff && <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> → {toStaff.name}</span>}
                        </div>
                        {shift && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {shift.task} · {fmtHour(shift.start_hour)}–{fmtHour(shift.end_hour)}
                          </div>
                        )}
                        {swap.notes && (
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3, fontStyle: 'italic' }}>{swap.notes}</div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                        background: swap.status === 'accepted' ? '#D97706' : '#6B7280',
                        color: '#fff',
                      }}>
                        {swap.status === 'accepted' ? 'Beide einig' : toStaff ? 'Wartet auf Zustimmung' : 'Offen'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {canApprove && (
                        <button
                          onClick={() => approveSwap(swap.id)}
                          style={{ ...btnGhostSm, color: '#16A34A', borderColor: 'rgba(22,163,74,0.3)', background: '#F0FDF4', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <Check size={12} /> Genehmigen
                        </button>
                      )}
                      <button
                        onClick={() => rejectSwap(swap.id)}
                        style={{ ...btnGhostSm, color: '#D94848', borderColor: 'rgba(217,72,72,0.3)', background: '#FEF2F2' }}
                      >
                        Ablehnen
                      </button>
                    </div>
                  </div>
                )
              })}
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
                  <TimeInput value={shiftStart} onChange={setShiftStart} style={inputS} />
                </div>
                <div>
                  <label style={labelS}>Bis</label>
                  <TimeInput value={shiftEnd} onChange={setShiftEnd} style={inputS} />
                </div>
              </div>
              <div>
                <label style={labelS}>Vertreter (optional)</label>
                <select value={shiftBackupId} onChange={e => setShiftBackupId(e.target.value)} style={{ ...inputS, appearance: 'auto' }}>
                  <option value="">— Kein Vertreter —</option>
                  {workingStaff.filter(m => m.id !== shiftStaffId).map(m => (
                    <option key={m.id} value={m.id}>{m.name} · {ROLES[m.role_category ?? '']?.label ?? '—'}</option>
                  ))}
                </select>
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
