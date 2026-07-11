'use client'

import { SpeedInsights } from '@vercel/speed-insights/next'
import { useConsent } from '@/components/consent/ConsentProvider'

// Lädt Vercel Speed Insights ausschließlich nach Einwilligung in „Statistik".
export default function AnalyticsGate() {
  const { has } = useConsent()
  if (!has('statistics')) return null
  return <SpeedInsights />
}
