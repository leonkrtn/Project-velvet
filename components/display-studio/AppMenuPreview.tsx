'use client'

import React from 'react'
import { LayoutGrid, Users, Armchair, Wallet, FolderOpen, ChevronRight } from 'lucide-react'
import {
  HEADING_FONTS, BODY_FONTS, fontHrefFor, bodyFontHrefFor, shade, textureStyle,
  type DisplaySettings,
} from '@/lib/display-settings'
import { DeviceFrame, screenHeightFor } from './DeviceMock'

const SCALE = { kompakt: 0.9, standard: 1, gross: 1.15 } as const

// Vorschau des Brautpaar-Portals („das Menü"), wie es die Anzeige-Einstellungen
// tatsächlich gestalten: Hintergrund (Farbe/Muster), Akzentfarbe (aktiver
// Menüpunkt + Buttons), Überschriften-Schrift/-Größe und Eckenform.
export default function AppMenuPreview({ s, device, coupleName }: {
  s: DisplaySettings
  device: 'desktop' | 'mobile'
  coupleName: string
}) {
  const headingFamily = HEADING_FONTS[s.headingFont].family
  const headingHref = fontHrefFor(s.headingFont)
  const bodyHref = bodyFontHrefFor(s.bodyFont)
  const bodyFamily = BODY_FONTS[s.bodyFont].family
  const scale = SCALE[s.headingScale]
  const tex = textureStyle(s.bgTexture)
  const accent = s.accent
  const accentDeep = shade(accent, -0.18)
  const radius = s.cornerStyle === 'elegant' ? 4 : 14
  const btnRadius = s.buttonStyle === 'square' ? 8 : 999
  const ink = '#2C2825'
  const ink3 = 'rgba(44,40,37,0.55)'
  const initials = coupleName.split(/\s|&/).map(w => w.trim()[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'AM'

  const items: { icon: React.ReactNode; label: string }[] = [
    { icon: <LayoutGrid size={16} />, label: 'Übersicht' },
    { icon: <Users size={16} />, label: 'Gästeliste' },
    { icon: <Armchair size={16} />, label: 'Sitzplan' },
    { icon: <Wallet size={16} />, label: 'Budget' },
    { icon: <FolderOpen size={16} />, label: 'Dateien' },
  ]

  const pad = device === 'mobile' ? 18 : 22

  const screen = (
    <div style={{
      position: 'relative', height: screenHeightFor(device), overflowY: 'auto',
      backgroundColor: s.bgColor,
      backgroundImage: tex.image !== 'none' ? tex.image : undefined,
      backgroundSize: tex.size,
      fontFamily: bodyFamily, color: ink,
    }}>
      {headingHref && <link rel="stylesheet" href={headingHref} />}
      {bodyHref && <link rel="stylesheet" href={bodyHref} />}

      <div style={{ padding: `${pad}px ${pad}px ${pad + 6}px` }}>
        {/* Kopf */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: accentDeep, margin: 0 }}>FOREVR</p>
            <h1 style={{ fontFamily: headingFamily, fontSize: `${Math.round(26 * scale)}px`, fontWeight: 600, color: ink, margin: '4px 0 0', lineHeight: 1.1 }}>
              Übersicht
            </h1>
          </div>
          <span style={{
            width: 38, height: 38, borderRadius: 999, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: s.accentGradient ? `linear-gradient(135deg, ${accent}, ${accentDeep})` : accent, color: '#fff', fontSize: 13, fontWeight: 700,
          }}>{initials}</span>
        </div>

        {/* Menü */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {items.map((it, i) => {
            const active = i === 0
            return (
              <div key={it.label} style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: radius,
                background: active ? (s.accentGradient ? `linear-gradient(135deg, ${accent}, ${accentDeep})` : accent) : '#fff',
                color: active ? '#fff' : ink,
                border: active ? '1px solid transparent' : '1px solid rgba(0,0,0,0.08)',
                boxShadow: active ? '0 6px 16px rgba(0,0,0,0.10)' : 'none',
                fontSize: 14, fontWeight: active ? 600 : 500,
              }}>
                {it.icon}
                <span style={{ flex: 1 }}>{it.label}</span>
                <ChevronRight size={15} style={{ opacity: active ? 0.85 : 0.3 }} />
              </div>
            )
          })}
        </div>

        {/* Karte */}
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: radius, boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)', padding: 16 }}>
          <h3 style={{ fontFamily: headingFamily, fontSize: `${Math.round(18 * scale)}px`, fontWeight: 600, color: ink, margin: '0 0 6px' }}>Nächste Schritte</h3>
          <p style={{ fontSize: 13, color: ink3, margin: '0 0 14px', lineHeight: 1.5 }}>
            Plant euren großen Tag – Gäste, Sitzplan und Budget an einem Ort.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled style={{
              padding: '9px 16px', borderRadius: btnRadius, border: 'none', cursor: 'default', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#fff',
              background: s.accentGradient ? `linear-gradient(135deg, ${accent}, ${accentDeep})` : accent,
            }}>Weiter planen</button>
            <button type="button" disabled style={{
              padding: '9px 16px', borderRadius: btnRadius, border: `1px solid ${shade(accent, 0.4)}`, cursor: 'default', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              background: '#fff', color: accentDeep,
            }}>Später</button>
          </div>
        </div>
      </div>
    </div>
  )

  return <DeviceFrame device={device}>{screen}</DeviceFrame>
}
