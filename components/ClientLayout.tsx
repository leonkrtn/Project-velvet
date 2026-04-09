'use client'
import { usePathname } from 'next/navigation'
import AppHeader from './AppHeader'
import { EventProvider } from '@/lib/event-context'

// Pages with their own header or no header at all
const NO_HEADER = ['/einstellungen', '/onboarding', '/']

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showHeader = !NO_HEADER.includes(pathname)
  return (
    <EventProvider>
      {showHeader && <AppHeader />}
      {children}
    </EventProvider>
  )
}
