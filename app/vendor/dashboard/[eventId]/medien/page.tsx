import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MediaTabContent from '@/components/tabs/MediaTabContent'

interface Props { params: Promise<{ eventId: string }> }

export default async function VendorMedienPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tabPerm } = await supabase
    .from('dienstleister_permissions')
    .select('access')
    .eq('event_id', eventId)
    .eq('dienstleister_user_id', user.id)
    .eq('tab_key', 'medien')
    .is('item_id', null)
    .single()

  const tabAccess = (tabPerm?.access ?? 'none') as 'none' | 'read' | 'write'
  if (tabAccess === 'none') redirect(`/vendor/dashboard/${eventId}/uebersicht`)

  const { data: itemPermsData } = await supabase
    .from('dienstleister_permissions')
    .select('item_id, access')
    .eq('event_id', eventId)
    .eq('dienstleister_user_id', user.id)
    .eq('tab_key', 'medien')
    .not('item_id', 'is', null)

  const itemPermissions: Record<string, { can_view: boolean; can_edit: boolean }> = {}
  for (const r of itemPermsData ?? []) {
    if (r.item_id) {
      const access = r.access as 'none' | 'read' | 'write'
      itemPermissions[r.item_id] = {
        can_view: access !== 'none',
        can_edit: access === 'write',
      }
    }
  }

  return (
    <MediaTabContent
      eventId={eventId}
      mode="dienstleister"
      hasFullModuleAccess={tabAccess === 'write'}
      itemPermissions={itemPermissions}
    />
  )
}
