'use client'

export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'
import VerifyStep from '@/components/auth/VerifyStep'
import { createClient } from '@/lib/supabase/client'
import { startSignup, EmailTakenError, EMAIL_TAKEN_MESSAGE } from '@/lib/auth-otp'
import { MARKETPLACE_CATEGORIES } from '@/lib/marketplace/types'
import '@/app/brautpaar/brautpaar.css'

// Öffentliche Selbstregistrierung für Dienstleister (Hybrid: Self-Signup +
// Admin-Freigabe). Nach der E-Mail-Bestätigung per Code wird ein Profil im
// Status "Entwurf" angelegt; der Anbieter pflegt es und reicht es zur Prüfung ein.
export default function DienstleisterSignupPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [category, setCategory] = useState('fotograf')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [awaitingCode, setAwaitingCode] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company.trim()) { setError('Bitte gib deinen Unternehmensnamen an.'); return }
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    setLoading(true); setError('')
    try {
      await startSignup({
        email: email.trim(),
        password,
        metadata: { name: name.trim(), company_name: company.trim(), category, signup_role: 'dienstleister' },
      })
      setAwaitingCode(true)
    } catch (err: unknown) {
      if (err instanceof EmailTakenError) setError(EMAIL_TAKEN_MESSAGE)
      else setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  // Läuft nach bestätigter E-Mail: Profil anlegen und in den Onboarding-Wizard leiten.
  const afterVerified = async (_supabase: SupabaseClient) => {
    await fetch('/api/vendor/marketplace/onboard', { method: 'POST' }).catch(() => {})
    router.push('/vendor/onboarding')
    router.refresh()
  }

  if (awaitingCode) {
    return (
      <AuthLayout tagline="Dein Angebot, dort wo Brautpaare planen." brandImage="/landing/cta.jpg">
        <VerifyStep
          supabase={createClient()}
          email={email.trim()}
          password={password}
          onVerified={afterVerified}
          onBack={() => { setAwaitingCode(false); setLoading(false) }}
          note="Nach der Bestätigung kannst du dein Anbieter-Profil vervollständigen und einreichen."
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout tagline="Dein Angebot, dort wo Brautpaare planen." brandImage="/landing/cta.jpg">
      <div className="bp-authx-card">
        <h1 className="bp-authx-heading">Als Dienstleister registrieren</h1>
        <p className="bp-authx-sub">Präsentiere dein Angebot dort, wo Brautpaare ihre Hochzeit planen.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="bp-label-text">Dein Name <span className="bp-text-gold-deep">*</span></label>
            <input
              required autoComplete="name" className="bp-input"
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Max Beispiel"
            />
          </div>

          <div>
            <label className="bp-label-text">Unternehmensname <span className="bp-text-gold-deep">*</span></label>
            <input
              required autoComplete="organization" className="bp-input"
              value={company} onChange={e => setCompany(e.target.value)}
              placeholder="Beispiel Fotografie GmbH"
            />
          </div>

          <div>
            <label className="bp-label-text">Kategorie <span className="bp-text-gold-deep">*</span></label>
            <select className="bp-input" value={category} onChange={e => setCategory(e.target.value)}>
              {MARKETPLACE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="bp-label-text">E-Mail-Adresse <span className="bp-text-gold-deep">*</span></label>
            <input
              type="email" required autoComplete="email" className="bp-input"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="kontakt@firma.de"
            />
          </div>

          <div>
            <label className="bp-label-text">Passwort (mind. 8 Zeichen) <span className="bp-text-gold-deep">*</span></label>
            <div className="bp-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'} required autoComplete="new-password"
                className="bp-input"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button type="button" className="bp-input-eye" onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="bp-auth-error">{error}</p>}

          <button type="submit" disabled={loading} className="bp-btn bp-btn-primary bp-btn-lg" style={{ width: '100%' }}>
            {loading ? 'Wird erstellt …' : 'Anbieter-Konto erstellen'}
          </button>
        </form>

        <div className="bp-authx-foot">
          <p className="bp-authx-foot-primary">
            Bereits registriert? <a href="/login?next=/vendor/listing" className="bp-auth-link">Anmelden</a>
          </p>
          <div className="bp-authx-foot-alts">
            <a href="/signup/brautpaar" className="bp-authx-foot-alt">Als Brautpaar registrieren</a>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}
