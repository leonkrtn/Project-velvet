'use client'

export const dynamic = 'force-dynamic'

import React, { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import '@/app/brautpaar/brautpaar.css'

type CodeType = 'event' | 'vendor' | null

type EventPreview = {
  event_id: string
  role: string
  expires_at: string
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [inviteCode, setInviteCode]   = useState(searchParams.get('code') ?? '')
  const [codeType, setCodeType]       = useState<CodeType>(null)
  const [eventPreview, setEventPreview] = useState<EventPreview | null>(null)
  const [name, setName]               = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [success, setSuccess]         = useState(false)

  // After successful signUp but before redeem — lets user retry redeem only
  const [pendingRedeem, setPendingRedeem] = useState(false)
  const [pendingCode, setPendingCode] = useState('')

  const getSupabase = () => createClient()

  const handleCodeBlur = async () => {
    const code = inviteCode.trim()
    if (!code) { setCodeType(null); setEventPreview(null); return }
    setPreviewLoading(true)
    setCodeType(null)
    setEventPreview(null)
    try {
      const supabase = getSupabase()
      // Try vendor code first
      const { data: vendorData } = await supabase.rpc('preview_vendor_signup_code', { p_code: code })
      if (vendorData && !vendorData.error) {
        setCodeType('vendor')
        setPreviewLoading(false)
        return
      }
      // Fall back to event invite code
      const { data: eventData } = await supabase.rpc('get_invite_preview', { p_code: code })
      if (eventData?.[0]) {
        setCodeType('event')
        setEventPreview(eventData[0])
      }
    } catch {
      // ignore
    } finally {
      setPreviewLoading(false)
    }
  }

  const doRedeem = async (code: string): Promise<string> => {
    const supabase = getSupabase()
    const result = await supabase.rpc('redeem_invite_code', { p_code: code })
    if (result.error) throw new Error(result.error.message)
    const data = result.data as { success: boolean; error?: string; event_id?: string }
    if (!data.success) throw new Error(data.error ?? 'Code konnte nicht eingelöst werden')
    return data.event_id!
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    const code = inviteCode.trim()
    if (!code) { setError('Einladungscode ist erforderlich.'); return }
    setLoading(true); setError('')

    // Vendor code flow — server-side account creation
    if (codeType === 'vendor') {
      const res = await fetch('/api/vendor/signup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code, name: name.trim(), email: email.trim(), password }),
      })
      const data = await res.json()
      setLoading(false)
      if (!res.ok || data.error) {
        setError(data.error ?? 'Registrierung fehlgeschlagen.')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2500)
      return
    }

    // Event invite code flow
    try {
      const supabase = getSupabase()
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

  if (success) {
    return (
      <div className="bp-auth">
        <div className="bp-auth-inner" style={{ textAlign: 'center' }}>
          <p className="bp-auth-wordmark" style={{ marginBottom: 24 }}>FOREVR</p>
          <h2 className="bp-h2" style={{ marginBottom: 8 }}>Account erstellt!</h2>
          <p className="bp-body">Du wirst zum Login weitergeleitet…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bp-auth">
      <div className="bp-auth-inner bp-auth-inner-wide">

        <div className="bp-auth-logo">
          <p className="bp-auth-wordmark">FOREVR</p>
          <p className="bp-auth-tagline">Konto erstellen</p>
        </div>

        <div className="bp-auth-card">

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Invite Code */}
            <div>
              <label className="bp-label-text">
                Einladungscode <span className="bp-text-gold-deep">*</span>
              </label>
              <input
                required
                className="bp-input"
                value={inviteCode}
                onChange={e => { setInviteCode(e.target.value); setCodeType(null); setEventPreview(null) }}
                onBlur={handleCodeBlur}
                placeholder="Dein Einladungscode"
              />
              {previewLoading && (
                <p className="bp-caption" style={{ marginTop: 5 }}>Prüfe Code …</p>
              )}
              {codeType === 'vendor' && (
                <p className="bp-caption" style={{ marginTop: 5, fontWeight: 600, color: 'var(--bp-gold-deep)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={13} /> Dienstleister-Code gültig
                </p>
              )}
              {codeType === 'event' && eventPreview && (
                <p className="bp-caption" style={{ marginTop: 5, fontWeight: 600, color: 'var(--bp-gold-deep)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={13} /> Einladung gefunden · Rolle: {eventPreview.role}
                </p>
              )}
              {!previewLoading && inviteCode.trim() && !codeType && (
                <p className="bp-caption" style={{ marginTop: 5 }}>Code nicht gefunden oder abgelaufen</p>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="bp-label-text">
                Dein Name <span className="bp-text-gold-deep">*</span>
              </label>
              <input
                required
                autoComplete="name"
                className="bp-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Max Mustermann"
              />
            </div>

            {/* Email */}
            <div>
              <label className="bp-label-text">
                E-Mail-Adresse <span className="bp-text-gold-deep">*</span>
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                className="bp-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="deine@email.de"
              />
            </div>

            {/* Password */}
            <div>
              <label className="bp-label-text">
                Passwort (mind. 8 Zeichen) <span className="bp-text-gold-deep">*</span>
              </label>
              <div className="bp-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  className="bp-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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

            {error && (
              <div className="bp-auth-error">
                <p style={{ margin: 0 }}>{error}</p>
                {pendingRedeem && (
                  <button
                    type="button"
                    onClick={handleRetryRedeem}
                    disabled={loading}
                    className="bp-btn bp-btn-danger bp-btn-sm"
                    style={{ marginTop: 10 }}
                  >
                    {loading ? 'Wird versucht …' : 'Erneut versuchen'}
                  </button>
                )}
              </div>
            )}

            {!pendingRedeem && (
              <button type="submit" disabled={loading} className="bp-btn bp-btn-primary bp-btn-lg" style={{ width: '100%' }}>
                {loading ? 'Wird erstellt …' : 'Konto erstellen'}
              </button>
            )}
          </form>

          <div className="bp-auth-footer">
            <p>
              Keinen Code? Plant eure Hochzeit selbst:{' '}
              <a href="/signup/brautpaar" className="bp-auth-link">Als Brautpaar starten</a>
            </p>
            <p>
              Bereits registriert?{' '}
              <a href="/login" className="bp-auth-link">Anmelden</a>
            </p>
          </div>
        </div>

        {/* Hidden admin link */}
        <a
          href="/admin/create-organizer"
          style={{ display: 'block', width: 8, height: 8, position: 'fixed', bottom: 12, right: 12, opacity: 0.15 }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="bp-auth" />}>
      <SignupForm />
    </Suspense>
  )
}
