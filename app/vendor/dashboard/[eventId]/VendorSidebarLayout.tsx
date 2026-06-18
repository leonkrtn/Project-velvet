'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MessagesSquare, Info, ChevronLeft, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ChatUnreadBadge from '@/app/veranstalter/[eventId]/chats/ChatUnreadBadge'

interface Props {
  eventId: string
  eventTitle: string
  eventDate: string | null
  children: React.ReactNode
}

const NAV_ITEMS = [
  { key: 'kommunikation', label: 'Kommunikation', icon: MessagesSquare },
  { key: 'informationen', label: 'Informationen', icon: Info },
]

export default function VendorSidebarLayout({ eventId, eventTitle, eventDate, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const base = `/vendor/dashboard/${eventId}`
  const isActive = (key: string) => pathname === `${base}/${key}` || pathname.startsWith(`${base}/${key}/`)
  const isFullHeight = isActive('kommunikation')

  const sidebar = (
    <nav style={{
      width: 240, minWidth: 240,
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100dvh', overflowY: 'auto',
    }}>
      <div style={{ padding: '16px 14px 8px' }}>
        <Link href="/vendor/dashboard" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 13, color: 'var(--text-secondary)',
          textDecoration: 'none', padding: '4px 6px',
          borderRadius: 6, width: 'fit-content',
        }}>
          <ChevronLeft size={14} />
          Alle Anfragen
        </Link>
      </div>

      <div style={{
        fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
        padding: '14px 14px 12px', letterSpacing: '-0.2px', lineHeight: 1.3,
      }}>
        {eventTitle}
        {eventDate && (
          <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginTop: 2 }}>
            {new Date(eventDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      <div style={{ padding: '4px 10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
            const active = isActive(key)
            return (
              <Link key={key} href={`${base}/${key}`} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 9,
                fontSize: 14.5, fontWeight: active ? 600 : 450,
                color: 'var(--text-primary)', textDecoration: 'none', marginBottom: 2,
                background: active ? 'var(--surface)' : 'transparent',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
              }}>
                <Icon size={17} style={{ opacity: active ? 1 : 0.55, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {key === 'kommunikation' && <ChatUnreadBadge eventId={eventId} />}
              </Link>
            )
          })}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 0 4px', marginTop: 4 }}>
          <button onClick={handleLogout} disabled={loggingOut} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 12px', borderRadius: 8, width: '100%',
            fontSize: 14, color: 'var(--text-secondary)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left',
          }}>
            <LogOut size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
            <span>Abmelden</span>
          </button>
        </div>
      </div>
    </nav>
  )

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Desktop sidebar */}
      <div className="vendor-sidebar-desktop" style={{ display: 'none' }}>
        {sidebar}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: isFullHeight ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile topbar */}
        <div className="vendor-mobile-topbar" style={{
          display: 'none', alignItems: 'center', gap: 12,
          padding: '12px 16px', background: 'var(--surface)',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <Link href="/vendor/dashboard" aria-label="Alle Anfragen" style={{ color: 'var(--text-secondary)', display: 'flex' }}>
            <ChevronLeft size={20} />
          </Link>
          <span style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eventTitle}</span>
        </div>

        {isFullHeight ? (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {children}
          </div>
        ) : (
          <main className="vendor-main" style={{ flex: 1, padding: '36px 40px 96px', width: '100%', boxSizing: 'border-box' }}>
            {children}
          </main>
        )}

        {/* Mobile bottom tab bar */}
        <nav className="vendor-bottom-nav" style={{
          display: 'none',
          borderTop: '1px solid var(--border)', background: 'var(--surface)',
          paddingBottom: 'env(safe-area-inset-bottom)', flexShrink: 0,
        }}>
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
            const active = isActive(key)
            return (
              <Link key={key} href={`${base}/${key}`} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '9px 0 7px', textDecoration: 'none',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                position: 'relative',
              }}>
                <Icon size={20} />
                <span style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>{label}</span>
                {key === 'kommunikation' && (
                  <span style={{ position: 'absolute', top: 4, right: '50%', marginRight: -26 }}>
                    <ChatUnreadBadge eventId={eventId} />
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .vendor-sidebar-desktop { display: block !important; }
        }
        @media (max-width: 767px) {
          .vendor-mobile-topbar { display: flex !important; }
          .vendor-bottom-nav { display: flex !important; }
          .vendor-main { padding: 20px 16px 40px !important; }
        }
      `}</style>
    </div>
  )
}
