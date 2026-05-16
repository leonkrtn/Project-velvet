'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ShiftDay } from './page'

type EventInfo = { id: string; title: string; color: string; shiftCount: number }

const PALETTE = [
  '#6366F1', '#EC4899', '#10B981', '#F59E0B',
  '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6',
]

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

const navBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid #E5E7EB', background: 'none',
  cursor: 'pointer', color: '#374151',
}

export default function MitarbeiterKalender({
  shiftDays,
  staffName,
}: {
  shiftDays: ShiftDay[]
  staffName: string
}) {
  const router = useRouter()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  // Build event info map
  const eventMap = new Map<string, EventInfo>()
  let colorIdx = 0
  for (const sd of shiftDays) {
    if (!eventMap.has(sd.eventId)) {
      eventMap.set(sd.eventId, {
        id: sd.eventId,
        title: sd.eventTitle,
        color: PALETTE[colorIdx % PALETTE.length],
        shiftCount: 0,
      })
      colorIdx++
    }
    eventMap.get(sd.eventId)!.shiftCount++
  }
  const events = Array.from(eventMap.values())

  // Build date → shifts map
  const byDate = new Map<string, ShiftDay[]>()
  for (const sd of shiftDays) {
    const list = byDate.get(sd.date) ?? []
    list.push(sd)
    byDate.set(sd.date, list)
  }

  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // Build calendar grid cells
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let startDow = firstDay.getDay() // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1 // Mon=0

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function isoDate(d: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 64px', fontFamily: 'inherit' }}>

      {/* Welcome */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', margin: '0 0 4px', color: '#111827' }}>
          Mein Schichtplan
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>
          Willkommen, {staffName}.
        </p>
      </div>

      {events.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', border: '2px dashed #E5E7EB', borderRadius: 12 }}>
          <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>Du bist noch keinem Event zugeteilt.</p>
        </div>
      ) : (
        <>
          {/* Event legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {events.map(ev => (
              <div
                key={ev.id}
                onClick={() => router.push(`/mitarbeiter/${ev.id}/schichtplan`)}
                title="Zum Schichtplan"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px', borderRadius: 20,
                  background: ev.color + '18', border: `1.5px solid ${ev.color}40`,
                  cursor: 'pointer', userSelect: 'none',
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{ev.title}</span>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {ev.shiftCount} Tag{ev.shiftCount !== 1 ? 'e' : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Calendar card */}
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>

            {/* Month navigation */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid #F3F4F6',
            }}>
              <button onClick={prevMonth} style={navBtnStyle}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                {MONTHS[month]} {year}
              </span>
              <button onClick={nextMonth} style={navBtnStyle}>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekday headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
              {WEEKDAYS.map(d => (
                <div key={d} style={{
                  padding: '8px 0', textAlign: 'center',
                  fontSize: 11, fontWeight: 700, color: '#9CA3AF',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((day, idx) => {
                const isLastRow = idx >= cells.length - 7
                const isLastCol = (idx + 1) % 7 === 0

                if (!day) {
                  return (
                    <div key={`e${idx}`} style={{
                      minHeight: 88,
                      borderRight: !isLastCol ? '1px solid #F3F4F6' : 'none',
                      borderBottom: !isLastRow ? '1px solid #F3F4F6' : 'none',
                      background: '#FAFAFA',
                    }} />
                  )
                }

                const iso = isoDate(day)
                const dayShifts = byDate.get(iso) ?? []
                const isT = iso === todayIso

                return (
                  <div key={day} style={{
                    minHeight: 88, padding: '6px 6px 4px',
                    borderRight: !isLastCol ? '1px solid #F3F4F6' : 'none',
                    borderBottom: !isLastRow ? '1px solid #F3F4F6' : 'none',
                    background: isT ? '#FAFBFF' : '#fff',
                  }}>
                    {/* Day number */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 24, height: 24, borderRadius: '50%', marginBottom: 3,
                      background: isT ? 'var(--accent, #6366F1)' : 'transparent',
                      fontSize: 12, fontWeight: isT ? 700 : 400,
                      color: isT ? '#fff' : '#374151',
                    }}>
                      {day}
                    </div>

                    {/* Event pills */}
                    {dayShifts.map(sd => {
                      const evInfo = eventMap.get(sd.eventId)
                      if (!evInfo) return null
                      return (
                        <div
                          key={sd.eventId}
                          onClick={() => router.push(`/mitarbeiter/${sd.eventId}/schichtplan`)}
                          title={sd.eventTitle}
                          style={{
                            background: evInfo.color,
                            color: '#fff',
                            fontSize: 10, fontWeight: 600,
                            padding: '2px 5px',
                            borderRadius: 3,
                            marginBottom: 2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            lineHeight: 1.4,
                          }}
                        >
                          {sd.eventTitle}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
