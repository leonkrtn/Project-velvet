'use client'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogOut, AlertTriangle, X, ArrowLeftRight, Send, Clock, Users, MessageSquare, CheckCircle, Circle } from 'lucide-react'

type Day = { id: string; label: string; date: string; sort_order: number }
type Shift = { id: string; day_id: string; staff_id: string; task: string; start_hour: number; end_hour: number; backup_staff_id: string | null }
type Swap = { id: string; shift_id: string; to_staff_id: string | null; status: string; notes: string | null; requested_at: string }
type StaffMember = { id: string; name: string }
type TimeLog = { id: string; shift_id: string; staff_id: string; actual_start: string | null; actual_end: string | null; notes: string | null }
type ChatMessage = { id: string; conversation_id: string; sender_id: string | null; content: string; created_at: string; sender?: { name: string } | null }

type ActiveTab = 'schicht' | 'team' | 'chat'

interface Props {
  eventId: string
  eventTitle: string
  staffId: string
  staffName: string
  staffAuthUserId: string
  organizerAuthUserId: string
  days: Day[]
  allDays: Day[]
  myShifts: Shift[]
  allShifts: Shift[]
  allStaff: StaffMember[]
  mySwaps: Swap[]
  myTimeLogs: TimeLog[]
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

function fmtDateShort(dateStr: string): string {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit',
    })
  } catch { return dateStr }
}

function fmtTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase()
}

export default function SchichtplanClient({
  eventId, eventTitle, staffId, staffName, staffAuthUserId, organizerAuthUserId,
  days, allDays, myShifts, allShifts, allStaff,
  mySwaps: initialSwaps, myTimeLogs: initialTimeLogs,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [activeTab, setActiveTab] = useState<ActiveTab>('schicht')

  // Own shifts + swaps
  const [swapModalShift, setSwapModalShift] = useState<Shift | null>(null)
  const [swapTargetId, setSwapTargetId] = useState('')
  const [swapNote, setSwapNote] = useState('')
  const [swapSubmitting, setSwapSubmitting] = useState(false)
  const [swapError, setSwapError] = useState('')
  const [mySwaps, setMySwaps] = useState<Swap[]>(initialSwaps)

  // Time logs (check-in/out)
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>(initialTimeLogs)
  const [checkingIn, setCheckingIn] = useState<string | null>(null) // shiftId being processed

  // Team tab
  const [teamDayId, setTeamDayId] = useState<string | null>(allDays[0]?.id ?? null)

  // Chat
  const [chatConvId, setChatConvId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── Logout ──────────────────────────────────────────────────────────────────
  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── Swap ─────────────────────────────────────────────────────────────────────
  async function submitSwapRequest() {
    if (!swapModalShift) return
    setSwapSubmitting(true); setSwapError('')
    try {
      const res = await fetch('/api/staff/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: swapModalShift.id, toStaffId: swapTargetId || undefined, notes: swapNote }),
      })
      if (!res.ok) { const { error } = await res.json().catch(() => ({ error: 'Fehler' })); setSwapError(error); return }
      const { swap } = await res.json()
      setMySwaps(prev => [...prev, swap])
      setSwapModalShift(null); setSwapTargetId(''); setSwapNote('')
    } finally { setSwapSubmitting(false) }
  }

  async function cancelSwap(swapId: string) {
    const res = await fetch(`/api/staff/swaps/${swapId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) })
    if (res.ok) setMySwaps(prev => prev.filter(s => s.id !== swapId))
  }

  // ── Check-in / Check-out ───────────────────────────────────────────────────
  async function handleCheckin(shift: Shift, action: 'checkin' | 'checkout') {
    setCheckingIn(shift.id)
    try {
      const res = await fetch('/api/staff/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: shift.id, action }),
      })
      if (!res.ok) return
      const { log } = await res.json()
      setTimeLogs(prev => {
        const existing = prev.findIndex(l => l.id === log.id)
        if (existing >= 0) return prev.map((l, i) => i === existing ? log : l)
        return [...prev, log]
      })
    } finally { setCheckingIn(null) }
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'chat' || chatConvId) return
    setChatLoading(true)
    fetch('/api/staff/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, staffId }),
    })
      .then(r => r.json())
      .then(async ({ conversationId }) => {
        if (!conversationId) return
        setChatConvId(conversationId)
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, content, created_at, sender:profiles(name)')
          .eq('conversation_id', conversationId)
          .order('created_at')
        setChatMessages((msgs ?? []) as unknown as ChatMessage[])
        setTimeout(() => chatEndRef.current?.scrollIntoView(), 100)

        supabase.channel(`staff-chat-${conversationId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
            async payload => {
              const msg = payload.new as ChatMessage
              const { data: profile } = await supabase.from('profiles').select('name').eq('id', msg.sender_id).maybeSingle()
              setChatMessages(prev => [...prev, { ...msg, sender: profile }])
              setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
            })
          .subscribe()
      })
      .finally(() => setChatLoading(false))
  }, [activeTab])

  async function sendMessage() {
    if (!chatInput.trim() || !chatConvId || chatSending) return
    const content = chatInput.trim()
    setChatInput('')
    setChatSending(true)
    try {
      await supabase.from('messages').insert({ conversation_id: chatConvId, event_id: eventId, sender_id: staffAuthUserId, content })
    } finally { setChatSending(false) }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const swapByShift = new Map(mySwaps.map(s => [s.shift_id, s]))
  const logByShift = new Map(timeLogs.map(l => [l.shift_id, l]))
  const otherStaff = allStaff.filter(s => s.id !== staffId)

  const teamDayShifts = teamDayId ? allShifts.filter(s => s.day_id === teamDayId) : []
  const staffById = new Map(allStaff.map(s => [s.id, s]))

  // ── Helpers ───────────────────────────────────────────────────────────────
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: active ? 700 : 500, fontFamily: 'inherit',
    color: active ? '#6366F1' : '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    borderTop: active ? '2px solid #6366F1' : '2px solid transparent', transition: 'all 0.15s',
  })

  return (
    <div style={{ minHeight: '100dvh', background: '#F3F4F6', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{eventTitle}</p>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>Hallo, {staffName} 👋</h1>
          </div>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#6B7280', fontFamily: 'inherit' }}>
            <LogOut size={13} /> Abmelden
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>

        {/* SCHICHT TAB */}
        {activeTab === 'schicht' && (
          <div style={{ padding: '20px 16px', maxWidth: 540, margin: '0 auto' }}>
            {days.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>Du bist noch keinem Tag zugeteilt.</p>
              </div>
            ) : days.map(day => {
              const dayShifts = myShifts.filter(s => s.day_id === day.id)
              const totalH = dayShifts.reduce((sum, s) => sum + (s.end_hour - s.start_hour), 0)
              return (
                <div key={day.id} style={{ marginBottom: 24 }}>
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 1px' }}>{day.label}</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{fmtDate(day.date)}</p>
                  </div>

                  {dayShifts.length === 0 ? (
                    <div style={{ padding: '14px 16px', background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, color: '#9CA3AF' }}>
                      Keine Schichten an diesem Tag.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {dayShifts.map(shift => {
                        const dur = shift.end_hour - shift.start_hour
                        const hasBreakWarning = dur > 6
                        const existingSwap = swapByShift.get(shift.id)
                        const backupStaff = shift.backup_staff_id ? allStaff.find(s => s.id === shift.backup_staff_id) : null
                        const log = logByShift.get(shift.id)
                        const isCheckedIn = !!log?.actual_start && !log?.actual_end
                        const isCheckedOut = !!log?.actual_end
                        const isBusy = checkingIn === shift.id

                        return (
                          <div key={shift.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            <div style={{ height: 4, background: isCheckedIn ? '#10B981' : isCheckedOut ? '#6B7280' : '#6366F1' }} />
                            <div style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>{shift.task}</p>
                                  <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                                    {fmtHour(shift.start_hour)} – {fmtHour(shift.end_hour)}
                                    <span style={{ marginLeft: 8, color: '#9CA3AF', fontSize: 11 }}>{dur.toFixed(1).replace('.0', '')} h</span>
                                  </p>
                                </div>
                                {!existingSwap && !isCheckedIn && !isCheckedOut && (
                                  <button onClick={() => { setSwapModalShift(shift); setSwapError('') }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'none', border: '1px solid #E5E7EB', borderRadius: 7, cursor: 'pointer', fontSize: 11, color: '#6B7280', fontFamily: 'inherit', flexShrink: 0 }}>
                                    <ArrowLeftRight size={11} /> Tausch
                                  </button>
                                )}
                              </div>

                              {hasBreakWarning && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 7 }}>
                                  <AlertTriangle size={12} style={{ color: '#D97706', flexShrink: 0 }} />
                                  <p style={{ fontSize: 11, color: '#92400E', margin: 0 }}>Gesetzliche Pause nach 6 h beachten.</p>
                                </div>
                              )}

                              {backupStaff && (
                                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '8px 0 0' }}>
                                  Vertreter: <span style={{ fontWeight: 600, color: '#6B7280' }}>{backupStaff.name}</span>
                                </p>
                              )}

                              {existingSwap && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '6px 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 7 }}>
                                  <ArrowLeftRight size={11} style={{ color: '#2563EB' }} />
                                  <p style={{ fontSize: 11, color: '#1D4ED8', margin: 0, flex: 1 }}>
                                    {existingSwap.status === 'pending' ? 'Tausch beantragt' : 'Tausch angenommen – wartet auf Veranstalter'}
                                    {existingSwap.to_staff_id ? ` → ${allStaff.find(s => s.id === existingSwap.to_staff_id)?.name ?? ''}` : ' (offen)'}
                                  </p>
                                  <button onClick={() => cancelSwap(existingSwap.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>
                                    <X size={12} />
                                  </button>
                                </div>
                              )}

                              {/* Check-in / Check-out button */}
                              {!existingSwap && (
                                <div style={{ marginTop: 12 }}>
                                  {isCheckedOut ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#F3F4F6', borderRadius: 10, fontSize: 13, color: '#6B7280' }}>
                                      <Clock size={14} style={{ color: '#9CA3AF' }} />
                                      Abgestempelt {log?.actual_start ? fmtHour(new Date(log.actual_start).getHours() + new Date(log.actual_start).getMinutes() / 60) : ''} – {log?.actual_end ? fmtHour(new Date(log.actual_end).getHours() + new Date(log.actual_end).getMinutes() / 60) : ''}
                                    </div>
                                  ) : isCheckedIn ? (
                                    <button
                                      onClick={() => handleCheckin(shift, 'checkout')}
                                      disabled={isBusy}
                                      style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: 'none', background: isBusy ? '#E5E7EB' : '#10B981', color: '#fff', fontSize: 14, fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                    >
                                      <CheckCircle size={16} />
                                      {isBusy ? 'Bitte warten …' : 'Jetzt ausstempeln'}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleCheckin(shift, 'checkin')}
                                      disabled={isBusy}
                                      style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: 'none', background: isBusy ? '#E5E7EB' : '#6366F1', color: '#fff', fontSize: 14, fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                    >
                                      <Circle size={16} />
                                      {isBusy ? 'Bitte warten …' : 'Jetzt einstempeln'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {totalH > 0 && (
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: '8px 0 0', textAlign: 'right' }}>
                      Gesamt: {totalH.toFixed(1).replace('.0', '')} h
                      {totalH > 6 && <span style={{ color: '#D97706', marginLeft: 6 }}>⚠ Pause planen</span>}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* TEAM TAB */}
        {activeTab === 'team' && (
          <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>
            {/* Day selector */}
            {allDays.length > 0 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 20 }}>
                {allDays.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setTeamDayId(d.id)}
                    style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: teamDayId === d.id ? 700 : 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: teamDayId === d.id ? '#6366F1' : '#fff', color: teamDayId === d.id ? '#fff' : '#6B7280', boxShadow: teamDayId === d.id ? '0 2px 6px rgba(99,102,241,0.3)' : '0 1px 3px rgba(0,0,0,0.08)', transition: 'all 0.15s' }}
                  >
                    <div>{d.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.8, marginTop: 1 }}>{fmtDateShort(d.date)}</div>
                  </button>
                ))}
              </div>
            )}

            {allDays.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>Noch keine Planungstage angelegt.</p>
              </div>
            ) : teamDayShifts.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>Keine Schichten an diesem Tag geplant.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Group by staff member */}
                {allStaff.map(member => {
                  const memberShifts = teamDayShifts.filter(s => s.staff_id === member.id)
                  if (memberShifts.length === 0) return null
                  const isMe = member.id === staffId
                  return (
                    <div key={member.id} style={{ background: '#fff', borderRadius: 12, border: isMe ? '2px solid #6366F1' : '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div style={{ padding: '10px 14px', background: isMe ? '#EEF2FF' : '#FAFAFA', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: isMe ? '#6366F1' : '#9CA3AF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {initials(member.name)}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isMe ? '#4338CA' : '#374151' }}>
                          {member.name} {isMe && <span style={{ fontSize: 11, fontWeight: 500, color: '#6366F1' }}>(Du)</span>}
                        </span>
                      </div>
                      <div style={{ padding: '8px 14px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {memberShifts.map(shift => (
                          <div key={shift.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 3, height: 36, background: '#6366F1', borderRadius: 2, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{shift.task}</div>
                              <div style={{ fontSize: 12, color: '#6B7280' }}>
                                {fmtHour(shift.start_hour)} – {fmtHour(shift.end_hour)}
                                <span style={{ marginLeft: 6, color: '#9CA3AF', fontSize: 11 }}>
                                  {(shift.end_hour - shift.start_hour).toFixed(1).replace('.0', '')} h
                                </span>
                              </div>
                            </div>
                            {shift.end_hour - shift.start_hour > 6 && (
                              <AlertTriangle size={13} style={{ color: '#D97706', marginLeft: 'auto', flexShrink: 0 }} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Staff with no shifts on this day */}
                {allStaff.filter(m => !teamDayShifts.some(s => s.staff_id === m.id)).map(member => (
                  <div key={member.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#D1D5DB', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {initials(member.name)}
                    </div>
                    <span style={{ fontSize: 13, color: '#9CA3AF' }}>{member.name} · frei</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 140px)' }}>
            {/* Chat header */}
            <div style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366F1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>V</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Veranstalter</div>
                <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>Dein direkter Draht</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: '#F3F4F6' }}>
              {chatLoading ? (
                <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 40 }}>Lade Chat …</p>
              ) : chatMessages.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 40 }}>Noch keine Nachrichten. Schreibe dem Veranstalter!</p>
              ) : chatMessages.map(msg => {
                const isMine = msg.sender_id === staffAuthUserId
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: 2 }}>
                    <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: isMine ? '#6366F1' : '#fff', color: isMine ? '#fff' : '#111827', fontSize: 14, lineHeight: 1.45, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                      {msg.content}
                    </div>
                    <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>
                      {isMine ? 'Du' : (msg.sender?.name ?? 'Veranstalter')} · {fmtTime(msg.created_at)}
                    </span>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '10px 14px', background: '#fff', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, flexShrink: 0 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Nachricht …"
                style={{ flex: 1, padding: '10px 14px', fontSize: 14, border: '1px solid #E5E7EB', borderRadius: 10, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#111827' }}
              />
              <button
                onClick={sendMessage}
                disabled={!chatInput.trim() || chatSending || !chatConvId}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 10, border: 'none', background: chatInput.trim() && chatConvId ? '#6366F1' : '#E5E7EB', color: '#fff', cursor: chatInput.trim() && chatConvId ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'background 0.15s' }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E5E7EB', display: 'flex', zIndex: 30, boxShadow: '0 -2px 10px rgba(0,0,0,0.06)' }}>
        <button onClick={() => setActiveTab('schicht')} style={tabBtnStyle(activeTab === 'schicht')}>
          <Clock size={18} />
          <span>Mein Plan</span>
        </button>
        <button onClick={() => setActiveTab('team')} style={tabBtnStyle(activeTab === 'team')}>
          <Users size={18} />
          <span>Team</span>
        </button>
        <button onClick={() => setActiveTab('chat')} style={tabBtnStyle(activeTab === 'chat')}>
          <MessageSquare size={18} />
          <span>Chat</span>
        </button>
      </div>

      {/* ── Swap modal ── */}
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
              <select value={swapTargetId} onChange={e => setSwapTargetId(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: '#fff', outline: 'none' }}>
                <option value="">— Offen (jeder kann übernehmen) —</option>
                {otherStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Grund (optional)</label>
              <textarea value={swapNote} onChange={e => setSwapNote(e.target.value)} placeholder="z.B. Arzttermin…" rows={2} style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            </div>
            {swapError && <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12 }}>{swapError}</p>}
            <button onClick={submitSwapRequest} disabled={swapSubmitting} style={{ width: '100%', padding: '12px', background: swapSubmitting ? '#D1D5DB' : '#6366F1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: swapSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {swapSubmitting ? 'Wird gesendet…' : 'Tausch beantragen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
