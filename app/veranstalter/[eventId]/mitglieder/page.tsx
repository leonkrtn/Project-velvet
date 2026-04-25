import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MitgliederClient from './MitgliederClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function MitgliederPage({ params }: Props) {
  const { eventId } = await params
  const admin = createAdminClient()

  const { data: members, error } = await admin
    .from('event_members')
    .select(`
      id, user_id, role, display_name, invite_status, show_in_contacts,
      profiles!user_id(id, name, email, phone)
    `)
    .eq('event_id', eventId)
    .order('id', { ascending: true })

  if (error || members === null) redirect('/veranstalter')

  const membersNormalized = members.map(m => ({
    ...m,
    joined_at: null as string | null,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))

  const dlUserIds = membersNormalized
    .filter(m => m.role === 'dienstleister')
    .map(m => m.user_id)
    .filter(Boolean) as string[]

  const [vendorsRes, invitationsRes, permissionsRes] = await Promise.all([
    admin
      .from('vendors')
      .select('id, name, category, price, cost_label, email, phone, status, notes')
      .eq('event_id', eventId),
    dlUserIds.length > 0
      ? admin
          .from('event_invitations')
          .select('id, accepted_by, metadata')
          .eq('event_id', eventId)
          .eq('status', 'accepted')
          .in('accepted_by', dlUserIds)
      : Promise.resolve({ data: [] }),
    dlUserIds.length > 0
      ? admin
          .from('permissions')
          .select('user_id, permission')
          .eq('event_id', eventId)
          .in('user_id', dlUserIds)
      : Promise.resolve({ data: [] }),
  ])

  const categoryByUserId: Record<string, { id: string; category: string | null }> = {}
  for (const inv of (invitationsRes.data ?? [])) {
    if (inv.accepted_by) {
      categoryByUserId[inv.accepted_by] = {
        id: inv.id,
        category: (inv.metadata as Record<string, string> | null)?.category ?? null,
      }
    }
  }

  const permissionsByUserId: Record<string, string[]> = {}
  for (const perm of (permissionsRes.data ?? [])) {
    if (!permissionsByUserId[perm.user_id]) permissionsByUserId[perm.user_id] = []
    permissionsByUserId[perm.user_id].push(perm.permission)
  }

  const membersWithMeta = membersNormalized.map(m => ({
    ...m,
    invitation_id: m.user_id ? (categoryByUserId[m.user_id]?.id ?? null) : null,
    invitation_category: m.user_id ? (categoryByUserId[m.user_id]?.category ?? null) : null,
    current_permissions: m.user_id ? (permissionsByUserId[m.user_id] ?? []) : [],
    show_in_contacts: m.show_in_contacts ?? false,
  }))

  return (
    <MitgliederClient
      eventId={eventId}
      members={membersWithMeta}
      vendors={vendorsRes.data ?? []}
    />
  )
}
