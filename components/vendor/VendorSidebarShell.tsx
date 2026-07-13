'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Inbox, ReceiptText,
  Calendar, BarChart2, User, LogOut, Users, Menu, X, Zap,
  Sparkles, ChevronRight, Settings,
} from 'lucide-react'

import { performLogout } from '@/lib/logout'
import { VENDOR_QUICK_TOUR_STEPS, VENDOR_QUICK_TOUR_START_EVENT, VENDOR_QUICK_TOUR_DONE_KEY } from '@/lib/tour/vendor-quick-tour-steps'
import VendorTour from '@/components/tour/VendorTour'

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

function markQuickTourDone() {
  fetch('/api/tour', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'vendor_quick_tour' }),
  }).catch(() => { /* best effort — localStorage-Flag greift als Fallback */ })
}

const NAV = [
  { key: 'listing',    label: 'Anbieter-Profil', href: '/vendor/listing',    icon: User },
  { key: 'ubersicht',   label: 'Übersicht',    href: '/vendor/ubersicht',   icon: LayoutDashboard },
  { key: 'anfragen',    label: 'Anfragen',     href: '/vendor/anfragen',    icon: Inbox,         badgeKey: 'pendingAnfragen' as const },
  { key: 'angebote',   label: 'Angebote',     href: '/vendor/angebote',    icon: ReceiptText },
  { key: 'events',     label: 'Events',       href: '/vendor/dashboard',   icon: Calendar },
  { key: 'report',     label: 'Berichte',     href: '/vendor/report',      icon: BarChart2 },
  { key: 'crm',        label: 'CRM',          href: '/vendor/crm',         icon: Users },
  { key: 'automatik',  label: 'Automatik',    href: '/vendor/automatisierungen', icon: Zap },
] as const

type NavKey = (typeof NAV)[number]['key'] | 'profil'

function activeKey(pathname: string): NavKey {
  if (pathname.startsWith('/vendor/listing'))    return 'listing'
  if (pathname.startsWith('/vendor/ubersicht'))  return 'ubersicht'
  if (pathname.startsWith('/vendor/anfragen'))   return 'anfragen'
  if (pathname.startsWith('/vendor/angebote'))   return 'angebote'
  if (pathname.startsWith('/vendor/profil'))     return 'profil'
  if (pathname.startsWith('/vendor/report'))     return 'report'
  if (pathname.startsWith('/vendor/crm'))        return 'crm'
  if (pathname.startsWith('/vendor/automatisierungen')) return 'automatik'
  if (pathname.startsWith('/vendor/e-mails'))    return 'automatik'
  if (pathname.startsWith('/vendor/dashboard'))  return 'events'
  return 'ubersicht'
}

export default function VendorSidebarShell({ companyName, companyInitials, category, logoUrl, children }: Props) {
  const pathname = usePathname()
  const [badges, setBadges] = useState<BadgeData>({ pendingAnfragen: 0 })
  const [moderationStatus, setModerationStatus] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // null = noch nicht vom Server geladen — Quick-Tour erst rendern, wenn klar ist,
  // dass sie für diesen Account noch nicht abgeschlossen wurde (verhindert Re-Start
  // bei jeder neuen Anmeldung auf einem anderen Gerät/Browser).
  const [quickTourDone, setQuickTourDone] = useState<boolean | null>(null)
  const active = activeKey(pathname)
  const isKommunikation = pathname.includes('/kommunikation')

  const noShell = pathname.startsWith('/vendor/join') || pathname.startsWith('/vendor/signup') || pathname.startsWith('/vendor/onboarding')

  useEffect(() => {
    fetch('/api/vendor/shell-data')
      .then(r => r.ok ? r.json() : null)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      .then(d => {
        if (d) {
          setBadges({ pendingAnfragen: d.pendingAnfragen ?? 0 })
          setModerationStatus(d.moderationStatus ?? null)
          setQuickTourDone(prev => prev === null ? !!d.quickTourDone : prev)
        }
      })
  }, [pathname])

  useEffect(() => { setMobileMenuOpen(false) }, [pathname])

  if (noShell) return <>{children}</>

  function navStyle(key: NavKey): React.CSSProperties {
    const on = active === key
    return {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 10px', borderRadius: 8, marginBottom: 1,
      textDecoration: 'none', fontSize: 14, fontWeight: on ? 600 : 450,
      color: on ? '#ffffff' : 'var(--text-secondary)',
      background: on ? 'var(--accent)' : 'transparent',
    }
  }

  function renderNavItems(forDrawer = false) {
    return NAV.map(item => {
      const Icon = item.icon
      const badge = 'badgeKey' in item ? (badges[item.badgeKey] ?? 0) : 0
      const on = active === item.key
      return (
        <Link key={item.key} href={item.href} className={forDrawer ? 'vdr-drawer-link' : 'vdr-nav-link'}
          data-active={on ? 'true' : undefined} style={navStyle(item.key)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <Icon size={16} style={{ flexShrink: 0, opacity: on ? 1 : 0.45 }} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {badge > 0 && (
              <span className="vdr-badge" style={{
                fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: 'center',
                padding: '2px 5px', borderRadius: 100,
                background: on ? 'rgba(255,255,255,0.3)' : 'var(--accent)', color: '#fff',
              }}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </div>
        </Link>
      )
    })
  }

  return (
    <div className="vdr-shell" style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>

      {/* ── Sidebar (desktop + tablet) ── */}
      <aside className="vdr-sidebar" style={{
        width: 240, flexShrink: 0, height: '100dvh',
        background: 'var(--sidebar-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(35,82,200,0.22)',
        boxShadow: '2px 0 12px rgba(35,82,200,0.06)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Company header */}
        <div className="vdr-company-header" style={{ padding: '18px 14px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: logoUrl ? 'transparent' : 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, letterSpacing: '-0.3px', overflow: 'hidden',
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

        <nav className="vdr-nav" style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
          {renderNavItems(false)}
        </nav>

        {/* Bottom */}
        <div className="vdr-sidebar-bottom" style={{ padding: '8px 8px 16px', borderTop: '1px solid var(--border)' }}>
          <Link href="/vendor/profil" className="vdr-nav-link" data-active={active === 'profil' ? 'true' : undefined} style={navStyle('profil')}>
            <Settings size={16} style={{ flexShrink: 0, opacity: active === 'profil' ? 1 : 0.45 }} />
            <span className="vdr-nav-text">Profil</span>
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

      {/* ── Mobile header (hidden on desktop/tablet) ── */}
      <div className="vdr-mobile-header" style={{
        display: 'none', // shown via CSS on mobile
        alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
        height: 56, flexShrink: 0,
        background: 'var(--sidebar-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(35,82,200,0.22)',
        boxShadow: '0 2px 8px rgba(35,82,200,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label={mobileMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, marginLeft: -8, borderRadius: 8, border: 'none',
              background: 'none', cursor: 'pointer', color: 'var(--text-primary)',
            }}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: logoUrl ? 'transparent' : 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, overflow: 'hidden',
          }}>
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : companyInitials
            }
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {companyName || 'Mein Unternehmen'}
          </span>
        </div>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            display: 'none', // shown via CSS on mobile
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 190,
          }}
          className="vdr-mobile-overlay"
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className="vdr-mobile-drawer"
        data-open={mobileMenuOpen ? 'true' : 'false'}
        style={{
          display: 'none', // shown via CSS on mobile
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: 280, zIndex: 200,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(35,82,200,0.22)',
          boxShadow: '4px 0 20px rgba(35,82,200,0.12)',
          flexDirection: 'column',
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Drawer header */}
        <div style={{ padding: '18px 14px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: logoUrl ? 'transparent' : 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, overflow: 'hidden',
            }}>
              {logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : companyInitials
              }
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {companyName || 'Mein Unternehmen'}
              </p>
              {category && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                  {category.replace(/-/g, ' ')}
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Drawer nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {renderNavItems(true)}
        </nav>

        {/* Drawer bottom */}
        <div style={{ padding: '8px 10px 24px', borderTop: '1px solid var(--border)' }}>
          <Link href="/vendor/profil" className="vdr-drawer-link" data-active={active === 'profil' ? 'true' : undefined} style={navStyle('profil')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <Settings size={16} style={{ flexShrink: 0, opacity: active === 'profil' ? 1 : 0.45 }} />
              <span>Profil</span>
            </div>
          </Link>
          <button
            onClick={() => performLogout()}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 450, color: 'var(--text-secondary)', marginTop: 1 }}
          >
            <LogOut size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
            <span>Abmelden</span>
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="vdr-main" style={{
        flex: 1, minWidth: 0,
        height: '100dvh',
        overflow: isKommunikation ? 'hidden' : 'auto',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg)',
      }}>
        {moderationStatus === 'draft' && !pathname.startsWith('/vendor/listing') && (
          <Link href="/vendor/listing" style={{
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            padding: '10px 20px', textDecoration: 'none',
            background: 'rgba(35,82,200,0.08)', borderBottom: '1px solid var(--border)',
            color: 'var(--accent)', fontSize: 13.5, fontWeight: 600,
          }}>
            <Sparkles size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>Dein Profil ist noch nicht eingereicht — jetzt in wenigen Minuten fertigstellen.</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>Fortsetzen <ChevronRight size={15} /></span>
          </Link>
        )}
        {children}
      </div>

      <style>{`
        /* ── Vendor-Portal Farbpalette ── */
        .vdr-shell {
          --bg:           #F5F8FF;
          --sidebar-bg:   rgba(255,255,255,0.88);
          --surface:      #FFFFFF;
          --accent:       #2352C8;
          --accent-light: rgba(35,82,200,0.09);
          --text-primary:   #111827;
          --text-secondary: #4B5768;
          --text-tertiary:  #94A3B8;
          --border:       rgba(35,82,200,0.10);
          --border2:      rgba(35,82,200,0.18);
          --shadow-sm:    0 1px 4px rgba(35,82,200,0.08), 0 1px 2px rgba(0,0,0,0.04);
          --shadow-md:    0 4px 20px rgba(35,82,200,0.10), 0 1px 6px rgba(0,0,0,0.04);
        }

        /* Globale Hover-Regeln im Vendor-Portal */
        .vdr-shell a:hover { opacity: 1 !important; }
        .vdr-shell button:hover:not(:disabled) { filter: none !important; opacity: 1 !important; }

        .vdr-logout-btn:hover { background: rgba(35,82,200,0.06) !important; }

        .vdr-nav-link:hover,
        .vdr-drawer-link:hover { background: rgba(35,82,200,0.08) !important; }
        .vdr-nav-link[data-active="true"]:hover,
        .vdr-drawer-link[data-active="true"]:hover { background: var(--accent) !important; }

        /* Tablet: icon-only sidebar */
        @media (max-width: 768px) {
          .vdr-sidebar { width: 56px !important; }
          .vdr-company-text { display: none !important; }
          .vdr-company-header { justify-content: center !important; padding: 14px 10px !important; gap: 0 !important; }
          .vdr-nav { padding: 2px 6px !important; }
          .vdr-nav-link { justify-content: center !important; padding: 10px !important; gap: 0 !important; }
          .vdr-nav-link > div { justify-content: center !important; }
          .vdr-nav-link span { display: none !important; }
          .vdr-badge { display: none !important; }
          .vdr-sidebar-bottom { padding: 6px 6px 12px !important; }
          .vdr-logout-btn { justify-content: center !important; padding: 10px !important; gap: 0 !important; }
          .vdr-logout-btn span { display: none !important; }
        }

        /* Mobile: burger menu */
        @media (max-width: 480px) {
          .vdr-shell { flex-direction: column !important; }
          .vdr-sidebar { display: none !important; }
          .vdr-mobile-header { display: flex !important; }
          .vdr-mobile-overlay { display: block !important; }
          .vdr-mobile-drawer { display: flex !important; }
          .vdr-main { height: auto !important; flex: 1 !important; min-height: 0 !important; overflow: auto !important; }
        }
      `}</style>

      {/* Hilfe-Auswahl (kompletter Rundgang / einzelner Bereich / Hilfe-Seite) lebt
          jetzt im Profil (/vendor/profil) statt als eigener Sidebar-Button. */}
      {/* Ausführliche Tour (über das Hilfe-Menü, optional bereichsgefiltert) */}
      <VendorTour />
      {/* Kurze Onboarding-Tour: einmaliger Auto-Start nach dem Wizard.
          Wird erst gerendert, sobald der Server bestätigt hat, dass sie für
          diesen Account noch nicht abgeschlossen ist. */}
      {quickTourDone === false && (
        <VendorTour
          steps={VENDOR_QUICK_TOUR_STEPS}
          startEvent={VENDOR_QUICK_TOUR_START_EVENT}
          autoStartOnceKey={VENDOR_QUICK_TOUR_DONE_KEY}
          onDismissForever={() => { setQuickTourDone(true); markQuickTourDone() }}
        />
      )}
    </div>
  )
}
