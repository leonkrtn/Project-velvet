'use client'

import React from 'react'

// Geräte-Mockups für die Live-Vorschau: iPhone (Mobil) und iMac (Desktop).
// Der „screen" (Inhalt) wird vom jeweiligen Vorschau-Renderer fertig
// dimensioniert übergeben (Höhe + eigenes Scrolling).

export function screenHeightFor(device: 'desktop' | 'mobile'): number {
  return device === 'mobile' ? 600 : 340
}

export function DeviceFrame({ device, children }: { device: 'desktop' | 'mobile'; children: React.ReactNode }) {
  return device === 'mobile' ? <IPhoneMock>{children}</IPhoneMock> : <IMacMock>{children}</IMacMock>
}

function IPhoneMock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 300, maxWidth: '100%', margin: '0 auto', flexShrink: 0 }}>
      <div style={{
        position: 'relative', padding: 11, borderRadius: 50,
        background: 'linear-gradient(155deg, #43434a, #1b1b1d)',
        boxShadow: '0 22px 55px rgba(0,0,0,0.38), inset 0 0 0 2px rgba(255,255,255,0.06)',
      }}>
        {/* Seitentasten */}
        <span style={{ position: 'absolute', left: -3, top: 116, width: 3, height: 30, borderRadius: 2, background: '#2a2a2c' }} />
        <span style={{ position: 'absolute', left: -3, top: 158, width: 3, height: 50, borderRadius: 2, background: '#2a2a2c' }} />
        <span style={{ position: 'absolute', right: -3, top: 142, width: 3, height: 66, borderRadius: 2, background: '#2a2a2c' }} />
        {/* Bildschirm */}
        <div style={{ position: 'relative', borderRadius: 40, overflow: 'hidden', background: '#000' }}>
          {/* Dynamic Island */}
          <div style={{ position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)', width: 90, height: 25, background: '#000', borderRadius: 999, zIndex: 6 }} />
          {children}
        </div>
      </div>
    </div>
  )
}

function IMacMock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 420, maxWidth: '100%', margin: '0 auto', flexShrink: 0 }}>
      {/* Gehäuse mit dünnem schwarzem Bildschirmrahmen + Aluminium-Kinn */}
      <div style={{
        padding: '12px 12px 28px', borderRadius: 16,
        background: 'linear-gradient(#f2f3f5, #d9dce0)',
        boxShadow: '0 16px 44px rgba(0,0,0,0.22), inset 0 1px 0 #ffffff',
      }}>
        <div style={{ borderRadius: 6, overflow: 'hidden', background: '#0a0a0b', padding: 6 }}>
          <div style={{ borderRadius: 2, overflow: 'hidden' }}>{children}</div>
        </div>
      </div>
      {/* Standfuß */}
      <div style={{ width: 92, height: 24, margin: '0 auto', background: 'linear-gradient(#e8eaed, #c2c6cc)' }} />
      <div style={{ width: 188, height: 12, margin: '0 auto', borderRadius: '0 0 9px 9px', background: 'linear-gradient(#cdd1d6, #b0b5bb)', boxShadow: '0 8px 14px rgba(0,0,0,0.16)' }} />
    </div>
  )
}
