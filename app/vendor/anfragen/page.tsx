import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadVendorRequests } from '@/lib/vendor/anfragen'
import VendorAnfragenClient, { type Req } from './VendorAnfragenClient'

export const dynamic = 'force-dynamic'

export default async function VendorAnfragenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/anfragen')

  const { requests, isVendor } = await loadVendorRequests(user.id)

  return <VendorAnfragenClient initialRequests={requests as Req[]} initialIsVendor={isVendor} />
}
