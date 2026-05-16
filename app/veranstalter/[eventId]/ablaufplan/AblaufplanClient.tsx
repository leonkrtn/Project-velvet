'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Settings, X, ChevronDown, ChevronUp } from 'lucide-react'
import DayCalendar, { type CalendarEntry } from '@/components/ablaufplan/DayCalendar'
import EventModal, {
  type AblaufplanDay,
  type TimelineEntry,
  type ChecklistItem,
  type Member,
  type StaffRow,
  type VendorRow,
} from '@/components/ablaufplan/EventModal'

// ─── Default day used if no rows exist yet ────────────────────────────────────
function defaultDay(eventId: string): AblaufplanDay {
  return { id: '', event_id: eventId, day_index: 0, name: 'Tag 1', start_hour: 7, end_hour: 25 }
}

// ─── Day-settings popover ─────────────────────────────────────────────────────
interface DayPopoverProps {
  day: AblaufplanDay
  canDelete: boolean
  onUpdate: (patch: Partial<AblaufplanDay>) => void
  onDelete: () => void
  onClose: () => void
}
function DaySettingsPopover({ day, canDelete, onUpdate, onDelete, onClose }: DayPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: '100%', left: 0, zIndex: 300, marginTop: 6,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '16px 18px', width: 260,
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 5 }}>
          Tagesname
        </label>
        <input
          autoFocus
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          value={day.name}
          onChange={e => onUpdate({ name: e.target.value })}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 5 }}>
            Start
          </label>
          <input
            type="number" min={0} max={23}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            value={day.start_hour}
            onChange={e => onUpdate({ start_hour: parseInt(e.target.value) || 0 })}
          />
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>Stunde (0–23)</div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 5 }}>
            Ende
          </label>
          <input
            type="number" min={1} max={30}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            value={day.end_hour}
            onChange={e => onUpdate({ end_hour: parseInt(e.target.value) || 25 })}
          />
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>z.B. 25 = 01:00 +1</div>
        </div>
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          style={{ width: '100%', padding: '7px', background: 'none', border: '1px solid #FF3B30', borderRadius: 'var(--radius-sm)', color: '#FF3B30', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Tag löschen
        </button>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  eventId: string
  initialEntries: TimelineEntry[]
  initialDays: AblaufplanDay[]
  members: Member[]
  staff: StaffRow[]
  vendors: VendorRow[]
  role?: 'veranstalter' | 'brautpaar' | 'dienstleister'
  readOnly?: boolean
}

// ─── Main orchestrator ────────────────────────────────────────────────────────
export default function AblaufplanClient({
  eventId,
  initialEntries,
  initialDays,
  members,
  staff: initialStaff,
  vendors,
  role = 'veranstalter',
  readOnly = false,
}: Props) {
  const supabase = createClient()

  // ── State ──────────────────────────────────────────────────────────────────
  const [days, setDays] = useState<AblaufplanDay[]>(
    initialDays.length > 0 ? initialDays : [defaultDay(eventId)]
  )
  const [activeDay, setActiveDay] = useState(0)
  const [entries,   setEntries]   = useState<TimelineEntry[]>(
    initialEntries.map(e => ({
      ...e,
      assigned_staff:   e.assigned_staff   ?? [],
      assigned_vendors: e.assigned_vendors ?? [],
      assigned_members: e.assigned_members ?? [],
      checklist:        e.checklist        ?? [],
    }))
  )
  const [staff, setStaff] = useState<StaffRow[]>(initialStaff)

  // Modal: null = closed
  type ModalState = { entry: TimelineEntry | null; prefill?: { startMinutes: number; duration: number } }
  const [modal, setModal] = useState<ModalState | null>(null)

  // Popover: which day_index's gear is open
  const [popover, setPopover] = useState<number | null>(null)

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  function showToast(msg: string, ok = true) {
    clearTimeout(toastTimer.current)
    setToast({ msg, ok })
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }

  // ── Load staff on mount ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('organizer_staff').select('id, name, role_category').eq('organizer_id', user.id).order('name')
        .then(({ data }) => { if (data) setStaff(data) })
    })
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentDay = days.find(d => d.day_index === activeDay) ?? days[0]
  const dayEntries = entries.filter(e => e.day_index === activeDay)
  const canManageDays = !readOnly && role === 'veranstalter'

  // ── Day management ─────────────────────────────────────────────────────────
  async function persistDay(day: AblaufplanDay): Promise<AblaufplanDay> {
    if (!day.id) {
      // Upsert to avoid 409 if row already exists (unique constraint event_id+day_index)
      const { data, error } = await supabase.from('ablaufplan_days').upsert({
        event_id: eventId, day_index: day.day_index,
        name: day.name, start_hour: day.start_hour, end_hour: day.end_hour,
      }, { onConflict: 'event_id,day_index' }).select().single()
      if (error) throw error
      return data as AblaufplanDay
    } else {
      const { data, error } = await supabase.from('ablaufplan_days').update({
        name: day.name, start_hour: day.start_hour, end_hour: day.end_hour,
      }).eq('id', day.id).select().single()
      if (error) throw error
      return data as AblaufplanDay
    }
  }

  async function addDay() {
    const nextIndex = Math.max(...days.map(d => d.day_index)) + 1
    const newDay = defaultDay(eventId)
    newDay.day_index = nextIndex
    newDay.name = `Tag ${nextIndex + 1}`
    // First ensure day 0 exists in DB (if it was the defaultDay placeholder)
    const updatedDays = [...days]
    for (let i = 0; i < updatedDays.length; i++) {
      if (!updatedDays[i].id) {
        try {
          updatedDays[i] = await persistDay(updatedDays[i])
        } catch { /* ignore */ }
      }
    }
    const saved = await persistDay(newDay).catch(() => newDay)
    setDays([...updatedDays, { ...newDay, id: saved.id ?? '' }])
    setActiveDay(nextIndex)
  }

  async function updateDay(day_index: number, patch: Partial<AblaufplanDay>) {
    setDays(prev => prev.map(d => d.day_index === day_index ? { ...d, ...patch } : d))
    const day = days.find(d => d.day_index === day_index)
    if (!day) return
    const merged = { ...day, ...patch }
    try { await persistDay(merged) } catch { showToast('Fehler beim Speichern', false) }
  }

  async function deleteDay(day_index: number) {
    if (days.length <= 1) return
    const day = days.find(d => d.day_index === day_index)
    if (day?.id) {
      await supabase.from('ablaufplan_days').delete().eq('id', day.id)
    }
    // Reassign entries of this day to day 0
    const entriesToReassign = entries.filter(e => e.day_index === day_index)
    for (const e of entriesToReassign) {
      await supabase.from('timeline_entries').update({ day_index: 0 }).eq('id', e.id)
    }
    setEntries(prev => prev.map(e => e.day_index === day_index ? { ...e, day_index: 0 } : e))
    setDays(prev => prev.filter(d => d.day_index !== day_index))
    if (activeDay === day_index) setActiveDay(0)
    setPopover(null)
  }

  // ── Entry management ───────────────────────────────────────────────────────
  async function handleSave(data: Partial<TimelineEntry> & { event_id: string }) {
    const isNew = !data.id
    if (isNew) {
      const { data: saved, error } = await supabase
        .from('timeline_entries')
        .insert({
          event_id:         eventId,
          title:            data.title ?? null,
          location:         data.location ?? null,
          start_minutes:    data.start_minutes ?? null,
          duration_minutes: data.duration_minutes ?? 60,
          category:         data.category ?? 'Feier',
          day_index:        data.day_index ?? activeDay,
          sort_order:       data.start_minutes ?? 9999,
          checklist:        data.checklist ?? [],
          assigned_staff:   data.assigned_staff   ?? [],
          assigned_vendors: data.assigned_vendors ?? [],
          assigned_members: data.assigned_members ?? [],
        })
        .select().single()
      if (error) { showToast('Fehler beim Speichern', false); return }
      setEntries(prev => [...prev, saved as TimelineEntry].sort(sortFn))

      // If this is the very first entry and day 0 has no DB row yet, persist it
      if (days[0]?.id === '') {
        const savedDay = await persistDay(days[0]).catch(() => days[0])
        setDays(prev => prev.map(d => d.day_index === 0 ? savedDay : d))
      }
    } else {
      const { data: saved, error } = await supabase
        .from('timeline_entries')
        .update({
          title:            data.title ?? null,
          location:         data.location ?? null,
          start_minutes:    data.start_minutes ?? null,
          duration_minutes: data.duration_minutes ?? 60,
          category:         data.category ?? 'Feier',
          day_index:        data.day_index ?? activeDay,
          sort_order:       data.start_minutes ?? 9999,
          checklist:        data.checklist ?? [],
          assigned_staff:   data.assigned_staff   ?? [],
          assigned_vendors: data.assigned_vendors ?? [],
          assigned_members: data.assigned_members ?? [],
        })
        .eq('id', data.id as string)
        .select().single()
      if (error) { showToast('Fehler beim Speichern', false); return }
      setEntries(prev => prev.map(e => e.id === data.id ? (saved as TimelineEntry) : e).sort(sortFn))
    }
  }

  async function handleDelete(id: string) {
    await supabase.from('timeline_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  async function handleChecklistChange(id: string, checklist: ChecklistItem[]) {
    await supabase.from('timeline_entries').update({ checklist }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, checklist } : e))
  }

  async function handleAssignmentsChange(
    id: string,
    patch: Partial<Pick<TimelineEntry, 'assigned_staff' | 'assigned_vendors' | 'assigned_members'>>
  ) {
    await supabase.from('timeline_entries').update(patch).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  async function handleEventMove(entryId: string, newStartMinutes: number) {
    await supabase.from('timeline_entries').update({
      start_minutes: newStartMinutes,
      sort_order:    newStartMinutes,
    }).eq('id', entryId)
    setEntries(prev =>
      prev.map(e => e.id === entryId ? { ...e, start_minutes: newStartMinutes, sort_order: newStartMinutes } : e)
         .sort(sortFn)
    )
  }

  async function handleEventResize(entryId: string, newStartMinutes: number, newDurationMinutes: number) {
    await supabase.from('timeline_entries').update({
      start_minutes:    newStartMinutes,
      duration_minutes: newDurationMinutes,
      sort_order:       newStartMinutes,
    }).eq('id', entryId)
    setEntries(prev =>
      prev.map(e => e.id === entryId
        ? { ...e, start_minutes: newStartMinutes, duration_minutes: newDurationMinutes, sort_order: newStartMinutes }
        : e
      ).sort(sortFn)
    )
  }

  function sortFn(a: TimelineEntry, b: TimelineEntry) {
    return (a.start_minutes ?? 9999) - (b.start_minutes ?? 9999)
  }

  // ── Calendar callbacks ─────────────────────────────────────────────────────
  const handleEventClick  = useCallback((entry: CalendarEntry) => {
    setModal({ entry: entry as TimelineEntry })
  }, [])
  const handleEmptyClick  = useCallback((startMinutes: number) => {
    setModal({ entry: null, prefill: { startMinutes, duration: 60 } })
  }, [])
  const handleDragCreate  = useCallback((startMinutes: number, duration: number) => {
    setModal({ entry: null, prefill: { startMinutes, duration } })
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>Ablaufplan</h1>
        {!readOnly && role !== 'dienstleister' && (
          <button
            onClick={() => setModal({ entry: null, prefill: { startMinutes: currentDay.start_hour * 60, duration: 60 } })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            <Plus size={14} /> Punkt hinzufügen
          </button>
        )}
      </div>

      {/* ── Day tabs ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexShrink: 0, flexWrap: 'wrap' }}>
        {days.map(day => (
          <div key={day.day_index} style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 0,
                borderRadius: 'var(--radius-sm)',
                border: `1.5px solid ${activeDay === day.day_index ? 'var(--accent)' : 'var(--border)'}`,
                background: activeDay === day.day_index ? 'var(--accent-light)' : 'var(--surface)',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setActiveDay(day.day_index)}
                style={{
                  padding: '6px 14px', border: 'none', background: 'transparent',
                  color: activeDay === day.day_index ? 'var(--accent)' : 'var(--text)',
                  fontWeight: activeDay === day.day_index ? 700 : 400,
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {day.name}
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                  ({entries.filter(e => e.day_index === day.day_index).length})
                </span>
              </button>
              {canManageDays && (
                <button
                  onClick={e => { e.stopPropagation(); setPopover(p => p === day.day_index ? null : day.day_index) }}
                  title="Tag konfigurieren"
                  style={{
                    padding: '6px 8px', border: 'none', borderLeft: '1px solid var(--border)',
                    background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <Settings size={12} />
                </button>
              )}
            </div>
            {canManageDays && popover === day.day_index && (
              <DaySettingsPopover
                day={day}
                canDelete={days.length > 1}
                onUpdate={patch => updateDay(day.day_index, patch)}
                onDelete={() => deleteDay(day.day_index)}
                onClose={() => setPopover(null)}
              />
            )}
          </div>
        ))}
        {canManageDays && (
          <button
            onClick={addDay}
            style={{ padding: '6px 12px', border: '1.5px dashed var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={12} /> Tag hinzufügen
          </button>
        )}
      </div>

      {/* ── Calendar ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ paddingTop: 14, paddingBottom: 24 }}>
          {dayEntries.length === 0 && !readOnly && (
            <div
              style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                textAlign: 'center', pointerEvents: 'none', zIndex: 1,
              }}
            >
              <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 6 }}>Klick oder ziehen um einen Ablaufpunkt zu erstellen</div>
            </div>
          )}
          <DayCalendar
            entries={dayEntries}
            startHour={currentDay.start_hour}
            endHour={currentDay.end_hour}
            readOnly={readOnly || role === 'dienstleister'}
            onEventClick={handleEventClick}
            onEmptyClick={handleEmptyClick}
            onDragCreate={handleDragCreate}
            onEventMove={handleEventMove}
            onEventResize={handleEventResize}
          />
        </div>
      </div>

      {/* ── Event modal ── */}
      {modal !== null && (
        <EventModal
          entry={modal.entry}
          prefill={modal.prefill}
          activeDay={activeDay}
          days={days}
          eventId={eventId}
          members={members}
          staff={staff}
          vendors={vendors}
          role={role}
          readOnly={readOnly}
          onSave={handleSave}
          onDelete={handleDelete}
          onChecklistChange={handleChecklistChange}
          onAssignmentsChange={handleAssignmentsChange}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 500,
          background: toast.ok ? 'var(--green)' : '#FF3B30',
          color: '#fff', padding: '9px 18px', borderRadius: 'var(--radius-sm)',
          fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          pointerEvents: 'none',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
