import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'FOREVR | Brautpaar' }

export default function BrautpaarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
