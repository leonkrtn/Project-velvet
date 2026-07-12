'use client'

export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'
import VerifyStep from '@/components/auth/VerifyStep'
import { createClient } from '@/lib/supabase/client'
import { isExistingUserSignup, EMAIL_TAKEN_MESSAGE } from '@/lib/auth-otp'
import '@/app/brautpaar/brautpaar.css'

// Signup für Veranstalter: Selbstregistrierung ohne Einladungscode.
// Nach erfolgreicher Registrierung erhält der Organizer den Status
// is_approved_organizer=false und sieht die Warteseite /veranstalter/pending,
// bis ein Admin die Freischaltung durchgeführt hat.
export default function VeranstalterSignupPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [awaitingCode, setAwaitingCode] = useState(false)

  const goToPending = () => {
    router.push('/veranstalter/pending')
    router.refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    if (!name.trim()) { setError('Bitte gib deinen Namen ein.'); return }
    setLoading(true); setError('')

    try {
      const supabase = createClient()
      const meta = {
        name: name.trim(),
        signup_role: 'veranstalter' as const,
      }

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: meta },
      })
      if (signUpErr) throw signUpErr

      // Bereits registrierte E-Mail → Flow abbrechen (keine Admin-Info, kein Verify).
      if (isExistingUserSignup(signUpData)) {
        setError(EMAIL_TAKEN_MESSAGE)
        return
      }

      // Admins über den neuen Veranstalter-Antrag informieren (best effort).
      fetch('/api/notify/organizer-signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      }).catch(() => {})

      // Keine Session → E-Mail muss per Code verifiziert werden (Zwischenschritt).
      if (!signUpData.session) {
        setAwaitingCode(true)
        return
      }

      goToPending()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  if (awaitingCode) {
    return (
      <AuthLayout tagline="Veranstaltungen, professionell geplant.">
        <VerifyStep
          supabase={createClient()}
          email={email.trim()}
          onVerified={async (_supabase: SupabaseClient) => goToPending()}
          onBack={() => { setAwaitingCode(false); setLoading(false) }}
          note="Nach der Bestätigung schaltet unser Team dein Veranstalter-Konto frei."
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout tagline="Veranstaltungen, professionell geplant." brandImage="/landing/cta.jpg">
      <div className="bp-authx-card">
        <h1 className="bp-authx-heading">Veranstalter werden</h1>
        <p className="bp-authx-sub">
          Verwalte deine Hochzeits- und Event-Veranstaltungen an einem Ort.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="bp-label-text">Dein Name <span className="bp-text-gold-deep">*</span></label>
            <input
              required autoComplete="name"
              className="bp-input"
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Max Beispiel"
            />
          </div>

          <div>
            <label className="bp-label-text">E-Mail-Adresse <span className="bp-text-gold-deep">*</span></label>
            <input
              type="email" required autoComplete="email"
              className="bp-input"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="deine@email.de"
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
              <button type="button" className="bp-input-eye" onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="bp-auth-error">{error}</p>}

          <button type="submit" disabled={loading} className="bp-btn bp-btn-primary bp-btn-lg" style={{ width: '100%' }}>
            {loading ? 'Wird erstellt …' : 'Veranstalter-Konto erstellen'}
          </button>
        </form>

        <div className="bp-auth-footer">
          <p>
            Bereits registriert?{' '}
            <a href="/login" className="bp-auth-link">Anmelden</a>
          </p>
          <p>
            Deine Hochzeit selbst planen?{' '}
            <a href="/signup/brautpaar" className="bp-auth-link">Als Brautpaar registrieren</a>
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}
