'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Send, Loader2, ChevronLeft, ChevronRight, ClipboardList, X } from 'lucide-react'
import type { PublicQuestionnaire, PublicQQuestion, PublicQSection } from '@/lib/vendor/questionnaire'

interface Props {
  eventId: string
  vendorId: string
  onSent: (existing: { id: string; status: string; conversation_id: string | null }) => void
}

type AnswerMap = Record<string, unknown>
type Step = { kind: 'section'; section: PublicQSection; roundNo: number } | { kind: 'message' } | { kind: 'review' }

function displayValue(q: PublicQQuestion, v: unknown): string {
  if (v === undefined || v === null || v === '') return '—'
  if (q.type === 'single') return q.options.find(o => o.id === v)?.label ?? String(v)
  if (q.type === 'multi') {
    const ids = Array.isArray(v) ? v : [v]
    if (ids.length === 0) return '—'
    return ids.map(id => q.options.find(o => o.id === id)?.label ?? String(id)).join(', ')
  }
  if (q.type === 'boolean') return v === true || v === 'true' ? 'Ja' : 'Nein'
  return String(v)
}
function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
}

export default function RequestFlow({ eventId, vendorId, onSent }: Props) {
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState<PublicQuestionnaire | null>(null)
  const [open, setOpen] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [message, setMessage] = useState('')
  const [budget, setBudget] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // Vorhandenes Event-Budget als Platzhalter vorschlagen, statt es erneut
  // eintippen zu lassen (Event-Eckdaten werden ohnehin automatisch mitgesendet).
  const [eventBudget, setEventBudget] = useState<number | null>(null)
  const [eventDate, setEventDate] = useState<string | null>(null)
  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (typeof d?.budget_total === 'number' && d.budget_total > 0) setEventBudget(d.budget_total)
        if (typeof d?.date === 'string') setEventDate(d.date)
      })
      .catch(() => {})
  }, [eventId])

  useEffect(() => {
    let active = true
    fetch(`/api/marketplace/questionnaire/${vendorId}`)
      .then(r => r.json())
      .then(d => { if (active) { setQ(d.questionnaire ?? null); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [vendorId])

  const sections = useMemo(() => q?.sections ?? [], [q])
  const steps: Step[] = useMemo(() => {
    const s: Step[] = sections.map((section, i) => ({ kind: 'section', section, roundNo: i + 1 }))
    s.push({ kind: 'message' }, { kind: 'review' })
    return s
  }, [sections])

  const setAnswer = (id: string, v: unknown) => setAnswers(a => ({ ...a, [id]: v }))

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function start() { setErr(''); setStepIdx(0); setOpen(true) }

  function next() {
    const step = steps[stepIdx]
    if (step.kind === 'section') {
      const missing = step.section.questions.filter(qq => qq.required && isEmpty(answers[qq.id]))
      if (missing.length > 0) { setErr(`Bitte beantworte: ${missing.map(m => m.label).join(', ')}`); return }
    }
    setErr('')
    setStepIdx(i => Math.min(i + 1, steps.length - 1))
  }
  function back() { setErr(''); setStepIdx(i => Math.max(i - 1, 0)) }

  async function send() {
    setErr(''); setBusy(true)
    try {
      const res = await fetch('/api/marketplace/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, dienstleisterId: vendorId, message, budget, answers }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setOpen(false)
      onSent({ id: json.id, status: 'pending', conversation_id: null })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fehler')
    } finally { setBusy(false) }
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bp-ink-3)', fontSize: 13.5, padding: '8px 0' }}><Loader2 size={15} className="bp-spin" /> Lädt…</div>
  }

  const step = steps[stepIdx]
  const isLast = stepIdx === steps.length - 1
  const progress = Math.round(((stepIdx + 1) / steps.length) * 100)
  const stepLabel = step?.kind === 'section'
    ? `Runde ${step.roundNo} von ${sections.length}`
    : step?.kind === 'message' ? 'Eure Nachricht' : 'Zusammenfassung'

  return (
    <>
      {/* Intro-Karte (im Aside) */}
      <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 4px' }}>{q ? q.title : 'Anfrage stellen'}</h3>
      {q?.intro_text
        ? <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 12px', lineHeight: 1.5 }}>{q.intro_text}</p>
        : <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 12px' }}>Eure Event-Eckdaten (Datum, Ort, Gästezahl) werden automatisch mitgesendet.</p>}
      {q && (
        <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ClipboardList size={14} style={{ color: 'var(--bp-gold-deep)' }} /> {sections.length} kurze {sections.length === 1 ? 'Runde' : 'Runden'} mit Fragen
        </p>
      )}
      <button onClick={start} className="bp-btn bp-btn-primary" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {q ? <ClipboardList size={15} /> : <Send size={15} />} Anfrage stellen
      </button>

      {/* Lightbox-Flow */}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="bp-card" style={{ width: 540, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            {/* Header + Fortschritt */}
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--bp-rule)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--bp-gold-deep)' }}>{stepLabel}</div>
                <button onClick={() => setOpen(false)} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bp-ink-3)', display: 'flex', padding: 2 }}><X size={20} /></button>
              </div>
              <div style={{ height: 4, borderRadius: 100, background: 'var(--bp-rule)', marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--bp-gold)', transition: 'width 0.2s' }} />
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
              {err && <p style={{ color: '#C62828', fontSize: 12.5, margin: '0 0 12px' }}>{err}</p>}

              {step?.kind === 'section' && (
                <>
                  <h2 className="bp-font-heading" style={{ fontSize: '1.35rem', margin: '0 0 4px' }}>{step.section.title}</h2>
                  {step.section.description && <p style={{ fontSize: 13, color: 'var(--bp-ink-3)', margin: '0 0 16px', lineHeight: 1.5 }}>{step.section.description}</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {step.section.questions.map(qq => (
                      <QuestionInput key={qq.id} q={qq} value={answers[qq.id]} onChange={v => setAnswer(qq.id, v)} />
                    ))}
                  </div>
                </>
              )}

              {step?.kind === 'message' && (
                <>
                  <h2 className="bp-font-heading" style={{ fontSize: '1.35rem', margin: '0 0 4px' }}>Eure Nachricht</h2>
                  <p style={{ fontSize: 13, color: 'var(--bp-ink-3)', margin: '0 0 16px' }}>Optional — weitere Wünsche, offene Fragen oder euer Budget.</p>
                  <textarea className="bp-textarea" placeholder="Weitere Wünsche oder Fragen…" value={message} onChange={e => setMessage(e.target.value)} style={{ minHeight: 90, marginBottom: 10 }} />
                  <input className="bp-input" type="number" placeholder={eventBudget ? `Budget (optional, € — z.B. ${eventBudget})` : 'Budget (optional, €)'} value={budget} onChange={e => setBudget(e.target.value)} />
                </>
              )}

              {step?.kind === 'review' && (
                <>
                  <h2 className="bp-font-heading" style={{ fontSize: '1.35rem', margin: '0 0 4px' }}>Zusammenfassung</h2>
                  <p style={{ fontSize: 13, color: 'var(--bp-ink-3)', margin: '0 0 16px' }}>Bitte prüft eure Angaben, bevor ihr die Anfrage absendet.</p>
                  {eventDate && (
                    <div style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', marginBottom: 14, padding: '8px 12px', background: 'var(--bp-surface-2,#F7F4EF)', borderRadius: 8 }}>
                      Wird automatisch mitgesendet: Hochzeitsdatum {new Date(eventDate).toLocaleDateString('de-DE')}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {sections.map((s, i) => {
                      const answered = s.questions.filter(qq => !isEmpty(answers[qq.id]))
                      return (
                        <div key={s.id}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--bp-ink-3)' }}>{s.title}</div>
                            <button onClick={() => setStepIdx(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bp-gold-deep)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>Ändern</button>
                          </div>
                          {answered.length === 0
                            ? <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: 0 }}>Keine Angaben.</p>
                            : answered.map(qq => (
                              <div key={qq.id} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '3px 0' }}>
                                <span style={{ color: 'var(--bp-ink-3)', flex: 1 }}>{qq.label}</span>
                                <span style={{ color: 'var(--bp-ink)', fontWeight: 500, flex: 1, textAlign: 'right' }}>{displayValue(qq, answers[qq.id])}</span>
                              </div>
                            ))}
                        </div>
                      )
                    })}
                    {message && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--bp-ink-3)', marginBottom: 6 }}>Nachricht</div>
                        <p style={{ fontSize: 13, margin: 0, whiteSpace: 'pre-wrap' }}>{message}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer-Navigation */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--bp-rule)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={back} disabled={stepIdx === 0} className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, opacity: stepIdx === 0 ? 0.4 : 1 }}>
                <ChevronLeft size={15} /> Zurück
              </button>
              <div style={{ flex: 1 }} />
              {isLast ? (
                <button onClick={send} disabled={busy} className="bp-btn bp-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {busy ? <Loader2 size={15} className="bp-spin" /> : <Send size={15} />} {busy ? 'Sendet…' : 'Anfrage senden'}
                </button>
              ) : (
                <button onClick={next} className="bp-btn bp-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Weiter <ChevronRight size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function QuestionInput({ q, value, onChange }: { q: PublicQQuestion; value: unknown; onChange: (v: unknown) => void }) {
  const label = (
    <label style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--bp-ink)', display: 'block', marginBottom: 6 }}>
      {q.label}{q.required && <span style={{ color: '#C62828' }}> *</span>}
      {q.help_text && <span style={{ display: 'block', fontWeight: 400, fontSize: 12, color: 'var(--bp-ink-3)', marginTop: 2 }}>{q.help_text}</span>}
    </label>
  )

  if (q.type === 'single') {
    return (
      <div>{label}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {q.options.map(o => (
            <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
              <input type="radio" name={q.id} checked={value === o.id} onChange={() => onChange(o.id)} /> {o.label}
            </label>
          ))}
        </div>
      </div>
    )
  }
  if (q.type === 'multi') {
    const arr = Array.isArray(value) ? value as string[] : []
    return (
      <div>{label}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {q.options.map(o => (
            <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={arr.includes(o.id)} onChange={e => onChange(e.target.checked ? [...arr, o.id] : arr.filter(x => x !== o.id))} /> {o.label}
            </label>
          ))}
        </div>
      </div>
    )
  }
  if (q.type === 'boolean') {
    return (
      <div>{label}
        <div style={{ display: 'flex', gap: 8 }}>
          {[['true', 'Ja'], ['false', 'Nein']].map(([val, lab]) => (
            <button key={val} type="button" onClick={() => onChange(val === 'true')}
              className="bp-btn" style={{ flex: 1, background: (value === (val === 'true')) ? 'var(--bp-gold-pale)' : '#fff', borderColor: (value === (val === 'true')) ? 'var(--bp-gold)' : undefined }}>
              {lab}
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (q.type === 'number') {
    return (
      <div>{label}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input className="bp-input" type="number" min={q.min} max={q.max} step={q.step}
            value={value === undefined || value === null ? '' : String(value)}
            onChange={e => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} style={{ flex: 1 }} />
          {q.unitLabel && <span style={{ fontSize: 13, color: 'var(--bp-ink-3)', whiteSpace: 'nowrap' }}>{q.unitLabel}</span>}
        </div>
      </div>
    )
  }
  if (q.type === 'date') {
    return <div>{label}<input className="bp-input" type="date" value={value ? String(value) : ''} onChange={e => onChange(e.target.value)} /></div>
  }
  return <div>{label}<textarea className="bp-textarea" value={value ? String(value) : ''} onChange={e => onChange(e.target.value)} style={{ minHeight: 70 }} /></div>
}
