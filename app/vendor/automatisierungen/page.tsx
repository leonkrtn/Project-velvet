import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AutomationsClient from './AutomationsClient'

export const dynamic = 'force-dynamic'

export default async function AutomatisierungenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/automatisierungen')

  const admin = createAdminClient()
  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!link) redirect('/vendor/listing')

  return <AutomationsClient />
}
