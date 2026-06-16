'use client'

export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { MailCheck } from 'lucide-react'
import ForevrHeart from '@/components/ForevrHeart'
import { createClient } from '@/lib/supabase/client'
import '@/app/brautpaar/brautpaar.css'

// Schritt 1 des Passwort-Reset-Flows: Nutzer fordert eine Reset-E-Mail an.
// Der Link in der E-Mail führt über /auth/callback (Code-Exchange) zu
// /password-reset/update, wo das neue Passwort gesetzt wird.
export default function PasswordResetPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const supabase = createClient()
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/password-reset/update`,
      })
      if (resetErr) throw resetErr
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'E-Mail konnte nicht gesendet werden.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="bp-auth">
        <div className="bp-auth-inner" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <ForevrHeart size={36} color="#9C7F4F" style={{ marginBottom: 8 }} />
            <p className="bp-auth-wordmark" style={{ margin: 0 }}>FOREVR</p>
          </div>
          <MailCheck size={40} style={{ color: 'var(--bp-gold-deep)', marginBottom: 12 }} />
          <h2 className="bp-h2" style={{ marginBottom: 8 }}>E-Mail unterwegs</h2>
          <p className="bp-body">
            Falls ein Konto mit dieser Adresse existiert, haben wir dir einen Link zum
            Zurücksetzen des Passworts geschickt. Bitte prüfe auch deinen Spam-Ordner.
          </p>
          <a href="/login" className="bp-auth-link" style={{ display: 'inline-block', marginTop: 20 }}>Zurück zur Anmeldung</a>
        </div>
      </div>
    )
  }

  return (
    <div className="bp-auth">
      <div className="bp-auth-inner">

        <div className="bp-auth-logo">
          <ForevrHeart size={40} color="#9C7F4F" style={{ marginBottom: 10 }} />
          <p className="bp-auth-wordmark">FOREVR</p>
          <p className="bp-auth-tagline">Passwort zurücksetzen</p>
        </div>

        <div className="bp-auth-card">
          <h1 className="bp-auth-title">Passwort vergessen?</h1>
          <p className="bp-caption" style={{ textAlign: 'center', marginTop: -12, marginBottom: 20 }}>
            Gib deine E-Mail-Adresse ein — wir schicken dir einen Link zum Zurücksetzen.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="bp-label-text">E-Mail-Adresse</label>
              <input
                type="email" required autoComplete="email"
                className="bp-input"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="deine@email.de"
              />
            </div>

            {error && <p className="bp-auth-error">{error}</p>}

            <button type="submit" disabled={loading} className="bp-btn bp-btn-primary bp-btn-lg" style={{ width: '100%' }}>
              {loading ? 'Wird gesendet …' : 'Link senden'}
            </button>
          </form>

          <div className="bp-auth-footer">
            <p>
              Doch wieder eingefallen?{' '}
              <a href="/login" className="bp-auth-link">Anmelden</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
