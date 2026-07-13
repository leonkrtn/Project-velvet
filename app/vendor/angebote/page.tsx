import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadVendorGlobalOffers } from '@/lib/vendor/global-offers'
import AngeboteGlobalClient from './AngeboteGlobalClient'

export const dynamic = 'force-dynamic'

export default async function VendorAngebotePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/angebote')

  const initialOffers = await loadVendorGlobalOffers(user.id)

  return <AngeboteGlobalClient initialOffers={initialOffers as never} />
}
