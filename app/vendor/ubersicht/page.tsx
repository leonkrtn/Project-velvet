import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadVendorUbersicht } from '@/lib/vendor/ubersicht'
import UbersichtClient from './UbersichtClient'

export const dynamic = 'force-dynamic'

export default async function VendorUbersichtPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/ubersicht')

  const initialData = await loadVendorUbersicht(user.id)

  return <UbersichtClient initialData={initialData} />
}
