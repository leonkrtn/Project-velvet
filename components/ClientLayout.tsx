'use client'
import { usePathname } from 'next/navigation'
import FrozenBanner from './FrozenBanner'
import { EventProvider } from '@/lib/event-context'

// Hinweis: Das alte Brautpaar-Portal (AppHeader + BottomNav + EventProvider
// auf /brautpaar-Routen) existiert nicht mehr — /brautpaar ist nur noch ein
// Redirect in die neue Shell. Das Legacy-Chrome darf dort nicht mehr rendern,
// sonst blitzt beim Laden die alte Ansicht auf.
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const skipEventProvider =
    pathname.startsWith('/veranstalter') ||
    pathname.startsWith('/vendor') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/brautpaar') ||
    pathname === '/login' ||
    pathname === '/signup'

  if (skipEventProvider) {
    return <>{children}</>
  }

  return (
    <EventProvider>
      <FrozenBanner />
      {children}
    </EventProvider>
  )
}
