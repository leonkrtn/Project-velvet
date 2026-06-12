'use client'

export const dynamic = 'force-dynamic'

import React, { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Hourglass } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function VeranstalterPendingPage() {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkApproval = useCallback(async () => {
    try {
      // Client erst hier erzeugen — beim Build-Prerender fehlen die Env-Vars
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.refreshSession()
      if (session?.user?.app_metadata?.is_approved_organizer === true) {
        router.push('/veranstalter/events')
        return
      }
      // Fallback: check profiles directly (when JWT hook is not registered)
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_approved_organizer')
          .eq('id', session.user.id)
          .single()
        if (profile?.is_approved_organizer === true) {
          router.push('/veranstalter/events')
        }
      }
    } catch {
      // ignore — will retry
    }
  }, [router])

  useEffect(() => {
    intervalRef.current = setInterval(checkApproval, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [checkApproval])

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, fontSize: 28, color: 'var(--accent)', letterSpacing: '0.16em', lineHeight: 1 }}>FOREVR</p>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: 32,
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Hourglass size={32} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            Zugang noch nicht freigeschaltet
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 24 }}>
            Dein Veranstalter-Konto wurde noch nicht aktiviert.
            Du wirst automatisch weitergeleitet sobald die Freischaltung erfolgt ist.
          </p>

          <button
            onClick={checkApproval}
            style={{
              padding: '12px 24px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: 600, color: 'var(--text)',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}
          >
            Jetzt prüfen
          </button>
        </div>
      </div>
    </div>
  )
}
