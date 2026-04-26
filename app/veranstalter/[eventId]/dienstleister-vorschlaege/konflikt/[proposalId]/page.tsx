import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import KonfliktClient from './KonfliktClient'

interface Props {
  params: Promise<{ eventId: string; proposalId: string }>
}

export default async function KonfliktPage({ params }: Props) {
  const { eventId, proposalId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberCheck } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!memberCheck || !['veranstalter', 'brautpaar'].includes(memberCheck.role)) {
    redirect(`/veranstalter/${eventId}/uebersicht`)
  }

  const [proposalRes, conflictRes] = await Promise.all([
    supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .eq('event_id', eventId)
      .single(),
    supabase
      .from('proposal_conflicts')
      .select('*')
      .eq('proposal_id', proposalId)
      .eq('status', 'open')
      .single(),
  ])

  if (!proposalRes.data || !conflictRes.data) {
    redirect(`/veranstalter/${eventId}/dienstleister-vorschlaege`)
  }

  const { data: submissions } = await supabase
    .from('proposal_submissions')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at')

  const { data: responses } = await supabase
    .from('proposal_responses')
    .select('*')
    .in('submission_id', submissions?.map(s => s.id) ?? [])

  const { data: members } = await supabase
    .from('event_members')
    .select('user_id, role, profiles!user_id(name)')
    .eq('event_id', eventId)
    .in('role', ['veranstalter', 'brautpaar'])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberList = (members ?? []).map((m: any) => ({
    userId: m.user_id as string,
    role: m.role as 'veranstalter' | 'brautpaar',
    name: (Array.isArray(m.profiles) ? m.profiles[0]?.name : m.profiles?.name) ?? m.role,
  }))

  return (
    <KonfliktClient
      eventId={eventId}
      proposal={proposalRes.data}
      conflict={conflictRes.data}
      submissions={submissions ?? []}
      responses={responses ?? []}
      currentUserId={user.id}
      currentUserRole={memberCheck.role as 'veranstalter' | 'brautpaar'}
      members={memberList}
    />
  )
}
