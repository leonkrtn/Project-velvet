'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, Suspense } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'
import VerifyStep from '@/components/auth/VerifyStep'
import SignupModeToggle, { type SignupMode } from '@/components/auth/SignupModeToggle'
import AuthFooter from '@/components/auth/AuthFooter'
import { createClient } from '@/lib/supabase/client'
import { startSignup, EmailTakenError, EMAIL_TAKEN_MESSAGE } from '@/lib/auth-otp'
import { ensureSoloEvent } from '@/lib/brautpaar-solo'
import { MARKETPLACE_CATEGORIES } from '@/lib/marketplace/types'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import { toRedeemErrorMessage } from '@/lib/auth/redeem-errors'
import '@/app/brautpaar/brautpaar.css'

const HEADINGS: Record<SignupMode, string> = {
  brautpaar: 'Kostenlos starten',
  code: 'Mit Einladungscode registrieren',
  dienstleister: 'Als Dienstleister registrieren',
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCode = searchParams.get('code') ?? ''
  const modeParam = searchParams.get('mode')
  const initialMode: SignupMode = initialCode
    ? 'code'
    : (modeParam === 'dienstleister' || modeParam === 'code' ? modeParam : 'brautpaar')

  const [mode, setMode] = useState<SignupMode>(initialMode)

  // ── Shared ──
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [awaitingCode, setAwaitingCode] = useState(false)

  // ── Brautpaar: 2-Schritt-Formular (erst Account, dann optionale Details) ──
  // Schritt 1 = nur E-Mail + Passwort, um die Einstiegshürde zu senken.
  const [brautpaarStep, setBrautpaarStep] = useState<1 | 2>(1)
  const [emailTaken, setEmailTaken] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)

  // ── Brautpaar (Solo) ──
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phone, setPhone]         = useState('')
  const [street, setStreet]       = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity]           = useState('')
  const [p2FirstName, setP2FirstName] = useState('')
  const [p2LastName, setP2LastName]   = useState('')
  const [p2Email, setP2Email]         = useState('')
  const [p2Phone, setP2Phone]         = useState('')
  const [weddingDate, setWeddingDate] = useState('')

  // ── Einladungscode (nur Paar-/Event-Codes) ──
  const [inviteCode, setInviteCode] = useState(initialCode)
  const [codeValid, setCodeValid]   = useState<boolean | null>(null)
  const [eventRole, setEventRole]   = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [pendingRedeem, setPendingRedeem]   = useState(false)
  const [pendingCode, setPendingCode]       = useState('')

  // ── Name (Code + Dienstleister) ──
  const [name, setName] = useState('')

  // ── Dienstleister ──
  const [company, setCompany]   = useState('')
  const [category, setCategory] = useState('fotograf')

  const switchMode = (m: SignupMode) => { setMode(m); setError(''); setBrautpaarStep(1) }

  // Code-Vorschau (nur Event-/Paar-Einladung)
  const checkCode = async (code: string) => {
    const c = code.trim()
    if (!c) { setCodeValid(null); setEventRole(''); return }
    setPreviewLoading(true); setCodeValid(null); setEventRole('')
    try {
      const supabase = createClient()
      const { data } = await supabase.rpc('get_invite_preview', { p_code: c })
      if (data?.[0]) { setCodeValid(true); setEventRole(data[0].role ?? '') }
      else setCodeValid(false)
    } catch { setCodeValid(false) }
    finally { setPreviewLoading(false) }
  }

  // Prefill-Code beim Laden prüfen
  useEffect(() => { if (initialCode) checkCode(initialCode) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // E-Mail-Verfügbarkeit früh prüfen (onBlur), statt erst nach vollständigem
  // Ausfüllen des Formulars beim Submit (EMAIL_TAKEN kommt sonst zu spät).
  const checkEmailAvailability = async (value: string): Promise<boolean> => {
    const e = value.trim()
    if (!e || !e.includes('@')) { setEmailTaken(false); return false }
    setCheckingEmail(true)
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e }),
      })
      const d = await res.json().catch(() => ({}))
      const taken = !!d.taken
      setEmailTaken(taken)
      return taken
    } catch { setEmailTaken(false); return false }
    finally { setCheckingEmail(false) }
  }

  const goToBrautpaarStep2 = async () => {
    setError('')
    if (!email.trim()) { setError('E-Mail-Adresse ist erforderlich.'); return }
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    const taken = await checkEmailAvailability(email)
    if (taken) { setError(EMAIL_TAKEN_MESSAGE); return }
    setBrautpaarStep(2)
  }

  const isDirty = mode === 'brautpaar' && (brautpaarStep === 2 || email.length > 0 || password.length > 0)
  useUnsavedChangesWarning(isDirty && !awaitingCode)

  const buildBrautpaarMeta = () => ({
    name: `${firstName.trim()} ${lastName.trim()}`,
    partner_name: `${p2FirstName.trim()} ${p2LastName.trim()}`,
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
  })

  const doRedeem = async (code: string): Promise<string> => {
    const supabase = createClient()
    const result = await supabase.rpc('redeem_invite_code', { p_code: code })
    if (result.error) throw new Error(toRedeemErrorMessage(undefined, result.error.message))
    const data = result.data as { success: boolean; error?: string; event_id?: string }
    if (!data.success) throw new Error(toRedeemErrorMessage(data.error))
    return data.event_id!
  }

  const finishRedeem = async (code: string) => {
    try {
      const eventId = await doRedeem(code)
      router.push(`/dashboard?event=${eventId}`)
    } catch (redeemErr: unknown) {
      setPendingCode(code)
      setPendingRedeem(true)
      setAwaitingCode(false)
      setError(
        (redeemErr instanceof Error ? redeemErr.message : 'Unbekannter Fehler') +
        ' — Konto wurde erstellt. Klicke „Erneut versuchen", um den Code einzulösen.'
      )
    }
  }

  const handleRetryRedeem = async () => {
    setLoading(true); setError('')
    try {
      const eventId = await doRedeem(pendingCode)
      router.push(`/dashboard?event=${eventId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Code konnte nicht eingelöst werden.')
    } finally { setLoading(false) }
  }

  // Nach bestätigter E-Mail: modusabhängige Weiterleitung
  const onVerified = async (supabase: SupabaseClient) => {
    if (mode === 'brautpaar') {
      const meta = buildBrautpaarMeta()
      const eventId = await ensureSoloEvent(supabase, meta)
      await fetch('/api/brautpaar/sync-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, meta }),
      }).catch(() => {})
      router.push(`/brautpaar/${eventId}/uebersicht`)
      router.refresh()
    } else if (mode === 'dienstleister') {
      await fetch('/api/vendor/marketplace/onboard', { method: 'POST' }).catch(() => {})
      router.push('/vendor/onboarding')
      router.refresh()
    } else {
      await finishRedeem(pendingCode || inviteCode.trim())
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }

    let metadata: Record<string, unknown>
    if (mode === 'brautpaar') {
      if (brautpaarStep !== 2) { await goToBrautpaarStep2(); return }
      // Partnername ist bewusst optional (Solo-Brautpaar kann ihn später ergänzen).
      metadata = buildBrautpaarMeta()
    } else if (mode === 'dienstleister') {
      if (!name.trim()) { setError('Bitte gib deinen Namen ein.'); return }
      if (!company.trim()) { setError('Bitte gib deinen Unternehmensnamen an.'); return }
      metadata = { name: name.trim(), company_name: company.trim(), category, signup_role: 'dienstleister' }
    } else {
      if (!inviteCode.trim()) { setError('Einladungscode ist erforderlich.'); return }
      if (!name.trim()) { setError('Bitte gib deinen Namen ein.'); return }
      metadata = { name: name.trim() }
    }

    setLoading(true); setError('')
    try {
      await startSignup({ email: email.trim(), password, metadata })
      if (mode === 'code') setPendingCode(inviteCode.trim())
      setAwaitingCode(true)
    } catch (err: unknown) {
      if (err instanceof EmailTakenError) setError(EMAIL_TAKEN_MESSAGE)
      else setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally { setLoading(false) }
  }

  // ── Verify-Zwischenschritt ──
  if (awaitingCode) {
    return (
      <AuthLayout tagline="Euer schönster Tag." xwide>
        <VerifyStep
          supabase={createClient()}
          email={email.trim()}
          password={password}
          onVerified={onVerified}
          onBack={() => { setAwaitingCode(false); setLoading(false) }}
        />
      </AuthLayout>
    )
  }

  // Gemeinsames Passwortfeld
  const passwordField = (
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
  )

  const field = (
    label: string, value: string, onChange: (v: string) => void,
    opts?: { required?: boolean; type?: string; placeholder?: string; autoComplete?: string },
  ) => (
    <div>
      <label className="bp-label-text">
        {label}{opts?.required !== false && <span className="bp-text-gold-deep"> *</span>}
      </label>
      <input
        type={opts?.type ?? 'text'} required={opts?.required !== false}
        autoComplete={opts?.autoComplete} className="bp-input"
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={opts?.placeholder ?? ''}
      />
    </div>
  )

  return (
    <AuthLayout tagline="Euer schönster Tag." xwide>
      <div className="bp-authx-card">
        <SignupModeToggle mode={mode} onChange={switchMode} />
        <h1 className="bp-authx-heading">{HEADINGS[mode]}</h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ══ BRAUTPAAR — Schritt 1: nur Account (E-Mail + Passwort) ══ */}
          {mode === 'brautpaar' && brautpaarStep === 1 && (
            <div className="bp-authx-narrow" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p className="bp-caption" style={{ margin: 0 }}>Schritt 1 von 2 — euer Konto</p>
              <div>
                <label className="bp-label-text">E-Mail-Adresse <span className="bp-text-gold-deep">*</span></label>
                <input
                  type="email" required autoComplete="email" className="bp-input"
                  value={email} onChange={e => { setEmail(e.target.value); setEmailTaken(false) }}
                  onBlur={() => checkEmailAvailability(email)}
                  placeholder="deine@email.de"
                />
                {checkingEmail && <p className="bp-caption" style={{ marginTop: 5 }}>Prüfe E-Mail …</p>}
                {emailTaken && !checkingEmail && (
                  <p className="bp-caption" style={{ marginTop: 5 }}>{EMAIL_TAKEN_MESSAGE}</p>
                )}
              </div>
              {passwordField}
              <button type="button" className="bp-btn bp-btn-primary bp-btn-lg" style={{ width: '100%' }} onClick={goToBrautpaarStep2}>
                Weiter
              </button>
            </div>
          )}

          {/* ══ BRAUTPAAR — Schritt 2: optionale Details (zweispaltig) ══ */}
          {mode === 'brautpaar' && brautpaarStep === 2 && (
            <div className="bp-authx-2col">
              <p className="bp-caption" style={{ margin: '0 0 4px', gridColumn: '1 / -1' }}>
                Schritt 2 von 2 — diese Angaben könnt ihr auch später ergänzen.
              </p>
              <div className="bp-authx-col">
                <p className="bp-authx-section-title">Deine Angaben</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {field('Vorname', firstName, setFirstName, { required: false, placeholder: 'Anna', autoComplete: 'given-name' })}
                  {field('Nachname', lastName, setLastName, { required: false, placeholder: 'Beispiel', autoComplete: 'family-name' })}
                </div>
                {field('Telefonnummer', phone, setPhone, { required: false, placeholder: '+49 151 00000000', autoComplete: 'tel' })}
                {field('Straße und Hausnummer', street, setStreet, { required: false, placeholder: 'Musterstraße 1', autoComplete: 'street-address' })}
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                  {field('PLZ', postalCode, setPostalCode, { required: false, placeholder: '10115', autoComplete: 'postal-code' })}
                  {field('Stadt', city, setCity, { required: false, placeholder: 'Berlin', autoComplete: 'address-level2' })}
                </div>
              </div>
              <div className="bp-authx-col">
                <p className="bp-authx-section-title">Partnerin / Partner (optional)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {field('Vorname', p2FirstName, setP2FirstName, { required: false, placeholder: 'Max' })}
                  {field('Nachname', p2LastName, setP2LastName, { required: false, placeholder: 'Beispiel' })}
                </div>
                {field('E-Mail (optional)', p2Email, setP2Email, { required: false, type: 'email', placeholder: 'partner@email.de' })}
                {field('Telefon (optional)', p2Phone, setP2Phone, { required: false, placeholder: '+49 151 00000000' })}
                <div>
                  <label className="bp-label-text">Hochzeitsdatum (spart euch später einen Klick)</label>
                  <input type="date" className="bp-input" value={weddingDate} onChange={e => setWeddingDate(e.target.value)} />
                </div>
              </div>
              <button type="button" className="bp-btn bp-btn-ghost bp-btn-sm" style={{ gridColumn: '1 / -1', justifySelf: 'start' }} onClick={() => setBrautpaarStep(1)}>
                Zurück
              </button>
            </div>
          )}

          {/* ══ EINLADUNGSCODE ══ */}
          {mode === 'code' && (
            <div className="bp-authx-narrow" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="bp-label-text">Einladungscode <span className="bp-text-gold-deep">*</span></label>
                <input
                  required className="bp-input"
                  value={inviteCode}
                  onChange={e => { setInviteCode(e.target.value); setCodeValid(null); setEventRole('') }}
                  onBlur={() => checkCode(inviteCode)}
                  placeholder="Dein Einladungscode"
                />
                {previewLoading && <p className="bp-caption" style={{ marginTop: 5 }}>Prüfe Code …</p>}
                {codeValid === true && (
                  <p className="bp-caption" style={{ marginTop: 5, fontWeight: 600, color: 'var(--bp-gold-deep)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={13} /> Einladung gefunden{eventRole ? ` · Rolle: ${eventRole}` : ''}
                  </p>
                )}
                {codeValid === false && inviteCode.trim() && !previewLoading && (
                  <p className="bp-caption" style={{ marginTop: 5 }}>Code nicht gefunden oder abgelaufen</p>
                )}
              </div>
              {field('Dein Name', name, setName, { placeholder: 'Max Mustermann', autoComplete: 'name' })}
              {field('E-Mail-Adresse', email, setEmail, { type: 'email', placeholder: 'deine@email.de', autoComplete: 'email' })}
              {passwordField}
            </div>
          )}

          {/* ══ DIENSTLEISTER ══ */}
          {mode === 'dienstleister' && (
            <div className="bp-authx-narrow" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {field('Dein Name', name, setName, { placeholder: 'Max Beispiel', autoComplete: 'name' })}
              {field('Unternehmensname', company, setCompany, { placeholder: 'Beispiel Fotografie GmbH', autoComplete: 'organization' })}
              <div>
                <label className="bp-label-text">Kategorie <span className="bp-text-gold-deep">*</span></label>
                <select className="bp-input" value={category} onChange={e => setCategory(e.target.value)}>
                  {MARKETPLACE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              {field('E-Mail-Adresse', email, setEmail, { type: 'email', placeholder: 'kontakt@firma.de', autoComplete: 'email' })}
              {passwordField}
            </div>
          )}

          {error && (
            <div className="bp-auth-error">
              <p style={{ margin: 0 }}>{error}</p>
              {pendingRedeem && (
                <button type="button" onClick={handleRetryRedeem} disabled={loading} className="bp-btn bp-btn-danger bp-btn-sm" style={{ marginTop: 10 }}>
                  {loading ? 'Wird versucht …' : 'Erneut versuchen'}
                </button>
              )}
            </div>
          )}

          {!pendingRedeem && !(mode === 'brautpaar' && brautpaarStep === 1) && (
            <button type="submit" disabled={loading} className="bp-btn bp-btn-primary bp-btn-lg" style={{ width: '100%' }}>
              {loading ? 'Wird erstellt …' : mode === 'brautpaar' ? 'Kostenlos starten' : 'Konto erstellen'}
            </button>
          )}
        </form>

        <AuthFooter loginPrompt />
      </div>
    </AuthLayout>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="bp-authx" />}>
      <SignupForm />
    </Suspense>
  )
}
