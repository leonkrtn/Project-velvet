import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import GlobalVendorShell from '@/components/vendor/GlobalVendorShell'
import FragebogenBuilderClient from './FragebogenBuilderClient'

export const dynamic = 'force-dynamic'

export default async function AnfrageFormularPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/anfrage-formular')

  const admin = createAdminClient()
  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id, dienstleister_profiles(category)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!link) redirect('/vendor/listing')

  const profile = Array.isArray(link.dienstleister_profiles) ? link.dienstleister_profiles[0] : link.dienstleister_profiles

  return (
    <GlobalVendorShell>
      <FragebogenBuilderClient category={(profile?.category as string) ?? 'sonstiges'} />
    </GlobalVendorShell>
  )
}
