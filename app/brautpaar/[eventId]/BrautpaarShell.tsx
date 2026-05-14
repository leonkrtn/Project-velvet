'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, LayoutGrid, Calendar, UtensilsCrossed,
  Palette, Music, Cake, Camera, Wallet, CheckSquare, Settings,
  MessageSquare, File, ChevronRight, X, Menu,
} from 'lucide-react'

interface NavItem {
  key: string
  label: string
  href: string
  icon: React.ReactNode
  disabled?: boolean
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

function buildNav(eventId: string): NavGroup[] {
  const b = (key: string, label: string, icon: React.ReactNode, disabled?: boolean): NavItem => ({
    key, label, href: `/brautpaar/${eventId}/${key}`, icon, disabled,
  })

  return [
    {
      items: [b('uebersicht', 'Übersicht', <LayoutDashboard size={16} />)],
    },
    {
      label: 'PLANUNG',
      items: [
        b('gaeste', 'Gäste', <Users size={16} />),
        b('sitzplan', 'Sitzplan', <LayoutGrid size={16} />),
        b('ablaufplan', 'Ablaufplan', <Calendar size={16} />),
      ],
    },
    {
      label: 'DETAILS',
      items: [
        b('catering', 'Catering & Menü', <UtensilsCrossed size={16} />),
        b('dekoration', 'Dekoration', <Palette size={16} />),
        b('musik', 'Musik', <Music size={16} />),
        b('patisserie', 'Patisserie', <Cake size={16} />),
        b('medien', 'Foto & Videograf', <Camera size={16} />),
      ],
    },
    {
      label: 'VERWALTUNG',
      items: [
        b('budget', 'Budget', <Wallet size={16} />),
        b('aufgaben', 'Aufgaben', <CheckSquare size={16} />),
        b('allgemein', 'Allgemein', <Settings size={16} />),
      ],
    },
    {
      label: 'KOMMUNIKATION',
      items: [
        b('nachrichten', 'Nachrichten', <MessageSquare size={16} />),
        b('dateien', 'Dateien', <File size={16} />),
      ],
    },
  ]
}

interface WelcomeOverlayProps {
  eventTitle: string
  eventId: string
  userId: string
  onDone: () => void
}

function WelcomeOverlay({ eventTitle, eventId, userId, onDone }: WelcomeOverlayProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleStart() {
    setLoading(true)
    try {
      await fetch('/api/brautpaar/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, userId }),
      })
    } catch { /* non-fatal */ }
    onDone()
    router.push(`/brautpaar/${eventId}/allgemein`)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'var(--bp-ivory)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
            <circle cx="28" cy="28" r="28" fill="var(--bp-gold-pale)" />
            <path d="M28 16c-3 0-5.5 2-6.5 4.5C18 21.5 16 24 16 27c0 4.4 3.6 8 8 8h8c4.4 0 8-3.6 8-8 0-3-2-5.5-5.5-6.5C33.5 18 30.9 16 28 16z" fill="var(--bp-gold)" />
          </svg>
        </div>
        <h1 className="bp-h1" style={{ marginBottom: '0.5rem' }}>
          Willkommen bei Velvet
        </h1>
        <p className="bp-body" style={{ marginBottom: '0.25rem', color: 'var(--bp-gold-deep)', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.125rem' }}>
          {eventTitle}
        </p>
        <p className="bp-body" style={{ marginBottom: '2.5rem' }}>
          Euer persönlicher Hochzeitsplaner ist bereit. Als nächstes könnt ihr die Details eurer Feier eintragen.
        </p>
        <button
          className="bp-btn bp-btn-primary bp-btn-lg"
          onClick={handleStart}
          disabled={loading}
        >
          {loading ? 'Einen Moment…' : 'Jetzt starten'}
        </button>
      </div>
    </div>
  )
}

interface Props {
  children: React.ReactNode
  eventId: string
  eventTitle: string
  eventDate: string | null
  userId: string
  showWelcome: boolean
}

export default function BrautpaarShell({ children, eventId, eventTitle, userId, showWelcome }: Props) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [welcomeVisible, setWelcomeVisible] = useState(showWelcome)

  const nav = buildNav(eventId)

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Persist sidebar state
  useEffect(() => {
    const stored = localStorage.getItem('bp-sidebar-expanded')
    if (stored !== null) setExpanded(stored === 'true')
  }, [])

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => {
      const next = !prev
      localStorage.setItem('bp-sidebar-expanded', String(next))
      return next
    })
  }, [])

  const isDeko = pathname === `/brautpaar/${eventId}/dekoration` || pathname.startsWith(`/brautpaar/${eventId}/dekoration/`)

  function isActive(item: NavItem) {
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  const sidebarContent = (
    <>
      {/* Header: couple name + toggle */}
      <div
        className="bp-sidebar-logo"
        onClick={!expanded ? toggleExpanded : undefined}
        role={!expanded ? 'button' : undefined}
        aria-label={!expanded ? 'Sidebar aufklappen' : undefined}
      >
        <span className="bp-sidebar-couple-name">{eventTitle}</span>
        <button
          className="bp-sidebar-toggle"
          onClick={e => { e.stopPropagation(); toggleExpanded() }}
          aria-label={expanded ? 'Sidebar zuklappen' : 'Sidebar aufklappen'}
          title={expanded ? 'Zuklappen' : 'Aufklappen'}
        >
          <ChevronRight />
        </button>
      </div>

      {/* Nav */}
      <nav className="bp-sidebar-nav" aria-label="Brautpaar Navigation">
        {nav.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <div className="bp-sidebar-divider" />}
            {group.label && (
              <div className="bp-sidebar-section-label" aria-hidden>
                {group.label}
              </div>
            )}
            {group.items.map(item => (
              item.disabled ? (
                <div
                  key={item.key}
                  className="bp-nav-item bp-nav-item-disabled"
                  title={expanded ? undefined : item.label}
                >
                  <span className="bp-nav-item-icon">{item.icon}</span>
                  <span className="bp-nav-item-label">{item.label}</span>
                </div>
              ) : (
                <Link
                  key={item.key}
                  href={item.href}
                  className="bp-nav-item"
                  aria-current={isActive(item) ? 'page' : undefined}
                  title={expanded ? undefined : item.label}
                >
                  <span className="bp-nav-item-icon">{item.icon}</span>
                  <span className="bp-nav-item-label">{item.label}</span>
                </Link>
              )
            ))}
          </React.Fragment>
        ))}
      </nav>

      {/* Footer links */}
      <div className="bp-sidebar-footer">
        <a href="#" className="bp-sidebar-footer-link"><span>Support</span></a>
        <a href="#" className="bp-sidebar-footer-link"><span>AGB</span></a>
        <a href="#" className="bp-sidebar-footer-link"><span>Datenschutz</span></a>
      </div>
    </>
  )

  return (
    <>
      {welcomeVisible && (
        <WelcomeOverlay
          eventTitle={eventTitle}
          eventId={eventId}
          userId={userId}
          onDone={() => setWelcomeVisible(false)}
        />
      )}

      <div className="bp-shell" style={isDeko ? { height: '100dvh', overflow: 'hidden' } : undefined}>
        {/* Sidebar — single element, CSS adapts desktop (data-expanded) vs mobile (data-mobile-open) */}
        <aside
          className="bp-sidebar"
          data-expanded={String(expanded)}
          data-mobile-open={String(mobileOpen)}
          aria-label="Hauptnavigation"
        >
          {sidebarContent}
        </aside>

        {/* Mobile overlay */}
        <div
          className={`bp-mobile-overlay${mobileOpen ? ' open' : ''}`}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />

        {/* Content area */}
        <div
          className="bp-content-offset"
          data-expanded={String(expanded)}
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
        >
          {/* Mobile header */}
          <header className="bp-mobile-header">
            <button
              className="bp-hamburger"
              onClick={() => setMobileOpen(true)}
              aria-label="Menü öffnen"
            >
              <span />
              <span />
              <span />
            </button>
            <span className="bp-font-wordmark" style={{ fontSize: '1rem', color: 'var(--bp-ink)' }}>
              Velvet
            </span>
            <div style={{ width: 36 }} />
          </header>

          {isDeko ? (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {children}
            </div>
          ) : (
            <main style={{ flex: 1 }}>
              {children}
            </main>
          )}
        </div>
      </div>
    </>
  )
}
