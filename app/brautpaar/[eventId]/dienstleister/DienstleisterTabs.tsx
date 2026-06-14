'use client'

import React, { useState } from 'react'
import { Store, SlidersHorizontal } from 'lucide-react'

// Tab-Umschalter im Dienstleister-Bereich:
//   "Entdecken" = Marktplatz (für alle Brautpaare)
//   "Verwaltung" = eigene Dienstleister + Rechte (nur Solo-Brautpaare)
export default function DienstleisterTabs({
  isSolo,
  discover,
  manage,
}: {
  isSolo: boolean
  discover: React.ReactNode
  manage?: React.ReactNode
}) {
  const [tab, setTab] = useState<'discover' | 'manage'>('discover')

  if (!isSolo) return <>{discover}</>

  const tabBtn = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13.5, fontWeight: 600, border: '1px solid var(--bp-border, #e5e0d8)',
    background: active ? 'var(--bp-ink, #2b2b2b)' : '#fff',
    color: active ? '#fff' : 'var(--bp-ink-2, #555)',
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button style={tabBtn(tab === 'discover')} onClick={() => setTab('discover')}>
          <Store size={15} /> Entdecken
        </button>
        <button style={tabBtn(tab === 'manage')} onClick={() => setTab('manage')}>
          <SlidersHorizontal size={15} /> Meine Dienstleister
        </button>
      </div>
      <div style={{ display: tab === 'discover' ? 'block' : 'none' }}>{discover}</div>
      <div style={{ display: tab === 'manage' ? 'block' : 'none' }}>{manage}</div>
    </div>
  )
}
