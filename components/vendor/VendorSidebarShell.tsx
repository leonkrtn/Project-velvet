'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Inbox, ReceiptText,
  Calendar, MessageSquare, User, LogOut, Bell,
} from 'lucide-react'

import { performLogout } from '@/lib/logout'

interface Props {
  companyName: string
  companyInitials: string
  category: string
  children: React.ReactNode
}

interface BadgeData {
  pendingAnfragen: number
  unreadNachrichten: number
}

const NAV = [
  { key: 'ubersicht',   label: 'Übersicht',    href: '/vendor/ubersicht',   icon: LayoutDashboard },
  { key: 'anfragen',    label: 'Anfragen',     href: '/vendor/anfragen',    icon: Inbox,         badgeKey: 'pendingAnfragen' as const },
  { key: 'angebote',   label: 'Angebote',     href: '/vendor/angebote',    icon: ReceiptText },
  { key: 'events',     label: 'Events',       href: '/vendor/dashboard',   icon: Calendar },
  { key: 'nachrichten',label: 'Nachrichten',  href: '/vendor/nachrichten', icon: MessageSquare, badgeKey: 'unreadNachrichten' as const },
] as const

type NavKey = (typeof NAV)[number]['key'] | 'listing' | 'anfrage-formular'

const PAGE_TITLES: Record<NavKey, string> = {
  ubersicht: 'Übersicht',
  anfragen: 'Anfragen',
  angebote: 'Angebote',
  events: 'Events',
  nachrichten: 'Nachrichten',
  listing: 'Anbieter-Profil',
  'anfrage-formular': 'Anfrage-Formular',
}

function activeKey(pathname: string): NavKey {
  if (pathname.startsWith('/vendor/ubersicht'))       return 'ubersicht'
  if (pathname.startsWith('/vendor/anfragen'))        return 'anfragen'
  if (pathname.startsWith('/vendor/angebote'))        return 'angebote'
  if (pathname.startsWith('/vendor/anfrage-formular'))return 'anfrage-formular'
  if (pathname.startsWith('/vendor/nachrichten'))     return 'nachrichten'
  if (pathname.startsWith('/vendor/listing'))         return 'listing'
  if (pathname.startsWith('/vendor/dashboard'))       return 'events'
  return 'ubersicht'
}

export default function VendorSidebarShell({ companyName, companyInitials, category, children }: Props) {
  const pathname = usePathname()
  const [badges, setBadges] = useState<BadgeData>({ pendingAnfragen: 0, unreadNachrichten: 0 })
  const active = activeKey(pathname)
  const isKommunikation = pathname.includes('/kommunikation')
  const isEventPage = pathname.startsWith('/vendor/dashboard/')

  // Skip sidebar for public pages
  const noShell = pathname.startsWith('/vendor/join') || pathname.startsWith('/vendor/signup')

  useEffect(() => {
    fetch('/api/vendor/shell-data')
      .then(r => r.ok ? r.json() : null)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      .then(d => { if (d) setBadges({ pendingAnfragen: d.pendingAnfragen ?? 0, unreadNachrichten: d.unreadNachrichten ?? 0 }) })
  }, [])

  if (noShell) return <>{children}</>

  function navStyle(key: NavKey): React.CSSProperties {
    const on = active === key
    return {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 10px', borderRadius: 8, marginBottom: 1,
      textDecoration: 'none', fontSize: 14, fontWeight: on ? 600 : 450,
      color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
      background: on ? 'var(--accent-light)' : 'transparent',
    }
  }

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 240, flexShrink: 0, height: '100dvh',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Company header */}
        <div style={{ padding: '18px 14px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, letterSpacing: '-0.3px',
          }}>
            {companyInitials}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {companyName || 'Mein Unternehmen'}
            </p>
            {category && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'capitalize' }}>
                {category.replace(/-/g, ' ')}
              </p>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
          {NAV.map(item => {
            const Icon = item.icon
            const badge = 'badgeKey' in item ? (badges[item.badgeKey] ?? 0) : 0
            const on = active === item.key
            return (
              <Link key={item.key} href={item.href} style={navStyle(item.key)}>
                <Icon size={16} style={{ flexShrink: 0, opacity: on ? 1 : 0.5 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: 'center',
                    padding: '2px 5px', borderRadius: 100,
                    background: 'var(--accent)', color: '#fff',
                  }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '8px 8px 16px', borderTop: '1px solid var(--border)' }}>
          <Link href="/vendor/listing" style={navStyle('listing')}>
            <User size={16} style={{ flexShrink: 0, opacity: active === 'listing' ? 1 : 0.5 }} />
            <span>Anbieter-Profil</span>
          </Link>
          <button
            onClick={() => performLogout()}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px', borderRadius: 8, width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 450,
              color: 'var(--text-secondary)', marginTop: 1,
            }}
          >
            <LogOut size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
            <span>Abmelden</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{
        flex: 1, minWidth: 0,
        height: '100dvh',
        overflow: isKommunikation ? 'hidden' : 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Top header bar — only for global pages (event pages have VendorEventTabBar) */}
        {!isEventPage && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 24px', height: 52, flexShrink: 0,
            background: '#fff', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
              {PAGE_TITLES[active]}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                position: 'relative',
              }}>
                <Bell size={18} />
                {(badges.pendingAnfragen + badges.unreadNachrichten) > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#EF4444', border: '1.5px solid #fff',
                  }} />
                )}
              </button>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, letterSpacing: '-0.2px',
              }}>
                {companyInitials}
              </div>
            </div>
          </div>
        )}
        {children}
      </div>

    </div>
  )
}
