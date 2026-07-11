'use client'

import React, { useEffect, useState } from 'react'
import {
  LayoutDashboard, Store, Flag, Users, Tag, LogOut, Bell, FlaskConical,
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

export default function AdminShell({ adminName, active, onNav, children }: Props) {
  const [badges, setBadges] = useState<Badges>({ anbieter: 0, meldungen: 0 })

  useEffect(() => {
    fetch('/api/admin/shell-data')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBadges({ anbieter: d.anbieter ?? 0, meldungen: d.meldungen ?? 0 }) })
  }, [])

  function navStyle(key: Section): React.CSSProperties {
    const on = active === key
    return {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 10px', borderRadius: 8, marginBottom: 1,
      background: on ? 'rgba(37,99,235,0.08)' : 'transparent',
      border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 600 : 450,
      color: on ? SB.accent : SB.text2,
    }
  }

  return (
    <div className="adm-shell" style={{ display: 'flex', height: '100dvh', overflow: 'hidden', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Sidebar ── */}
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
          {NAV.map(item => {
            const Icon = item.icon
            const badge = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0
            const on = active === item.key
            return (
              <button key={item.key} onClick={() => onNav(item.key)} className="adm-nav-btn" style={navStyle(item.key)}>
                <Icon size={16} style={{ flexShrink: 0, opacity: on ? 1 : 0.5 }} />
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
        </nav>

        {/* Bottom */}
        <div style={{ padding: '8px 8px 16px', borderTop: `1px solid ${SB.border}` }}>
          <button
            onClick={() => performLogout()}
            className="adm-nav-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px', borderRadius: 8, width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 450,
              color: SB.text2,
            }}
          >
            <LogOut size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
            <span>Abmelden</span>
          </button>
        </div>
      </aside>

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
        @media (max-width: 640px) {
          .adm-shell { flex-direction: column !important; }
          .adm-sidebar { width: 100% !important; height: auto !important; flex-direction: row !important; border-right: none !important; border-bottom: 1px solid #E2E4E8 !important; }
          .adm-main { height: auto !important; flex: 1 !important; }
        }
      `}</style>
    </div>
  )
}
