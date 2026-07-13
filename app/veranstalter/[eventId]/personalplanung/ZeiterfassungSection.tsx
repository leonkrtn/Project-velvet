'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Clock, Check } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string
  name: string
  role_category: string | null
}

interface ShiftInfo {
  id: string
  staff_id: string
  day_id: string
  task: string
  start_hour: number
  end_hour: number
  day_label: string
  day_date: string
}

interface TimeLog {
  id: string
  shift_id: string
  staff_id: string
  event_id: string
  actual_start: string    // ISO timestamp
  actual_end: string | null
  notes: string | null
}

interface Props {
  eventId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtHour(h: number): string {
  const norm = h >= 24 ? h - 24 : h
  return `${String(norm).padStart(2, '0')}:00`
}

function isoToTimeStr(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isoToDateStr(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function buildIso(date: string, time: string): string | null {
  if (!date || !time) return null
  return `${date}T${time}:00`
}

function calcHours(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 3600000
  return diff > 0 ? diff : null
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
  color: 'var(--text-tertiary)',
}

// ── Inline-editable time log row ──────────────────────────────────────────────

function TimeLogRow({
  log, shiftDate, onSaved, onDeleted,
}: {
  log: TimeLog
  shiftDate: string
  onSaved: (updated: TimeLog) => void
  onDeleted: (id: string) => void
}) {
  const supabase = createClient()
  const [startTime, setStartTime] = useState(isoToTimeStr(log.actual_start))
  const [endTime,   setEndTime]   = useState(isoToTimeStr(log.actual_end))
  const [startDate, setStartDate] = useState(isoToDateStr(log.actual_start) || shiftDate)
  const [endDate,   setEndDate]   = useState(isoToDateStr(log.actual_end)   || shiftDate)
  const [notes,     setNotes]     = useState(log.notes ?? '')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  async function persist(patch: Partial<{ actual_start: string | null; actual_end: string | null; notes: string }>) {
    setSaving(true)
    const { data, error } = await supabase
      .from('shift_time_logs')
      .update(patch)
      .eq('id', log.id)
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      onSaved(data as TimeLog)
      clearTimeout(savedTimer.current)
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 1500)
    }
  }

  async function del() {
    await supabase.from('shift_time_logs').delete().eq('id', log.id)
    onDeleted(log.id)
  }

  const hours = calcHours(
    buildIso(startDate, startTime),
    buildIso(endDate, endTime),
  )

  const inputSt: React.CSSProperties = {
    border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px',
    fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff',
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="date" value={startDate} style={{ ...inputSt, width: 130 }}
            onChange={e => setStartDate(e.target.value)}
            onBlur={() => persist({ actual_start: buildIso(startDate, startTime) })}
          />
          <input
            type="time" value={startTime} style={{ ...inputSt, width: 90 }}
            onChange={e => setStartTime(e.target.value)}
            onBlur={() => persist({ actual_start: buildIso(startDate, startTime) })}
          />
        </div>
      </td>
      <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="date" value={endDate} style={{ ...inputSt, width: 130 }}
            onChange={e => setEndDate(e.target.value)}
            onBlur={() => persist({ actual_end: buildIso(endDate, endTime) || null })}
          />
          <input
            type="time" value={endTime} style={{ ...inputSt, width: 90 }}
            onChange={e => setEndTime(e.target.value)}
            onBlur={() => persist({ actual_end: buildIso(endDate, endTime) || null })}
          />
        </div>
      </td>
      <td style={{ padding: '8px 10px', verticalAlign: 'middle', textAlign: 'center' }}>
        {hours != null ? (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{hours.toFixed(1)} h</span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
        )}
      </td>
      <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={() => persist({ notes: notes.trim() })}
          placeholder="Notiz…"
          style={{ ...inputSt, width: '100%' }}
        />
      </td>
      <td style={{ padding: '8px 10px', verticalAlign: 'middle', textAlign: 'center' }}>
        {saving ? (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>…</span>
        ) : saved ? (
          <Check size={13} color="var(--green, #34c759)" />
        ) : (
          <button
            onClick={del}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30', padding: 4 }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Add log form ──────────────────────────────────────────────────────────────

function AddLogRow({
  shiftId, staffId, eventId, shiftDate, onAdded,
}: {
  shiftId: string; staffId: string; eventId: string; shiftDate: string
  onAdded: (log: TimeLog) => void
}) {
  const supabase = createClient()
  const [open,      setOpen]      = useState(false)
  const [startDate, setStartDate] = useState(shiftDate)
  const [startTime, setStartTime] = useState('')
  const [endDate,   setEndDate]   = useState(shiftDate)
  const [endTime,   setEndTime]   = useState('')
  const [notes,     setNotes]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  async function save() {
    if (!startDate || !startTime) { setError('Startzeit erforderlich'); return }
    setSaving(true); setError('')
    const actual_start = buildIso(startDate, startTime)!
    const actual_end   = endDate && endTime ? buildIso(endDate, endTime) : null
    const { data, err } = await supabase
      .from('shift_time_logs')
      .insert({ shift_id: shiftId, staff_id: staffId, event_id: eventId, actual_start, actual_end, notes: notes.trim() || null })
      .select()
      .single() as unknown as { data: TimeLog | null; err: unknown }
    setSaving(false)
    if (!data) { setError('Fehler beim Speichern'); return }
    onAdded(data)
    setOpen(false)
    setStartTime(''); setEndTime(''); setNotes('')
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={5} style={{ padding: '6px 10px' }}>
          <button
            onClick={() => setOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Plus size={12} /> Eintrag manuell hinzufügen
          </button>
        </td>
      </tr>
    )
  }

  const inputSt: React.CSSProperties = {
    border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px',
    fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff',
  }

  return (
    <tr style={{ background: 'rgba(var(--accent-rgb,183,139,74),0.04)', borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="date" value={startDate} style={{ ...inputSt, width: 130 }} onChange={e => setStartDate(e.target.value)} />
          <input type="time" value={startTime} style={{ ...inputSt, width: 90 }} onChange={e => setStartTime(e.target.value)} />
        </div>
      </td>
      <td style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="date" value={endDate} style={{ ...inputSt, width: 130 }} onChange={e => setEndDate(e.target.value)} />
          <input type="time" value={endTime} style={{ ...inputSt, width: 90 }} onChange={e => setEndTime(e.target.value)} />
        </div>
      </td>
      <td />
      <td style={{ padding: '8px 10px' }}>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notiz…" style={{ ...inputSt, width: '100%' }} />
      </td>
      <td style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={save} disabled={saving}
            style={{ padding: '5px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {saving ? '…' : 'Speichern'}
          </button>
          <button
            onClick={() => setOpen(false)}
            style={{ padding: '5px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        {error && <p style={{ fontSize: 11, color: '#FF3B30', marginTop: 4 }}>{error}</p>}
      </td>
    </tr>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ZeiterfassungSection({ eventId }: Props) {
  const supabase = createClient()
  const [staff,    setStaff]    = useState<StaffMember[]>([])
  const [shifts,   setShifts]   = useState<ShiftInfo[]>([])
  const [logs,     setLogs]     = useState<TimeLog[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [staffRes, daysRes, logsRes] = await Promise.all([
        supabase.from('organizer_staff').select('id, name, role_category').eq('organizer_id', user.id).order('name'),
        supabase.from('personalplanung_days').select('id, label, date').eq('event_id', eventId).order('date'),
        supabase.from('shift_time_logs').select('*').eq('event_id', eventId),
      ])

      const staffList = staffRes.data ?? []
      const dayList   = daysRes.data ?? []
      const staffIds  = staffList.map((s: StaffMember) => s.id)

      let shiftList: ShiftInfo[] = []
      if (staffIds.length > 0 && dayList.length > 0) {
        const dayIds = dayList.map((d: { id: string }) => d.id)
        const { data: shiftsRaw } = await supabase
          .from('personalplanung_shifts')
          .select('id, staff_id, day_id, task, start_hour, end_hour')
          .in('staff_id', staffIds)
          .in('day_id', dayIds)

        const dayMap = Object.fromEntries(dayList.map((d: { id: string; label: string; date: string }) => [d.id, d]))
        shiftList = (shiftsRaw ?? []).map((s: {
          id: string; staff_id: string; day_id: string
          task: string; start_hour: number; end_hour: number
        }) => ({
          ...s,
          day_label: dayMap[s.day_id]?.label ?? '—',
          day_date:  dayMap[s.day_id]?.date  ?? '',
        }))
      }

      setStaff(staffList)
      setShifts(shiftList)
      setLogs(logsRes.data ?? [])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: 14, padding: 24 }}>Wird geladen…</div>
  }

  if (staff.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
        Noch keine Mitarbeiter angelegt.
      </div>
    )
  }

  const totalByStaff: Record<string, number> = {}
  for (const log of logs) {
    const h = calcHours(log.actual_start, log.actual_end)
    if (h != null) totalByStaff[log.staff_id] = (totalByStaff[log.staff_id] ?? 0) + h
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {staff.map(s => {
          const total = totalByStaff[s.id]
          return (
            <div key={s.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Clock size={13} color="var(--text-tertiary)" />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
              <span style={{ fontSize: 13, color: total ? 'var(--text)' : 'var(--text-tertiary)', fontWeight: total ? 700 : 400 }}>
                {total != null ? `${total.toFixed(1)} h` : '—'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Per-staff accordion */}
      {staff.map(s => {
        const staffShifts = shifts.filter(sh => sh.staff_id === s.id)
        if (staffShifts.length === 0) return null
        const isOpen = expanded[s.id] ?? false

        return (
          <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <button
              onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !isOpen }))}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '14px 18px', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{s.name}</span>
                {s.role_category && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg)', padding: '2px 7px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    {s.role_category}
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {staffShifts.length} Schicht{staffShifts.length > 1 ? 'en' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {totalByStaff[s.id] != null && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {totalByStaff[s.id].toFixed(1)} h gesamt
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▼</span>
              </div>
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {staffShifts.map(shift => {
                  const shiftLogs = logs.filter(l => l.shift_id === shift.id)
                  return (
                    <div key={shift.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <div style={{ padding: '10px 18px', background: 'rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                          {shift.day_label}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{shift.day_date}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {shift.task} · {fmtHour(shift.start_hour)} – {fmtHour(shift.end_hour)}
                        </span>
                      </div>
                      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.015)' }}>
                            <th style={{ ...labelStyle, padding: '7px 10px', textAlign: 'left', fontWeight: 700 }}>Einstempel-Zeit</th>
                            <th style={{ ...labelStyle, padding: '7px 10px', textAlign: 'left', fontWeight: 700 }}>Ausstempel-Zeit</th>
                            <th style={{ ...labelStyle, padding: '7px 10px', textAlign: 'center', fontWeight: 700 }}>Stunden</th>
                            <th style={{ ...labelStyle, padding: '7px 10px', textAlign: 'left', fontWeight: 700 }}>Notiz</th>
                            <th style={{ padding: '7px 10px' }} />
                          </tr>
                        </thead>
                        <tbody>
                          {shiftLogs.map(log => (
                            <TimeLogRow
                              key={log.id}
                              log={log}
                              shiftDate={shift.day_date}
                              onSaved={updated => setLogs(prev => prev.map(l => l.id === updated.id ? updated : l))}
                              onDeleted={id => setLogs(prev => prev.filter(l => l.id !== id))}
                            />
                          ))}
                          <AddLogRow
                            shiftId={shift.id}
                            staffId={s.id}
                            eventId={eventId}
                            shiftDate={shift.day_date}
                            onAdded={log => setLogs(prev => [...prev, log])}
                          />
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
