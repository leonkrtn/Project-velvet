'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Settings, Users, MessageSquare, Lightbulb,
  Calendar, Shield, Grid2X2, UserCog, ChevronLeft, Menu,
} from 'lucide-react'

interface Props {
  eventId: string
  eventTitle: string
  eventDate: string | null
  eventCode?: string | null
  children: React.ReactNode
}

const NAV_ITEMS = [
  { key: 'uebersicht',     label: 'Übersicht',       icon: LayoutDashboard },
  { key: 'allgemein',      label: 'Allgemein',        icon: Settings },
  { key: 'mitglieder',     label: 'Mitglieder',       icon: Users },
  { key: 'chats',          label: 'Chats',            icon: MessageSquare },
  { key: 'vorschlaege',    label: 'Vorschläge',       icon: Lightbulb },
  { key: 'ablaufplan',     label: 'Ablaufplan',       icon: Calendar },
{ key: 'berechtigungen', label: 'Berechtigungen',   icon: Shield },
  { key: 'sitzplan',       label: 'Sitzplan',         icon: Grid2X2,  disabled: true },
  { key: 'personalplanung',label: 'Personalplanung',  icon: UserCog },
]

export default function SidebarLayout({ eventId, eventTitle, eventDate, eventCode, children }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const base = `/veranstalter/${eventId}`

  function isActive(key: string) {
    return pathname === `${base}/${key}` || pathname.startsWith(`${base}/${key}/`)
  }

  const isChats = pathname === `${base}/chats` || pathname.startsWith(`${base}/chats/`)

  const sidebar = (
    <nav style={{
      width: 220,
      minWidth: 220,
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflowY: 'auto',
    }}>
      <div style={{ padding: '16px 12px 8px' }}>
        <Link
          href="/veranstalter"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 13, color: 'var(--text-secondary)',
            textDecoration: 'none', padding: '4px 6px',
            borderRadius: 6, width: 'fit-content',
          }}
        >
          <ChevronLeft size={14} />
          Alle Events
        </Link>
      </div>

      <div style={{
        fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
        padding: '14px 12px 10px', letterSpacing: '-0.2px', lineHeight: 1.3,
      }}>
        {eventTitle}
        {eventDate && (
          <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginTop: 2 }}>
            {new Date(eventDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      <div style={{ padding: '4px 8px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
        {NAV_ITEMS.map(({ key, label, icon: Icon, disabled }) => {
          const active = isActive(key)
          if (disabled) {
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 10px', borderRadius: 8,
                fontSize: 14, color: 'var(--text-tertiary)',
                cursor: 'not-allowed', marginBottom: 1,
              }}>
                <Icon size={16} style={{ opacity: 0.4, flexShrink: 0 }} />
                <span>{label}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  background: 'rgba(0,0,0,0.06)', color: 'var(--text-tertiary)',
                  padding: '2px 6px', borderRadius: 4,
                }}>Bald</span>
              </div>
            )
          }
          return (
            <Link
              key={key}
              href={`${base}/${key}`}
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 10px', borderRadius: 8,
                fontSize: 14, fontWeight: active ? 500 : 450,
                color: 'var(--text-primary)',
                textDecoration: 'none', marginBottom: 1,
                background: active ? 'var(--surface)' : 'transparent',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                transition: 'background 0.12s',
              }}
            >
              <Icon size={16} style={{ opacity: active ? 1 : 0.5, flexShrink: 0 }} />
              <span>{label}</span>
            </Link>
          )
        })}
        </div>
        {eventCode && (
          <div style={{ padding: '12px 10px 8px', borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', margin: '0 0 3px' }}>
              Event-Code
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', margin: 0, fontFamily: 'monospace', letterSpacing: '0.12em' }}>
              #{eventCode}
            </p>
          </div>
        )}
      </div>
    </nav>
  )

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Desktop sidebar */}
      <div className="sidebar-desktop" style={{ display: 'none' }}>
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}
          onClick={() => setMobileOpen(false)}
        >
          <div style={{ width: 220, height: '100%' }} onClick={e => e.stopPropagation()}>
            {sidebar}
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} />
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, overflow: isChats ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile topbar */}
        <div className="mobile-topbar" style={{
          display: 'none', alignItems: 'center', gap: 12,
          padding: '14px 16px', background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}>
          <button
            onClick={() => setMobileOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <Menu size={20} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{eventTitle}</span>
        </div>

        {isChats ? (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        ) : (
          <main style={{ flex: 1, padding: '36px 40px 60px', width: '100%', boxSizing: 'border-box' }}>
            {children}
          </main>
        )}
      </div>

      <style>{`
        @media (min-width: 768px) {
          .sidebar-desktop { display: block !important; }
        }
        @media (max-width: 767px) {
          .mobile-topbar { display: flex !important; }
          main { padding: 20px 16px !important; }
        }
        .nav-item-link:hover { background: rgba(0,0,0,0.06) !important; }
        .back-btn-link:hover { background: rgba(0,0,0,0.06) !important; color: var(--text-primary) !important; }
      `}</style>
    </div>
  )
}
