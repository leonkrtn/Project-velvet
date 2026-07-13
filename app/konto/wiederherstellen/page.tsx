'use client'

export const dynamic = 'force-dynamic'
import React, { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { RotateCcw, LogOut, Loader2 } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'
import { createClient } from '@/lib/supabase/client'
import { resolveDestination } from '@/lib/auth/resolve-destination'
import { performLogout } from '@/lib/logout'
import '@/app/brautpaar/brautpaar.css'

function daysLeft(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

function RestoreForm() {
  const searchParams = useSearchParams()
  const rawNext = searchParams.get('next')
  const nextUrl = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null

  const [loading, setLoading] = useState(true)
  const [purgeAt, setPurgeAt] = useState<string | null>(null)
  const [busy, setBusy] = useState<'restore' | 'logout' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.assign('/login'); return }

      const res = await fetch('/api/account/restore')
      const data = await res.json().catch(() => ({}))
      if (!data.deleted) {
        // Nichts (mehr) zu tun — direkt weiterleiten.
        const dest = await resolveDestination(supabase, session.user, nextUrl)
        window.location.assign(dest)
        return
      }
      setPurgeAt(data.scheduledPurgeAt ?? null)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function restore() {
    setBusy('restore'); setError('')
    try {
      const res = await fetch('/api/account/restore', { method: 'POST' })
      if (!res.ok) throw new Error('Wiederherstellung fehlgeschlagen.')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const dest = await resolveDestination(supabase, session!.user, nextUrl)
      window.location.assign(dest)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wiederherstellung fehlgeschlagen.')
      setBusy(null)
    }
  }

  async function logout() {
    setBusy('logout')
    await performLogout()
  }

  const remaining = daysLeft(purgeAt)

  return (
    <AuthLayout tagline="Euer schönster Tag.">
      <div className="bp-authx-card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <Loader2 size={22} className="bp-spin" />
          </div>
        ) : (
          <>
            <h1 className="bp-authx-heading">Dein Account wurde gelöscht</h1>
            <p className="bp-authx-sub">
              {remaining != null
                ? `Er wird in ${remaining} Tag${remaining === 1 ? '' : 'en'} endgültig gelöscht, sofern du nichts unternimmst. Bis dahin kannst du ihn jederzeit wiederherstellen.`
                : 'Er wird in Kürze endgültig gelöscht, sofern du nichts unternimmst. Bis dahin kannst du ihn jederzeit wiederherstellen.'}
            </p>

            {error && <p className="bp-auth-error">{error}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={restore}
                disabled={!!busy}
                className="bp-btn bp-btn-primary bp-btn-lg"
                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {busy === 'restore' ? <Loader2 size={16} className="bp-spin" /> : <RotateCcw size={16} />}
                Account wiederherstellen
              </button>
              <button
                type="button"
                onClick={logout}
                disabled={!!busy}
                className="bp-btn bp-btn-lg"
                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'none', border: '1px solid var(--bp-line, #e7e0d6)' }}
              >
                {busy === 'logout' ? <Loader2 size={16} className="bp-spin" /> : <LogOut size={16} />}
                Ausloggen
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`.bp-spin{animation:bpSpin 1s linear infinite}@keyframes bpSpin{to{transform:rotate(360deg)}}`}</style>
    </AuthLayout>
  )
}

export default function AccountRestorePage() {
  return (
    <Suspense fallback={<div className="bp-auth" />}>
      <RestoreForm />
    </Suspense>
  )
}
