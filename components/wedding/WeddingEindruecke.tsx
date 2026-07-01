'use client'
// components/wedding/WeddingEindruecke.tsx
// Nach der Hochzeit ersetzt diese Komponente das komplette normale RSVP-Formular
// (siehe isAfterWedding-Zweig in WeddingRsvp.tsx). Eigenständiger, schmaler Ablauf:
// Code eingeben → Fotos hochladen/ansehen (RsvpPhotos) + eine Erinnerung hinterlassen
// (PATCH /api/rsvp/[token]/memory). Im Look des restlichen Templates (.wd-*-Klassen).
import React, { useEffect, useState } from 'react'
import { Camera, Check, Loader, ArrowLeft, Heart } from 'lucide-react'
import RsvpPhotos from '@/components/rsvp/RsvpPhotos'

type Step = 'code' | 'loading' | 'ready'

export default function WeddingEindruecke({ slug, coupleName }: { slug: string; coupleName?: string }) {
  const [step, setStep] = useState<Step>('code')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [guestName, setGuestName] = useState<string>('')

  // Persönlicher Deep-Link aus der Einladung: /wedding/[slug]/rsvp?code=XXXX
  useEffect(() => {
    const c = (new URLSearchParams(window.location.search).get('code') || '').toUpperCase().trim()
    if (!/^[A-Z0-9]{4}$/.test(c)) return
    setCode(c)
    ;(async () => {
      setBusy(true); setError(null); setStep('loading')
      try {
        const res = await fetch(`/api/wedding/public/${slug}/rsvp/lookup`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: c }),
        })
        const d = await res.json()
        if (res.ok) { setToken(d.token); setGuestName(d.name ?? ''); setStep('ready') }
        else { setError(d.error ?? 'Code ungültig'); setStep('code') }
      } catch { setStep('code') } finally { setBusy(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCode(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/wedding/public/${slug}/rsvp/lookup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Code ungültig')
      setToken(d.token); setGuestName(d.name ?? ''); setStep('ready')
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <section className="wd-section wd-rsvp">
      {step !== 'ready' && (
        <div className="wd-card">
          <div className="wd-center" style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'inline-flex', width: 56, height: 56, borderRadius: '50%',
              background: 'var(--wd-accent)', color: '#fff', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1rem',
            }}>
              <Camera size={26} />
            </div>
            <h2 className="wd-h2" style={{ fontSize: '1.6rem' }}>Eindrücke der Hochzeit</h2>
            <p className="wd-body">
              {coupleName ? `${coupleName} sagen Danke fürs Feiern! ` : ''}
              Gib deinen persönlichen Code ein, um Fotos zu teilen und eine Erinnerung zu hinterlassen.
            </p>
          </div>

          {step === 'loading' ? (
            <div className="wd-center"><Loader size={22} className="wd-spin" /></div>
          ) : (
            <form onSubmit={handleCode}>
              <div className="wd-field">
                <label className="wd-label">Dein persönlicher Code</label>
                <input
                  className="wd-input" value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="z.B. K7MQ" autoCapitalize="characters" autoComplete="off"
                  style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.4rem' }}
                />
                <p className="wd-hint">4 Zeichen — du findest ihn in deiner Einladung oder Bestätigungs-E-Mail.</p>
              </div>
              {error && <p className="wd-error">{error}</p>}
              <button className="wd-btn wd-btn-block wd-btn-lg" disabled={busy || code.length !== 4}>
                {busy ? <Loader size={16} className="wd-spin" /> : 'Weiter'}
              </button>
            </form>
          )}
        </div>
      )}

      {step === 'ready' && token && (
        <EindrueckeContent token={token} guestName={guestName} coupleName={coupleName} onBack={() => { setStep('code'); setToken(null) }} />
      )}
    </section>
  )
}

function EindrueckeContent({ token, guestName, coupleName, onBack }: {
  token: string; guestName: string; coupleName?: string; onBack: () => void
}) {
  return (
    <div className="wd-card">
      <button type="button" className="wd-btn wd-btn-ghost" style={{ marginTop: 0, marginBottom: '1rem' }} onClick={onBack}>
        <ArrowLeft size={15} /> Anderer Code
      </button>

      <div className="wd-center" style={{ marginBottom: '1.5rem' }}>
        <h2 className="wd-h2" style={{ fontSize: '1.6rem' }}>
          {guestName ? `Schön, dass du dabei warst, ${guestName.split(' ')[0]}!` : 'Schön, dass du dabei warst!'}
        </h2>
        <p className="wd-body">
          {coupleName ? `${coupleName} freuen` : 'Wir freuen'} sich über jedes Foto und jede Erinnerung an diesen Tag.
        </p>
      </div>

      <RsvpPhotos token={token} />

      <div className="wd-divider-soft" />

      <MemoryForm token={token} />
    </div>
  )
}

function MemoryForm({ token }: { token: string }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/rsvp/${token}/memory`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Speichern fehlgeschlagen')
      setSent(true)
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <h3 className="wd-extras-title">
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Heart size={18} />
          Eine Erinnerung hinterlassen
        </span>
      </h3>
      <p className="wd-body" style={{ marginBottom: '1.25rem', marginTop: '-0.25rem' }}>
        Ein schöner Moment, ein lustiger Spruch, ein Glückwunsch — das Brautpaar freut sich über jede Zeile.
      </p>

      {sent ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.85rem 1rem',
          background: 'color-mix(in srgb, var(--wd-accent) 8%, var(--wd-bg))',
          borderRadius: 'var(--wd-radius)',
          border: '1px solid color-mix(in srgb, var(--wd-accent) 20%, transparent)',
        }}>
          <Check size={16} style={{ color: 'var(--wd-accent)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.92rem', color: 'var(--wd-ink)' }}>Danke! Deine Erinnerung wurde gespeichert.</span>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="wd-field">
            <textarea
              className="wd-textarea" value={text}
              onChange={e => setText(e.target.value.slice(0, 1000))}
              placeholder="Eure Worte…"
            />
          </div>
          {error && <p className="wd-error">{error}</p>}
          <button className="wd-btn wd-btn-lg" disabled={busy || !text.trim()}>
            {busy ? <Loader size={16} className="wd-spin" /> : 'Erinnerung senden'}
          </button>
        </form>
      )}
    </div>
  )
}
