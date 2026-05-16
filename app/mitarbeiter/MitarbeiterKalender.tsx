'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
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
  onClose,
}: {
  shiftDays: ShiftDay[]
  onClose: () => void
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

  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let startDow = firstDay.getDay()
  startDow = startDow === 0 ? 6 : startDow - 1

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function isoDate(d: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720,
          maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={prevMonth} style={navBtnStyle}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#111827', minWidth: 160, textAlign: 'center' }}>
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} style={navBtnStyle}><ChevronRight size={16} /></button>
          </div>
          <button onClick={onClose} style={{ ...navBtnStyle, color: '#9CA3AF' }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Weekday labels */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            background: '#FAFAFA', borderBottom: '1px solid #F3F4F6',
          }}>
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
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, borderRadius: '50%', marginBottom: 3,
                    background: isT ? 'var(--accent, #6366F1)' : 'transparent',
                    fontSize: 12, fontWeight: isT ? 700 : 400,
                    color: isT ? '#fff' : '#374151',
                  }}>
                    {day}
                  </div>
                  {dayShifts.map(sd => {
                    const evInfo = eventMap.get(sd.eventId)
                    if (!evInfo) return null
                    return (
                      <div
                        key={sd.eventId}
                        onClick={() => { onClose(); router.push(`/mitarbeiter/${sd.eventId}/schichtplan`) }}
                        title={sd.eventTitle}
                        style={{
                          background: evInfo.color, color: '#fff',
                          fontSize: 10, fontWeight: 600,
                          padding: '2px 5px', borderRadius: 3, marginBottom: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          cursor: 'pointer', lineHeight: 1.4,
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
      </div>
    </div>
  )
}
