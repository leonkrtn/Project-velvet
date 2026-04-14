'use client'
import { usePathname } from 'next/navigation'
import AppHeader from './AppHeader'
import BottomNav from './BottomNav'
import FrozenBanner from './FrozenBanner'
import { EventProvider } from '@/lib/event-context'

const NO_CHROME = ['/einstellungen', '/onboarding', '/', '/login', '/signup', '/bewerbung']
const NO_NAV    = [...NO_CHROME, '/rsvp']

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showHeader  = !NO_CHROME.some(p => pathname === p || pathname.startsWith('/rsvp'))
  const showBottomNav = !NO_NAV.some(p => pathname === p || pathname.startsWith('/rsvp'))
  return (
    <EventProvider>
      {showHeader && <AppHeader />}
      <FrozenBanner />
      {children}
      {showBottomNav && <BottomNav />}
    </EventProvider>
  )
}
