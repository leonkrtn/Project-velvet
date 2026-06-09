'use client'
import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn])

  const handleJoin = async () => {
    setJoining(true); setError('')
    try {
      const { data, error: rpcErr } = await supabase.rpc('redeem_invite_code', { p_code: code.trim() })
      if (rpcErr) throw new Error(rpcErr.message)
      const result = data as { success: boolean; error?: string; event_id?: string; role?: string }
      if (!result.success) throw new Error(result.error ?? 'Code konnte nicht eingelöst werden.')
      router.push(portalForRole(result.role ?? 'brautpaar', result.event_id!))
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Beitritt fehlgeschlagen.')
      setJoining(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', fontSize: 15,
    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    background: '#fff', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: 'var(--text)',
  }

  const loginNext = `/join${code ? `?code=${encodeURIComponent(code)}` : ''}`

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 40, color: 'var(--gold)', letterSpacing: '-1px', lineHeight: 1 }}>Velvet.</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 8 }}>Event beitreten</p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 28 }}>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
              Einladungscode
            </label>
            <input
              value={code}
              onChange={e => { setCode(e.target.value); setRole(null); setChecked(false); setError('') }}
              onBlur={() => checkCode(code)}
              placeholder="Code eingeben"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
            />
            {checking && <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 5 }}>Prüfe Code …</p>}
            {role && (
              <p style={{ fontSize: 12, color: 'var(--gold)', marginTop: 5, fontWeight: 600 }}>
                Einladung gefunden · Rolle: {ROLE_LABELS[role] ?? role}
              </p>
            )}
          </div>

          {error && (
            <p style={{ fontSize: 13, color: 'var(--red)', background: 'rgba(160,64,64,0.08)', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>{error}</p>
          )}

          {loggedIn === false ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                Bitte melde dich an oder erstelle ein Konto, um die Einladung anzunehmen.
              </p>
              <a
                href={`/login?next=${encodeURIComponent(loginNext)}`}
                style={{
                  padding: '14px', borderRadius: 'var(--r-sm)', textAlign: 'center',
                  background: 'var(--text)', color: '#fff', fontSize: 15, fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Anmelden
              </a>
              <a
                href={`/signup${code ? `?code=${encodeURIComponent(code)}` : ''}`}
                style={{
                  padding: '14px', borderRadius: 'var(--r-sm)', textAlign: 'center',
                  border: '1px solid var(--border)', color: 'var(--text)',
                  fontSize: 15, fontWeight: 600, textDecoration: 'none',
                }}
              >
                Neues Konto erstellen
              </a>
            </div>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joining || !role}
              style={{
                width: '100%', padding: '14px', borderRadius: 'var(--r-sm)', border: 'none',
                background: 'var(--gold)', color: '#fff',
                fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
                cursor: joining || !role ? 'not-allowed' : 'pointer',
                opacity: joining || !role ? 0.6 : 1, transition: 'opacity 0.15s',
              }}
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
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--bg)' }} />}>
      <JoinForm />
    </Suspense>
  )
}
