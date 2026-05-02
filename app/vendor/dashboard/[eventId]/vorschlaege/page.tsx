import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import VorschlaegeClient from '@/app/veranstalter/[eventId]/vorschlaege/VorschlaegeClient'

interface Props { params: Promise<{ eventId: string }> }

export default async function VendorVorschlaegePage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tabPerm } = await supabase
    .from('dienstleister_permissions')
    .select('access')
    .eq('event_id', eventId)
    .eq('dienstleister_user_id', user.id)
    .eq('tab_key', 'vorschlaege')
    .is('item_id', null)
    .single()

  const tabAccess = (tabPerm?.access ?? 'none') as 'none' | 'read' | 'write'
  if (tabAccess === 'none') redirect(`/vendor/dashboard/${eventId}/uebersicht`)

  const [membersRes, vendorsRes, hotelsRes, dekoRes] = await Promise.all([
    admin
      .from('event_members')
      .select('user_id, role, profiles!user_id(name)')
      .eq('event_id', eventId)
      .in('role', ['brautpaar', 'dienstleister']),
    supabase
      .from('organizer_vendor_suggestions')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
    supabase
      .from('organizer_hotel_suggestions')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
    supabase
      .from('deko_suggestions')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
  ])

  const dlUserIds = (membersRes.data ?? [])
    .filter(m => m.role === 'dienstleister')
    .map(m => m.user_id)
    .filter(Boolean) as string[]

  const categoryByUserId: Record<string, string> = {}
  if (dlUserIds.length > 0) {
    const { data: invitations } = await admin
      .from('event_invitations')
      .select('accepted_by, metadata')
      .eq('event_id', eventId)
      .eq('status', 'accepted')
      .in('accepted_by', dlUserIds)

    for (const inv of (invitations ?? [])) {
      if (inv.accepted_by) {
        const meta = inv.metadata as Record<string, string> | null
        if (meta?.category) categoryByUserId[inv.accepted_by] = meta.category
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allRecipients = (membersRes.data ?? []).map((m: any) => {
    const name = (Array.isArray(m.profiles) ? m.profiles[0]?.name : m.profiles?.name) as string | undefined
    const category = m.role === 'dienstleister' ? (categoryByUserId[m.user_id] ?? null) : null
    const label = name
      ? (category ? `${name} ${category}` : name)
      : (m.role === 'brautpaar' ? 'Brautpaar' : 'Dienstleister')
    return {
      userId: m.user_id as string,
      role: m.role as 'brautpaar' | 'dienstleister',
      label,
    }
  })

  return (
    <VorschlaegeClient
      eventId={eventId}
      userId={user.id}
      allRecipients={allRecipients}
      initialVendors={vendorsRes.data ?? []}
      initialHotels={hotelsRes.data ?? []}
      initialDeko={dekoRes.data ?? []}
    />
  )
}
