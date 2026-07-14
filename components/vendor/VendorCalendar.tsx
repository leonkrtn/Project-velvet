'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2, Loader2,
  Download, Link2, AlignLeft, LayoutGrid,
} from 'lucide-react'
import SegmentedToggle from './SegmentedToggle'
import { useConfirm } from '@/components/ui/ConfirmDialog'

export interface CalendarEntry {
  id: string
  title: string
  description: string
  start_at: string
  end_at: string | null
  all_day: boolean
  color: string
  entry_type: 'event' | 'reminder' | 'payment' | 'custom'
  editable: boolean
  href?: string
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// Monday-based week start
function weekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const offset = first.getDay() === 0 ? 6 : first.getDay() - 1
  const start = addDays(first, -offset)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

function entryDate(e: CalendarEntry): Date {
  return new Date(e.start_at)
}

function entriesOnDay(entries: CalendarEntry[], day: Date): CalendarEntry[] {
  return entries.filter(e => sameDay(entryDate(e), day))
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const PALETTE = [
  '#2352C8', '#0EA5E9', '#1E7E34', '#10B981',
  '#B89968', '#D97706', '#C5221F', '#EF4444',
  '#7C3AED', '#A855F7', '#6B7280', '#374151',
]

const TYPE_LABELS: Record<CalendarEntry['entry_type'], string> = {
  event: 'Hochzeit',
  reminder: 'Erinnerung',
  payment: 'Zahlung',
  custom: 'Termin',
}

type View = 'month' | 'week' | 'agenda'

type ModalState =
  | { mode: 'create'; initialDate: Date }
  | { mode: 'edit'; entry: CalendarEntry }

const C = {
  border: 'var(--border)',
  text: 'var(--text)',
  dim: 'var(--text-secondary, #666)',
  surface: 'var(--surface)',
  bg: 'var(--bg)',
  accent: 'var(--accent, #2352C8)',
}

const inp: React.CSSProperties = {
  height: 36, padding: '0 10px', fontSize: 13.5,
  border: `1px solid ${C.border}`, borderRadius: 8,
  background: '#fff', fontFamily: 'inherit',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function VendorCalendar() {
  const router = useRouter()
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d })
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/vendor/calendar').catch(() => null)
    if (r?.ok) {
      const d = await r.json()
      setEntries(d.entries ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (window.innerWidth < 540) setView('agenda')
  }, [])

  function openCreate(date: Date) { setModal({ mode: 'create', initialDate: date }) }
  function openEdit(e: CalendarEntry) {
    if (e.editable) { setModal({ mode: 'edit', entry: e }); return }
    if (e.href) router.push(e.href)
  }
  function closeModal() { setModal(null) }

  function prevPeriod() {
    setCursor(c => {
      const d = new Date(c)
      if (view === 'month') { d.setMonth(d.getMonth() - 1); d.setDate(1) }
      else if (view === 'week') { d.setDate(d.getDate() - 7) }
      else { d.setMonth(d.getMonth() - 1); d.setDate(1) }
      return d
    })
  }

  function nextPeriod() {
    setCursor(c => {
      const d = new Date(c)
      if (view === 'month') { d.setMonth(d.getMonth() + 1); d.setDate(1) }
      else if (view === 'week') { d.setDate(d.getDate() + 7) }
      else { d.setMonth(d.getMonth() + 1); d.setDate(1) }
      return d
    })
  }

  function goToday() {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    setCursor(d)
  }

  async function downloadIcal() {
    setExportBusy(true)
    try {
      const r = await fetch('/api/vendor/calendar/ical')
      if (!r.ok) return
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'forevr-kalender.ics'; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportBusy(false)
    }
  }

  async function copyGoogleLink() {
    const r = await fetch('/api/vendor/calendar/ical', { method: 'POST' })
    if (!r.ok) return
    const { userId, token } = await r.json()
    const origin = window.location.origin
    const icalUrl = `${origin}/api/vendor/calendar/ical?uid=${userId}&token=${token}`
    const gcLink = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(icalUrl)}`
    window.open(gcLink, '_blank', 'noopener')
  }

  const cursorLabel = view === 'week'
    ? (() => {
        const ws = weekStart(cursor)
        const we = addDays(ws, 6)
        return `${ws.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${we.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`
      })()
    : formatMonthYear(cursor)

  return (
    <div style={{ marginTop: 20, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div className="vc-calendar-header" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: C.text, flex: '0 0 auto' }}>Kalender</h2>

        {/* View switcher */}
        <SegmentedToggle
          className="vc-view-switcher"
          style={{ flex: '0 0 auto' }}
          value={view === 'week' ? 'month' : view}
          onChange={setView}
          options={[
            { key: 'month', label: 'Monat', icon: LayoutGrid },
            { key: 'agenda', label: 'Agenda', icon: AlignLeft },
          ]}
        />

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
          <button onClick={prevPeriod} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, minWidth: 160, textAlign: 'center' }}>{cursorLabel}</span>
          <button onClick={nextPeriod} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim }}>
            <ChevronRight size={16} />
          </button>
          <button onClick={goToday} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 12, color: C.dim, fontFamily: 'inherit' }}>Heute</button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <button
          onClick={() => openCreate(new Date())}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: C.accent, color: '#fff', fontFamily: 'inherit' }}
        >
          <Plus size={15} /> Termin
        </button>
        <button
          onClick={downloadIcal}
          disabled={exportBusy}
          title="iCal herunterladen"
          className="vc-ical-btn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${C.border}`, background: C.surface, color: C.dim, fontFamily: 'inherit' }}
        >
          {exportBusy ? <Loader2 size={14} className="vc-spin" /> : <Download size={14} />} iCal
        </button>
        <button
          onClick={copyGoogleLink}
          title="In Google Calendar abonnieren"
          className="vc-google-btn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${C.border}`, background: C.surface, color: C.dim, fontFamily: 'inherit' }}
        >
          <Link2 size={14} /> Google Calendar
        </button>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div style={{ padding: 48, display: 'flex', justifyContent: 'center', color: C.dim }}>
          <Loader2 size={20} className="vc-spin" />
        </div>
      ) : view === 'month' ? (
        <MonthView cursor={cursor} entries={entries} onDayClick={openCreate} onEntryClick={openEdit} isMobile={isMobile} onDayDetail={setSelectedDay} />
      ) : view === 'week' ? (
        <WeekView cursor={cursor} entries={entries} onDayClick={openCreate} onEntryClick={openEdit} isMobile={isMobile} onDayDetail={setSelectedDay} />
      ) : (
        <AgendaView cursor={cursor} entries={entries} onEntryClick={openEdit} onAdd={openCreate} />
      )}

      {/* ── Modal ── */}
      {modal && (
        <EntryModal
          modal={modal}
          onClose={closeModal}
          onSaved={async () => { closeModal(); await load() }}
          onDeleted={async () => { closeModal(); await load() }}
        />
      )}

      {selectedDay && (
        <DayDetailPanel
          day={selectedDay}
          entries={entriesOnDay(entries, selectedDay)}
          onClose={() => setSelectedDay(null)}
          onEntryClick={e => { setSelectedDay(null); openEdit(e) }}
          onAdd={d => { setSelectedDay(null); openCreate(d) }}
        />
      )}

      <style>{`
        .vc-spin{animation:vcspin 1s linear infinite}
        @keyframes vcspin{to{transform:rotate(360deg)}}
        .vc-chip{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;font-weight:500;padding:2px 6px;border-radius:4px;cursor:pointer;line-height:1.4;max-width:100%}
        .vc-chip:hover{filter:brightness(.9)}
        .vc-day:hover .vc-day-add{opacity:1!important}
        @media(max-width:700px){.vc-week-grid{grid-template-columns:repeat(7,1fr)!important;font-size:11px}}
        @media(max-width:540px){
          .vc-ical-btn,.vc-google-btn{display:none!important}
          .vc-calendar-header{padding:10px 12px!important;gap:8px!important}
          .vc-view-switcher button{padding:5px 8px!important;font-size:12px!important}
          .vc-day{min-height:52px!important;padding:3px 2px!important}
          .vc-agenda-date{width:52px!important;padding:10px 6px!important}
          .vc-agenda-events{padding:10px 10px!important}
        }
      `}</style>
    </div>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({ cursor, entries, onDayClick, onEntryClick, isMobile, onDayDetail }: {
  cursor: Date
  entries: CalendarEntry[]
  onDayClick: (d: Date) => void
  onEntryClick: (e: CalendarEntry) => void
  isMobile?: boolean
  onDayDetail?: (d: Date) => void
}) {
  const today = new Date()
  const cells = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])
  const currentMonth = cursor.getMonth()

  return (
    <div>
      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: `1px solid ${C.border}` }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</div>
        ))}
      </div>

      {/* Day cells grid (6 rows) — minmax(0,1fr) statt 1fr: sonst kann ein
          langer Termin-Titel in einer Zelle die ganze Spalte breiter ziehen
          als die anderen. Feste Höhe + overflow:hidden statt minHeight, damit
          alle Kacheln unabhängig von der Anzahl der Termine gleich groß bleiben. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {cells.map((day, i) => {
          const isToday = sameDay(day, today)
          const isCurrentMonth = day.getMonth() === currentMonth
          const dayEntries = entriesOnDay(entries, day)

          function handleDayClick() {
            if (isMobile && onDayDetail && dayEntries.length > 0) {
              onDayDetail(day)
            } else {
              onDayClick(day)
            }
          }

          return (
            <div
              key={i}
              className="vc-day"
              onClick={handleDayClick}
              style={{
                height: isMobile ? 48 : 90,
                minWidth: 0,
                padding: isMobile ? '4px 2px' : '5px 4px',
                cursor: 'pointer',
                overflow: 'hidden',
                borderRight: i % 7 !== 6 ? `1px solid ${C.border}` : 'none',
                borderBottom: i < 35 ? `1px solid ${C.border}` : 'none',
                background: isToday ? 'rgba(35,82,200,0.04)' : 'transparent',
                position: 'relative',
                boxSizing: 'border-box',
              }}
            >
              {/* Date number */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'space-between', marginBottom: 2 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: '50%', fontSize: 12, fontWeight: isToday ? 700 : 400,
                  color: isToday ? '#fff' : isCurrentMonth ? C.text : C.dim,
                  background: isToday ? C.accent : 'transparent',
                }}>
                  {day.getDate()}
                </span>
                {!isMobile && (
                  <span className="vc-day-add" style={{ opacity: 0, color: C.dim, lineHeight: 1, transition: 'opacity .15s', fontSize: 14 }}>+</span>
                )}
              </div>

              {/* Mobile: colored dots. Desktop: text chips */}
              {isMobile ? (
                dayEntries.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 2 }}>
                    {dayEntries.slice(0, 3).map((e, di) => (
                      <div key={di} style={{ width: 5, height: 5, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                    ))}
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dayEntries.slice(0, 3).map(e => (
                    <div
                      key={e.id}
                      className="vc-chip"
                      onClick={ev => { ev.stopPropagation(); onEntryClick(e) }}
                      style={{ background: e.color + '22', color: e.color, border: `1px solid ${e.color}33`, cursor: (e.editable || e.href) ? 'pointer' : 'default' }}
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEntries.length > 3 && (
                    <span style={{ fontSize: 10, color: C.dim, paddingLeft: 4 }}>+{dayEntries.length - 3} weitere</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({ cursor, entries, onDayClick, onEntryClick, isMobile, onDayDetail }: {
  cursor: Date
  entries: CalendarEntry[]
  onDayClick: (d: Date) => void
  onEntryClick: (e: CalendarEntry) => void
  isMobile?: boolean
  onDayDetail?: (d: Date) => void
}) {
  const today = new Date()
  const ws = weekStart(cursor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))

  return (
    <div>
      <div className="vc-week-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((day, i) => {
          const isToday = sameDay(day, today)
          const dayEntries = entriesOnDay(entries, day)

          function handleDayClick() {
            if (isMobile && onDayDetail && dayEntries.length > 0) {
              onDayDetail(day)
            } else {
              onDayClick(day)
            }
          }

          return (
            <div
              key={i}
              style={{
                borderRight: i < 6 ? `1px solid ${C.border}` : 'none',
                background: isToday ? 'rgba(35,82,200,0.04)' : 'transparent',
              }}
            >
              {/* Day header */}
              <div
                onClick={handleDayClick}
                style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {WEEKDAYS[i]}
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: '50%', fontSize: 14, fontWeight: 600, marginTop: 3,
                  background: isToday ? C.accent : 'transparent',
                  color: isToday ? '#fff' : C.text,
                }}>
                  {day.getDate()}
                </div>
              </div>

              {/* Events: dots on mobile, chips on desktop */}
              {isMobile ? (
                <div style={{ padding: '6px 4px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 3, minHeight: 40 }}>
                  {dayEntries.slice(0, 3).map((e, di) => (
                    <div key={di} style={{ width: 6, height: 6, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                  ))}
                </div>
              ) : (
                <div style={{ padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: 3, minHeight: 120 }}>
                  {dayEntries.length === 0 ? null : dayEntries.map(e => (
                    <div
                      key={e.id}
                      onClick={() => onEntryClick(e)}
                      className="vc-chip"
                      style={{ background: e.color + '22', color: e.color, border: `1px solid ${e.color}33`, cursor: (e.editable || e.href) ? 'pointer' : 'default' }}
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Agenda View ───────────────────────────────────────────────────────────────

function AgendaView({ cursor, entries, onEntryClick, onAdd }: {
  cursor: Date
  entries: CalendarEntry[]
  onEntryClick: (e: CalendarEntry) => void
  onAdd: (d: Date) => void
}) {
  // Show entries from the 1st of cursor month
  const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
  to.setHours(23, 59, 59, 999)

  const visible = entries
    .filter(e => {
      const d = entryDate(e)
      return d >= from && d <= to
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  // Group by date string
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    for (const e of visible) {
      const key = ymd(entryDate(e))
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return Array.from(map.entries())
  }, [visible])

  if (grouped.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ color: C.dim, fontSize: 14, marginBottom: 16 }}>Keine Termine in diesem Monat.</p>
        <button
          onClick={() => onAdd(new Date())}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: C.accent, color: '#fff', fontFamily: 'inherit' }}
        >
          <Plus size={14} /> Termin erstellen
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 8px' }}>
      {grouped.map(([dateKey, dayEntries]) => {
        const date = new Date(dateKey + 'T12:00:00')
        const isToday = sameDay(date, new Date())
        return (
          <div key={dateKey} style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}` }}>
            {/* Date column */}
            <div className="vc-agenda-date" style={{
              width: 80, flexShrink: 0, padding: '14px 12px',
              borderRight: `1px solid ${C.border}`, textAlign: 'right',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: isToday ? C.accent : C.text, lineHeight: 1 }}>
                {date.getDate()}
              </div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                {date.toLocaleDateString('de-DE', { weekday: 'short' })}
              </div>
              <div style={{ fontSize: 11, color: C.dim }}>
                {date.toLocaleDateString('de-DE', { month: 'short' })}
              </div>
            </div>

            {/* Events column */}
            <div className="vc-agenda-events" style={{ flex: 1, minWidth: 0, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dayEntries.map(e => (
                <div
                  key={e.id}
                  onClick={() => onEntryClick(e)}
                  style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
                    cursor: (e.editable || e.href) ? 'pointer' : 'default',
                    padding: '8px 12px', borderRadius: 10,
                    background: e.color + '14', border: `1px solid ${e.color}30`,
                    transition: 'filter .12s',
                  }}
                  onMouseEnter={el => e.editable && (el.currentTarget.style.filter = 'brightness(.95)')}
                  onMouseLeave={el => (el.currentTarget.style.filter = '')}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                    {e.description && (
                      <div style={{ fontSize: 12, color: C.dim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: e.color, background: e.color + '22', padding: '2px 7px', borderRadius: 100, flexShrink: 0 }}>
                    {TYPE_LABELS[e.entry_type]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Day Detail Panel (mobile bottom sheet) ───────────────────────────────────

function DayDetailPanel({ day, entries, onClose, onEntryClick, onAdd }: {
  day: Date
  entries: CalendarEntry[]
  onClose: () => void
  onEntryClick: (e: CalendarEntry) => void
  onAdd: (d: Date) => void
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 59 }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
        background: C.surface, borderRadius: '20px 20px 0 0',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
        maxHeight: '72dvh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.15)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px 12px', borderBottom: `1px solid ${C.border}`, gap: 10 }}>
          <h3 style={{ flex: 1, fontSize: 16, fontWeight: 700, margin: 0, color: C.text }}>
            {day.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <button
            onClick={() => onAdd(day)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: C.accent, color: '#fff', fontFamily: 'inherit' }}
          >
            <Plus size={14} /> Termin
          </button>
        </div>

        {/* Events list */}
        <div style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
          {entries.length === 0 ? (
            <p style={{ fontSize: 14, color: C.dim, textAlign: 'center', padding: '24px 0' }}>Keine Termine an diesem Tag.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {entries.map(e => (
                <button
                  key={e.id}
                  onClick={() => onEntryClick(e)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderRadius: 12, background: e.color + '14', border: `1px solid ${e.color}30`,
                    cursor: (e.editable || e.href) ? 'pointer' : 'default',
                    width: '100%', textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                    {e.description && (
                      <div style={{ fontSize: 12, color: C.dim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: e.color, background: e.color + '22', padding: '2px 7px', borderRadius: 100, flexShrink: 0 }}>
                    {TYPE_LABELS[e.entry_type]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Entry Modal (Create / Edit) ───────────────────────────────────────────────

function EntryModal({ modal, onClose, onSaved, onDeleted }: {
  modal: ModalState
  onClose: () => void
  onSaved: () => Promise<void>
  onDeleted: () => Promise<void>
}) {
  const isEdit = modal.mode === 'edit'
  const initial = isEdit ? modal.entry : null

  const todayStr = ymd(new Date())
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [startDate, setStartDate] = useState(initial ? ymd(entryDate(initial)) : ymd(modal.mode === 'create' ? modal.initialDate : new Date()))
  const [endDate, setEndDate] = useState(initial?.end_at ? ymd(new Date(initial.end_at)) : '')
  const [color, setColor] = useState(initial?.color ?? '#2352C8')
  const [entryType, setEntryType] = useState<CalendarEntry['entry_type']>(initial?.entry_type ?? 'custom')
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [err, setErr] = useState('')
  const confirm = useConfirm()

  async function save() {
    if (!title.trim()) { setErr('Bitte Titel eingeben.'); return }
    setBusy('save'); setErr('')
    const body = {
      title: title.trim(),
      description,
      start_at: `${startDate}T00:00:00.000Z`,
      end_at: endDate ? `${endDate}T23:59:59.000Z` : null,
      all_day: true,
      color,
      entry_type: entryType,
    }
    const url = isEdit ? `/api/vendor/calendar/${initial!.id}` : '/api/vendor/calendar'
    const method = isEdit ? 'PATCH' : 'POST'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setBusy(null)
    if (!r.ok) { const d = await r.json(); setErr(d.error ?? 'Fehler'); return }
    await onSaved()
  }

  async function remove() {
    if (!(await confirm('Termin löschen?'))) return
    setBusy('delete')
    await fetch(`/api/vendor/calendar/${initial!.id}`, { method: 'DELETE' })
    setBusy(null)
    await onDeleted()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 16, width: 440, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ flex: 1, margin: 0, fontSize: 16, fontWeight: 700 }}>{isEdit ? 'Termin bearbeiten' : 'Neuer Termin'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <p style={{ color: 'var(--red, #C5221F)', fontSize: 13, margin: 0 }}>{err}</p>}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.dim, display: 'block', marginBottom: 5 }}>Titel *</label>
            <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="z. B. Meeting mit Florist" autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.dim, display: 'block', marginBottom: 5 }}>Datum *</label>
              <input style={inp} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={todayStr} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.dim, display: 'block', marginBottom: 5 }}>Enddatum</label>
              <input style={inp} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.dim, display: 'block', marginBottom: 5 }}>Kategorie</label>
            <select
              style={{ ...inp }}
              value={entryType}
              onChange={e => setEntryType(e.target.value as CalendarEntry['entry_type'])}
            >
              {(Object.keys(TYPE_LABELS) as CalendarEntry['entry_type'][])
                .filter(t => t !== 'event')
                .map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.dim, display: 'block', marginBottom: 8 }}>Farbe</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                    cursor: 'pointer', outline: color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2, boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none',
                    transition: 'box-shadow .15s',
                  }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.dim, display: 'block', marginBottom: 5 }}>Notiz</label>
            <textarea
              style={{ ...inp, height: 'auto', padding: '8px 10px', minHeight: 60, resize: 'vertical' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung…"
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: `1px solid ${C.border}`, justifyContent: 'flex-end' }}>
          {isEdit && (
            <button
              onClick={remove}
              disabled={!!busy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid rgba(197,34,31,0.3)`, background: 'transparent', color: 'var(--red, #C5221F)', fontFamily: 'inherit', marginRight: 'auto' }}
            >
              {busy === 'delete' ? <Loader2 size={14} className="vc-spin" /> : <Trash2 size={14} />} Löschen
            </button>
          )}
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${C.border}`, background: 'transparent', fontFamily: 'inherit', color: C.dim }}>
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={!!busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: C.accent, color: '#fff', fontFamily: 'inherit' }}
          >
            {busy === 'save' ? <Loader2 size={14} className="vc-spin" /> : null}
            {isEdit ? 'Speichern' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}
