'use client'
import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

export default function MitarbeiterChangePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    if (password !== confirm) { setError('Passwörter stimmen nicht überein.'); return }
    setSubmitting(true); setError('')
    try {
      const supabase = createClient()
      const { error: pwErr } = await supabase.auth.updateUser({ password })
      if (pwErr) { setError(pwErr.message); return }

      // Clear must_change_password flag via API
      const res = await fetch('/api/mitarbeiter/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: true }),
      })
      if (!res.ok) {
        const { error: apiErr } = await res.json().catch(() => ({ error: 'Fehler' }))
        setError(apiErr)
        return
      }

      router.push('/mitarbeiter')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 380, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Passwort festlegen</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
          Bitte wähle ein neues Passwort für dein Konto.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Neues Passwort
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                style={{ width: '100%', padding: '10px 40px 10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                placeholder="Mindestens 8 Zeichen"
              />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Passwort bestätigen
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              placeholder="Passwort wiederholen"
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 14 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{ width: '100%', padding: '11px', background: submitting ? '#D1D5DB' : '#6366F1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            {submitting ? 'Wird gespeichert…' : 'Passwort speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}
