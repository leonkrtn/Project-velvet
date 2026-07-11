import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureQuestionnaire } from '@/lib/vendor/questionnaire-seed'
import OnboardingWizardClient from './OnboardingWizardClient'

export const dynamic = 'force-dynamic'

// Onboarding-Wizard: geführte Erst-Einrichtung des Marktplatz-Profils (<3 Min).
// Stellt (idempotent) sicher, dass ein Marktplatz-Profil existiert — auch für
// per E-Mail-Bestätigung erst später einsteigende Dienstleister.
export default async function VendorOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/onboarding')

  const admin = createAdminClient()
  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!link) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    await admin.from('profiles').update({ role: 'dienstleister' }).eq('id', user.id)
    const { data: vendor } = await admin
      .from('dienstleister_profiles')
      .insert({
        name: (meta.name as string)?.trim() || user.email?.split('@')[0] || 'Dienstleister',
        company_name: (meta.company_name as string)?.trim() || null,
        category: (meta.category as string)?.trim() || 'sonstiges',
        email: user.email ?? null,
        is_marketplace: true,
        published: false,
        moderation_status: 'draft',
        notify_new_request_email: true,
      })
      .select('id')
      .single()
    if (vendor) {
      await admin.from('user_dienstleister').insert({ user_id: user.id, dienstleister_id: vendor.id })
      await ensureQuestionnaire(admin, vendor.id, (meta.category as string)?.trim() || 'sonstiges')
    }
  } else {
    // Bestehendes Profil: Formular garantiert nachziehen, falls es fehlt.
    const { data: prof } = await admin.from('dienstleister_profiles').select('category').eq('id', link.dienstleister_id).maybeSingle()
    await ensureQuestionnaire(admin, link.dienstleister_id, (prof?.category as string) ?? 'sonstiges')
  }

  return <OnboardingWizardClient />
}
