'use client'

import Script from 'next/script'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { useConsent } from '@/components/consent/ConsentProvider'

// Lädt Vercel Speed Insights + Plausible (Funnel-/Event-Tracking) ausschließlich
// nach Einwilligung in „Statistik". Plausible ist cookie-los und EU-hostbar;
// die Domain wird über NEXT_PUBLIC_PLAUSIBLE_DOMAIN konfiguriert — ohne diese
// Env-Var bleibt das Script deaktiviert (kein Tracking ohne Konfiguration).
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
const PLAUSIBLE_SCRIPT_SRC = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL || 'https://plausible.io/js/script.js'

export default function AnalyticsGate() {
  const { has } = useConsent()
  if (!has('statistics')) return null
  return (
    <>
      <SpeedInsights />
      {PLAUSIBLE_DOMAIN && (
        <Script
          defer
          data-domain={PLAUSIBLE_DOMAIN}
          src={PLAUSIBLE_SCRIPT_SRC}
          strategy="afterInteractive"
        />
      )}
    </>
  )
}
