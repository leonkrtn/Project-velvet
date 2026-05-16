import { Suspense } from 'react'
import KonfigurationClient from './KonfigurationClient'

export default function KonfigurationPage() {
  return (
    <Suspense>
      <KonfigurationClient />
    </Suspense>
  )
}
