'use client'

import React from 'react'
import { ExternalLink, PlayCircle } from 'lucide-react'
import { useConsent } from '@/components/consent/ConsentProvider'

// Blockiert Drittanbieter-Inhalte (Google Maps, YouTube, Spotify, Apple Music)
// bis zur Einwilligung in „Externe Medien". Vorher erscheint ein Platzhalter,
// der ohne Datenübertragung auskommt. „Laden" willigt für die Kategorie ein
// (alle externen Medien), sodass der Nutzer nicht jedes Embed einzeln bestätigen muss.
export default function ExternalEmbed({
  provider,
  privacyUrl,
  note,
  minHeight = 200,
  style,
  children,
}: {
  provider: string
  privacyUrl?: string
  note?: string
  minHeight?: number
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const { has, grant, ready } = useConsent()

  // Vor der Hydration nichts Externes rendern (kein Autoload).
  if (ready && has('externalMedia')) return <>{children}</>

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 10, textAlign: 'center', padding: 20, minHeight,
        background: '#F5F6F9', border: '1px dashed #C7D0DE', borderRadius: 12, color: '#4B5768',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        ...style,
      }}
    >
      <PlayCircle size={26} style={{ color: '#8A94A6' }} />
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#111827' }}>
        Externer Inhalt von {provider}
      </div>
      <p style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0, maxWidth: 340 }}>
        {note ?? `Zum Anzeigen wird eine Verbindung zu ${provider} hergestellt, dabei können Daten übertragen und Cookies gesetzt werden.`}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        <button
          onClick={() => grant('externalMedia')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', borderRadius: 9, border: 'none', cursor: 'pointer', background: '#2352C8', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}
        >
          Inhalt laden & einwilligen
        </button>
        {privacyUrl && (
          <a href={privacyUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2352C8', fontWeight: 600, textDecoration: 'none' }}>
            Datenschutz {provider} <ExternalLink size={12} />
          </a>
        )}
      </div>
      <p style={{ fontSize: 11, color: '#8A94A6', margin: '2px 0 0' }}>
        Gilt für alle externen Medien. Jederzeit in den Cookie-Einstellungen änderbar.
      </p>
    </div>
  )
}
