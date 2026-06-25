'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Inbox, ReceiptText,
  Calendar, User, LogOut,
} from 'lucide-react'

import { performLogout } from '@/lib/logout'

interface Props {
  companyName: string
  companyInitials: string
  category: string
  logoUrl?: string
  children: React.ReactNode
}

interface BadgeData {
  pendingAnfragen: number
}

const NAV = [
  { key: 'ubersicht',   label: 'Übersicht',    href: '/vendor/ubersicht',   icon: LayoutDashboard },
  { key: 'anfragen',    label: 'Anfragen',     href: '/vendor/anfragen',    icon: Inbox,         badgeKey: 'pendingAnfragen' as const },
  { key: 'angebote',   label: 'Angebote',     href: '/vendor/angebote',    icon: ReceiptText },
  { key: 'events',     label: 'Events',       href: '/vendor/dashboard',   icon: Calendar },
] as const

type NavKey = (typeof NAV)[number]['key'] | 'listing'

function activeKey(pathname: string): NavKey {
  if (pathname.startsWith('/vendor/ubersicht'))  return 'ubersicht'
  if (pathname.startsWith('/vendor/anfragen'))   return 'anfragen'
  if (pathname.startsWith('/vendor/angebote'))   return 'angebote'
  if (pathname.startsWith('/vendor/listing'))    return 'listing'
  if (pathname.startsWith('/vendor/dashboard'))  return 'events'
  return 'ubersicht'
}

export default function VendorSidebarShell({ companyName, companyInitials, category, logoUrl, children }: Props) {
  const pathname = usePathname()
  const [badges, setBadges] = useState<BadgeData>({ pendingAnfragen: 0 })
  const active = activeKey(pathname)
  const isKommunikation = pathname.includes('/kommunikation')

  const noShell = pathname.startsWith('/vendor/join') || pathname.startsWith('/vendor/signup')

  useEffect(() => {
    fetch('/api/vendor/shell-data')
      .then(r => r.ok ? r.json() : null)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      .then(d => { if (d) setBadges({ pendingAnfragen: d.pendingAnfragen ?? 0 }) })
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
    <div className="vdr-shell" style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside className="vdr-sidebar" style={{
        width: 240, flexShrink: 0, height: '100dvh',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Company header */}
        <div className="vdr-company-header" style={{ padding: '18px 14px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: logoUrl ? 'transparent' : 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, letterSpacing: '-0.3px',
            overflow: 'hidden',
          }}>
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : companyInitials
            }
          </div>
          <div className="vdr-company-text" style={{ overflow: 'hidden' }}>
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
        <nav className="vdr-nav" style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
          {NAV.map(item => {
            const Icon = item.icon
            const badge = 'badgeKey' in item ? (badges[item.badgeKey] ?? 0) : 0
            const on = active === item.key
            return (
              <Link key={item.key} href={item.href} className="vdr-nav-link" style={navStyle(item.key)}>
                <Icon size={16} style={{ flexShrink: 0, opacity: on ? 1 : 0.5 }} />
                <span className="vdr-nav-text" style={{ flex: 1 }}>{item.label}</span>
                {badge > 0 && (
                  <span className="vdr-badge" style={{
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
        <div className="vdr-sidebar-bottom" style={{ padding: '8px 8px 16px', borderTop: '1px solid var(--border)' }}>
          <Link href="/vendor/listing" className="vdr-nav-link" style={navStyle('listing')}>
            <User size={16} style={{ flexShrink: 0, opacity: active === 'listing' ? 1 : 0.5 }} />
            <span className="vdr-nav-text">Anbieter-Profil</span>
          </Link>
          <button
            onClick={() => performLogout()}
            className="vdr-logout-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px', borderRadius: 8, width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 450,
              color: 'var(--text-secondary)', marginTop: 1,
            }}
          >
            <LogOut size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
            <span className="vdr-nav-text">Abmelden</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="vdr-main" style={{
        flex: 1, minWidth: 0,
        height: '100dvh',
        overflow: isKommunikation ? 'hidden' : 'auto',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg)',
      }}>
        {children}
      </div>

      <style>{`
        /* Tablet: icon-only sidebar */
        @media (max-width: 768px) {
          .vdr-sidebar { width: 56px !important; }
          .vdr-company-text { display: none !important; }
          .vdr-company-header { justify-content: center !important; padding: 14px 10px !important; gap: 0 !important; }
          .vdr-nav { padding: 2px 6px !important; }
          .vdr-nav-link { justify-content: center !important; padding: 10px !important; gap: 0 !important; }
          .vdr-nav-text { display: none !important; }
          .vdr-badge { display: none !important; }
          .vdr-sidebar-bottom { padding: 6px 6px 12px !important; }
          .vdr-logout-btn { justify-content: center !important; padding: 10px !important; gap: 0 !important; }
        }
        /* Mobile: bottom tab bar */
        @media (max-width: 480px) {
          .vdr-shell { flex-direction: column !important; }
          .vdr-sidebar {
            order: 2 !important;
            width: 100% !important;
            height: 56px !important;
            flex-direction: row !important;
            border-right: none !important;
            border-top: 1px solid var(--border) !important;
            overflow: hidden;
          }
          .vdr-main { order: 1 !important; height: auto !important; flex: 1 !important; min-height: 0 !important; }
          .vdr-company-header { display: none !important; }
          .vdr-nav {
            flex: 1 !important;
            overflow: visible !important;
            display: flex !important;
            flex-direction: row !important;
            padding: 0 !important;
            align-items: stretch !important;
            height: 100% !important;
          }
          .vdr-nav-link {
            flex: 1 !important;
            flex-direction: column !important;
            gap: 3px !important;
            padding: 6px 2px !important;
            border-radius: 0 !important;
            margin-bottom: 0 !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .vdr-sidebar-bottom {
            border-top: none !important;
            border-left: 1px solid var(--border) !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: stretch !important;
            height: 100% !important;
          }
          .vdr-logout-btn { display: none !important; }
        }
      `}</style>
    </div>
  )
}
