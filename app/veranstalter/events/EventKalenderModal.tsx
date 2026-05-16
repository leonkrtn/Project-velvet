'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export type EventSummary = {
  id: string
  title: string
  couple_name: string | null
  date: string | null
  venue: string | null
}

type View = 'month' | 'week'
type Stats = { guests: number; members: number; vendors: number }

const PALETTE = [
  { bg: '#6366F1', light: 'rgba(99,102,241,0.13)' },
  { bg: '#EC4899', light: 'rgba(236,72,153,0.13)' },
  { bg: '#10B981', light: 'rgba(16,185,129,0.13)' },
  { bg: '#F59E0B', light: 'rgba(245,158,11,0.13)' },
  { bg: '#3B82F6', light: 'rgba(59,130,246,0.13)' },
  { bg: '#8B5CF6', light: 'rgba(139,92,246,0.13)' },
  { bg: '#EF4444', light: 'rgba(239,68,68,0.13)' },
  { bg: '#14B8A6', light: 'rgba(20,184,166,0.13)' },
]

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function displayName(ev: EventSummary) {
  return ev.couple_name?.trim() || ev.title?.trim() || 'Event'
}

function fmtDate(iso: string | null) {
  if (!iso) return 'Kein Datum'
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch { return iso }
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return mon
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(d.getDate() + n)
  return r
}

const navBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid #E5E7EB', background: 'none',
  cursor: 'pointer', color: '#374151', flexShrink: 0,
}

export default function EventKalenderModal({
  events,
  onClose,
}: {
  events: EventSummary[]
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const today = new Date()
  const todayIso = toISO(today)

  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(today)
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Assign colors deterministically by index
  const colorMap = new Map(events.map((ev, i) => [ev.id, PALETTE[i % PALETTE.length]]))

  // Group events by date
  const eventsByDate = new Map<string, EventSummary[]>()
  for (const ev of events) {
    if (!ev.date) continue
    const list = eventsByDate.get(ev.date) ?? []
    list.push(ev)
    eventsByDate.set(ev.date, list)
  }

  async function handleEventClick(ev: EventSummary, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedEvent(ev)
    setStats(null)
    setLoadingStats(true)
    const [{ count: guests }, { count: members }, { count: vendors }] = await Promise.all([
      supabase.from('guests').select('id', { count: 'exact', head: true }).eq('event_id', ev.id),
      supabase.from('event_members').select('id', { count: 'exact', head: true }).eq('event_id', ev.id).neq('role', 'veranstalter'),
      supabase.from('event_dienstleister').select('id', { count: 'exact', head: true }).eq('event_id', ev.id),
    ])
    setStats({ guests: guests ?? 0, members: members ?? 0, vendors: vendors ?? 0 })
    setLoadingStats(false)
  }

  // Navigation
  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  function prevPeriod() {
    if (view === 'month') setCursor(new Date(year, month - 1, 1))
    else setCursor(addDays(cursor, -7))
  }
  function nextPeriod() {
    if (view === 'month') setCursor(new Date(year, month + 1, 1))
    else setCursor(addDays(cursor, 7))
  }

  // Month grid
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let startDow = firstDay.getDay()
  startDow = startDow === 0 ? 6 : startDow - 1
  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  // Week days
  const weekStart = getMonday(cursor)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const navLabel = view === 'month'
    ? `${MONTHS[month]} ${year}`
    : (() => {
        const from = weekDays[0]
        const to = weekDays[6]
        if (from.getMonth() === to.getMonth())
          return `${from.getDate()}. – ${to.getDate()}. ${MONTHS[to.getMonth()]} ${to.getFullYear()}`
        return `${from.getDate()}. ${MONTHS[from.getMonth()]} – ${to.getDate()}. ${MONTHS[to.getMonth()]} ${to.getFullYear()}`
      })()

  function renderEventPill(ev: EventSummary, size: 'sm' | 'lg' = 'sm') {
    const c = colorMap.get(ev.id)!
    return (
      <div
        key={ev.id}
        onClick={(e) => handleEventClick(ev, e)}
        title={displayName(ev)}
        style={{
          background: c.bg, color: '#fff',
          fontSize: size === 'lg' ? 12 : 10, fontWeight: 600,
          padding: size === 'lg' ? '4px 8px' : '2px 6px',
          borderRadius: 4, marginBottom: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          cursor: 'pointer', lineHeight: 1.4, userSelect: 'none',
        }}
      >
        {displayName(ev)}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 900,
          maxHeight: '92vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid #F3F4F6', gap: 12, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>Eventkalender</h2>
            {/* View toggle */}
            <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 3, gap: 1 }}>
              {(['month', 'week'] as View[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none',
                    background: view === v ? '#fff' : 'transparent',
                    color: view === v ? '#111827' : '#6B7280',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  {v === 'month' ? 'Monat' : 'Woche'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={prevPeriod} style={navBtn}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', minWidth: 180, textAlign: 'center' }}>
              {navLabel}
            </span>
            <button onClick={nextPeriod} style={navBtn}><ChevronRight size={16} /></button>
            <button onClick={onClose} style={{ ...navBtn, marginLeft: 4, color: '#9CA3AF' }}><X size={16} /></button>
          </div>
        </div>

        {/* Calendar body */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>

          {/* Weekday headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '1px solid #F3F4F6', background: '#FAFAFA', flexShrink: 0,
          }}>
            {view === 'month'
              ? WEEKDAYS.map(d => (
                <div key={d} style={{
                  padding: '10px 0', textAlign: 'center',
                  fontSize: 11, fontWeight: 700, color: '#9CA3AF',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {d}
                </div>
              ))
              : weekDays.map((d, i) => {
                const iso = toISO(d)
                const isT = iso === todayIso
                return (
                  <div key={iso} style={{ padding: '8px 0', textAlign: 'center' }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: '#9CA3AF',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {WEEKDAYS[i]}
                    </div>
                    <div style={{
                      fontSize: 18, fontWeight: 700, marginTop: 2,
                      color: isT ? 'var(--accent, #6366F1)' : '#374151',
                    }}>
                      {d.getDate()}
                    </div>
                  </div>
                )
              })
            }
          </div>

          {/* Month view */}
          {view === 'month' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((day, idx) => {
                const isLastRow = idx >= cells.length - 7
                const isLastCol = (idx + 1) % 7 === 0

                if (!day) {
                  return (
                    <div key={`e${idx}`} style={{
                      minHeight: 100,
                      borderRight: !isLastCol ? '1px solid #F3F4F6' : 'none',
                      borderBottom: !isLastRow ? '1px solid #F3F4F6' : 'none',
                      background: '#FAFAFA',
                    }} />
                  )
                }

                const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayEvents = eventsByDate.get(iso) ?? []
                const isT = iso === todayIso

                return (
                  <div key={day} style={{
                    minHeight: 100, padding: '6px',
                    borderRight: !isLastCol ? '1px solid #F3F4F6' : 'none',
                    borderBottom: !isLastRow ? '1px solid #F3F4F6' : 'none',
                    background: isT ? '#FAFBFF' : '#fff',
                  }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 26, height: 26, borderRadius: '50%', marginBottom: 4,
                      background: isT ? 'var(--accent, #6366F1)' : 'transparent',
                      fontSize: 12, fontWeight: isT ? 700 : 400,
                      color: isT ? '#fff' : '#374151',
                    }}>
                      {day}
                    </div>
                    {dayEvents.map(ev => renderEventPill(ev))}
                  </div>
                )
              })}
            </div>
          )}

          {/* Week view */}
          {view === 'week' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {weekDays.map((d, idx) => {
                const iso = toISO(d)
                const dayEvents = eventsByDate.get(iso) ?? []
                const isT = iso === todayIso
                return (
                  <div key={iso} style={{
                    minHeight: 240, padding: '10px 8px',
                    borderRight: idx < 6 ? '1px solid #F3F4F6' : 'none',
                    background: isT ? '#FAFBFF' : '#fff',
                  }}>
                    {dayEvents.map(ev => renderEventPill(ev, 'lg'))}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Event detail panel (shown when event is selected) */}
        {selectedEvent && (
          <div style={{
            borderTop: '1px solid #E5E7EB', padding: '18px 22px',
            background: '#FAFAFA', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Event name + color dot */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: colorMap.get(selectedEvent.id)?.bg,
                  }} />
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName(selectedEvent)}
                  </h3>
                </div>
                {/* Date + venue */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: '#6B7280' }}>{fmtDate(selectedEvent.date)}</span>
                  {selectedEvent.venue && (
                    <span style={{ fontSize: 13, color: '#6B7280' }}>{selectedEvent.venue}</span>
                  )}
                </div>
                {/* Stats */}
                {loadingStats ? (
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Lade …</p>
                ) : stats && (
                  <div style={{ display: 'flex', gap: 20 }}>
                    {[
                      { value: stats.guests, label: 'Gäste' },
                      { value: stats.members, label: 'Team' },
                      { value: stats.vendors, label: 'Dienstleister' },
                    ].map(({ value, label }) => (
                      <div key={label}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={() => setSelectedEvent(null)}
                  style={{
                    padding: '8px 14px', borderRadius: 8,
                    border: '1px solid #E5E7EB', background: 'none',
                    cursor: 'pointer', fontSize: 13, color: '#6B7280', fontFamily: 'inherit',
                  }}
                >
                  Schließen
                </button>
                <button
                  onClick={() => { router.push(`/veranstalter/dashboard?event=${selectedEvent.id}`); onClose() }}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: 'none', background: 'var(--accent, #6366F1)', color: '#fff',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  }}
                >
                  Zur Verwaltung →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
