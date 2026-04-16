'use client'
import React, { useState } from 'react'

type Phase = 'verify' | 'form' | 'success'

export default function CreateOrganizerPage() {
  const [phase, setPhase] = useState<Phase>('verify')
  const [token, setToken] = useState('')

  const [adminCode, setAdminCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createdEmail, setCreatedEmail] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', fontSize: 14,
    border: '1px solid #ccc', borderRadius: 6,
    background: '#fff', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: '#111',
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifyLoading(true); setVerifyError('')
    try {
      const res = await fetch('/api/admin/create-organizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'verify', code: adminCode }),
      })
      const data = await res.json() as { token?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Verifikation fehlgeschlagen')
      setToken(data.token!)
      setPhase('form')
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : 'Fehler')
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setCreateError('Passwort muss mind. 8 Zeichen haben.'); return }
    setCreateLoading(true); setCreateError('')
    try {
      const res = await fetch('/api/admin/create-organizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'create',
          token,
          name,
          email,
          password,
          ...(companyName ? { companyName } : {}),
        }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) {
        if (res.status === 401) {
          setPhase('verify')
          setToken('')
          throw new Error('Sitzung abgelaufen — bitte Admin-Code erneut eingeben.')
        }
        throw new Error(data.error ?? 'Erstellung fehlgeschlagen')
      }
      setCreatedEmail(email)
      setPhase('success')
      setName(''); setEmail(''); setPassword(''); setCompanyName('')
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Fehler')
    } finally {
      setCreateLoading(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100dvh', background: '#f4f4f4',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    fontFamily: 'system-ui, sans-serif',
  }

  const cardStyle: React.CSSProperties = {
    width: '100%', maxWidth: 420,
    background: '#fff', border: '1px solid #ddd', borderRadius: 10,
    padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  }

  return (
    <div style={containerStyle}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 20, textAlign: 'center' }}>
          Veranstalter erstellen
        </h1>

        {phase === 'verify' && (
          <div style={cardStyle}>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
              Bitte Admin-Code eingeben um fortzufahren.
            </p>
            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Admin-Code</label>
                <input
                  type="password"
                  required
                  autoComplete="off"
                  value={adminCode}
                  onChange={e => setAdminCode(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </div>
              {verifyError && (
                <p style={{ fontSize: 13, color: '#c00', background: 'rgba(200,0,0,0.06)', padding: '8px 12px', borderRadius: 6 }}>{verifyError}</p>
              )}
              <button
                type="submit"
                disabled={verifyLoading}
                style={{
                  padding: '11px', borderRadius: 6, border: 'none',
                  background: '#111', color: '#fff', fontSize: 14,
                  fontWeight: 600, fontFamily: 'inherit',
                  cursor: verifyLoading ? 'not-allowed' : 'pointer',
                  opacity: verifyLoading ? 0.6 : 1,
                }}
              >
                {verifyLoading ? 'Prüfe …' : 'Weiter'}
              </button>
            </form>
          </div>
        )}

        {phase === 'form' && (
          <div style={cardStyle}>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
              Zugangsdaten für den neuen Veranstalter eingeben.
            </p>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Name *</label>
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="Max Mustermann" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>E-Mail *</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="veranstalter@email.de" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Passwort (mind. 8 Zeichen) *</label>
                <input type="password" required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>Firma (optional)</label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Musterfirma GmbH" style={inputStyle} />
              </div>
              {createError && (
                <p style={{ fontSize: 13, color: '#c00', background: 'rgba(200,0,0,0.06)', padding: '8px 12px', borderRadius: 6 }}>{createError}</p>
              )}
              <button
                type="submit"
                disabled={createLoading}
                style={{
                  padding: '11px', borderRadius: 6, border: 'none',
                  background: '#111', color: '#fff', fontSize: 14,
                  fontWeight: 600, fontFamily: 'inherit',
                  cursor: createLoading ? 'not-allowed' : 'pointer',
                  opacity: createLoading ? 0.6 : 1,
                }}
              >
                {createLoading ? 'Wird erstellt …' : 'Veranstalter erstellen'}
              </button>
            </form>
          </div>
        )}

        {phase === 'success' && (
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <p style={{ fontSize: 28, marginBottom: 12 }}>✓</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 8 }}>Veranstalter erstellt</p>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 20 }}>
              Konto für <strong>{createdEmail}</strong> wurde erstellt und als Veranstalter freigeschaltet.
            </p>
            <button
              onClick={() => setPhase('form')}
              style={{
                padding: '10px 20px', borderRadius: 6, border: '1px solid #ccc',
                background: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Weiteren Veranstalter erstellen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
