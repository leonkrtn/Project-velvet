'use client'

export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'
import VerifyStep from '@/components/auth/VerifyStep'
import SignupModeTabs from '@/components/auth/SignupModeTabs'
import AuthFooter from '@/components/auth/AuthFooter'
import { createClient } from '@/lib/supabase/client'
import { startSignup, EmailTakenError, EMAIL_TAKEN_MESSAGE } from '@/lib/auth-otp'
import { ensureSoloEvent } from '@/lib/brautpaar-solo'
import '@/app/brautpaar/brautpaar.css'

export default function BrautpaarSignupPage() {
  const router = useRouter()

  // Person 1
  const [firstName, setFirstName]   = useState('')
  const [lastName, setLastName]     = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [phone, setPhone]           = useState('')
  const [street, setStreet]         = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity]             = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Person 2
  const [p2FirstName, setP2FirstName] = useState('')
  const [p2LastName, setP2LastName]   = useState('')
  const [p2Email, setP2Email]         = useState('')
  const [p2Phone, setP2Phone]         = useState('')

  // Shared
  const [weddingDate, setWeddingDate] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  // Verifizierungs-Zwischenschritt: Metadaten der Registrierung merken, bis der
  // E-Mail-Code eingegeben wurde.
  const [pendingMeta, setPendingMeta] = useState<Record<string, unknown> | null>(null)

  // Legt nach bestätigter Registrierung Event + Profil an und leitet weiter.
  const completeOnboarding = async (supabase: SupabaseClient, meta: Record<string, unknown>) => {
    const eventId = await ensureSoloEvent(supabase, meta)
    await fetch('/api/brautpaar/sync-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, meta }),
    }).catch(() => {})
    router.push(`/brautpaar/${eventId}/uebersicht`)
    router.refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    if (!firstName.trim() || !lastName.trim()) { setError('Vor- und Nachname sind erforderlich.'); return }
    if (!p2FirstName.trim() || !p2LastName.trim()) { setError('Name der zweiten Person ist erforderlich.'); return }
    setLoading(true); setError('')

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`
      const partnerFullName = `${p2FirstName.trim()} ${p2LastName.trim()}`

      const meta = {
        name: fullName,
        partner_name: partnerFullName,
        wedding_date: weddingDate || undefined,
        signup_role: 'brautpaar_solo' as const,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        street: street.trim(),
        postal_code: postalCode.trim(),
        city: city.trim(),
        partner_first_name: p2FirstName.trim(),
        partner_last_name: p2LastName.trim(),
        partner_email: p2Email.trim(),
        partner_phone: p2Phone.trim(),
      }

      // Account anlegen + Code versenden. Bereits vergebene E-Mail → Abbruch.
      await startSignup({ email: email.trim(), password, metadata: meta })
      setPendingMeta(meta)
    } catch (err: unknown) {
      if (err instanceof EmailTakenError) setError(EMAIL_TAKEN_MESSAGE)
      else setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  if (pendingMeta) {
    return (
      <AuthLayout tagline="Eure Hochzeit, selbst geplant." wide>
        <VerifyStep
          supabase={createClient()}
          email={email.trim()}
          password={password}
          onVerified={supabase => completeOnboarding(supabase, pendingMeta)}
          onBack={() => { setPendingMeta(null); setLoading(false) }}
          note="Nach der Bestätigung wird euer Hochzeits-Event automatisch erstellt."
        />
      </AuthLayout>
    )
  }

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { required?: boolean; type?: string; placeholder?: string; autoComplete?: string }
  ) => (
    <div>
      <label className="bp-label-text">
        {label}{opts?.required !== false && <span className="bp-text-gold-deep"> *</span>}
      </label>
      <input
        type={opts?.type ?? 'text'}
        required={opts?.required !== false}
        autoComplete={opts?.autoComplete}
        className="bp-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={opts?.placeholder ?? ''}
      />
    </div>
  )

  return (
    <AuthLayout tagline="Eure Hochzeit, selbst geplant." xwide>
        <div className="bp-authx-card">
          <SignupModeTabs active="brautpaar" />
          <h1 className="bp-authx-heading">Kostenlos starten</h1>
          <p className="bp-authx-sub">Erstellt euer gemeinsames Hochzeitskonto in wenigen Minuten.</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div className="bp-authx-2col">
              {/* ── Spalte 1: Deine Angaben ── */}
              <div className="bp-authx-col">
                <div>
                  <p className="bp-authx-section-title">Deine Angaben</p>
                  <p className="bp-authx-section-hint">Diese Person verwaltet das Konto.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {field('Vorname', firstName, setFirstName, { placeholder: 'Anna', autoComplete: 'given-name' })}
                  {field('Nachname', lastName, setLastName, { placeholder: 'Beispiel', autoComplete: 'family-name' })}
                </div>

                {field('E-Mail-Adresse', email, setEmail, { type: 'email', placeholder: 'deine@email.de', autoComplete: 'email' })}

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

                {field('Telefonnummer', phone, setPhone, { placeholder: '+49 151 00000000', autoComplete: 'tel' })}

                {field('Straße und Hausnummer', street, setStreet, { placeholder: 'Musterstraße 1', autoComplete: 'street-address' })}

                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                  {field('PLZ', postalCode, setPostalCode, { placeholder: '10115', autoComplete: 'postal-code' })}
                  {field('Stadt', city, setCity, { placeholder: 'Berlin', autoComplete: 'address-level2' })}
                </div>
              </div>

              {/* ── Spalte 2: Partner:in + Hochzeit ── */}
              <div className="bp-authx-col">
                <div>
                  <p className="bp-authx-section-title">Partnerin / Partner</p>
                  <p className="bp-authx-section-hint">Ihr könnt euch später gegenseitig einladen.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {field('Vorname', p2FirstName, setP2FirstName, { placeholder: 'Max' })}
                  {field('Nachname', p2LastName, setP2LastName, { placeholder: 'Beispiel' })}
                </div>
                {field('E-Mail (optional)', p2Email, setP2Email, { required: false, type: 'email', placeholder: 'partner@email.de' })}
                {field('Telefon (optional)', p2Phone, setP2Phone, { required: false, placeholder: '+49 151 00000000' })}

                <div>
                  <label className="bp-label-text">Hochzeitsdatum (falls schon bekannt)</label>
                  <input type="date" className="bp-input" value={weddingDate} onChange={e => setWeddingDate(e.target.value)} />
                </div>
              </div>
            </div>

            {error && <p className="bp-auth-error">{error}</p>}

            <button type="submit" disabled={loading} className="bp-btn bp-btn-primary bp-btn-lg" style={{ width: '100%' }}>
              {loading ? 'Wird erstellt …' : 'Kostenlos starten'}
            </button>
          </form>

          <AuthFooter
            loginPrompt
            alts={[{ label: 'Als Dienstleister listen', href: '/signup/dienstleister' }]}
          />
        </div>
    </AuthLayout>
  )
}
