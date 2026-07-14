'use client'

export const dynamic = 'force-dynamic'
import React, { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'
import { createClient } from '@/lib/supabase/client'
import { setLoginPersistence, REMEMBER_DAYS } from '@/lib/auth-persistence'
import { resolveDestination } from '@/lib/auth/resolve-destination'
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

      // Läuft für diesen Account gerade eine Löschfrist? Dann erst die
      // Wiederherstellen-Seite zeigen, statt direkt ins Portal zu leiten.
      const { data: profile } = await supabase
        .from('profiles')
        .select('deleted_at')
        .eq('id', session!.user.id)
        .maybeSingle()
      if (profile?.deleted_at) {
        window.location.assign(`/konto/wiederherstellen${nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ''}`)
        return
      }

      // Zielpfad bestimmen, dann EINMAL hart navigieren. Harte Navigation
      // (window.location) statt router.push ist in Safari zuverlaessiger: sie
      // erzwingt einen vollen Reload, sodass die Middleware mit den frisch
      // gesetzten Auth-Cookies laeuft (router.push committet in Safari sonst
      // mitunter nicht).
      const dest = await resolveDestination(supabase, session!.user, nextUrl)
      window.location.assign(dest)
      return
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout tagline="Euer schönster Tag.">
        <div className="bp-authx-card">
          <h1 className="bp-authx-heading">Willkommen zurück</h1>
          <p className="bp-authx-sub">Melde dich an, um weiterzuplanen.</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="bp-label-text" htmlFor="login-email">E-Mail-Adresse</label>
              <input
                id="login-email"
                type="email" required autoComplete="email"
                className="bp-input"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="deine@email.de"
              />
            </div>

            <div>
              <label className="bp-label-text" htmlFor="login-password">Passwort</label>
              <div className="bp-input-wrap">
                <input
                  id="login-password"
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

          <div className="bp-authx-foot">
            <p className="bp-authx-foot-primary">
              Noch kein Konto? <a href="/signup" className="bp-auth-link">Registrieren</a>
            </p>
          </div>
        </div>
    </AuthLayout>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="bp-auth" />}>
      <LoginForm />
    </Suspense>
  )
}
