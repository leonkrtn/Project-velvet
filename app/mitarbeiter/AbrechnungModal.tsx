'use client'
import { useMemo } from 'react'
import { X, TrendingUp } from 'lucide-react'

export type AbrechnungLog = {
  actualStart: string
  actualEnd: string
  shiftHourlyRate: number | null
  dayDate: string
  eventId: string
  eventTitle: string
}

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

function fmtHours(h: number) {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  if (mm === 0) return `${hh} Std.`
  return `${hh}:${String(mm).padStart(2, '0')} Std.`
}

function fmtEuro(amount: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

type MonthEntry = {
  key: string // 'YYYY-MM'
  label: string
  hours: number
  shiftDays: number
  brutto: number
  hasRate: boolean
  events: Map<string, { title: string; hours: number; brutto: number; days: number; hasRate: boolean }>
}

export default function AbrechnungModal({
  logs,
  staffHourlyRate,
  staffName,
  onClose,
}: {
  logs: AbrechnungLog[]
  staffHourlyRate: number | null
  staffName: string
  onClose: () => void
}) {
  const months = useMemo(() => {
    const map = new Map<string, MonthEntry>()

    for (const log of logs) {
      const start = new Date(log.actualStart)
      const end = new Date(log.actualEnd)
      if (isNaN(start.getTime()) || isNaN(end.getTime())) continue

      const hours = Math.max(0, (end.getTime() - start.getTime()) / 3600000)
      const rate = log.shiftHourlyRate ?? staffHourlyRate ?? null
      const brutto = rate != null ? hours * rate : 0
      const hasRate = rate != null

      const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = `${MONTHS[start.getMonth()]} ${start.getFullYear()}`

      if (!map.has(monthKey)) {
        map.set(monthKey, { key: monthKey, label: monthLabel, hours: 0, shiftDays: 0, brutto: 0, hasRate, events: new Map() })
      }
      const m = map.get(monthKey)!
      m.hours += hours
      m.brutto += brutto
      if (!m.hasRate && hasRate) m.hasRate = true

      // Track unique shift days per event
      const dayKey = `${log.eventId}::${log.dayDate}`
      const evEntry = m.events.get(log.eventId) ?? { title: log.eventTitle, hours: 0, brutto: 0, days: 0, hasRate }
      evEntry.hours += hours
      evEntry.brutto += brutto
      if (!evEntry.hasRate && hasRate) evEntry.hasRate = true
      m.events.set(log.eventId, evEntry)
    }

    // Count unique shift days
    const daysSeen = new Map<string, Set<string>>()
    for (const log of logs) {
      const start = new Date(log.actualStart)
      if (isNaN(start.getTime())) continue
      const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
      const m = map.get(monthKey)
      if (!m) continue
      const evDays = daysSeen.get(`${monthKey}::${log.eventId}`) ?? new Set<string>()
      if (!evDays.has(log.dayDate)) {
        evDays.add(log.dayDate)
        const evEntry = m.events.get(log.eventId)
        if (evEntry) evEntry.days++
        m.shiftDays++
      }
      daysSeen.set(`${monthKey}::${log.eventId}`, evDays)
    }

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key))
  }, [logs, staffHourlyRate])

  const yearTotal = useMemo(() => {
    const year = new Date().getFullYear().toString()
    return months
      .filter(m => m.key.startsWith(year))
      .reduce((acc, m) => ({ hours: acc.hours + m.hours, brutto: acc.brutto + m.brutto }), { hours: 0, brutto: 0 })
  }, [months])

  const hasAnyRate = months.some(m => m.hasRate)

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
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580,
          maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-light, #EEF2FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} style={{ color: 'var(--accent, #6366F1)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#111827' }}>Meine Abrechnung</h2>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{staffName}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid #E5E7EB', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {logs.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>Noch keine abgeschlossenen Schichten vorhanden.</p>
            </div>
          ) : (
            <>
              {/* Jahresübersicht */}
              <div style={{
                background: 'var(--accent-light, #EEF2FF)', borderRadius: 12,
                padding: '16px 18px', marginBottom: 20,
                border: '1px solid var(--accent, #6366F1)22',
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent, #6366F1)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
                  Jahresgesamt {new Date().getFullYear()}
                </p>
                <div style={{ display: 'flex', gap: 28 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{fmtHours(yearTotal.hours)}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Stunden</div>
                  </div>
                  {hasAnyRate && (
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{fmtEuro(yearTotal.brutto)}</div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Brutto</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Monate */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {months.map(m => (
                  <div key={m.key} style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                    {/* Monats-Header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6',
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{m.label}</span>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#6B7280' }}>{fmtHours(m.hours)}</span>
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{m.shiftDays} Tag{m.shiftDays !== 1 ? 'e' : ''}</span>
                        {m.hasRate && (
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{fmtEuro(m.brutto)}</span>
                        )}
                      </div>
                    </div>

                    {/* Events in diesem Monat */}
                    <div style={{ padding: '8px 0' }}>
                      {Array.from(m.events.entries()).map(([evId, ev]) => (
                        <div key={evId} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '7px 16px', gap: 12,
                        }}>
                          <span style={{ fontSize: 13, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ev.title}
                          </span>
                          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 12, color: '#9CA3AF' }}>{ev.days} Tag{ev.days !== 1 ? 'e' : ''}</span>
                            <span style={{ fontSize: 12, color: '#6B7280' }}>{fmtHours(ev.hours)}</span>
                            {ev.hasRate && (
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{fmtEuro(ev.brutto)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {!hasAnyRate && (
                <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 16 }}>
                  Kein Stundenlohn hinterlegt — bitte beim Veranstalter erfragen.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
