// app/page.tsx
// Rollenbasiertes Routing nach dem Login:
//   veranstalter            → /veranstalter
//   brautpaar / trauzeuge   → /dashboard
//   dienstleister           → /dashboard
//   kein Event / Demo-Modus → /onboarding
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEvent } from '@/lib/event-context'

export default function Home() {
  const router = useRouter()
  const { currentRole, hasLoaded, isDemo, event } = useEvent()

  useEffect(() => {
    if (!hasLoaded) return // warten bis Context geladen ist

    if (isDemo || !event) {
      // Nicht eingeloggt oder kein Event in DB → Onboarding
      router.replace('/onboarding')
      return
    }

    switch (currentRole) {
      case 'veranstalter':
        router.replace('/veranstalter')
        break
      case 'brautpaar':
      case 'trauzeuge':
      case 'dienstleister':
        router.replace('/dashboard')
        break
      default:
        // Eingeloggt, aber noch keine Rolle (genehmigter Veranstalter ohne Event)
        router.replace('/onboarding')
    }
  }, [hasLoaded, currentRole, isDemo, event, router])

  return null
}
