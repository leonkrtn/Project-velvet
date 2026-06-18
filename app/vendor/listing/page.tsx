import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import VendorListingClient from './VendorListingClient'

export const dynamic = 'force-dynamic'

// Anbieter-Portal: Selbstverwaltung des eigenen Marktplatz-Listings.
// Stellt (idempotent) sicher, dass ein Marktplatz-Profil existiert — auch für
// vormals nur per Event eingeladene Dienstleister ("ein Profil, beide Welten").
export default async function VendorListingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/listing')

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
      })
      .select('id')
      .single()
    if (vendor) {
      await admin.from('user_dienstleister').insert({ user_id: user.id, dienstleister_id: vendor.id })
    }
  } else {
    // Vorhandenes (evtl. nur Event-)Profil für den Marktplatz freischalten.
    await admin
      .from('dienstleister_profiles')
      .update({ is_marketplace: true })
      .eq('id', link.dienstleister_id)
      .eq('is_marketplace', false)
  }

  return <VendorListingClient />
}
