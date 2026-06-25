import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UbersichtClient from './UbersichtClient'

export const dynamic = 'force-dynamic'

export default async function VendorUbersichtPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/ubersicht')

  return <UbersichtClient />
}
