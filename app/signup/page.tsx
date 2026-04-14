'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Path = 'invite' | null

export default function SignupPage() {
  const router = useRouter()
  const [path, setPath] = useState<Path>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    if (!inviteCode.trim()) { setError('Einladungscode ist erforderlich.'); return }
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, invite_code: inviteCode.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      setSuccess(true)
    } catch (err: any) {
      setError(err.message ?? 'Registrierung fehlgeschlagen.')
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

  if (success) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 'var(--r-md)', padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 32 }}>🎉</p>
          <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 12 }}>Fast geschafft!</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.6 }}>
            Wir haben eine Bestätigungs-E-Mail an <strong>{email}</strong> geschickt. Bitte klicke auf den Link, um dein Konto zu aktivieren.
          </p>
          <a href="/login" style={{ display: 'inline-block', marginTop: 24, padding: '12px 28px', background: 'var(--gold)', color: '#fff', borderRadius: 100, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Zur Anmeldung
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 40, color: 'var(--gold)', letterSpacing: '-1px', lineHeight: 1 }}>Velvet.</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 8 }}>Konto erstellen</p>
        </div>

        {/* Path selection */}
        {path === null && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 28 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Wie möchtest du beitreten?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                type="button"
                onClick={() => setPath('invite')}
                style={{
                  padding: '16px', borderRadius: 'var(--r-sm)', textAlign: 'left',
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget.style.borderColor = 'var(--gold)'); (e.currentTarget.style.background = 'var(--gold-pale)') }}
                onMouseLeave={e => { (e.currentTarget.style.borderColor = 'var(--border)'); (e.currentTarget.style.background = 'var(--bg)') }}
              >
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Ich habe einen Einladungscode</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>Brautpaar, Trauzeuge oder Dienstleister — registriere dich mit deinem Code</p>
              </button>

              <a
                href="/bewerbung"
                style={{
                  display: 'block', padding: '16px', borderRadius: 'var(--r-sm)', textAlign: 'left',
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e: any) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'var(--gold-pale)' }}
                onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)' }}
              >
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Ich bin Veranstalter</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>Bewirb dich als Hochzeitsplaner — nach Prüfung erhältst du Zugang</p>
              </a>
            </div>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                Bereits registriert?{' '}
                <a href="/login" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Anmelden</a>
              </p>
            </div>
          </div>
        )}

        {/* Invite code signup form */}
        {path === 'invite' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 28 }}>
            <button
              type="button"
              onClick={() => { setPath(null); setError('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 13, padding: 0, marginBottom: 20, fontFamily: 'inherit' }}
            >
              ← Zurück
            </button>
            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Dein Name</label>
                <input
                  required value={name} onChange={e => setName(e.target.value)}
                  placeholder="Max Mustermann"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>E-Mail-Adresse</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="deine@email.de"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Passwort (mind. 8 Zeichen)</label>
                <input
                  type="password" required autoComplete="new-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Einladungscode</label>
                <input
                  required value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                  placeholder="Von deinem Veranstalter oder Brautpaar"
                  style={inputStyle}
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
                {loading ? 'Wird erstellt …' : 'Konto erstellen'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
