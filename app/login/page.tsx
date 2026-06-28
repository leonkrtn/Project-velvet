'use client'

export const dynamic = 'force-dynamic'
import React, { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import ForevrHeart from '@/components/ForevrHeart'
import { createClient } from '@/lib/supabase/client'
import { ensureSoloEvent, isSoloSignup } from '@/lib/brautpaar-solo'
import { setLoginPersistence, REMEMBER_DAYS } from '@/lib/auth-persistence'
import ToggleSwitch from '@/components/ui/ToggleSwitch'
import '@/app/brautpaar/brautpaar.css'

function LoginForm() {
  const searchParams = useSearchParams()
  // Nur interne Pfade als Redirect-Ziel akzeptieren (kein Open Redirect):
  // "//evil.com" wäre eine protokoll-relative externe URL
  const rawNext = searchParams.get('next')
  const nextUrl = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // „Angemeldet bleiben"-Präferenz festhalten (30 Tage vs. nur diese Sitzung).
      setLoginPersistence(rememberMe)
      const { data: { session } } = await supabase.auth.getSession()
      let isOrganizer = session?.user?.app_metadata?.is_approved_organizer === true
      if (!isOrganizer && session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_approved_organizer')
          .eq('id', session.user.id)
          .single()
        isOrganizer = profile?.is_approved_organizer === true
      }
      // Zielpfad bestimmen, dann EINMAL hart navigieren. Harte Navigation
      // (window.location) statt router.push ist in Safari zuverlaessiger: sie
      // erzwingt einen vollen Reload, sodass die Middleware mit den frisch
      // gesetzten Auth-Cookies laeuft (router.push committet in Safari sonst
      // mitunter nicht).
      let dest = '/signup'
      if (nextUrl) {
        dest = nextUrl
      } else if (isOrganizer) {
        dest = '/veranstalter/events'
      } else if (session?.user?.app_metadata?.role === 'mitarbeiter') {
        dest = '/mitarbeiter'
      } else {
        const { data: memberships } = await supabase
          .from('event_members')
          .select('event_id, role')
          .eq('user_id', session!.user.id)

        // Feste Rollen-Priorität (deterministisch, unabhängig von DB-Reihenfolge):
        // Paar-Portal → Vendor-Portal → Veranstalter-Warteseite
        const roles = (memberships ?? []).map(m => m.role)

        if (roles.includes('brautpaar') || roles.includes('brautpaar_solo')) {
          dest = '/brautpaar'
        } else if (roles.includes('dienstleister')) {
          dest = '/vendor/ubersicht'
        } else if (roles.includes('veranstalter')) {
          // Veranstalter-Mitgliedschaft ohne Freischaltung (isOrganizer war false)
          dest = '/veranstalter/pending'
        } else if (isSoloSignup(session?.user)) {
          // Solo-Brautpaar ohne Event: Signup lief ohne Session (E-Mail-
          // Bestätigung) — Event jetzt anhand der Signup-Metadaten erstellen.
          try {
            const eventId = await ensureSoloEvent(supabase, session!.user.user_metadata)
            // Sync profile + partner data captured during signup (email-confirmation flow)
            await fetch('/api/brautpaar/sync-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ eventId, meta: session!.user.user_metadata }),
            }).catch(() => {})
            dest = `/brautpaar/${eventId}/uebersicht`
          } catch {
            dest = '/signup/brautpaar'
          }
        } else {
          // Fallback: check organizer_staff table directly (covers cases where
          // app_metadata.role was not yet set, e.g. after a password reset)
          const { data: staffRow } = await supabase
            .from('organizer_staff')
            .select('id')
            .eq('auth_user_id', session!.user.id)
            .maybeSingle()
          if (staffRow) {
            dest = '/mitarbeiter'
          } else {
            const { data: vsc } = await supabase
              .from('vendor_signup_codes')
              .select('id')
              .eq('used_by', session!.user.id)
              .limit(1)
            if (vsc && vsc.length > 0) {
              dest = '/vendor/ubersicht'
            } else if (session?.user?.user_metadata?.signup_role === 'dienstleister') {
              dest = '/vendor/listing'
            } else {
              dest = '/signup'
            }
          }
        }
      }
      window.location.assign(dest)
      return
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bp-auth">
      <div className="bp-auth-inner">

        <div className="bp-auth-logo">
          <ForevrHeart size={40} color="#9C7F4F" style={{ marginBottom: 10 }} />
          <p className="bp-auth-wordmark">FOREVR</p>
          <p className="bp-auth-tagline">Euer schönster Tag.</p>
        </div>

        <div className="bp-auth-card">
          <h1 className="bp-auth-title">Anmelden</h1>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="bp-label-text">E-Mail-Adresse</label>
              <input
                type="email" required autoComplete="email"
                className="bp-input"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="deine@email.de"
              />
            </div>

            <div>
              <label className="bp-label-text">Passwort</label>
              <div className="bp-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'} required autoComplete="current-password"
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
              <div style={{ textAlign: 'right', marginTop: 6 }}>
                <a href="/password-reset" className="bp-auth-link" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                  Passwort vergessen?
                </a>
              </div>
            </div>

            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--bp-ink-2)' }}>
              <ToggleSwitch checked={rememberMe} onChange={setRememberMe} size="sm" aria-label="Angemeldet bleiben" />
              {REMEMBER_DAYS} Tage angemeldet bleiben
            </span>

            {error && <p className="bp-auth-error">{error}</p>}

            <button type="submit" disabled={loading} className="bp-btn bp-btn-primary bp-btn-lg" style={{ width: '100%' }}>
              {loading ? 'Wird geladen …' : 'Anmelden'}
            </button>
          </form>

          <div className="bp-auth-footer">
            <p>
              Noch kein Konto?{' '}
              <a href="/signup" className="bp-auth-link">Registrieren</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="bp-auth" />}>
      <LoginForm />
    </Suspense>
  )
}
