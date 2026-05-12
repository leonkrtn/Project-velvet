import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import CateringTabContent from '@/components/tabs/CateringTabContent'

interface Props { params: Promise<{ eventId: string }> }

export default async function VendorCateringPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [tabPermRes, itemPermsRes, cateringCostsRes] = await Promise.all([
    supabase
      .from('dienstleister_permissions')
      .select('access')
      .eq('event_id', eventId)
      .eq('dienstleister_user_id', user.id)
      .eq('tab_key', 'catering')
      .is('item_id', null)
      .maybeSingle(),
    supabase
      .from('dienstleister_permissions')
      .select('item_id, access')
      .eq('event_id', eventId)
      .eq('dienstleister_user_id', user.id)
      .eq('tab_key', 'catering')
      .not('item_id', 'is', null),
    admin
      .from('event_organizer_costs')
      .select('id, category, price_per_person, notes')
      .eq('event_id', eventId)
      .eq('source', 'catering')
      .order('created_at', { ascending: true }),
  ])

  const tabAccess = (tabPermRes.data?.access ?? 'none') as 'none' | 'read' | 'write'
  if (tabAccess === 'none') redirect(`/vendor/dashboard/${eventId}/uebersicht`)

  const itemPermissions: Record<string, 'none' | 'read' | 'write'> = {}
  for (const r of itemPermsRes.data ?? []) {
    if (r.item_id) itemPermissions[r.item_id] = r.access as 'none' | 'read' | 'write'
  }

  return (
    <CateringTabContent
      eventId={eventId}
      mode="dienstleister"
      tabAccess={tabAccess}
      itemPermissions={itemPermissions}
      initialCosts={cateringCostsRes.data ?? []}
    />
  )
}
