'use client'
import React, { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function VeranstalterPendingPage() {
  const router = useRouter()
  const supabase = createClient()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkApproval = async () => {
    try {
      const { data: { session } } = await supabase.auth.refreshSession()
      if (session?.user?.app_metadata?.is_approved_organizer === true) {
        router.push('/veranstalter/events')
      }
    } catch {
      // ignore — will retry
    }
  }

  useEffect(() => {
    intervalRef.current = setInterval(checkApproval, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: 'var(--gold)', letterSpacing: '-1px', lineHeight: 1 }}>Velvet.</p>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: 32,
        }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            Zugang noch nicht freigeschaltet
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 24 }}>
            Dein Veranstalter-Konto wurde noch nicht aktiviert.
            Du wirst automatisch weitergeleitet sobald die Freischaltung erfolgt ist.
          </p>

          <button
            onClick={checkApproval}
            style={{
              padding: '12px 24px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: 600, color: 'var(--text)',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}
          >
            Jetzt prüfen
          </button>
        </div>
      </div>
    </div>
  )
}
