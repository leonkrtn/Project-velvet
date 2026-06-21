'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, LayoutGrid, Calendar, UtensilsCrossed,
  Music, Camera, Wallet, CheckSquare, Settings, Info,
  MessageSquare, ChevronRight, X, Menu, LogOut,
  Briefcase, Lock, Sparkles, Globe, ReceiptText,
} from 'lucide-react'
import ForevrHeart from '@/components/ForevrHeart'
import ChatUnreadBadge from '@/app/veranstalter/[eventId]/chats/ChatUnreadBadge'
import ProductTour from '@/components/tour/ProductTour'
import { createClient } from '@/lib/supabase/client'
import { performLogout } from '@/lib/logout'
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

function buildNav(eventId: string, isSolo: boolean, chatEnabled: boolean): NavGroup[] {
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
        b('allgemein', 'Allgemein', <Info size={16} />),
        b('gaeste', 'Gäste', <Users size={16} />),
        b('sitzplan', 'Sitzplan', <LayoutGrid size={16} />),
        b('ablaufplan', 'Ablaufplan', <Calendar size={16} />),
      ],
    },
    {
      label: 'DETAILS',
      items: [
        b('catering-getraenke', 'Catering & Getränke', <UtensilsCrossed size={16} />),
        b('musik', 'Musik', <Music size={16} />),
        b('medien', 'Bilder', <Camera size={16} />),
      ],
    },
    {
      label: 'VERWALTUNG',
      items: [
        b('budget', 'Budget', <Wallet size={16} />),
        b('aufgaben-notizen', 'Aufgaben & Notizen', <CheckSquare size={16} />),
        b('website', 'Hochzeitswebsite', <Globe size={16} />),
        // Dienstleister-Bereich für ALLE Brautpaare: enthält den Marktplatz
        // ("Entdecken") und – für Solo-Paare – die Verwaltung der Zugriffsrechte.
        b('dienstleister', 'Dienstleister', <Briefcase size={16} />),
        b('angebote', 'Angebote', <ReceiptText size={16} />),
      ],
    },
    {
      label: 'KOMMUNIKATION',
      items: [
        // Chat nur mit Forevr Pro (bei gegateten Solo-Events). Ungegatete
        // veranstalter-verwaltete Events behalten den Chat.
        ...(chatEnabled ? [b('nachrichten', 'Nachrichten', <MessageSquare size={16} />)] : []),
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
            <ForevrHeart size={28} color="var(--bp-gold)" />
          </span>
        </div>
        <h1 className="bp-h1" style={{ marginBottom: '0.5rem' }}>
          Willkommen bei Forevr
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
  subscription?: ShellSubscription | null
  /** Persönliches Monogramm/Initialen; ersetzt das FOREVR-Wordmark wenn gesetzt */
  monogram?: string
}

// Serialisierbarer Abo-Zustand (vom Server-Layout via lib/subscription.ts)
export interface ShellSubscription {
  gated: boolean
  status: 'trialing' | 'active' | 'canceled' | 'expired'
  plan: 'trial' | 'basis' | 'pro'
  daysLeft: number
  isPro: boolean
}

export default function BrautpaarShell({ children, eventId, eventTitle, userId, showWelcome, isSolo = false, subscription = null, monogram = '' }: Props) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [welcomeVisible, setWelcomeVisible] = useState(showWelcome)
  const [bpToggles, setBpToggles] = useState<Record<string, boolean>>({})
  const [trialDismissed, setTrialDismissed] = useState(false)

  // Trial-Banner: Wegklicken gilt nur für die aktuelle Sitzung — beim nächsten
  // Login / in einem neuen Tab erscheint der Hinweis wieder (sessionStorage).
  useEffect(() => {
    setTrialDismissed(sessionStorage.getItem('bp-trial-banner-dismissed') === 'true')
  }, [])

  const dismissTrialBanner = useCallback(() => {
    setTrialDismissed(true)
    sessionStorage.setItem('bp-trial-banner-dismissed', 'true')
  }, [])

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

  // Chat (Nachrichten) nur mit Forevr Pro; ungegatete Events behalten ihn.
  const chatEnabled = !subscription || subscription.isPro
  // Filter nav: uebersicht and allgemein always shown; others follow bp-* toggles
  const fullNav = buildNav(eventId, isSolo, chatEnabled)
  const nav = fullNav.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.key === 'uebersicht' || item.key === 'allgemein' || item.key === 'dienstleister' || item.key === 'website' || item.key === 'angebote') return true
      // Kombinierter Eintrag: sichtbar, solange Aufgaben ODER Notizen freigeschaltet sind
      if (item.key === 'aufgaben-notizen') return (bpToggles['bp-aufgaben'] ?? true) || (bpToggles['bp-notizen'] ?? true)
      // Kombinierter Eintrag: sichtbar, solange Catering ODER Getränke freigeschaltet sind
      if (item.key === 'catering-getraenke') return (bpToggles['bp-catering'] ?? true) || (bpToggles['bp-getraenke'] ?? true)
      return bpToggles[`bp-${item.key}`] ?? true
    }),
  })).filter(g => g.items.length > 0)

  // Freigeschaltete Module für die Produkt-Tour (gesperrte/Pro-Bereiche werden
  // dadurch automatisch übersprungen).
  const tourAvailable: Record<string, boolean> = {}
  for (const group of nav) for (const item of group.items) tourAvailable[item.key] = !item.disabled

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Offener Mobile-Drawer: Hintergrund-Scroll sperren + Schließen per Escape
  useEffect(() => {
    if (!mobileOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

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

  const isChat = pathname === `/brautpaar/${eventId}/nachrichten` || pathname.startsWith(`/brautpaar/${eventId}/nachrichten/`)
  const isWebsite = pathname === `/brautpaar/${eventId}/website` || pathname.startsWith(`/brautpaar/${eventId}/website/`)
  // Vollflächige Ansichten füllen exakt die verbleibende Höhe (kein Seiten-Scroll)
  const isFullBleed = isChat || isWebsite
  // Paywall: Trial/Abo abgelaufen → nur die Abo-Seite bleibt erreichbar
  const isAboPage = pathname === `/brautpaar/${eventId}/abo` || pathname.startsWith(`/brautpaar/${eventId}/abo/`)
  const isExpired = subscription?.status === 'expired' && !isAboPage

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
        <span className="bp-sidebar-couple-name" style={isSolo ? { color: 'var(--bp-ink)' } : undefined}>
          {monogram && <span className="bp-font-heading" style={{ display: 'block', fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--bp-gold)', marginBottom: 2 }}>{monogram}</span>}
          {eventTitle}
        </span>
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

      {/* Footer — nur zwei Aktionen: Einstellungen (Zahnrad) und Abmelden. */}
      <div className="bp-sidebar-footer">
        <Link
          href={`/brautpaar/${eventId}/einstellungen`}
          onClick={() => setMobileOpen(false)}
          className="bp-sidebar-footer-link"
          aria-current={pathname === `/brautpaar/${eventId}/einstellungen` || pathname.startsWith(`/brautpaar/${eventId}/einstellungen/`) ? 'page' : undefined}
        >
          <Settings size={16} className="bp-nav-item-icon" />
          <span>Einstellungen</span>
        </Link>
        <button
          onClick={() => { performLogout() }}
          className="bp-sidebar-footer-link"
        >
          <LogOut size={16} className="bp-nav-item-icon" />
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

      <div className="bp-shell" style={isFullBleed ? { height: '100dvh', overflow: 'hidden' } : undefined}>
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
            <span className="bp-font-wordmark bp-mobile-header-title">
              {eventTitle}
            </span>
            <div style={{ width: 36 }} />
          </header>

          {/* Trial-Banner: nur während laufender Testphase, nicht auf der Abo-Seite,
              und nur solange nicht weggeklickt */}
          {subscription?.status === 'trialing' && !isAboPage && !trialDismissed && (
            <div className="bp-trial-banner">
              <Sparkles size={14} style={{ flexShrink: 0 }} />
              <span>
                Testphase — {subscription.daysLeft === 1 ? 'noch 1 Tag' : `noch ${subscription.daysLeft} Tage`} mit allen Planungsfunktionen
              </span>
              <Link href={`/brautpaar/${eventId}/abo`}>Tarif wählen</Link>
              <button
                type="button"
                className="bp-trial-banner-close"
                onClick={dismissTrialBanner}
                aria-label="Hinweis ausblenden"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {isExpired ? (
            <main className="bp-paywall-main">
              <div className="bp-paywall-card">
                <div className="bp-paywall-icon"><Lock size={24} /></div>
                <h2 className="bp-font-heading" style={{ fontSize: '1.6rem', margin: '0 0 0.6rem', color: 'var(--bp-ink)' }}>
                  Eure Testphase ist beendet
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--bp-ink-2)', margin: '0 0 1.75rem', lineHeight: 1.65 }}>
                  Eure gesamte Planung — Gäste, Sitzplan, Budget — ist sicher gespeichert.
                  Wählt einen Tarif und macht genau dort weiter, wo ihr aufgehört habt.
                </p>
                <Link
                  href={`/brautpaar/${eventId}/abo`}
                  style={{
                    display: 'inline-block', color: '#fff', borderRadius: 999,
                    padding: '0.75rem 1.9rem', textDecoration: 'none',
                    fontSize: '0.9rem', fontWeight: 600,
                    background: 'linear-gradient(135deg, #C9AE7D, var(--bp-gold-deep))',
                    boxShadow: '0 4px 14px rgba(156,127,79,0.32)',
                  }}
                >
                  Tarif wählen &amp; weiterplanen
                </Link>
                <p style={{ fontSize: '0.72rem', color: 'var(--bp-ink-3)', margin: '1.1rem 0 0' }}>
                  Ab 25 € im Monat · monatlich kündbar
                </p>
              </div>
            </main>
          ) : isFullBleed ? (
            <div data-tour="bp-content" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {children}
            </div>
          ) : (
            <main data-tour="bp-content" style={{ flex: 1 }}>
              {children}
            </main>
          )}
        </div>
      </div>

      {!welcomeVisible && <ProductTour eventId={eventId} available={tourAvailable} />}
    </BpToastProvider>
  )
}
