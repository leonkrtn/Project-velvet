'use client'
import { usePathname } from 'next/navigation'
import FrozenBanner from './FrozenBanner'
import { EventProvider } from '@/lib/event-context'
import { ConsentProvider } from '@/components/consent/ConsentProvider'
import CookieConsent from '@/components/consent/CookieConsent'
import AnalyticsGate from '@/components/consent/AnalyticsGate'
import ChunkReloadGuard from '@/components/ChunkReloadGuard'
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog'
import { BpToastProvider } from '@/components/ui/BpToast'

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

  const inner = skipEventProvider
    ? <>{children}</>
    : (
        <EventProvider>
          <FrozenBanner />
          {children}
        </EventProvider>
      )

  // Consent-Provider umschließt den GESAMTEN Baum (site-weit), damit das
  // Cookie-Banner überall erscheint und gegatete Embeds den Status lesen können.
  return (
    <ConsentProvider>
      <ChunkReloadGuard />
      <ConfirmDialogProvider>
        <BpToastProvider>
          {inner}
        </BpToastProvider>
      </ConfirmDialogProvider>
      <CookieConsent />
      <AnalyticsGate />
    </ConsentProvider>
  )
}
