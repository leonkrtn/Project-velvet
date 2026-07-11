import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ReportClient from './ReportClient'

export const metadata = { title: 'FOREVR | Dienstleister' }
export const dynamic = 'force-dynamic'

export default async function ReportPage() {
  let brandColor: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const admin = createAdminClient()
      const { data: link } = await admin
        .from('user_dienstleister')
        .select('dienstleister_profiles(brand_color)')
        .eq('user_id', user.id)
        .maybeSingle()
      const profile = Array.isArray(link?.dienstleister_profiles) ? link?.dienstleister_profiles[0] : link?.dienstleister_profiles
      brandColor = (profile?.brand_color as string) || null
    }
  } catch { /* Standard-Akzent, wenn nicht ladbar */ }

  return <ReportClient brandColor={brandColor} />
}
