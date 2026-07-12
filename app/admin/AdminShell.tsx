'use client'

import React, { useEffect, useState } from 'react'
import {
  LayoutDashboard, Store, Flag, Users, Tag, LogOut, Bell, FlaskConical, Menu, X,
} from 'lucide-react'
import { performLogout } from '@/lib/logout'

type Section = 'ubersicht' | 'anbieter' | 'meldungen' | 'veranstalter' | 'promo' | 'benachrichtigungen' | 'testen'

interface Props {
  adminName: string
  active: Section
  onNav: (s: Section) => void
  children: React.ReactNode
}

interface Badges { anbieter: number; meldungen: number }

const NAV: { key: Section; label: string; icon: React.ElementType; badgeKey?: keyof Badges }[] = [
  { key: 'ubersicht',    label: 'Übersicht',    icon: LayoutDashboard },
  { key: 'anbieter',    label: 'Anbieter',     icon: Store,           badgeKey: 'anbieter' },
  { key: 'meldungen',   label: 'Meldungen',    icon: Flag,            badgeKey: 'meldungen' },
  { key: 'veranstalter', label: 'Veranstalter', icon: Users },
  { key: 'promo',       label: 'Promo-Codes',  icon: Tag },
  { key: 'benachrichtigungen', label: 'Benachrichtigungen', icon: Bell },
  { key: 'testen',      label: 'Kontrolle',    icon: FlaskConical },
]

const SB = {
  bg: '#FFFFFF',
  border: '#E2E4E8',
  text: '#1A1D21',
  text2: '#5A6068',
  accent: '#2563EB',
}

const ACTIVE_LABEL: Record<Section, string> = {
  ubersicht: 'Übersicht', anbieter: 'Anbieter', meldungen: 'Meldungen',
  veranstalter: 'Veranstalter', promo: 'Promo-Codes', benachrichtigungen: 'Benachrichtigungen',
  testen: 'Kontrolle',
}

export default function AdminShell({ adminName, active, onNav, children }: Props) {
  const [badges, setBadges] = useState<Badges>({ anbieter: 0, meldungen: 0 })
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    fetch('/api/admin/shell-data')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBadges({ anbieter: d.anbieter ?? 0, meldungen: d.meldungen ?? 0 }) })
  }, [])

  // Menü beim Wechsel der Sektion schließen (Mobile-Drawer).
  useEffect(() => { setMenuOpen(false) }, [active])

  // Body-Scroll sperren, solange der Drawer offen ist.
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [menuOpen])

  function navStyle(key: Section): React.CSSProperties {
    const on = active === key
    return {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 8, marginBottom: 1,
      background: on ? 'rgba(37,99,235,0.08)' : 'transparent',
      border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 600 : 450,
      color: on ? SB.accent : SB.text2,
    }
  }

  function NavList() {
    return (
      <>
        {NAV.map(item => {
          const Icon = item.icon
          const badge = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0
          const on = active === item.key
          return (
            <button key={item.key} onClick={() => onNav(item.key)} className="adm-nav-btn" style={navStyle(item.key)}>
              <Icon size={17} style={{ flexShrink: 0, opacity: on ? 1 : 0.5 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {badge > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, minWidth: 18, textAlign: 'center',
                  padding: '2px 5px', borderRadius: 100,
                  background: SB.accent, color: '#fff',
                }}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          )
        })}
      </>
    )
  }

  const logoutBtn = (
    <button
      onClick={() => performLogout()}
      className="adm-nav-btn"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 8, width: '100%',
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 14, fontWeight: 450,
        color: SB.text2,
      }}
    >
      <LogOut size={17} style={{ flexShrink: 0, opacity: 0.5 }} />
      <span>Abmelden</span>
    </button>
  )

  return (
    <div className="adm-shell" style={{ display: 'flex', height: '100dvh', overflow: 'hidden', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Sidebar (Desktop) ── */}
      <aside className="adm-sidebar" style={{
        width: 220, flexShrink: 0, height: '100dvh',
        background: SB.bg,
        borderRight: `1px solid ${SB.border}`,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 14px 14px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: SB.text2, margin: 0 }}>
            Verwaltung
          </p>
          <p style={{ fontSize: 12.5, color: SB.text2, margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {adminName}
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
          <NavList />
        </nav>

        {/* Bottom */}
        <div style={{ padding: '8px 8px 16px', borderTop: `1px solid ${SB.border}` }}>
          {logoutBtn}
        </div>
      </aside>

      {/* ── Top bar (Mobile) ── */}
      <header className="adm-topbar" style={{
        display: 'none', alignItems: 'center', gap: 12,
        height: 56, flexShrink: 0, padding: '0 14px',
        background: SB.bg, borderBottom: `1px solid ${SB.border}`,
      }}>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Menü öffnen"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 8, border: `1px solid ${SB.border}`, background: '#fff', cursor: 'pointer', color: SB.text, flexShrink: 0 }}
        >
          <Menu size={19} />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: SB.text2, margin: 0, lineHeight: 1.2 }}>Verwaltung</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: SB.text, margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ACTIVE_LABEL[active]}</p>
        </div>
        {/* Badge-Summe als Hinweis */}
        {(badges.anbieter + badges.meldungen) > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 20, textAlign: 'center', padding: '3px 7px', borderRadius: 100, background: SB.accent, color: '#fff', flexShrink: 0 }}>
            {badges.anbieter + badges.meldungen}
          </span>
        )}
      </header>

      {/* ── Mobile Drawer ── */}
      {menuOpen && (
        <div className="adm-drawer-root" onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,22,26,0.45)' }} />
          <aside
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative', width: 'min(300px, 82vw)', height: '100dvh',
              background: SB.bg, borderRight: `1px solid ${SB.border}`,
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 0 40px rgba(0,0,0,0.25)',
              animation: 'admDrawerIn .18s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '16px 14px 12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: SB.text2, margin: 0 }}>Verwaltung</p>
                <p style={{ fontSize: 12.5, color: SB.text2, margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adminName}</p>
              </div>
              <button onClick={() => setMenuOpen(false)} aria-label="Menü schließen" style={{ display: 'flex', width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: SB.text2, flexShrink: 0 }}>
                <X size={19} />
              </button>
            </div>
            <nav style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
              <NavList />
            </nav>
            <div style={{ padding: '8px 8px 16px', borderTop: `1px solid ${SB.border}` }}>
              {logoutBtn}
            </div>
          </aside>
        </div>
      )}

      {/* ── Main ── */}
      <div className="adm-main" style={{
        flex: 1, minWidth: 0,
        height: '100dvh',
        overflowY: 'auto',
        background: '#F4F5F7',
      }}>
        {children}
      </div>

      <style>{`
        .adm-nav-btn:hover { background: rgba(37,99,235,0.06) !important; }
        @keyframes admDrawerIn { from { transform: translateX(-100%) } to { transform: translateX(0) } }
        /* Mobile-Layout: Sidebar zu Topbar + Drawer */
        @media (max-width: 820px) {
          .adm-shell { flex-direction: column !important; }
          .adm-sidebar { display: none !important; }
          .adm-topbar { display: flex !important; }
          .adm-main { height: auto !important; flex: 1 1 auto !important; min-height: 0 !important; }
        }
      `}</style>
    </div>
  )
}
