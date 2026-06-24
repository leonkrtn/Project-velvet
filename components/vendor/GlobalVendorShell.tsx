'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Inbox, ReceiptText, FileText,
  Calendar, MessageSquare, UserCircle, LogOut,
} from 'lucide-react'
import { performLogout } from '@/lib/logout'

interface ShellData {
  companyName: string
  pendingAnfragen: number
  unreadNachrichten: number
}

const NAV = [
  { key: 'ubersicht',        label: 'Übersicht',        href: '/vendor/ubersicht',        icon: LayoutDashboard },
  { key: 'anfragen',         label: 'Anfragen',         href: '/vendor/anfragen',         icon: Inbox,           badgeKey: 'pendingAnfragen' },
  { key: 'angebote',         label: 'Angebote',         href: '/vendor/angebote',         icon: ReceiptText },
  { key: 'anfrage-formular', label: 'Anfrage-Formular', href: '/vendor/anfrage-formular', icon: FileText },
  { key: 'events',           label: 'Meine Events',     href: '/vendor/dashboard',        icon: Calendar },
  { key: 'nachrichten',      label: 'Nachrichten',      href: '/vendor/nachrichten',      icon: MessageSquare,   badgeKey: 'unreadNachrichten' },
] as const

type NavKey = typeof NAV[number]['key'] | 'listing'

function activeKeyFromPath(pathname: string): NavKey {
  if (pathname.startsWith('/vendor/ubersicht')) return 'ubersicht'
  if (pathname.startsWith('/vendor/anfragen')) return 'anfragen'
  if (pathname.startsWith('/vendor/angebote')) return 'angebote'
  if (pathname.startsWith('/vendor/anfrage-formular')) return 'anfrage-formular'
  if (pathname.startsWith('/vendor/nachrichten')) return 'nachrichten'
  if (pathname.startsWith('/vendor/listing')) return 'listing'
  if (pathname.startsWith('/vendor/dashboard')) return 'events'
  return 'ubersicht'
}

const navLink: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
  borderRadius: 9, marginBottom: 2, textDecoration: 'none',
  fontSize: 14, fontWeight: 500, transition: 'background .12s',
}

export default function GlobalVendorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [data, setData] = useState<ShellData | null>(null)
  const active = activeKeyFromPath(pathname)

  useEffect(() => {
    fetch('/api/vendor/shell-data')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
  }, [])

  function styleFor(key: NavKey): React.CSSProperties {
    const isActive = active === key
    return {
      ...navLink,
      background: isActive ? 'rgba(184,153,104,0.12)' : 'transparent',
      color: isActive ? 'var(--gold)' : 'var(--text)',
      fontWeight: isActive ? 600 : 500,
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: 'var(--bg)' }}>
      {/* Desktop sidebar */}
      <aside className="gvs-sidebar" style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', zIndex: 100,
      }}>
        <div style={{ padding: '22px 18px 16px' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, fontSize: 22, color: 'var(--gold)', letterSpacing: '0.16em', lineHeight: 1, margin: 0 }}>FOREVR</p>
          {data?.companyName && (
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.companyName}</p>
          )}
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '2px 10px' }}>
          {NAV.map(item => {
            const Icon = item.icon
            const badge = item.badgeKey ? (data?.[item.badgeKey as keyof ShellData] as number ?? 0) : 0
            return (
              <Link key={item.key} href={item.href} style={styleFor(item.key)}
                onMouseEnter={e => { if (active !== item.key) e.currentTarget.style.background = 'var(--bg)' }}
                onMouseLeave={e => { if (active !== item.key) e.currentTarget.style.background = 'transparent' }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, minWidth: 18, textAlign: 'center', padding: '1px 5px', borderRadius: 100, background: 'var(--gold)', color: '#fff' }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '8px 10px 20px', borderTop: '1px solid var(--border)' }}>
          <Link href="/vendor/listing" style={styleFor('listing')}
            onMouseEnter={e => { if (active !== 'listing') e.currentTarget.style.background = 'var(--bg)' }}
            onMouseLeave={e => { if (active !== 'listing') e.currentTarget.style.background = 'transparent' }}
          >
            <UserCircle size={16} style={{ flexShrink: 0 }} />
            <span>Anbieter-Profil</span>
          </Link>
          <button onClick={() => performLogout()} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9,
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 14, color: 'var(--text-dim)', fontWeight: 500,
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <LogOut size={16} style={{ flexShrink: 0 }} />
            <span>Abmelden</span>
          </button>
        </div>
      </aside>

      {/* Content area */}
      <main className="gvs-content" style={{ marginLeft: 240, flex: 1, minWidth: 0 }}>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="gvs-mobile-nav" style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        zIndex: 100, justifyContent: 'space-around', alignItems: 'flex-end',
        padding: '6px 0 max(6px, env(safe-area-inset-bottom))',
      }}>
        {([...NAV.slice(0, 4), { key: 'listing' as const, label: 'Profil', href: '/vendor/listing', icon: UserCircle }]).map(item => {
          const Icon = item.icon
          const isActive = active === item.key
          const badge = 'badgeKey' in item && item.badgeKey ? (data?.[item.badgeKey as keyof ShellData] as number ?? 0) : 0
          return (
            <Link key={item.key} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              textDecoration: 'none', padding: '4px 6px', position: 'relative',
              color: isActive ? 'var(--gold)' : 'var(--text-dim)',
            }}>
              <Icon size={22} />
              <span style={{ fontSize: 9.5, fontWeight: 600 }}>{item.label}</span>
              {badge > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 2, fontSize: 9, fontWeight: 700, minWidth: 14, textAlign: 'center', padding: '0 3px', borderRadius: 100, background: 'var(--gold)', color: '#fff' }}>
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .gvs-sidebar { display: none !important; }
          .gvs-content { margin-left: 0 !important; padding-bottom: 68px; }
          .gvs-mobile-nav { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
