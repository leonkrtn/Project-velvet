import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GlobalVendorShell from '@/components/vendor/GlobalVendorShell'
import AngeboteGlobalClient from './AngeboteGlobalClient'

export const dynamic = 'force-dynamic'

export default async function VendorAngebotePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/angebote')

  return (
    <GlobalVendorShell>
      <AngeboteGlobalClient />
    </GlobalVendorShell>
  )
}
