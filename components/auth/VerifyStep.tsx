'use client'

import React, { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MailCheck } from 'lucide-react'
import OtpCodeInput from '@/components/auth/OtpCodeInput'
import {
  verifySignupOtp,
  resendSignupOtp,
  otpErrorMessage,
  OTP_CODE_LENGTH,
} from '@/lib/auth-otp'

type Props = {
  supabase: SupabaseClient
  email: string
  /** Läuft nach erfolgreicher Verifizierung (Session ist gesetzt). */
  onVerified: (supabase: SupabaseClient) => void | Promise<void>
  /** Zurück zum Formular (z. B. „Andere E-Mail-Adresse"). */
  onBack?: () => void
  /** Optionaler Zusatzhinweis unter dem Erfolgsschritt. */
  note?: string
}

/**
 * Zwischenschritt der Registrierung: Eingabe des 8-stelligen Codes, den Supabase
 * per E-Mail verschickt hat. Bei Erfolg wird `onVerified` mit dem eingeloggten
 * Supabase-Client aufgerufen (die Session ist dann bereits gesetzt).
 */
export default function VerifyStep({ supabase, email, onVerified, onBack, note }: Props) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resending, setResending] = useState(false)
  const [resentAt, setResentAt] = useState<number | null>(null)

  const submit = async (value: string) => {
    const token = value.replace(/\s+/g, '')
    if (token.length !== OTP_CODE_LENGTH) {
      setError(`Bitte gib den ${OTP_CODE_LENGTH}-stelligen Code ein.`)
      return
    }
    setLoading(true); setError('')
    try {
      const { error: vErr } = await verifySignupOtp(supabase, email, token)
      if (vErr) throw vErr
      await onVerified(supabase)
    } catch (err: unknown) {
      setError(otpErrorMessage(err instanceof Error ? err.message : 'Verifizierung fehlgeschlagen.'))
      setLoading(false)
    }
  }

  const resend = async () => {
    setResending(true); setError('')
    try {
      const { error: rErr } = await resendSignupOtp(supabase, email)
      if (rErr) throw rErr
      setResentAt(Date.now())
      setCode('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Code konnte nicht erneut gesendet werden.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="bp-authx-card">
      <div className="bp-authx-success" aria-hidden="true">
        <MailCheck size={26} />
      </div>
      <h1 className="bp-authx-heading">E-Mail bestätigen</h1>
      <p className="bp-authx-sub">
        Wir haben einen {OTP_CODE_LENGTH}-stelligen Code an <strong>{email}</strong> gesendet.
        Gib ihn hier ein, um dein Konto zu verifizieren.
      </p>

      <form
        onSubmit={e => { e.preventDefault(); submit(code) }}
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <OtpCodeInput
          value={code}
          onChange={setCode}
          onComplete={submit}
          disabled={loading}
        />

        {error && <p className="bp-auth-error">{error}</p>}

        {resentAt && !error && (
          <p className="bp-caption" style={{ textAlign: 'center', color: 'var(--bp-green)', margin: 0 }}>
            Neuer Code wurde gesendet.
          </p>
        )}

        <button
          type="submit"
          disabled={loading || code.replace(/\s+/g, '').length !== OTP_CODE_LENGTH}
          className="bp-btn bp-btn-primary bp-btn-lg"
          style={{ width: '100%' }}
        >
          {loading ? 'Wird geprüft …' : 'Bestätigen'}
        </button>

        <p className="bp-otp-resend">
          Keinen Code erhalten?{' '}
          <button type="button" onClick={resend} disabled={resending}>
            {resending ? 'Wird gesendet …' : 'Erneut senden'}
          </button>
        </p>

        {onBack && (
          <p className="bp-otp-resend" style={{ marginTop: '-0.5rem' }}>
            <button type="button" onClick={onBack} disabled={loading}>
              Andere E-Mail-Adresse verwenden
            </button>
          </p>
        )}

        {note && (
          <p className="bp-caption" style={{ textAlign: 'center', margin: 0 }}>{note}</p>
        )}
      </form>
    </div>
  )
}
