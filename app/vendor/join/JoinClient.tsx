'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CalendarDays, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { MODULE_MAP } from '@/lib/vendor-modules'

interface EventPreview {
  event_id:    string
  event_title: string
  event_date:  string | null
  role:        string
  permissions: string[]
  expires_at:  string
}

interface Props {
  initialCode: string
}

export default function JoinClient({ initialCode }: Props) {
  const router = useRouter()
  const [code, setCode]           = useState(initialCode)
  const [preview, setPreview]     = useState<EventPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [joining, setJoining]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)

  // Auto-Vorschau wenn Code aus URL-Param kommt
  useEffect(() => {
    if (initialCode.trim().length >= 10) {
      handlePreview(initialCode.trim())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePreview(c?: string) {
    const lookupCode = (c ?? code).trim()
    if (!lookupCode) return
    setLoadingPreview(true)
    setError(null)
    setPreview(null)
    const supabase = createClient()
    const { data, error: rpcErr } = await supabase.rpc('preview_invitation_code', { p_code: lookupCode })
    setLoadingPreview(false)
    if (rpcErr || !data) {
      setError('Code konnte nicht geprüft werden.')
      return
    }
    if (data.error) {
      setError(data.error)
      return
    }
    setPreview(data as EventPreview)
  }

  async function handleJoin() {
    if (!preview) return
    setJoining(true)
    setError(null)
    const supabase = createClient()
    const { data, error: rpcErr } = await supabase.rpc('join_event_by_code', { p_code: code.trim() })
    setJoining(false)
    if (rpcErr || !data) {
      setError('Beitritt fehlgeschlagen. Bitte versuche es erneut.')
      return
    }
    if (data.error) {
      setError(data.error)
      return
    }
    setSuccess(true)
    setTimeout(() => router.push(`/vendor/dashboard/${preview.event_id}`), 1800)
  }

  const moduleLabels = preview?.permissions
    .map(p => MODULE_MAP[p]?.label)
    .filter(Boolean)
    .join(', ')

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Velvet</p>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Event beitreten</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Gib deinen Einladungscode ein.</p>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, boxShadow: 'var(--shadow-md)' }}>

          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(52,199,89,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={28} color="#34C759" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Erfolgreich beigetreten!</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Du wirst weitergeleitet…</p>
            </div>
          ) : (
            <>
              {/* Code-Eingabe */}
              {!preview && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    Einladungscode
                  </label>
                  <input
                    value={code}
                    onChange={e => { setCode(e.target.value); setError(null) }}
                    onKeyDown={e => e.key === 'Enter' && handlePreview()}
                    placeholder="Code eingeben…"
                    style={{ width: '100%', padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    autoFocus
                  />
                </div>
              )}

              {/* Fehlermeldung */}
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
                  <AlertCircle size={15} color="#FF3B30" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#FF3B30' }}>{error}</span>
                </div>
              )}

              {/* Event-Vorschau */}
              {preview && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ background: '#F5F5F7', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Event</p>
                    <p style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 4 }}>{preview.event_title}</p>
                    {preview.event_date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
                        <CalendarDays size={13} />
                        {new Date(preview.event_date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div style={{ background: '#F5F5F7', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4 }}>Rolle</p>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>Dienstleister</p>
                    </div>
                    <div style={{ background: '#F5F5F7', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4 }}>Gültig bis</p>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{new Date(preview.expires_at).toLocaleDateString('de-DE')}</p>
                    </div>
                  </div>

                  {moduleLabels && (
                    <div style={{ background: '#F5F5F7', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4 }}>Zugriff auf</p>
                      <p style={{ fontSize: 13, lineHeight: 1.6 }}>{moduleLabels}</p>
                    </div>
                  )}

                  <button
                    onClick={() => { setPreview(null); setError(null) }}
                    style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-tertiary)', cursor: 'pointer', marginTop: 8, padding: '2px 0', textDecoration: 'underline' }}
                  >
                    Anderen Code eingeben
                  </button>
                </div>
              )}

              {/* Aktions-Buttons */}
              {!preview ? (
                <button
                  onClick={() => handlePreview()}
                  disabled={loadingPreview || !code.trim()}
                  style={{ width: '100%', padding: '11px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: loadingPreview || !code.trim() ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: !code.trim() ? 0.5 : 1 }}
                >
                  {loadingPreview ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Prüfen…</> : 'Code prüfen'}
                </button>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  style={{ width: '100%', padding: '11px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: joining ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {joining ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Beitreten…</> : 'Event beitreten'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
