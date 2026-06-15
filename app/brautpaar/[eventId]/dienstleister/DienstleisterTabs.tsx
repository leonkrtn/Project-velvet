'use client'

import React, { useState } from 'react'
import { Store, SlidersHorizontal, Inbox } from 'lucide-react'
import MeineAnfragen from './MeineAnfragen'

type Tab = 'discover' | 'requests' | 'manage'

// Tab-Umschalter im Dienstleister-Bereich:
//   "Entdecken"        = Marktplatz (alle Brautpaare)
//   "Meine Anfragen"   = gestellte Anfragen + Zurückziehen/Beenden (alle Brautpaare)
//   "Meine Dienstleister" = eigene Vendors + Rechte (nur Solo-Brautpaare)
export default function DienstleisterTabs({
  eventId,
  isSolo,
  discover,
  manage,
}: {
  eventId: string
  isSolo: boolean
  discover: React.ReactNode
  manage?: React.ReactNode
}) {
  const [tab, setTab] = useState<Tab>('discover')

  const tabBtn = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13.5, fontWeight: 600, border: '1px solid var(--bp-border, #e5e0d8)',
    background: active ? 'var(--bp-ink, #2b2b2b)' : '#fff',
    color: active ? '#fff' : 'var(--bp-ink-2, #555)', whiteSpace: 'nowrap',
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={tabBtn(tab === 'discover')} onClick={() => setTab('discover')}>
          <Store size={15} /> Entdecken
        </button>
        {isSolo && (
          <button style={tabBtn(tab === 'manage')} onClick={() => setTab('manage')}>
            <SlidersHorizontal size={15} /> Meine Dienstleister
          </button>
        )}
        {/* Meine Anfragen — oben rechts in der Ecke */}
        <button style={{ ...tabBtn(tab === 'requests'), marginLeft: 'auto' }} onClick={() => setTab('requests')}>
          <Inbox size={15} /> Meine Anfragen
        </button>
      </div>
      <div style={{ display: tab === 'discover' ? 'block' : 'none' }}>{discover}</div>
      <div style={{ display: tab === 'requests' ? 'block' : 'none' }}>
        {tab === 'requests' && <MeineAnfragen eventId={eventId} />}
      </div>
      {isSolo && <div style={{ display: tab === 'manage' ? 'block' : 'none' }}>{manage}</div>}
    </div>
  )
}
