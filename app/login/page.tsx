'use client'
import React, { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [magicSent, setMagicSent] = useState(false)

  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      if (mode === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
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
        if (nextUrl) {
          router.push(nextUrl)
        } else if (isOrganizer) {
          router.push('/veranstalter/events')
        } else if (session?.user?.app_metadata?.role === 'mitarbeiter') {
          router.push('/mitarbeiter')
        } else {
          const { data: memberships } = await supabase
            .from('event_members')
            .select('event_id, role')
            .eq('user_id', session!.user.id)
            .limit(5)

          const isVendor = memberships?.some(m => m.role === 'dienstleister')
          const nonVendor = memberships?.find(m => m.role !== 'dienstleister')

          if (isVendor) {
            router.push('/vendor/dashboard')
          } else if (nonVendor) {
            router.push('/brautpaar?event=' + nonVendor.event_id)
          } else {
            const { data: vsc } = await supabase
              .from('vendor_signup_codes')
              .select('id')
              .eq('used_by', session!.user.id)
              .limit(1)
            if (vsc && vsc.length > 0) {
              router.push('/vendor/dashboard')
            } else {
              router.push('/signup')
            }
          }
        }
        router.refresh()
      } else {
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })
        if (error) throw error
        setMagicSent(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', fontSize: 15,
    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    background: '#fff', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: 'var(--text)',
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 40, color: 'var(--gold)', letterSpacing: '-1px', lineHeight: 1 }}>Velvet.</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 8 }}>Euer schönster Tag.</p>
        </div>

        {magicSent ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 'var(--r-md)', padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 24 }}>✉️</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginTop: 12 }}>E-Mail gesendet!</p>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 8 }}>
              Wir haben einen Anmeldelink an <strong>{email}</strong> geschickt. Bitte prüfe dein Postfach.
            </p>
            <button onClick={() => setMagicSent(false)} style={{ marginTop: 20, padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 100, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--text-dim)' }}>
              Zurück
            </button>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 28 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 24, textAlign: 'center' }}>Anmelden</h1>

            {/* Mode toggle */}
            <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 8, padding: 3, marginBottom: 24, gap: 3 }}>
              {(['password', 'magic'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 6, border: 'none',
                    background: mode === m ? 'var(--surface)' : 'transparent',
                    fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
                    fontWeight: mode === m ? 600 : 400,
                    color: mode === m ? 'var(--text)' : 'var(--text-dim)',
                    boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >{m === 'password' ? 'Passwort' : 'Magic Link'}</button>
              ))}
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>E-Mail-Adresse</label>
                <input
                  type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="deine@email.de"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>

              {mode === 'password' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Passwort</label>
                  <input
                    type="password" required autoComplete="current-password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                  />
                </div>
              )}

              {error && (
                <p style={{ fontSize: 13, color: 'var(--red)', background: 'rgba(160,64,64,0.08)', padding: '10px 14px', borderRadius: 8 }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '14px', borderRadius: 'var(--r-sm)', border: 'none',
                  background: 'var(--text)', color: '#fff',
                  fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {loading ? 'Wird geladen …' : mode === 'password' ? 'Anmelden' : 'Magic Link senden'}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                Noch kein Konto?{' '}
                <a href="/signup" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Registrieren</a>
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
