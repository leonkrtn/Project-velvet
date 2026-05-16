import { Suspense } from 'react'
import KonfigurationClient from './KonfigurationClient'

function KonfigurationSkeleton() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px' }}>
      <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 44, marginBottom: 20 }} />
      <div className="skeleton" style={{ height: 300 }} />
    </div>
  )
}

export default function KonfigurationPage() {
  return (
    <Suspense fallback={<KonfigurationSkeleton />}>
      <KonfigurationClient />
    </Suspense>
  )
}
