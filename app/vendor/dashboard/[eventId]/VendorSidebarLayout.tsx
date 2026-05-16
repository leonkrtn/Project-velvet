'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare,
  Calendar, Grid2X2, ChevronLeft, Menu, UtensilsCrossed,
  Music2, Flower2, Camera, Users, FileText, LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ChatUnreadBadge from '@/app/veranstalter/[eventId]/chats/ChatUnreadBadge'

interface Props {
  eventId: string
  eventTitle: string
  eventDate: string | null
  children: React.ReactNode
  initialTabPerms: Record<string, 'none' | 'read' | 'write'>
}

const ALL_NAV_ITEMS = [
  { key: 'uebersicht',  label: 'Übersicht',         icon: LayoutDashboard },
  { key: 'catering',    label: 'Catering & Menü',    icon: UtensilsCrossed },
  { key: 'chats',       label: 'Chats',              icon: MessageSquare },
  { key: 'ablaufplan',  label: 'Ablaufplan',         icon: Calendar },
  { key: 'gaesteliste', label: 'Gästeliste',         icon: Users },
  { key: 'musik',       label: 'Musik',              icon: Music2 },
  { key: 'dekoration',  label: 'Dekoration',         icon: Flower2 },
  { key: 'medien',      label: 'Foto & Videograf',   icon: Camera },
  { key: 'sitzplan',    label: 'Sitzplan',           icon: Grid2X2 },
  { key: 'files',       label: 'Dokumente',          icon: FileText },
]

export default function VendorSidebarLayout({ eventId, eventTitle, eventDate, children, initialTabPerms }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tabPerms, setTabPerms] = useState(initialTabPerms)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Re-sync permissions on focus (so changes by Veranstalter are reflected quickly)
  useEffect(() => {
    const supabase = createClient()
    const refetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('dienstleister_permissions')
        .select('tab_key, access')
        .eq('event_id', eventId)
        .eq('dienstleister_user_id', user.id)
        .is('item_id', null)
      if (data) {
        const map: Record<string, 'none' | 'read' | 'write'> = {}
        data.forEach(r => { map[r.tab_key] = r.access as 'none' | 'read' | 'write' })
        setTabPerms(map)
      }
    }
    window.addEventListener('focus', refetch)
    return () => window.removeEventListener('focus', refetch)
  }, [eventId])

  const base = `/vendor/dashboard/${eventId}`
  const visibleItems = ALL_NAV_ITEMS.filter(item => (tabPerms[item.key] ?? 'none') !== 'none')

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
          href="/vendor/dashboard"
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
          {visibleItems.map(({ key, label, icon: Icon }) => {
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
        </div>
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 0 4px', marginTop: 4 }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '8px 10px', borderRadius: 8, width: '100%',
              fontSize: 14, color: 'var(--text-secondary)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
            }}
          >
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
      `}</style>
    </div>
  )
}

