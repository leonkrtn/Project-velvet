'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Settings, Users, MessageSquare, Lightbulb,
  Calendar, BarChart2, Shield, Grid2X2, UserCog, ChevronLeft, Menu, X,
} from 'lucide-react'

interface Props {
  eventId: string
  eventTitle: string
  eventDate: string | null
  children: React.ReactNode
}

const NAV_ITEMS = [
  { key: 'uebersicht',     label: 'Übersicht',       icon: LayoutDashboard },
  { key: 'allgemein',      label: 'Allgemein',        icon: Settings },
  { key: 'mitglieder',     label: 'Mitglieder',       icon: Users },
  { key: 'chats',          label: 'Chats',            icon: MessageSquare },
  { key: 'vorschlaege',    label: 'Vorschläge',       icon: Lightbulb },
  { key: 'ablaufplan',     label: 'Ablaufplan',       icon: Calendar },
  { key: 'statistiken',    label: 'Statistiken',      icon: BarChart2 },
  { key: 'berechtigungen', label: 'Berechtigungen',   icon: Shield },
  { key: 'sitzplan',       label: 'Sitzplan',         icon: Grid2X2,  disabled: true },
  { key: 'personalplanung',label: 'Personalplanung',  icon: UserCog,  disabled: true },
]

export default function SidebarLayout({ eventId, eventTitle, eventDate, children }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const base = `/veranstalter/${eventId}`

  function isActive(key: string) {
    return pathname === `${base}/${key}` || pathname.startsWith(`${base}/${key}/`)
  }

  const sidebar = (
    <nav style={{
      width: 240, flexShrink: 0, background: 'var(--surface)',
      borderRight: '1px solid var(--border)', display: 'flex',
      flexDirection: 'column', height: '100%', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <Link
          href="/veranstalter"
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-light)', fontSize: 12, textDecoration: 'none', marginBottom: 12 }}
        >
          <ChevronLeft size={14} /> Alle Events
        </Link>
        <div style={{ fontFamily: 'var(--heading-font)', fontSize: 16, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
          {eventTitle}
        </div>
        {eventDate && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>
            {new Date(eventDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      {/* Nav items */}
      <div style={{ padding: '10px 10px', flex: 1 }}>
        {NAV_ITEMS.map(({ key, label, icon: Icon, disabled }) => {
          const active = isActive(key)
          return (
            <div key={key}>
              {disabled ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 'var(--r-sm)',
                  fontSize: 14, color: 'var(--text-dim)', cursor: 'not-allowed',
                  marginBottom: 2,
                }}>
                  <Icon size={16} />
                  <span>{label}</span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    background: 'var(--surface2)', color: 'var(--text-dim)',
                    padding: '2px 6px', borderRadius: 4,
                  }}>Bald</span>
                </div>
              ) : (
                <Link
                  href={`${base}/${key}`}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 'var(--r-sm)',
                    fontSize: 14, textDecoration: 'none', marginBottom: 2,
                    background: active ? 'var(--gold-pale)' : 'transparent',
                    color: active ? 'var(--gold)' : 'var(--text-mid)',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Desktop sidebar */}
      <div style={{ display: 'none' }} className="sidebar-desktop">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}
          onClick={() => setMobileOpen(false)}
        >
          <div style={{ width: 240, height: '100%' }} onClick={e => e.stopPropagation()}>
            {sidebar}
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} />
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
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
          <span style={{ fontFamily: 'var(--heading-font)', fontSize: 16, fontWeight: 600 }}>
            {eventTitle}
          </span>
        </div>

        <main style={{ flex: 1, padding: '32px 36px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .sidebar-desktop { display: block !important; }
        }
        @media (max-width: 767px) {
          .mobile-topbar { display: flex !important; }
          main { padding: 20px 16px !important; }
        }
      `}</style>
    </div>
  )
}
