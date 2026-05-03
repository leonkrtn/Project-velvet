import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GuestsTab from '@/app/vendor/dashboard/[eventId]/tabs/GuestsTab'

interface Props { params: Promise<{ eventId: string }> }

export default async function VendorGaestelistePage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tabPerm } = await supabase
    .from('dienstleister_permissions')
    .select('access')
    .eq('event_id', eventId)
    .eq('dienstleister_user_id', user.id)
    .eq('tab_key', 'gaesteliste')
    .is('item_id', null)
    .maybeSingle()

  const tabAccess = (tabPerm?.access ?? 'none') as 'none' | 'read' | 'write'
  if (tabAccess === 'none') redirect(`/vendor/dashboard/${eventId}/uebersicht`)

  const { data: sectionPermsData } = await supabase
    .from('dienstleister_permissions')
    .select('item_id, access')
    .eq('event_id', eventId)
    .eq('dienstleister_user_id', user.id)
    .eq('tab_key', 'gaesteliste')
    .not('item_id', 'is', null)

  const sectionPerms: Record<string, 'none' | 'read' | 'write'> = {}
  for (const r of sectionPermsData ?? []) {
    if (r.item_id) sectionPerms[r.item_id] = r.access as 'none' | 'read' | 'write'
  }

  return <GuestsTab eventId={eventId} tabAccess={tabAccess} sectionPerms={sectionPerms} />
}
