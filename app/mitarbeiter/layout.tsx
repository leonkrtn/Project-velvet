import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'FOREVR | Admin' }

export default function MitarbeiterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
