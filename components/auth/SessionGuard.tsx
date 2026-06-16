'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sessionPolicyViolation, markActive, clearPersistence } from '@/lib/auth-persistence'

// Setzt die „Angemeldet bleiben"-Präferenz durch: meldet ab, wenn die
// 30-Tage-Frist abgelaufen ist oder (ohne Haken) die Browser-Sitzung beendet
// wurde. Läuft global, ist aber ein No-Op, solange keine Präferenz gesetzt ist.
export default function SessionGuard() {
  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const enforce = async () => {
      const violation = sessionPolicyViolation()
      if (!violation) { markActive(); return }
      const { data: { session } } = await supabase.auth.getSession()
      clearPersistence()
      if (session) {
        await supabase.auth.signOut()
        if (mounted && window.location.pathname !== '/login') {
          window.location.replace('/login')
        }
      }
    }

    enforce()
    const id = window.setInterval(enforce, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') enforce() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', enforce)
    return () => {
      mounted = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', enforce)
    }
  }, [])

  return null
}
