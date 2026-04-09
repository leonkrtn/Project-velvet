// app/page.tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadEvent } from '@/lib/store'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const event = loadEvent()
    if (!event.onboardingComplete) {
      router.replace('/einstellungen')
    } else {
      router.replace('/dashboard')
    }
  }, [router])
  return null
}
