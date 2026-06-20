'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Send, Loader2, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import type { PublicQuestionnaire, PublicQQuestion } from '@/lib/vendor/questionnaire'

interface Props {
  eventId: string
  vendorId: string
  onSent: (existing: { id: string; status: string; conversation_id: string | null }) => void
}

type AnswerMap = Record<string, unknown>

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
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [message, setMessage] = useState('')
  const [budget, setBudget] = useState('')
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/marketplace/questionnaire/${vendorId}`)
      .then(r => r.json())
      .then(d => { if (active) { setQ(d.questionnaire ?? null); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [vendorId])

  const allQuestions = useMemo(() => (q?.sections ?? []).flatMap(s => s.questions), [q])
  const setAnswer = (id: string, v: unknown) => setAnswers(a => ({ ...a, [id]: v }))

  function goReview() {
    const missing = allQuestions.filter(qq => qq.required && isEmpty(answers[qq.id]))
    if (missing.length > 0) { setErr(`Bitte beantworte: ${missing.map(m => m.label).join(', ')}`); return }
    setErr(''); setStep('review')
  }

  async function send() {
    setErr(''); setBusy(true)
    try {
      const res = await fetch('/api/marketplace/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, dienstleisterId: vendorId, message, budget, answers }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onSent({ id: json.id, status: 'pending', conversation_id: null })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fehler')
    } finally { setBusy(false) }
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bp-ink-3)', fontSize: 13.5, padding: '8px 0' }}><Loader2 size={15} className="bp-spin" /> Lädt…</div>
  }

  // Fallback ohne Fragebogen: klassische Freitext-Anfrage.
  if (!q) {
    return (
      <>
        <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 4px' }}>Anfrage stellen</h3>
        <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 12px' }}>Eure Event-Eckdaten (Datum, Ort, Gästezahl) werden automatisch mitgesendet.</p>
        {err && <p style={{ color: '#C62828', fontSize: 12.5, margin: '0 0 8px' }}>{err}</p>}
        <textarea className="bp-textarea" placeholder="Beschreibt euer Anliegen, Wünsche, offene Fragen…" value={message} onChange={e => setMessage(e.target.value)} style={{ minHeight: 96, marginBottom: 8 }} />
        <input className="bp-input" type="number" placeholder="Budget (optional, €)" value={budget} onChange={e => setBudget(e.target.value)} style={{ marginBottom: 12 }} />
        <button onClick={send} disabled={busy} className="bp-btn bp-btn-primary" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {busy ? <Loader2 size={15} className="bp-spin" /> : <Send size={15} />} {busy ? 'Sendet…' : 'Anfrage senden'}
        </button>
      </>
    )
  }

  if (step === 'review') {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <ClipboardList size={17} style={{ color: 'var(--bp-gold-deep)' }} />
          <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: 0 }}>Zusammenfassung</h3>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 12px' }}>Bitte prüft eure Angaben, bevor ihr die Anfrage absendet.</p>
        {err && <p style={{ color: '#C62828', fontSize: 12.5, margin: '0 0 8px' }}>{err}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
          {q.sections.map(s => {
            const answered = s.questions.filter(qq => !isEmpty(answers[qq.id]))
            if (answered.length === 0) return null
            return (
              <div key={s.id}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--bp-ink-3)', marginBottom: 6 }}>{s.title}</div>
                {answered.map(qq => (
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

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setStep('form')} className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ChevronLeft size={15} /> Zurück
          </button>
          <button onClick={send} disabled={busy} className="bp-btn bp-btn-primary" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {busy ? <Loader2 size={15} className="bp-spin" /> : <Send size={15} />} {busy ? 'Sendet…' : 'Anfrage senden'}
          </button>
        </div>
      </>
    )
  }

  // Formular
  return (
    <>
      <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 4px' }}>{q.title}</h3>
      {q.intro_text
        ? <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 12px', lineHeight: 1.5 }}>{q.intro_text}</p>
        : <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 12px' }}>Eure Event-Eckdaten (Datum, Ort, Gästezahl) werden automatisch mitgesendet.</p>}
      {err && <p style={{ color: '#C62828', fontSize: 12.5, margin: '0 0 8px' }}>{err}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 14 }}>
        {q.sections.map(s => (
          <div key={s.id}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--bp-ink-3)', marginBottom: 8 }}>{s.title}</div>
            {s.description && <p style={{ fontSize: 12, color: 'var(--bp-ink-3)', margin: '0 0 10px' }}>{s.description}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {s.questions.map(qq => (
                <QuestionInput key={qq.id} q={qq} value={answers[qq.id]} onChange={v => setAnswer(qq.id, v)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--bp-rule)', paddingTop: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--bp-ink-3)', display: 'block', marginBottom: 6 }}>Nachricht (optional)</label>
        <textarea className="bp-textarea" placeholder="Weitere Wünsche oder Fragen…" value={message} onChange={e => setMessage(e.target.value)} style={{ minHeight: 70, marginBottom: 8 }} />
        <input className="bp-input" type="number" placeholder="Budget (optional, €)" value={budget} onChange={e => setBudget(e.target.value)} />
      </div>

      <button onClick={goReview} className="bp-btn bp-btn-primary" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        Weiter zur Zusammenfassung <ChevronRight size={15} />
      </button>
    </>
  )
}

function QuestionInput({ q, value, onChange }: { q: PublicQQuestion; value: unknown; onChange: (v: unknown) => void }) {
  const label = (
    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--bp-ink)', display: 'block', marginBottom: 6 }}>
      {q.label}{q.required && <span style={{ color: '#C62828' }}> *</span>}
      {q.help_text && <span style={{ display: 'block', fontWeight: 400, fontSize: 11.5, color: 'var(--bp-ink-3)', marginTop: 2 }}>{q.help_text}</span>}
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
    return <div>{label}<input className="bp-input" type="number" value={value === undefined || value === null ? '' : String(value)} onChange={e => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} /></div>
  }
  if (q.type === 'date') {
    return <div>{label}<input className="bp-input" type="date" value={value ? String(value) : ''} onChange={e => onChange(e.target.value)} /></div>
  }
  return <div>{label}<textarea className="bp-textarea" value={value ? String(value) : ''} onChange={e => onChange(e.target.value)} style={{ minHeight: 60 }} /></div>
}
