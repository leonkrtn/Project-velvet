'use client'
import React, { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Users, Hotel, Utensils, MessageCircle } from 'lucide-react'
import { useEvent } from '@/lib/event-context'
import { DEFAULT_FEATURE_TOGGLES } from '@/lib/store'
import type { FeatureKey } from '@/lib/store'

const TAB_KEY = 'velvet_dashboard_tab'

type NavItem = {
  label: string
  icon: LucideIcon
  href: string
  dashTab?: string
  featureKey?: FeatureKey  // hide if this feature is disabled
}

const ITEMS: NavItem[] = [
  { label: 'Übersicht', icon: LayoutDashboard, href: '/dashboard',    dashTab: 'overview' },
  { label: 'Gäste',     icon: Users,           href: '/gaeste' },
  { label: 'Hotel',     icon: Hotel,           href: '/dashboard',    dashTab: 'hotel' },
  { label: 'Catering',  icon: Utensils,        href: '/dashboard',    dashTab: 'catering', featureKey: 'catering' },
  { label: 'Nachrichten', icon: MessageCircle, href: '/nachrichten',  featureKey: 'messaging' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const { event } = useEvent()
  const featureToggles = { ...DEFAULT_FEATURE_TOGGLES, ...event?.organizer?.featureToggles }
  const [dashTab, setDashTab] = useState('overview')

  // Sync dashboard tab from sessionStorage
  useEffect(() => {
    const read = () => {
      const t = sessionStorage.getItem(TAB_KEY)
      if (t) setDashTab(t)
    }
    read()
    window.addEventListener('velvet-tab-change', read)
    return () => window.removeEventListener('velvet-tab-change', read)
  }, [])

  const isActive = (item: NavItem) => {
    if (item.href === '/dashboard' && pathname === '/dashboard') {
      return dashTab === (item.dashTab ?? 'overview')
    }
    return pathname === item.href && !item.dashTab
  }

  const handleClick = (item: NavItem) => {
    if (item.dashTab) {
      sessionStorage.setItem(TAB_KEY, item.dashTab)
      window.dispatchEvent(new Event('velvet-tab-change'))
      if (pathname !== '/dashboard') {
        router.push('/dashboard')
      }
    } else {
      router.push(item.href)
    }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--surface)', borderTop: '1px solid var(--border)',
      zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 0', maxWidth: 480, margin: '0 auto' }}>
        {ITEMS.filter(item => !item.featureKey || featureToggles[item.featureKey]).map(item => {
          const active = isActive(item)
          return (
            <button
              key={item.label + (item.dashTab ?? '')}
              onClick={() => handleClick(item)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                color: active ? 'var(--gold)' : 'var(--text-dim)',
                fontSize: 10, fontWeight: 600, padding: '4px 16px',
                transition: 'color 0.15s', fontFamily: 'inherit',
              }}
            >
              <item.icon size={19} />
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
