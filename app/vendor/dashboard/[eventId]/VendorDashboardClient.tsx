'use client'
import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Menu, X, CalendarDays, ChevronLeft } from 'lucide-react'
import { ALL_MODULES, MODULE_MAP } from '@/lib/vendor-modules'

// Tab-Komponenten
import ChatTab       from './tabs/ChatTab'
import TimelineTab   from './tabs/TimelineTab'
import LocationTab   from './tabs/LocationTab'
import GuestsTab     from './tabs/GuestsTab'
import SeatingTab    from './tabs/SeatingTab'
import CateringTab   from './tabs/CateringTab'
import PatisserieTab from './tabs/PatisserieTab'
import MediaTab      from './tabs/MediaTab'
import MusicTab      from './tabs/MusicTab'
import DecorTab      from './tabs/DecorTab'
import FilesTab      from './tabs/FilesTab'

// Registry: Permission-Key → Tab-Komponente. Kein if/else, kein switch.
const TAB_REGISTRY: Record<string, React.ComponentType<{ eventId: string }>> = {
  mod_chat:       ChatTab,
  mod_timeline:   TimelineTab,
  mod_location:   LocationTab,
  mod_guests:     GuestsTab,
  mod_seating:    SeatingTab,
  mod_catering:   CateringTab,
  mod_patisserie: PatisserieTab,
  mod_media:      MediaTab,
  mod_music:      MusicTab,
  mod_decor:      DecorTab,
  mod_files:      FilesTab,
}

interface Props {
  eventId:      string
  permissions:  string[]
  eventTitle:   string
  eventDate:    string | null
  initialTab:   string | null
}

export default function VendorDashboardClient({ eventId, permissions, eventTitle, eventDate, initialTab }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  // Nur freigeschaltete Module in der Reihenfolge von ALL_MODULES
  const visibleModules = ALL_MODULES.filter(m => permissions.includes(m.key))

  const defaultTab = visibleModules[0]?.key ?? ''
  const [activeTab, setActiveTab]       = useState(initialTab ?? defaultTab)
  const [mobileOpen, setMobileOpen]     = useState(false)

  // Sicherstellen dass activeTab ein erlaubtes Modul ist
  const resolvedTab = permissions.includes(activeTab) ? activeTab : defaultTab

  useEffect(() => {
    if (resolvedTab !== activeTab) setActiveTab(resolvedTab)
  }, [resolvedTab, activeTab])

  function navigate(key: string) {
    setActiveTab(key)
    setMobileOpen(false)
    router.replace(`${pathname}?tab=${key}`, { scroll: false })
  }

  const TabComponent = TAB_REGISTRY[resolvedTab] ?? null

  const sidebar = (
    <nav style={{
      width: 220, minWidth: 220,
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflowY: 'auto',
    }}>
      <div style={{ padding: '12px 12px 8px' }}>
        <button
          onClick={() => router.push('/vendor/dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 500,
            padding: '2px 0', marginBottom: 6, fontFamily: 'inherit',
          }}
        >
          <ChevronLeft size={14} />
          Alle Events
        </button>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
          Dienstleister-Portal
        </p>
      </div>

      <div style={{ padding: '0 12px 14px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.2px', lineHeight: 1.3 }}>
          {eventTitle}
        </p>
        {eventDate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, color: 'var(--text-secondary)', fontSize: 12 }}>
            <CalendarDays size={12} />
            {new Date(eventDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      <div style={{ padding: '8px 8px', flex: 1 }}>
        {visibleModules.map(({ key, label, icon: Icon }) => {
          const active = resolvedTab === key
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '8px 10px', borderRadius: 8, marginBottom: 1,
                fontSize: 14, fontWeight: active ? 500 : 450,
                color: 'var(--text-primary)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: active ? 'var(--surface)' : 'transparent',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                transition: 'background 0.12s',
                fontFamily: 'inherit',
              }}
            >
              <Icon size={16} style={{ opacity: active ? 1 : 0.5, flexShrink: 0 }} />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Desktop Sidebar */}
      <div className="sidebar-desktop" style={{ display: 'none' }}>
        {sidebar}
      </div>

      {/* Mobile Overlay */}
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

      {/* Hauptinhalt */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile Topbar */}
        <div className="mobile-topbar" style={{ display: 'none', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setMobileOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {MODULE_MAP[resolvedTab]?.label ?? eventTitle}
          </span>
        </div>

        <main style={{ flex: 1, padding: '36px 40px 60px', width: '100%', boxSizing: 'border-box' }}>
          {TabComponent ? (
            <TabComponent eventId={eventId} />
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Keine Berechtigung für diesen Bereich.
            </div>
          )}
        </main>
      </div>

      <style>{`
        @media (min-width: 768px) { .sidebar-desktop { display: block !important; } }
        @media (max-width: 767px) { .mobile-topbar { display: flex !important; } main { padding: 20px 16px !important; } }
      `}</style>
    </div>
  )
}
