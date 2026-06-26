'use client'

export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import ForevrHeart from '@/components/ForevrHeart'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
  const [confirmEmail, setConfirmEmail] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    if (!firstName.trim() || !lastName.trim()) { setError('Vor- und Nachname sind erforderlich.'); return }
    if (!p2FirstName.trim() || !p2LastName.trim()) { setError('Name der zweiten Person ist erforderlich.'); return }
    setLoading(true); setError('')

    try {
      const supabase = createClient()
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

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: meta },
      })
      if (signUpErr) throw signUpErr

      if (!signUpData.session) {
        setConfirmEmail(true)
        return
      }

      const eventId = await ensureSoloEvent(supabase, meta)

      // Sync extended profile + partner info to DB
      await fetch('/api/brautpaar/sync-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, meta }),
      })

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
      <div className="bp-auth">
        <div className="bp-auth-inner" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <ForevrHeart size={36} color="#9C7F4F" style={{ marginBottom: 8 }} />
            <p className="bp-auth-wordmark" style={{ margin: 0 }}>FOREVR</p>
          </div>
          <h2 className="bp-h2" style={{ marginBottom: 8 }}>Fast geschafft!</h2>
          <p className="bp-body">
            Bitte bestätigt eure E-Mail-Adresse über den Link, den wir euch geschickt haben.
            Nach der Anmeldung wird euer Hochzeits-Event automatisch erstellt.
          </p>
          <a href="/login" className="bp-auth-link" style={{ display: 'inline-block', marginTop: 20 }}>Zur Anmeldung</a>
        </div>
      </div>
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
    <div className="bp-auth">
      <div className="bp-auth-inner bp-auth-inner-wide">

        <div className="bp-auth-logo">
          <ForevrHeart size={40} color="#9C7F4F" style={{ marginBottom: 10 }} />
          <p className="bp-auth-wordmark">FOREVR</p>
          <p className="bp-auth-tagline">Eure Hochzeit, selbst geplant.</p>
        </div>

        <div className="bp-auth-card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Person 1 ── */}
            <p className="bp-label-text" style={{ fontWeight: 700, color: 'var(--text-primary, #1a1a1a)', marginBottom: -4 }}>
              Deine Angaben
            </p>

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

            {/* ── Person 2 ── */}
            <div style={{ borderTop: '1px solid var(--border, #e5e5e5)', paddingTop: 12, marginTop: 4 }}>
              <p className="bp-label-text" style={{ fontWeight: 700, color: 'var(--text-primary, #1a1a1a)', marginBottom: 12 }}>
                Angaben zu deiner Partnerin / deinem Partner
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {field('Vorname', p2FirstName, setP2FirstName, { placeholder: 'Max' })}
                  {field('Nachname', p2LastName, setP2LastName, { placeholder: 'Beispiel' })}
                </div>
                {field('E-Mail (optional)', p2Email, setP2Email, { required: false, type: 'email', placeholder: 'partner@email.de' })}
                {field('Telefon (optional)', p2Phone, setP2Phone, { required: false, placeholder: '+49 151 00000000' })}
              </div>
            </div>

            {/* ── Hochzeitsdatum ── */}
            <div>
              <label className="bp-label-text">Hochzeitsdatum (falls schon bekannt)</label>
              <input type="date" className="bp-input" value={weddingDate} onChange={e => setWeddingDate(e.target.value)} />
            </div>

            {error && <p className="bp-auth-error">{error}</p>}

            <button type="submit" disabled={loading} className="bp-btn bp-btn-primary bp-btn-lg" style={{ width: '100%' }}>
              {loading ? 'Wird erstellt …' : 'Kostenlos starten'}
            </button>
          </form>

          <div className="bp-auth-footer">
            <p>
              Du hast einen Einladungscode?{' '}
              <a href="/signup" className="bp-auth-link">Mit Code registrieren</a>
            </p>
            <p>
              Bereits registriert?{' '}
              <a href="/login" className="bp-auth-link">Anmelden</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
