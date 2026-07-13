import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadVendorConversations } from '@/lib/vendor/nachrichten'
import NachrichtenClient from './NachrichtenClient'

export const dynamic = 'force-dynamic'

export default async function VendorNachrichtenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/nachrichten')

  const initialConvs = await loadVendorConversations(user.id)

  return <NachrichtenClient initialConvs={initialConvs} />
}
