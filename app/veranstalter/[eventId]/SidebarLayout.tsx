'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ChatUnreadBadge from './chats/ChatUnreadBadge'
import { performLogout } from '@/lib/logout'
import {
  LayoutDashboard, Users, MessageSquare,
  Calendar, UserCog, ChevronLeft, Menu, UtensilsCrossed,
  Camera, FolderOpen, LogOut, UserCircle, SlidersHorizontal,
  FileDown, CheckSquare,
} from 'lucide-react'
import { NavIconAllgemein, NavIconSitzplan, NavIconMusik } from '@/lib/nav-icons'

interface Props {
  eventId: string
  eventTitle: string
  eventDate: string | null
  eventCode?: string | null
  userName?: string | null
  userAvatarUrl?: string | null
  children: React.ReactNode
}

interface NavItem {
  key: string
  label: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
}
interface NavGroup {
  label?: string
  items: NavItem[]
}

// Gruppiert analog zum Brautpaar-Portal (BrautpaarShell.tsx), damit beide
// Sidebars dieselbe Informationsarchitektur nutzen (siehe UX-Audit B14/B15).
const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ key: 'uebersicht', label: 'Übersicht', icon: LayoutDashboard }],
  },
  {
    label: 'PLANUNG',
    items: [
      { key: 'gaesteliste', label: 'Gästeliste', icon: Users },
      { key: 'sitzplan', label: 'Sitzplan', icon: NavIconSitzplan },
      { key: 'ablaufplan', label: 'Ablaufplan', icon: Calendar },
    ],
  },
  {
    label: 'DETAILS',
    items: [
      { key: 'catering-getraenke', label: 'Catering & Getränke', icon: UtensilsCrossed },
      { key: 'musik', label: 'Musik', icon: NavIconMusik },
      { key: 'medien', label: 'Bilder', icon: Camera },
    ],
  },
  {
    label: 'VERWALTUNG',
    items: [
      { key: 'allgemein', label: 'Allgemein', icon: NavIconAllgemein },
      { key: 'aufgaben-notizen', label: 'Aufgaben & Notizen', icon: CheckSquare },
      { key: 'mitglieder', label: 'Beteiligte', icon: Users },
      { key: 'personalplanung', label: 'Personalplanung', icon: UserCog },
      { key: 'dateien', label: 'Dateien', icon: FolderOpen },
      { key: 'pdf-export', label: 'PDF-Export', icon: FileDown },
    ],
  },
  {
    label: 'KOMMUNIKATION',
    items: [{ key: 'chats', label: 'Nachrichten', icon: MessageSquare }],
  },
]

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

export default function SidebarLayout({ eventId, eventTitle, eventDate, eventCode, userName, userAvatarUrl, children }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await performLogout()
  }

  const base = `/veranstalter/${eventId}`

  function isActive(key: string) {
    return pathname === `${base}/${key}` || pathname.startsWith(`${base}/${key}/`)
  }

  const isChats = pathname === `${base}/chats` || pathname.startsWith(`${base}/chats/`)
  const isPdfExport = pathname === `${base}/pdf-export` || pathname.startsWith(`${base}/pdf-export/`)
  const isFullscreen = isChats || isPdfExport

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
          {NAV_GROUPS.map((group, gi) => (
            <React.Fragment key={group.label ?? `group-${gi}`}>
              {gi > 0 && <div style={{ borderTop: '1px solid var(--border)', margin: '8px 4px' }} />}
              {group.label && (
                <div style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                  padding: '6px 10px 4px',
                }}>
                  {group.label}
                </div>
              )}
              {group.items.map(({ key, label, icon: Icon }) => {
                const active = isActive(key)
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
                    <span style={{ flex: 1 }}>{label}</span>
                    {key === 'chats' && <ChatUnreadBadge eventId={eventId} />}
                  </Link>
                )
              })}
            </React.Fragment>
          ))}
        </div>

        {eventCode && (
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <div style={{ padding: '10px 10px 6px' }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', margin: '0 0 2px' }}>
                Event-Code
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', margin: 0, fontFamily: 'monospace', letterSpacing: '0.12em' }}>
                #{eventCode}
              </p>
            </div>
          </div>
        )}

        {/* Bottom icon bar: Profile · Settings · Logout */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '8px 6px 10px',
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
        }}>
          {/* Profile avatar / icon */}
          <Link
            href={`/veranstalter/profil?from=${encodeURIComponent(pathname)}`}
            aria-label={userName ? `Profil: ${userName}` : 'Profil verwalten'}
            className="mob-touch"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '7px 0', borderRadius: 8, textDecoration: 'none',
              color: 'var(--text-secondary)', transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
          >
            {userAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userAvatarUrl}
                alt={userName ?? 'Profil'}
                style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : userName ? (
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--accent)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
              }}>
                {initials(userName)}
              </div>
            ) : (
              <UserCircle size={20} style={{ opacity: 0.6 }} />
            )}
          </Link>

          {/* Settings */}
          <Link
            href={`/veranstalter/konfiguration?from=${encodeURIComponent(pathname)}`}
            aria-label="Einstellungen"
            className="mob-touch"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '7px 0', borderRadius: 8, textDecoration: 'none',
              color: 'var(--text-secondary)', transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
          >
            <SlidersHorizontal size={18} style={{ opacity: 0.6 }} />
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            aria-label="Abmelden"
            className="mob-touch"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '7px 0', borderRadius: 8, border: 'none',
              background: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
              transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.color = '#FF3B30' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
          >
            <LogOut size={18} style={{ opacity: 0.6 }} />
          </button>
        </div>
      </div>
    </nav>
  )

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Sidebar — rendered ONCE, shown via CSS on desktop, via .sidebar-open class on mobile */}
      <div className={`sidebar-wrapper${mobileOpen ? ' sidebar-open' : ''}`}>
        {sidebar}
      </div>

      {/* Mobile backdrop (no second sidebar render) */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div style={{ flex: 1, overflow: isFullscreen ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile topbar */}
        <div className="mobile-topbar" style={{
          display: 'none', alignItems: 'center', gap: 12,
          padding: '14px 16px', background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}>
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Menü öffnen"
            aria-expanded={mobileOpen}
            className="mob-touch"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <Menu size={20} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{eventTitle}</span>
        </div>

        {isFullscreen ? (
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
        /* Desktop: sidebar always visible */
        .sidebar-wrapper { display: none; }
        @media (min-width: 768px) {
          .sidebar-wrapper { display: block !important; }
        }
        /* Mobile: sidebar slides in as fixed overlay when open */
        @media (max-width: 767px) {
          .mobile-topbar { display: flex !important; }
          main { padding: 20px 16px !important; }
          .sidebar-open {
            display: block !important;
            position: fixed;
            top: 0; left: 0; bottom: 0;
            z-index: 200;
          }
        }
        .nav-item-link:hover { background: rgba(0,0,0,0.06) !important; }
        .back-btn-link:hover { background: rgba(0,0,0,0.06) !important; color: var(--text-primary) !important; }
      `}</style>
    </div>
  )
}
