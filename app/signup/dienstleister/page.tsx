'use client'

export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import ForevrHeart from '@/components/ForevrHeart'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MARKETPLACE_CATEGORIES } from '@/lib/marketplace/types'
import '@/app/brautpaar/brautpaar.css'

// Öffentliche Selbstregistrierung für Dienstleister (Hybrid: Self-Signup +
// Admin-Freigabe). Nach dem Signup wird ein Profil im Status "Entwurf"
// angelegt; der Anbieter pflegt es und reicht es zur Prüfung ein.
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
  const [confirmEmail, setConfirmEmail] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company.trim()) { setError('Bitte gib deinen Unternehmensnamen an.'); return }
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    setLoading(true); setError('')
    try {
      const supabase = createClient()
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim(), company_name: company.trim(), category, signup_role: 'dienstleister' } },
      })
      if (signUpErr) throw signUpErr

      if (!signUpData.session) { setConfirmEmail(true); return }

      // Session vorhanden → Profil sofort anlegen und in den Onboarding-Wizard leiten.
      await fetch('/api/vendor/marketplace/onboard', { method: 'POST' }).catch(() => {})
      router.push('/vendor/onboarding')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  if (confirmEmail) {
    return (
      <div className="bp-auth">
        <div className="bp-auth-inner" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <ForevrHeart size={36} color="#9C7F4F" style={{ marginBottom: 8 }} />
            <p className="bp-auth-wordmark" style={{ margin: 0 }}>FOREVR</p>
          </div>
          <h2 className="bp-h2" style={{ marginBottom: 8 }}>Fast geschafft!</h2>
          <p className="bp-body">
            Bitte bestätige deine E-Mail-Adresse über den zugesandten Link. Danach kannst du dein
            Anbieter-Profil vervollständigen und zur Freischaltung einreichen.
          </p>
          <a href="/login?next=/vendor/onboarding" className="bp-auth-link" style={{ display: 'inline-block', marginTop: 20 }}>Zur Anmeldung</a>
        </div>
      </div>
    )
  }

  return (
    <div className="bp-auth">
      <div className="bp-auth-inner bp-auth-inner-wide">

        <div className="bp-auth-logo">
          <ForevrHeart size={40} color="#9C7F4F" style={{ marginBottom: 10 }} />
          <p className="bp-auth-wordmark">FOREVR</p>
          <p className="bp-auth-tagline">Dein Angebot, dort wo Brautpaare planen.</p>
        </div>

        <div className="bp-auth-card">
          <h1 className="bp-auth-title">Als Dienstleister registrieren</h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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

          <div className="bp-auth-footer">
            <p>
              Bereits registriert?{' '}
              <a href="/login?next=/vendor/listing" className="bp-auth-link">Anmelden</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
