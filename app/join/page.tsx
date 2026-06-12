'use client'

export const dynamic = 'force-dynamic'
import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import '@/app/brautpaar/brautpaar.css'

// Einlösen von invite_codes für bereits registrierte Nutzer.
// Genutzt vor allem für: Solo-Brautpaar lädt einen Veranstalter oder
// den Partner ein. Nicht eingeloggte Nutzer werden zu Login/Signup geleitet
// (der Code bleibt über ?code= erhalten).
const ROLE_LABELS: Record<string, string> = {
  veranstalter:   'Veranstalter',
  brautpaar:      'Brautpaar',
  brautpaar_solo: 'Brautpaar',
  trauzeuge:      'Trauzeuge',
  dienstleister:  'Dienstleister',
}

function portalForRole(role: string, eventId: string): string {
  switch (role) {
    case 'veranstalter':   return `/veranstalter/${eventId}/allgemein`
    case 'dienstleister':  return `/vendor/dashboard/${eventId}/uebersicht`
    default:               return `/brautpaar/${eventId}/uebersicht`
  }
}

// Fehler-Codes aus redeem_invite_code() → verständliche Meldungen
const REDEEM_ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED:        'Bitte melde dich zuerst an.',
  CODE_NOT_FOUND_OR_LOCKED: 'Code nicht gefunden — bitte prüfe den Link.',
  CODE_ALREADY_USED:        'Dieser Code wurde bereits eingelöst.',
  CODE_EXPIRED:             'Dieser Code ist abgelaufen. Bitte lass dir einen neuen Link schicken.',
  EVENT_NOT_FOUND:          'Das zugehörige Event existiert nicht mehr.',
  NOT_APPROVED_ORGANIZER:   'Nur freigeschaltete Veranstalter-Konten können diese Einladung annehmen. Bitte registriere dich zuerst als Veranstalter und warte auf die Freischaltung.',
}

function JoinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [code, setCode]           = useState(searchParams.get('code') ?? '')
  const [loggedIn, setLoggedIn]   = useState<boolean | null>(null)
  const [role, setRole]           = useState<string | null>(null)
  const [checked, setChecked]     = useState(false)
  const [checking, setChecking]   = useState(false)
  const [joining, setJoining]     = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setLoggedIn(!!session))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkCode = async (c: string) => {
    if (!c.trim()) return
    setChecking(true); setError(''); setRole(null); setChecked(false)
    try {
      const { data } = await supabase.rpc('get_invite_preview', { p_code: c.trim() })
      if (data?.[0]) {
        setRole(data[0].role as string)
      } else {
        setError('Code nicht gefunden oder abgelaufen.')
      }
    } catch {
      setError('Code konnte nicht geprüft werden.')
    } finally {
      setChecking(false)
      setChecked(true)
    }
  }

  // Code aus der URL direkt prüfen, sobald Login-Status bekannt ist
  useEffect(() => {
    if (loggedIn !== null && code && !checked && !checking) void checkCode(code)
  }, [loggedIn, code, checked, checking])

  const handleJoin = async () => {
    setJoining(true); setError('')
    try {
      const { data, error: rpcErr } = await supabase.rpc('redeem_invite_code', { p_code: code.trim() })
      if (rpcErr) throw new Error(rpcErr.message)
      const result = data as { success: boolean; error?: string; event_id?: string; role?: string }
      if (!result.success) {
        throw new Error(REDEEM_ERRORS[result.error ?? ''] ?? result.error ?? 'Code konnte nicht eingelöst werden.')
      }
      router.push(portalForRole(result.role ?? 'brautpaar', result.event_id!))
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Beitritt fehlgeschlagen.')
      setJoining(false)
    }
  }

  const loginNext = `/join${code ? `?code=${encodeURIComponent(code)}` : ''}`

  return (
    <div className="bp-auth">
      <div className="bp-auth-inner bp-auth-inner-wide">

        <div className="bp-auth-logo">
          <p className="bp-auth-wordmark">FOREVR</p>
          <p className="bp-auth-tagline">Event beitreten</p>
        </div>

        <div className="bp-auth-card">

          <div style={{ marginBottom: 16 }}>
            <label className="bp-label-text">Einladungscode</label>
            <input
              className="bp-input"
              value={code}
              onChange={e => { setCode(e.target.value); setRole(null); setChecked(false); setError('') }}
              onBlur={() => checkCode(code)}
              placeholder="Code eingeben"
            />
            {checking && <p className="bp-caption" style={{ marginTop: 5 }}>Prüfe Code …</p>}
            {role && (
              <p className="bp-caption" style={{ marginTop: 5, fontWeight: 600, color: 'var(--bp-gold-deep)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={13} /> Einladung gefunden · Rolle: {ROLE_LABELS[role] ?? role}
              </p>
            )}
          </div>

          {error && (
            <p className="bp-auth-error" style={{ marginBottom: 16 }}>{error}</p>
          )}

          {loggedIn === false ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="bp-caption">
                Bitte melde dich an oder erstelle ein Konto, um die Einladung anzunehmen.
              </p>
              <a
                href={`/login?next=${encodeURIComponent(loginNext)}`}
                className="bp-btn bp-btn-primary bp-btn-lg"
                style={{ width: '100%' }}
              >
                Anmelden
              </a>
              <a
                href={`/signup${code ? `?code=${encodeURIComponent(code)}` : ''}`}
                className="bp-btn bp-btn-secondary bp-btn-lg"
                style={{ width: '100%' }}
              >
                Neues Konto erstellen
              </a>
            </div>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joining || !role}
              className="bp-btn bp-btn-primary bp-btn-lg"
              style={{ width: '100%' }}
            >
              {joining ? 'Trete bei …' : 'Event beitreten'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="bp-auth" />}>
      <JoinForm />
    </Suspense>
  )
}
