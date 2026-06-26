import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'FOREVR | Veranstalter' }

export default function VeranstalterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
