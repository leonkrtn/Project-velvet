'use client'

export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import ForevrHeart from '@/components/ForevrHeart'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import '@/app/brautpaar/brautpaar.css'

// Schritt 2 des Passwort-Reset-Flows: Nutzer kommt über den Recovery-Link
// (Session existiert bereits durch /auth/callback) und setzt ein neues Passwort.
export default function PasswordResetUpdatePage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    if (password !== passwordRepeat) { setError('Die Passwörter stimmen nicht überein.'); return }
    setLoading(true); setError('')
    try {
      const supabase = createClient()
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw updateErr
      router.push('/login')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Passwort konnte nicht geändert werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bp-auth">
      <div className="bp-auth-inner">

        <div className="bp-auth-logo">
          <ForevrHeart size={40} color="#9C7F4F" style={{ marginBottom: 10 }} />
          <p className="bp-auth-wordmark">FOREVR</p>
          <p className="bp-auth-tagline">Neues Passwort festlegen</p>
        </div>

        <div className="bp-auth-card">
          <h1 className="bp-auth-title">Neues Passwort</h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="bp-label-text">Neues Passwort (mind. 8 Zeichen)</label>
              <div className="bp-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'} required autoComplete="new-password"
                  className="bp-input"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="bp-input-eye"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="bp-label-text">Passwort wiederholen</label>
              <input
                type={showPassword ? 'text' : 'password'} required autoComplete="new-password"
                className="bp-input"
                value={passwordRepeat} onChange={e => setPasswordRepeat(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && <p className="bp-auth-error">{error}</p>}

            <button type="submit" disabled={loading} className="bp-btn bp-btn-primary bp-btn-lg" style={{ width: '100%' }}>
              {loading ? 'Wird gespeichert …' : 'Passwort speichern'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
