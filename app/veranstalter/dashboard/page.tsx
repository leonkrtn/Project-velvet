'use client'
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function DashboardRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventId = searchParams.get('event')

  useEffect(() => {
    if (eventId) {
      router.replace(`/veranstalter/${eventId}/uebersicht`)
    } else {
      router.replace('/veranstalter')
    }
  }, [eventId, router])

  return null
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardRedirect />
    </Suspense>
  )
}
