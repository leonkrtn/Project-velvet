import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MitgliederClient from './MitgliederClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function MitgliederPage({ params }: Props) {
  const { eventId } = await params
  const admin = createAdminClient()

  const { data: members, error } = await admin
    .from('event_members')
    .select(`
      id, role, display_name, invite_status,
      profiles(id, name, email)
    `)
    .eq('event_id', eventId)
    .order('id', { ascending: true })

  if (error || members === null) redirect('/veranstalter')

  const membersNormalized = members.map(m => ({
    ...m,
    joined_at: null as string | null,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))

  // For Dienstleister: fetch vendor data linked via email match or event
  const { data: vendors } = await admin
    .from('vendors')
    .select('id, name, category, price, cost_label, email, phone, status, notes')
    .eq('event_id', eventId)

  return <MitgliederClient eventId={eventId} members={membersNormalized} vendors={vendors ?? []} />
}
