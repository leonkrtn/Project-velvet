'use client'
import { usePathname } from 'next/navigation'
import AppHeader from './AppHeader'
import BottomNav from './BottomNav'
import FrozenBanner from './FrozenBanner'
import { EventProvider } from '@/lib/event-context'

const NO_CHROME_EXACT = ['/onboarding', '/', '/login', '/signup', '/bewerbung']
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBrautpaar = pathname.startsWith('/brautpaar')
  const showHeader    = isBrautpaar && pathname !== '/brautpaar/einstellungen'
  const showBottomNav = isBrautpaar && pathname !== '/brautpaar/einstellungen'
  const skipEventProvider =
    pathname.startsWith('/veranstalter') ||
    pathname.startsWith('/vendor') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname === '/login' ||
    pathname === '/signup'

  if (skipEventProvider) {
    return <>{children}</>
  }

  return (
    <EventProvider>
      {showHeader && <AppHeader />}
      <FrozenBanner />
      {children}
      {showBottomNav && <BottomNav />}
    </EventProvider>
  )
}
