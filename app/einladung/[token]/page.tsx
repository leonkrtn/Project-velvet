'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import '@/app/brautpaar/brautpaar.css'
import {
  DEFAULT_DISPLAY_SETTINGS, HEADING_FONTS, fontHrefFor, shade, textureStyle,
  invitationAccent, invitationFont, focusPosition, focusSize, type DisplaySettings,
} from '@/lib/display-settings'

// Öffentliche Sammel-Link-Seite: Gäste registrieren sich selbst mit ihrem
// Namen und werden danach in den normalen persönlichen RSVP-Flow geleitet.
// Die Gäste erscheinen beim Brautpaar erst nach Bestätigung als vollwertige
// Gäste (pending_approval).
export default function OpenInvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [eventInfo, setEventInfo] = useState<{ title: string; coupleName: string | null; date: string | null } | null>(null)
  const [display, setDisplay] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS)
  const [motiveUrl, setMotiveUrl] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [side, setSide] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/open-invite/${token}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setEventInfo(data)
        if (data.display) setDisplay(data.display as DisplaySettings)
        setMotiveUrl(data.motiveUrl ?? null)
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/open-invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), side: side || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Registrierung fehlgeschlagen')
      router.push(`/rsvp/${data.rsvpToken}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen')
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="bp-auth"><div className="bp-spinner" /></div>
  }

  if (invalid || !eventInfo) {
    return (
      <div className="bp-auth">
        <div className="bp-auth-inner" style={{ textAlign: 'center' }}>
          <p className="bp-auth-wordmark" style={{ marginBottom: 20 }}>FOREVR</p>
          <h1 className="bp-h2" style={{ marginBottom: 8 }}>Link nicht gültig</h1>
          <p className="bp-body">
            Diese Einladung ist nicht mehr aktiv. Bitte wendet euch an das Brautpaar.
          </p>
        </div>
      </div>
    )
  }

  const dateLabel = eventInfo.date
    ? new Date(eventInfo.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const effAccent = invitationAccent(display)
  const effFont = invitationFont(display)
  const headingFamily = HEADING_FONTS[effFont].family
  const headingFontHref = fontHrefFor(effFont)
  const tex = textureStyle(display.bgTexture)
  const themeVars = {
    '--bp-gold': effAccent,
    '--bp-gold-deep': shade(effAccent, -0.18),
    '--bp-gold-pale': shade(effAccent, 0.82),
    '--bp-gold-mist': shade(effAccent, 0.7),
    '--gold': effAccent,
    '--bp-ivory': display.bgColor,
    '--bp-ivory-2': shade(display.bgColor, -0.03),
  } as React.CSSProperties
  const greetingTitle = display.invitation.greetingTitle || 'Ihr seid eingeladen'
  const greetingSubtitle = display.invitation.greetingSubtitle || 'Sag uns kurz, wer du bist — danach kannst du direkt zu- oder absagen.'

  return (
    <div className="bp-auth" style={{
      ...themeVars,
      backgroundColor: display.bgColor,
      ...(motiveUrl
        ? { backgroundImage: `linear-gradient(rgba(255,255,255,0.78), rgba(255,255,255,0.9)), url(${motiveUrl})`, backgroundSize: `cover, ${focusSize(display.invitation.motiveFocus)}`, backgroundPosition: `center, ${focusPosition(display.invitation.motiveFocus)}`, backgroundAttachment: 'fixed' }
        : tex.image !== 'none' ? { backgroundImage: tex.image, backgroundSize: tex.size, backgroundAttachment: 'fixed' } : {}),
    }}>
      {headingFontHref && <link rel="stylesheet" href={headingFontHref} />}
      <div className="bp-auth-inner">

        <div className="bp-auth-logo">
          {display.monogram && (
            <p style={{ fontFamily: headingFamily, fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--bp-gold)', margin: '0 0 0.5rem' }}>{display.monogram}</p>
          )}
          <span style={{
            width: 52, height: 52, borderRadius: '50%', margin: '0 auto 0.875rem',
            background: 'var(--bp-gold-pale)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Heart size={24} fill="var(--bp-gold)" color="var(--bp-gold)" />
          </span>
          <h1 style={{
            fontFamily: headingFamily, fontWeight: 600,
            fontSize: '1.75rem', color: 'var(--bp-ink)', margin: 0, lineHeight: 1.2,
          }}>
            {eventInfo.coupleName || eventInfo.title}
          </h1>
          {dateLabel && <p className="bp-auth-tagline">{dateLabel}</p>}
        </div>

        <div className="bp-auth-card">
          <h2 className="bp-auth-title" style={{ marginBottom: '0.5rem', fontFamily: headingFamily }}>{greetingTitle}</h2>
          <p className="bp-caption" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            {greetingSubtitle}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="bp-label-text">Dein Name <span className="bp-text-gold-deep">*</span></label>
              <input
                required autoComplete="name"
                className="bp-input"
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Vorname Nachname"
              />
            </div>

            <div>
              <label className="bp-label-text">Ich gehöre zu</label>
              <select className="bp-select" value={side} onChange={e => setSide(e.target.value)}>
                <option value="">Keine Angabe</option>
                <option value="Braut">Braut</option>
                <option value="Bräutigam">Bräutigam</option>
                <option value="Gemeinsam">Beiden</option>
              </select>
            </div>

            {error && <p className="bp-auth-error">{error}</p>}

            <button type="submit" disabled={submitting || name.trim().length < 2} className="bp-btn bp-btn-primary bp-btn-lg" style={{ width: '100%' }}>
              {submitting ? 'Einen Moment …' : 'Weiter zur Rückmeldung'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
