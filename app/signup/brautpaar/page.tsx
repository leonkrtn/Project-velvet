'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ensureSoloEvent } from '@/lib/brautpaar-solo'

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
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
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
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 40, color: 'var(--gold)', letterSpacing: '-1px', lineHeight: 1, marginBottom: 24 }}>Velvet.</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Fast geschafft!</h2>
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>
            Bitte bestätigt eure E-Mail-Adresse über den Link, den wir euch geschickt haben.
            Nach der Anmeldung wird euer Hochzeits-Event automatisch erstellt.
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
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 40, color: 'var(--gold)', letterSpacing: '-1px', lineHeight: 1 }}>Velvet.</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 8 }}>
            Eure Hochzeit, selbst geplant — ohne Veranstalter starten
          </p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 28 }}>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <label style={fieldLabel}>Dein Name <span style={{ color: 'var(--gold)' }}>*</span></label>
              <input
                required autoComplete="name"
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Anna Beispiel" style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            <div>
              <label style={fieldLabel}>Name deines Partners / deiner Partnerin</label>
              <input
                value={partnerName} onChange={e => setPartnerName(e.target.value)}
                placeholder="Max Beispiel" style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            <div>
              <label style={fieldLabel}>Hochzeitsdatum (falls schon bekannt)</label>
              <input
                type="date"
                value={weddingDate} onChange={e => setWeddingDate(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            <div>
              <label style={fieldLabel}>E-Mail-Adresse <span style={{ color: 'var(--gold)' }}>*</span></label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="eure@email.de" style={inputStyle}
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
              {loading ? 'Wird erstellt …' : 'Kostenlos starten'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Du hast einen Einladungscode?{' '}
              <a href="/signup" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Mit Code registrieren</a>
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Bereits registriert?{' '}
              <a href="/login" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Anmelden</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
