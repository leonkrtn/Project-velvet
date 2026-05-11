'use client'
import { usePathname } from 'next/navigation'
import AppHeader from './AppHeader'
import BottomNav from './BottomNav'
import FrozenBanner from './FrozenBanner'
import { EventProvider } from '@/lib/event-context'

const NO_CHROME_EXACT = ['/onboarding', '/', '/login', '/signup', '/bewerbung']
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isNewBrautpaarRoute = /^\/brautpaar\/[^/]+\/.+/.test(pathname)
  const isOldBrautpaar = pathname.startsWith('/brautpaar') && !isNewBrautpaarRoute
  const showHeader    = isOldBrautpaar && pathname !== '/brautpaar/einstellungen'
  const showBottomNav = isOldBrautpaar && pathname !== '/brautpaar/einstellungen'

  const skipEventProvider =
    pathname.startsWith('/veranstalter') ||
    pathname.startsWith('/vendor') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    isNewBrautpaarRoute ||
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
