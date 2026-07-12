import React from 'react'
import ForevrHeart from '@/components/ForevrHeart'

type Props = {
  children: React.ReactNode
  /** Kursive Zeile unter der Wortmarke im Brand-Panel und (klein) über dem Formular */
  tagline?: string
  /** Breiteres Formular für mehrspaltige Signups */
  wide?: boolean
  /** Hintergrundbild des Brand-Panels (aus /public) */
  brandImage?: string
}

const FEATURES = [
  'Gästeliste, Sitzplan & Ablauf an einem Ort',
  'Dienstleister finden und direkt anfragen',
  'Kostenlos starten – ganz ohne Kreditkarte',
]

/**
 * Zweispaltiges Auth-Layout (Split-Screen) im Forevr-Branding.
 * Links ein Marken-Panel mit Bild + Wortmarke (ab Desktop), rechts der Inhalt.
 * Auf Mobilgeräten wird nur der rechte Bereich mit kompaktem Logo angezeigt.
 */
export default function AuthLayout({
  children,
  tagline = 'Euer schönster Tag.',
  wide = false,
  brandImage = '/landing/hero.jpg',
}: Props) {
  return (
    <div className="bp-authx">
      <aside
        className="bp-authx-brand"
        style={{ backgroundImage: `url(${brandImage})` }}
      >
        <div className="bp-authx-brand-overlay" />
        <div className="bp-authx-brand-content">
          <div className="bp-authx-brand-top">
            <ForevrHeart size={44} color="#FFFFFF" />
            <p className="bp-authx-brand-wordmark">FOREVR</p>
            <p className="bp-authx-brand-tagline">{tagline}</p>
          </div>
          <ul className="bp-authx-brand-features">
            {FEATURES.map(f => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="bp-authx-main">
        <div className={`bp-authx-panel${wide ? ' bp-authx-panel-wide' : ''}`}>
          <div className="bp-authx-logo">
            <ForevrHeart size={34} color="#9C7F4F" />
            <p className="bp-authx-logo-wordmark">FOREVR</p>
            <p className="bp-authx-logo-tagline">{tagline}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
