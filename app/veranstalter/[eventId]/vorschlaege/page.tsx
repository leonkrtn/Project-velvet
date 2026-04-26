import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import VorschlaegeClient from './VorschlaegeClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function VorschlaegePage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  const membersRes = await admin
    .from('event_members')
    .select('user_id, role, profiles!user_id(name)')
    .eq('event_id', eventId)
    .in('role', ['brautpaar', 'dienstleister'])

  // Fetch invitation categories for dienstleister (same as chats page)
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
      userId={user?.id ?? ''}
      allRecipients={allRecipients}
    />
  )
}
