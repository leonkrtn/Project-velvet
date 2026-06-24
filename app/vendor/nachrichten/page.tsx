import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GlobalVendorShell from '@/components/vendor/GlobalVendorShell'
import NachrichtenClient from './NachrichtenClient'

export const dynamic = 'force-dynamic'

export default async function VendorNachrichtenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/nachrichten')

  return (
    <GlobalVendorShell>
      <NachrichtenClient />
    </GlobalVendorShell>
  )
}
