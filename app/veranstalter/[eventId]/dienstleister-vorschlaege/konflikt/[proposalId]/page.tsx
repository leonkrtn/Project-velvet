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

  const [{ data: proposal }, { data: caseData }, { data: recipient }] = await Promise.all([
    supabase
      .from('proposals')
      .select('module, title')
      .eq('id', proposalId)
      .eq('event_id', eventId)
      .single(),
    supabase
      .from('cases')
      .select('id, status')
      .eq('proposal_id', proposalId)
      .single(),
    supabase
      .from('proposal_recipients')
      .select('status')
      .eq('proposal_id', proposalId)
      .eq('user_id', user.id)
      .single(),
  ])

  if (!proposal || !caseData) {
    redirect(`/veranstalter/${eventId}/dienstleister-vorschlaege`)
  }

  const { data: snapshot } = await supabase
    .from('proposal_snapshots')
    .select('snapshot_json')
    .eq('proposal_id', proposalId)
    .single()

  return (
    <div style={{ padding: '28px 20px 80px' }}>
      <KonfliktClient
        eventId={eventId}
        proposalId={proposalId}
        module={proposal.module}
        caseId={caseData.id}
        snapshotData={(snapshot?.snapshot_json as Record<string, unknown>) ?? null}
        currentUserId={user.id}
        currentUserRole={memberCheck.role}
        myStatus={recipient?.status ?? null}
        backUrl={`/veranstalter/${eventId}/dienstleister-vorschlaege`}
      />
    </div>
  )
}
