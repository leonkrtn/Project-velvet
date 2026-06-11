'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, LayoutGrid, Calendar, UtensilsCrossed,
  Palette, Music, Camera, Wallet, CheckSquare, Settings,
  MessageSquare, File, ChevronRight, X, Menu, LogOut, NotebookPen, GlassWater,
  Briefcase, Heart, FileDown,
} from 'lucide-react'
import ChatUnreadBadge from '@/app/veranstalter/[eventId]/chats/ChatUnreadBadge'
import { createClient } from '@/lib/supabase/client'
import { BpToastProvider } from '@/components/ui/BpToast'

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

function buildNav(eventId: string, isSolo: boolean): NavGroup[] {
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
        b('getraenke', 'Getränke', <GlassWater size={16} />),
        b('dekoration', 'Dekoration', <Palette size={16} />),
        b('musik', 'Musik', <Music size={16} />),
        b('medien', 'Foto & Videograf', <Camera size={16} />),
      ],
    },
    {
      label: 'VERWALTUNG',
      items: [
        b('budget', 'Budget', <Wallet size={16} />),
        b('aufgaben', 'Aufgaben', <CheckSquare size={16} />),
        b('notizen', 'Notizen', <NotebookPen size={16} />),
        // Solo-Paare verwalten Dienstleister-Zugriffsrechte selbst (kein Veranstalter)
        ...(isSolo ? [b('dienstleister', 'Dienstleister', <Briefcase size={16} />)] : []),
        ...(isSolo ? [b('pdf-export', 'PDF-Export', <FileDown size={16} />)] : []),
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
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <span
            aria-hidden
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--bp-gold-pale)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Heart size={26} fill="var(--bp-gold)" color="var(--bp-gold)" />
          </span>
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
  isSolo?: boolean
}

export default function BrautpaarShell({ children, eventId, eventTitle, userId, showWelcome, isSolo = false }: Props) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [welcomeVisible, setWelcomeVisible] = useState(showWelcome)
  const [bpToggles, setBpToggles] = useState<Record<string, boolean>>({})

  // Load bp-* feature toggles to filter nav items
  useEffect(() => {
    const supabase = createClient()
    supabase.from('feature_toggles')
      .select('key, enabled')
      .eq('event_id', eventId)
      .like('key', 'bp-%')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, boolean> = {}
          for (const row of data) map[row.key] = row.enabled
          setBpToggles(map)
        }
      })
  }, [eventId])

  // Filter nav: uebersicht and allgemein always shown; others follow bp-* toggles
  const fullNav = buildNav(eventId, isSolo)
  const nav = fullNav.map(group => ({
    ...group,
    items: group.items.filter(item =>
      item.key === 'uebersicht' || item.key === 'allgemein' || item.key === 'dienstleister' || item.key === 'pdf-export'
        ? true
        : (bpToggles[`bp-${item.key}`] ?? true)
    ),
  })).filter(g => g.items.length > 0)

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
          aria-expanded={expanded}
          aria-label={expanded ? 'Sidebar zuklappen' : 'Sidebar aufklappen'}
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
                  {item.key === 'nachrichten' && <ChatUnreadBadge eventId={eventId} />}
                </Link>
              )
            ))}
          </React.Fragment>
        ))}
      </nav>

      {/* Footer — tote Platzhalter-Links (Support/AGB/Datenschutz) entfernt,
          bis echte Zielseiten existieren */}
      <div className="bp-sidebar-footer">
        <button
          onClick={async () => {
            const supabase = createClient()
            await supabase.auth.signOut()
            window.location.href = '/login'
          }}
          className="bp-sidebar-footer-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, color: 'inherit' }}
        >
          <LogOut size={13} />
          <span>Abmelden</span>
        </button>
      </div>
    </>
  )

  return (
    <BpToastProvider>
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
              {eventTitle}
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
    </BpToastProvider>
  )
}
