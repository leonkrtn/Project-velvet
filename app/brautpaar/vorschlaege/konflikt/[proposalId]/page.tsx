import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import KonfliktClient from '@/app/veranstalter/[eventId]/dienstleister-vorschlaege/konflikt/[proposalId]/KonfliktClient'

interface Props {
  params: Promise<{ proposalId: string }>
}

export default async function BrautpaarKonfliktPage({ params }: Props) {
  const { proposalId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Find which event the user belongs to as brautpaar
  const { data: member } = await supabase
    .from('event_members')
    .select('event_id, role')
    .eq('user_id', user.id)
    .eq('role', 'brautpaar')
    .limit(1)
    .single()

  if (!member) redirect('/brautpaar')

  const eventId = member.event_id

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
    redirect('/brautpaar/vorschlaege')
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
    <div style={{ padding: '28px 20px 80px', maxWidth: 900, margin: '0 auto' }}>
      <KonfliktClient
        eventId={eventId}
        proposal={proposalRes.data}
        conflict={conflictRes.data}
        submissions={submissions ?? []}
        responses={responses ?? []}
        currentUserId={user.id}
        currentUserRole="brautpaar"
        members={memberList}
      />
    </div>
  )
}
