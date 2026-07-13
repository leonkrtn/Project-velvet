import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildReportData, type ReportData, type ReportPeriod } from '@/lib/vendor/monthly-report'
import ReportClient from './ReportClient'

export const metadata = { title: 'FOREVR | Dienstleister' }
export const dynamic = 'force-dynamic'

export default async function ReportPage() {
  let brandColor: string | null = null
  let initialData: ReportData | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const admin = createAdminClient()
      const { data: link } = await admin
        .from('user_dienstleister')
        .select('dienstleister_id, dienstleister_profiles(brand_color, company_name)')
        .eq('user_id', user.id)
        .maybeSingle()
      const profile = Array.isArray(link?.dienstleister_profiles) ? link?.dienstleister_profiles[0] : link?.dienstleister_profiles
      brandColor = (profile?.brand_color as string) || null

      if (link?.dienstleister_id) {
        const now = new Date()
        const period: ReportPeriod = { type: 'month', year: now.getFullYear(), value: now.getMonth() + 1 }
        initialData = await buildReportData(admin, user.id, link.dienstleister_id, (profile?.company_name as string) ?? '', period)
      }
    }
  } catch { /* Standard-Akzent + Client lädt selbst, wenn nicht ladbar */ }

  return <ReportClient brandColor={brandColor} initialData={initialData} />
}
