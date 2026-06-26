'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, MessagesSquare, ReceiptText, Info } from 'lucide-react'
import ChatUnreadBadge from '@/app/veranstalter/[eventId]/chats/ChatUnreadBadge'

interface Props {
  eventId: string
  eventTitle: string
  eventDate: string | null
  children: React.ReactNode
}

const TABS = [
  { key: 'kommunikation', label: 'Kommunikation', icon: MessagesSquare },
  { key: 'angebote',     label: 'Angebote',       icon: ReceiptText },
  { key: 'informationen',label: 'Informationen',  icon: Info },
] as const

export default function VendorEventTabBar({ eventId, eventTitle, eventDate, children }: Props) {
  const pathname = usePathname()
  const base = `/vendor/dashboard/${eventId}`
  const activeTab = TABS.find(t => pathname.startsWith(`${base}/${t.key}`))?.key ?? 'kommunikation'
  const isKommunikation = activeTab === 'kommunikation'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

      {/* Event header + tab bar */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        padding: '14px 24px 0',
      }} className="vet-header">
        <Link href="/vendor/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none',
          marginBottom: 6,
        }}>
          <ChevronLeft size={13} />
          Meine Events
        </Link>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.3px' }}>
            {eventTitle}
          </p>
          {eventDate && (
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {new Date(eventDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="vet-tabs" style={{ display: 'flex', marginTop: 10, gap: 0 }}>
          {TABS.map(tab => {
            const on = tab.key === activeTab
            return (
              <Link key={tab.key} href={`${base}/${tab.key}`} className="vet-tab" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', textDecoration: 'none',
                fontSize: 13.5, fontWeight: on ? 600 : 450,
                color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}>
                {tab.label}
                {tab.key === 'kommunikation' && <ChatUnreadBadge eventId={eventId} />}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {isKommunikation
        ? <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>
        : <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
      }
    </div>
  )
}
