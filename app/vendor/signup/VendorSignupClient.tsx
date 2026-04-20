'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'

interface Props {
  initialCode: string
}

type Step = 'code' | 'form' | 'success'

export default function VendorSignupClient({ initialCode }: Props) {
  const router = useRouter()
  const [step, setStep]               = useState<Step>(initialCode ? 'form' : 'code')
  const [code, setCode]               = useState(initialCode)
  const [codeValid, setCodeValid]     = useState(!!initialCode)
  const [checkingCode, setCheckingCode] = useState(false)
  const [name, setName]               = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // Validate code from URL param on mount
  useEffect(() => {
    if (initialCode) {
      validateCode(initialCode)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function validateCode(c: string) {
    setCheckingCode(true)
    setError(null)
    const supabase = createClient()
    const { data } = await supabase.rpc('preview_vendor_signup_code', { p_code: c.trim() })
    setCheckingCode(false)
    if (!data || data.error) {
      setError(data?.error ?? 'Ungültiger Code')
      setCodeValid(false)
      setStep('code')
      return
    }
    setCodeValid(true)
    setStep('form')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password) return
    setSubmitting(true)
    setError(null)

    const res = await fetch('/api/vendor/signup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code: code.trim(), name: name.trim(), email: email.trim(), password }),
    })
    const data = await res.json()
    setSubmitting(false)

    if (!res.ok || data.error) {
      setError(data.error ?? 'Registrierung fehlgeschlagen')
      return
    }

    setStep('success')
    setTimeout(() => router.push('/login'), 2500)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 13px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Velvet</p>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Dienstleister-Account</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Registriere dich mit deinem Einladungscode.</p>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, boxShadow: 'var(--shadow-md)' }}>

          {step === 'success' ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(52,199,89,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={28} color="#34C759" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Account erstellt!</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Du wirst zum Login weitergeleitet…</p>
            </div>
          ) : step === 'code' ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  Einladungscode
                </label>
                <input
                  value={code}
                  onChange={e => { setCode(e.target.value); setError(null) }}
                  onKeyDown={e => e.key === 'Enter' && validateCode(code)}
                  placeholder="Code eingeben…"
                  style={inputStyle}
                  autoFocus
                />
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
                  <AlertCircle size={15} color="#FF3B30" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#FF3B30' }}>{error}</span>
                </div>
              )}

              <button
                onClick={() => validateCode(code)}
                disabled={checkingCode || !code.trim()}
                style={{ width: '100%', padding: 11, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: checkingCode || !code.trim() ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: !code.trim() ? 0.5 : 1 }}
              >
                {checkingCode ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Prüfen…</> : 'Code prüfen'}
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '8px 12px', background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={14} color="#34C759" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#3D7A56' }}>Code gültig</span>
                <button
                  type="button"
                  onClick={() => { setStep('code'); setCodeValid(false) }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >
                  ändern
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Vor- und Nachname" required style={inputStyle} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>E-Mail *</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="name@beispiel.de" required style={inputStyle} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Passwort *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type={showPw ? 'text' : 'password'}
                    placeholder="Mindestens 8 Zeichen"
                    minLength={8}
                    required
                    style={{ ...inputStyle, paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 0 }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)', borderRadius: 'var(--radius-sm)' }}>
                  <AlertCircle size={15} color="#FF3B30" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#FF3B30' }}>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{ padding: 11, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: submitting ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {submitting ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Erstellen…</> : 'Account erstellen'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>
          Bereits ein Konto?{' '}
          <a href="/login" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>Anmelden</a>
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
