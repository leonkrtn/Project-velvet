'use client'

export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Signup für Veranstalter: Selbstregistrierung ohne Einladungscode.
// Nach erfolgreicher Registrierung erhält der Organizer den Status
// is_approved_organizer=false und sieht die Warteseite /veranstalter/pending,
// bis ein Admin die Freischaltung durchgeführt hat.
export default function VeranstalterSignupPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmEmail, setConfirmEmail] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', fontSize: 15,
    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    background: '#fff', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: 'var(--text)',
  }

  const fieldLabel: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--text-dim)', marginBottom: 6,
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
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

      // Admins über den neuen Veranstalter-Antrag informieren (best effort).
      fetch('/api/notify/organizer-signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      }).catch(() => {})

      if (!signUpData.session) {
        setConfirmEmail(true)
        return
      }

      router.push('/veranstalter/pending')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  if (confirmEmail) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, fontSize: 34, color: 'var(--gold)', letterSpacing: '0.16em', lineHeight: 1, marginBottom: 24 }}>FOREVR</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Fast geschafft!</h2>
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>
            Bitte bestätigt eure E-Mail-Adresse über den Link, den wir euch geschickt haben.
            Nach der Bestätigung müsst ihr noch auf die Freischaltung durch unser Team warten.
          </p>
          <a href="/login" style={{ display: 'inline-block', marginTop: 20, color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Zur Anmeldung</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, fontSize: 34, color: 'var(--gold)', letterSpacing: '0.16em', lineHeight: 1 }}>FOREVR</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 8 }}>
            Wird Veranstalter und verwalte deine Hochzeitsveranstaltungen
          </p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 28 }}>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <label style={fieldLabel}>Dein Name <span style={{ color: 'var(--gold)' }}>*</span></label>
              <input
                required autoComplete="name"
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Max Beispiel" style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            <div>
              <label style={fieldLabel}>E-Mail-Adresse <span style={{ color: 'var(--gold)' }}>*</span></label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="deine@email.de" style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            <div>
              <label style={fieldLabel}>Passwort (mind. 8 Zeichen) <span style={{ color: 'var(--gold)' }}>*</span></label>
              <input
                type="password" required autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'var(--red)', background: 'rgba(160,64,64,0.08)', padding: '10px 14px', borderRadius: 8 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px', borderRadius: 'var(--r-sm)', border: 'none',
                background: 'var(--gold)', color: '#fff',
                fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Wird erstellt …' : 'Veranstalter-Konto erstellen'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Bereits registriert?{' '}
              <a href="/login" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Anmelden</a>
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Deine Hochzeit selbst planen?{' '}
              <a href="/signup/brautpaar" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Als Brautpaar registrieren</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
