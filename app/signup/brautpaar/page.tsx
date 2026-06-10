'use client'

export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ensureSoloEvent } from '@/lib/brautpaar-solo'
import '@/app/brautpaar/brautpaar.css'

// Signup für Solo-Brautpaare: kein Einladungscode nötig.
// Beim Registrieren wird automatisch genau ein Event erstellt
// (create_event_as_brautpaar_solo ist idempotent). Falls die Supabase-Instanz
// E-Mail-Bestätigung verlangt (keine Session direkt nach signUp), übernimmt
// der Login-Fallback die Event-Erstellung anhand der Signup-Metadaten.
export default function BrautpaarSignupPage() {
  const router = useRouter()

  const [name, setName]               = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [weddingDate, setWeddingDate] = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [confirmEmail, setConfirmEmail] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    setLoading(true); setError('')

    try {
      // Client erst hier erzeugen — beim Build-Prerender fehlen die Env-Vars
      const supabase = createClient()
      const meta = {
        name: name.trim(),
        partner_name: partnerName.trim() || undefined,
        wedding_date: weddingDate || undefined,
        signup_role: 'brautpaar_solo' as const,
      }

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: meta },
      })
      if (signUpErr) throw signUpErr

      // Ohne Session (E-Mail-Bestätigung aktiv) kann das Event noch nicht
      // erstellt werden — das erledigt der Login-Fallback nach Bestätigung.
      if (!signUpData.session) {
        setConfirmEmail(true)
        return
      }

      const eventId = await ensureSoloEvent(supabase, meta)
      router.push(`/brautpaar/${eventId}/uebersicht`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  if (confirmEmail) {
    return (
      <div className="bp-auth">
        <div className="bp-auth-inner" style={{ textAlign: 'center' }}>
          <p className="bp-auth-wordmark" style={{ marginBottom: 24 }}>Velvet.</p>
          <h2 className="bp-h2" style={{ marginBottom: 8 }}>Fast geschafft!</h2>
          <p className="bp-body">
            Bitte bestätigt eure E-Mail-Adresse über den Link, den wir euch geschickt haben.
            Nach der Anmeldung wird euer Hochzeits-Event automatisch erstellt.
          </p>
          <a href="/login" className="bp-auth-link" style={{ display: 'inline-block', marginTop: 20 }}>Zur Anmeldung</a>
        </div>
      </div>
    )
  }

  return (
    <div className="bp-auth">
      <div className="bp-auth-inner bp-auth-inner-wide">

        <div className="bp-auth-logo">
          <p className="bp-auth-wordmark">Velvet.</p>
          <p className="bp-auth-tagline">Eure Hochzeit, selbst geplant.</p>
        </div>

        <div className="bp-auth-card">

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <label className="bp-label-text">Dein Name <span className="bp-text-gold-deep">*</span></label>
              <input
                required autoComplete="name"
                className="bp-input"
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Anna Beispiel"
              />
            </div>

            <div>
              <label className="bp-label-text">Name deines Partners / deiner Partnerin</label>
              <input
                className="bp-input"
                value={partnerName} onChange={e => setPartnerName(e.target.value)}
                placeholder="Max Beispiel"
              />
            </div>

            <div>
              <label className="bp-label-text">Hochzeitsdatum (falls schon bekannt)</label>
              <input
                type="date"
                className="bp-input"
                value={weddingDate} onChange={e => setWeddingDate(e.target.value)}
              />
            </div>

            <div>
              <label className="bp-label-text">E-Mail-Adresse <span className="bp-text-gold-deep">*</span></label>
              <input
                type="email" required autoComplete="email"
                className="bp-input"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="eure@email.de"
              />
            </div>

            <div>
              <label className="bp-label-text">Passwort (mind. 8 Zeichen) <span className="bp-text-gold-deep">*</span></label>
              <div className="bp-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'} required autoComplete="new-password"
                  className="bp-input"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="bp-input-eye"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="bp-auth-error">{error}</p>}

            <button type="submit" disabled={loading} className="bp-btn bp-btn-primary bp-btn-lg" style={{ width: '100%' }}>
              {loading ? 'Wird erstellt …' : 'Kostenlos starten'}
            </button>
          </form>

          <div className="bp-auth-footer">
            <p>
              Du hast einen Einladungscode?{' '}
              <a href="/signup" className="bp-auth-link">Mit Code registrieren</a>
            </p>
            <p>
              Bereits registriert?{' '}
              <a href="/login" className="bp-auth-link">Anmelden</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
