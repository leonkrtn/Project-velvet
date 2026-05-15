'use client'
import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogOut, AlertTriangle, X, ArrowLeftRight, ChevronRight } from 'lucide-react'

type Day = { id: string; label: string; date: string; sort_order: number }
type Shift = { id: string; day_id: string; staff_id: string; task: string; start_hour: number; end_hour: number; backup_staff_id: string | null }
type Swap = { id: string; shift_id: string; to_staff_id: string | null; status: string; notes: string | null; requested_at: string }
type StaffMember = { id: string; name: string }

interface Props {
  eventId: string
  eventTitle: string
  staffId: string
  staffName: string
  days: Day[]
  shifts: Shift[]
  allStaff: StaffMember[]
  mySwaps: Swap[]
}

function fmtHour(h: number): string {
  const norm = h >= 24 ? h - 24 : h
  const hh = Math.floor(norm)
  const mm = Math.round((norm - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', {
      weekday: 'long', day: '2-digit', month: 'long',
    })
  } catch { return dateStr }
}

export default function SchichtplanClient({ eventId, eventTitle, staffId, staffName, days, shifts, allStaff, mySwaps: initialSwaps }: Props) {
  const [swapModalShift, setSwapModalShift] = useState<Shift | null>(null)
  const [swapTargetId, setSwapTargetId] = useState('')
  const [swapNote, setSwapNote] = useState('')
  const [swapSubmitting, setSwapSubmitting] = useState(false)
  const [swapError, setSwapError] = useState('')
  const [mySwaps, setMySwaps] = useState<Swap[]>(initialSwaps)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function submitSwapRequest() {
    if (!swapModalShift) return
    setSwapSubmitting(true); setSwapError('')
    try {
      const res = await fetch('/api/staff/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: swapModalShift.id,
          toStaffId: swapTargetId || undefined,
          notes: swapNote,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Fehler' }))
        setSwapError(error); return
      }
      const { swap } = await res.json()
      setMySwaps(prev => [...prev, swap])
      setSwapModalShift(null); setSwapTargetId(''); setSwapNote('')
    } finally {
      setSwapSubmitting(false)
    }
  }

  async function cancelSwap(swapId: string) {
    const res = await fetch(`/api/staff/swaps/${swapId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (res.ok) setMySwaps(prev => prev.filter(s => s.id !== swapId))
  }

  const swapByShift = new Map(mySwaps.map(s => [s.shift_id, s]))
  const otherStaff = allStaff.filter(s => s.id !== staffId)

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{eventTitle}</p>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>Mein Schichtplan</h1>
          </div>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#6B7280', fontFamily: 'inherit' }}>
            <LogOut size={13} /> Abmelden
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '6px 0 0' }}>Hallo, {staffName} 👋</p>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 540, margin: '0 auto' }}>
        {days.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
            <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>Du bist noch keinem Tag zugeteilt.</p>
          </div>
        ) : (
          days.map(day => {
            const dayShifts = shifts.filter(s => s.day_id === day.id)
            const totalH = dayShifts.reduce((sum, s) => sum + (s.end_hour - s.start_hour), 0)
            return (
              <div key={day.id} style={{ marginBottom: 20 }}>
                {/* Day header */}
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 1px' }}>{day.label}</p>
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{fmtDate(day.date)}</p>
                </div>

                {dayShifts.length === 0 ? (
                  <div style={{ padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, color: '#9CA3AF' }}>
                    Keine Schichten an diesem Tag.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dayShifts.map(shift => {
                      const dur = shift.end_hour - shift.start_hour
                      const hasBreakWarning = dur > 6
                      const existingSwap = swapByShift.get(shift.id)
                      const backupStaff = shift.backup_staff_id ? allStaff.find(s => s.id === shift.backup_staff_id) : null

                      return (
                        <div key={shift.id} style={{
                          background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
                          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}>
                          {/* Shift header strip */}
                          <div style={{ height: 4, background: '#6366F1' }} />

                          <div style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>{shift.task}</p>
                                <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                                  {fmtHour(shift.start_hour)} – {fmtHour(shift.end_hour)}
                                  <span style={{ marginLeft: 8, color: '#9CA3AF', fontSize: 11 }}>{dur.toFixed(1).replace('.0', '')} h</span>
                                </p>
                              </div>
                              {!existingSwap && (
                                <button
                                  onClick={() => { setSwapModalShift(shift); setSwapError('') }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 7, cursor: 'pointer', fontSize: 11, color: '#6B7280', fontFamily: 'inherit', flexShrink: 0 }}
                                >
                                  <ArrowLeftRight size={11} /> Tausch
                                </button>
                              )}
                            </div>

                            {/* Break warning */}
                            {hasBreakWarning && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 7 }}>
                                <AlertTriangle size={12} style={{ color: '#D97706', flexShrink: 0 }} />
                                <p style={{ fontSize: 11, color: '#92400E', margin: 0 }}>Gesetzliche Pause nach 6 h Arbeitszeit beachten.</p>
                              </div>
                            )}

                            {/* Backup person */}
                            {backupStaff && (
                              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '8px 0 0' }}>
                                Vertreter: <span style={{ fontWeight: 600, color: '#6B7280' }}>{backupStaff.name}</span>
                              </p>
                            )}

                            {/* Swap request status */}
                            {existingSwap && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '6px 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 7 }}>
                                <ArrowLeftRight size={11} style={{ color: '#2563EB' }} />
                                <p style={{ fontSize: 11, color: '#1D4ED8', margin: 0, flex: 1 }}>
                                  {existingSwap.status === 'pending' ? 'Tausch beantragt' : 'Tausch angenommen — wartet auf Veranstalter'}
                                  {existingSwap.to_staff_id ? ` → ${allStaff.find(s => s.id === existingSwap.to_staff_id)?.name ?? ''}` : ' (offen)'}
                                </p>
                                <button onClick={() => cancelSwap(existingSwap.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Total hours for day */}
                {totalH > 0 && (
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '8px 0 0', textAlign: 'right' }}>
                    Gesamt: {totalH.toFixed(1).replace('.0', '')} h
                    {totalH > 6 && <span style={{ color: '#D97706', marginLeft: 6 }}>⚠ Pause planen</span>}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Swap modal */}
      {swapModalShift && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSwapModalShift(null) }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Tausch beantragen</h3>
              <button onClick={() => setSwapModalShift(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={18} /></button>
            </div>

            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              Schicht: <strong>{swapModalShift.task}</strong> · {fmtHour(swapModalShift.start_hour)}–{fmtHour(swapModalShift.end_hour)}
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Mit wem tauschen?</label>
              <select
                value={swapTargetId}
                onChange={e => setSwapTargetId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: '#fff', outline: 'none' }}
              >
                <option value="">— Offen (jeder kann übernehmen) —</option>
                {otherStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Grund (optional)</label>
              <textarea
                value={swapNote}
                onChange={e => setSwapNote(e.target.value)}
                placeholder="z.B. Arzttermin, privater Anlass…"
                rows={2}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {swapError && <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12 }}>{swapError}</p>}

            <button
              onClick={submitSwapRequest}
              disabled={swapSubmitting}
              style={{ width: '100%', padding: '12px', background: swapSubmitting ? '#D1D5DB' : '#6366F1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: swapSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {swapSubmitting ? 'Wird gesendet…' : 'Tausch beantragen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
