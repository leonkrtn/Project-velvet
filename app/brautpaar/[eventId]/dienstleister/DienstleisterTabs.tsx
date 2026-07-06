'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Store, SlidersHorizontal, Inbox, Handshake, FileText } from 'lucide-react'
import MeineAnfragen from './MeineAnfragen'
import AngeboteVergleich from './AngeboteVergleich'

type Tab = 'discover' | 'active' | 'offers' | 'requests' | 'manage'

// Tab-Umschalter im Dienstleister-Bereich:
//   "Entdecken"           = Marktplatz (alle Brautpaare)
//   "Aktive Dienstleister"= aktuelle Zusammenarbeit + Chat (alle Brautpaare)
//   "Angebote"            = Angebotsvergleich über alle Anfragen (alle Brautpaare)
//   "Meine Anfragen"      = gestellte Anfragen + Zurückziehen/Beenden (alle Brautpaare)
//   "Meine Dienstleister" = eigene Vendors + Datenfreigaben (nur Solo-Brautpaare)
export default function DienstleisterTabs({
  eventId,
  isSolo,
  discover,
  active,
  manage,
}: {
  eventId: string
  isSolo: boolean
  discover: React.ReactNode
  active?: React.ReactNode
  manage?: React.ReactNode
}) {
  const [tab, setTab] = useState<Tab>('discover')

  // Deep-Link ?category= (z.B. "Ähnliche Anbieter ansehen" nach Absage):
  // immer auf den Entdecken-Tab schalten, der Marktplatz übernimmt den Filter.
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')
  useEffect(() => {
    if (categoryParam) setTab('discover')
  }, [categoryParam])

  const tabBtn = (on: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13.5, fontWeight: 600, border: '1px solid var(--bp-border, #e5e0d8)',
    background: on ? 'var(--bp-ink, #2b2b2b)' : '#fff',
    color: on ? '#fff' : 'var(--bp-ink-2, #555)', whiteSpace: 'nowrap',
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={tabBtn(tab === 'discover')} onClick={() => setTab('discover')}>
          <Store size={15} /> Entdecken
        </button>
        <button style={tabBtn(tab === 'active')} onClick={() => setTab('active')}>
          <Handshake size={15} /> Aktive Dienstleister
        </button>
        <button style={tabBtn(tab === 'offers')} onClick={() => setTab('offers')}>
          <FileText size={15} /> Angebote
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
      <div style={{ display: tab === 'active' ? 'block' : 'none' }}>{active}</div>
      <div style={{ display: tab === 'offers' ? 'block' : 'none' }}>
        {tab === 'offers' && <AngeboteVergleich eventId={eventId} />}
      </div>
      <div style={{ display: tab === 'requests' ? 'block' : 'none' }}>
        {tab === 'requests' && <MeineAnfragen eventId={eventId} />}
      </div>
      {isSolo && <div style={{ display: tab === 'manage' ? 'block' : 'none' }}>{manage}</div>}
    </div>
  )
}
