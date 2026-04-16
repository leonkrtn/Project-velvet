'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type InvitePreview = {
  event_id: string
  role: string
  expires_at: string
}

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [inviteCode, setInviteCode] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // After successful signUp but before redeem — lets user retry redeem only
  const [pendingRedeem, setPendingRedeem] = useState(false)
  const [pendingCode, setPendingCode] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', fontSize: 15,
    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    background: '#fff', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: 'var(--text)',
  }

  const handleCodeBlur = async () => {
    const code = inviteCode.trim()
    if (!code) { setPreview(null); return }
    setPreviewLoading(true)
    try {
      const { data } = await supabase.rpc('get_invite_preview', { p_code: code })
      setPreview(data?.[0] ?? null)
    } catch {
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const doRedeem = async (code: string): Promise<string> => {
    const result = await supabase.rpc('redeem_invite_code', { p_code: code })
    if (result.error) throw new Error(result.error.message)
    const data = result.data as { success: boolean; error?: string; event_id?: string }
    if (!data.success) throw new Error(data.error ?? 'Code konnte nicht eingelöst werden')
    return data.event_id!
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    const code = inviteCode.trim()
    if (!code) { setError('Einladungscode ist erforderlich.'); return }
    setLoading(true); setError('')

    try {
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (signUpErr) throw signUpErr

      try {
        const eventId = await doRedeem(code)
        router.push(`/dashboard?event=${eventId}`)
      } catch (redeemErr: unknown) {
        setPendingCode(code)
        setPendingRedeem(true)
        setError(
          (redeemErr instanceof Error ? redeemErr.message : 'Unbekannter Fehler') +
          ' — Konto wurde erstellt. Klicke "Erneut versuchen" um den Code einzulösen.'
        )
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  const handleRetryRedeem = async () => {
    setLoading(true); setError('')
    try {
      const eventId = await doRedeem(pendingCode)
      router.push(`/dashboard?event=${eventId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Code konnte nicht eingelöst werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 40, color: 'var(--gold)', letterSpacing: '-1px', lineHeight: 1 }}>Velvet.</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 8 }}>Konto erstellen</p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 28 }}>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Invite Code */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
                Einladungscode <span style={{ color: 'var(--gold)' }}>*</span>
              </label>
              <input
                required
                value={inviteCode}
                onChange={e => { setInviteCode(e.target.value); setPreview(null) }}
                onBlur={handleCodeBlur}
                placeholder="Von deinem Veranstalter oder Brautpaar"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
              />
              {previewLoading && (
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 5 }}>Prüfe Code …</p>
              )}
              {preview && (
                <p style={{ fontSize: 12, color: 'var(--gold)', marginTop: 5, fontWeight: 600 }}>
                  Einladung gefunden · Rolle: {preview.role}
                </p>
              )}
              {!previewLoading && inviteCode.trim() && !preview && (
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 5 }}>Code nicht gefunden oder abgelaufen</p>
              )}
            </div>

            {/* Name */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
                Dein Name <span style={{ color: 'var(--gold)' }}>*</span>
              </label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Max Mustermann"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
                E-Mail-Adresse <span style={{ color: 'var(--gold)' }}>*</span>
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="deine@email.de"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
                Passwort (mind. 8 Zeichen) <span style={{ color: 'var(--gold)' }}>*</span>
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: 'var(--red)', background: 'rgba(160,64,64,0.08)', padding: '10px 14px', borderRadius: 8 }}>
                <p>{error}</p>
                {pendingRedeem && (
                  <button
                    type="button"
                    onClick={handleRetryRedeem}
                    disabled={loading}
                    style={{
                      marginTop: 10, padding: '8px 16px', borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--red)', background: 'none',
                      color: 'var(--red)', cursor: 'pointer', fontSize: 13,
                      fontFamily: 'inherit', fontWeight: 600,
                    }}
                  >
                    {loading ? 'Wird versucht …' : 'Erneut versuchen'}
                  </button>
                )}
              </div>
            )}

            {!pendingRedeem && (
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
            )}
          </form>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Bereits registriert?{' '}
              <a href="/login" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Anmelden</a>
            </p>
          </div>
        </div>

        {/* Hidden admin link — no label */}
        <a
          href="/admin/create-organizer"
          style={{ display: 'block', width: 8, height: 8, position: 'fixed', bottom: 12, right: 12, opacity: 0.15 }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
