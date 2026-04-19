import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MitgliederClient from './MitgliederClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function MitgliederPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: members } = await supabase
    .from('event_members')
    .select(`
      id, role, joined_at, display_name, invite_status,
      profiles(id, name, email)
    `)
    .eq('event_id', eventId)
    .order('joined_at', { ascending: true })

  if (members === null) redirect('/veranstalter')

  const membersNormalized = members.map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))

  // For Dienstleister: fetch vendor data linked via email match or event
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name, category, price, cost_label, email, phone, status, notes')
    .eq('event_id', eventId)

  return <MitgliederClient eventId={eventId} members={membersNormalized} vendors={vendors ?? []} />
}
