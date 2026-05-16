'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DayCalendar, { type CalendarEntry } from '@/components/ablaufplan/DayCalendar'
import { type AblaufplanDay } from '@/components/ablaufplan/EventModal'
import EventModal, { type TimelineEntry } from '@/components/ablaufplan/EventModal'

type Access = 'none' | 'read' | 'write'

function defaultDay(): AblaufplanDay {
  return { id: '', event_id: '', day_index: 0, name: 'Tag 1', start_hour: 7, end_hour: 25 }
}

export default function TimelineTab({
  eventId,
  tabAccess = 'read',
}: {
  eventId: string
  tabAccess?: Access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sectionPerms?: Record<string, any>
}) {
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [days,    setDays]    = useState<AblaufplanDay[]>([defaultDay()])
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState(0)
  const [modal, setModal] = useState<TimelineEntry | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase
        .from('timeline_entries')
        .select('*')
        .eq('event_id', eventId)
        .order('day_index',     { ascending: true })
        .order('start_minutes', { ascending: true, nullsFirst: false }),
      supabase
        .from('ablaufplan_days')
        .select('*')
        .eq('event_id', eventId)
        .order('day_index', { ascending: true }),
    ]).then(([entriesRes, daysRes]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEntries((entriesRes.data ?? []).map((e: any) => ({
        ...e,
        checklist:        e.checklist        ?? [],
        assigned_staff:   e.assigned_staff   ?? [],
        assigned_vendors: e.assigned_vendors ?? [],
        assigned_members: e.assigned_members ?? [],
      })))
      setDays(daysRes.data?.length ? daysRes.data as AblaufplanDay[] : [defaultDay()])
      setLoading(false)
    })
  }, [eventId])

  if (tabAccess === 'none') {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        Kein Zugriff auf den Ablaufplan.
      </div>
    )
  }

  if (loading) {
    const HOUR_H = 80
    const hours = Array.from({ length: 16 }, (_, i) => i + 8) // 08:00–23:00
    // Fake events at representative positions
    const fakeEvents = [
      { top: 1 * HOUR_H,  height: 1.5 * HOUR_H, left: '60px', width: '55%', label: true },
      { top: 3 * HOUR_H,  height: 1 * HOUR_H,   left: '60px', width: '40%', label: false },
      { top: 5 * HOUR_H,  height: 2 * HOUR_H,   left: '60px', width: '60%', label: true },
      { top: 8.5 * HOUR_H, height: 1 * HOUR_H,  left: '60px', width: '45%', label: false },
      { top: 10 * HOUR_H, height: 1.5 * HOUR_H, left: '60px', width: '50%', label: true },
    ]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
        {/* h1 */}
        <div className="skeleton" style={{ height: 32, width: 180, marginBottom: 16, flexShrink: 0 }} />
        {/* Day tabs row */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexShrink: 0 }}>
          {[80, 80, 80].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 32, width: w, borderRadius: 'var(--radius-sm)' }} />
          ))}
        </div>
        {/* Calendar shell */}
        <div style={{ flex: 1, overflowY: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface)', position: 'relative' }}>
          <div style={{ position: 'relative', height: hours.length * HOUR_H }}>
            {/* Hour grid lines + time labels */}
            {hours.map((h, i) => (
              <div key={h} style={{ position: 'absolute', top: i * HOUR_H, left: 0, right: 0, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', paddingTop: 6 }}>
                <div className="skeleton" style={{ height: 10, width: 36, marginLeft: 12, borderRadius: 4, flexShrink: 0 }} />
              </div>
            ))}
            {/* Fake event blocks */}
            {fakeEvents.map((ev, i) => (
              <div key={i} style={{ position: 'absolute', top: ev.top + 2, left: ev.left, width: ev.width, height: ev.height - 4, borderRadius: 6, background: 'linear-gradient(90deg, #DCDCDE 25%, #E8E8EA 50%, #DCDCDE 75%)', backgroundSize: '1200px 100%', animation: 'skeletonShimmer 1.6s ease-in-out infinite', overflow: 'hidden', padding: '8px 10px' }}>
                {ev.label && (
                  <>
                    <div className="skeleton" style={{ height: 11, width: '60%', marginBottom: 5, background: 'rgba(255,255,255,0.5)', borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 9, width: '40%', background: 'rgba(255,255,255,0.4)', borderRadius: 4 }} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const currentDay  = days.find(d => d.day_index === activeDay) ?? days[0]
  const dayEntries  = entries.filter(e => e.day_index === activeDay) as CalendarEntry[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 16, flexShrink: 0 }}>Ablaufplan</h1>

      {/* Day tabs */}
      {days.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexShrink: 0, flexWrap: 'wrap' }}>
          {days.map(day => (
            <button
              key={day.day_index}
              onClick={() => setActiveDay(day.day_index)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13,
                border: `1.5px solid ${activeDay === day.day_index ? 'var(--accent)' : 'var(--border)'}`,
                background: activeDay === day.day_index ? 'var(--accent-light)' : 'transparent',
                color: activeDay === day.day_index ? 'var(--accent)' : 'var(--text)',
                fontWeight: activeDay === day.day_index ? 700 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {day.name}
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 5 }}>
                ({entries.filter(e => e.day_index === day.day_index).length})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Calendar — read-only for vendors */}
      <div style={{ flex: 1, overflowY: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
        {dayEntries.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
            Noch keine Einträge für diesen Tag.
          </div>
        ) : (
          <div style={{ paddingBottom: 24 }}>
            <DayCalendar
              entries={dayEntries}
              startHour={currentDay.start_hour}
              endHour={currentDay.end_hour}
              readOnly={true}
              onEventClick={e => setModal(e as TimelineEntry)}
              onEmptyClick={() => {}}
              onDragCreate={() => {}}
              onEventMove={() => {}}
            />
          </div>
        )}
      </div>

      {/* Read-only detail modal */}
      {modal && (
        <EventModal
          entry={modal}
          activeDay={activeDay}
          days={days}
          eventId={eventId}
          members={[]}
          staff={[]}
          vendors={[]}
          role="dienstleister"
          readOnly={true}
          onSave={async () => {}}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
