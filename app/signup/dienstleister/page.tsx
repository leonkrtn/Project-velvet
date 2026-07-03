'use client'

export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MARKETPLACE_CATEGORIES } from '@/lib/marketplace/types'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmEmail, setConfirmEmail] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 48, padding: '0 16px', fontSize: 15,
    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    background: '#fff', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: 'var(--text)',
  }
  const fieldLabel: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--text-dim)', marginBottom: 6,
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

      // Session vorhanden → Profil sofort anlegen und ins Portal leiten.
      await fetch('/api/vendor/marketplace/onboard', { method: 'POST' }).catch(() => {})
      router.push('/vendor/listing')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  if (confirmEmail) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, fontSize: 34, color: 'var(--gold)', letterSpacing: '0.16em', lineHeight: 1, marginBottom: 24 }}>FOREVR</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Fast geschafft!</h2>
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>
            Bitte bestätige deine E-Mail-Adresse über den zugesandten Link. Danach kannst du dein
            Anbieter-Profil vervollständigen und zur Freischaltung einreichen.
          </p>
          <a href="/login?next=/vendor/listing" style={{ display: 'inline-block', marginTop: 20, color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Zur Anmeldung</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, fontSize: 34, color: 'var(--gold)', letterSpacing: '0.16em', lineHeight: 1 }}>FOREVR</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 8 }}>
            Werde Teil des Forevr-Marktplatzes und präsentiere deine Dienstleistung Brautpaaren.
          </p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={fieldLabel}>Dein Name <span style={{ color: 'var(--gold)' }}>*</span></label>
              <input required autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Max Beispiel" style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Firma / Marke</label>
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Beispiel Fotografie" style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Kategorie <span style={{ color: 'var(--gold)' }}>*</span></label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                {MARKETPLACE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={fieldLabel}>E-Mail-Adresse <span style={{ color: 'var(--gold)' }}>*</span></label>
              <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="kontakt@firma.de" style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Passwort (mind. 8 Zeichen) <span style={{ color: 'var(--gold)' }}>*</span></label>
              <input type="password" required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
            </div>

            {error && <p style={{ fontSize: 13, color: 'var(--red)', background: 'rgba(160,64,64,0.08)', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}

            <button type="submit" disabled={loading} style={{ padding: '14px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--gold)', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Wird erstellt …' : 'Anbieter-Konto erstellen'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Bereits registriert? <a href="/login?next=/vendor/listing" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Anmelden</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
