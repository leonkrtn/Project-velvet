import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VendorAnfragenClient from './VendorAnfragenClient'

export const dynamic = 'force-dynamic'

export default async function VendorAnfragenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/anfragen')
  return <VendorAnfragenClient />
}
