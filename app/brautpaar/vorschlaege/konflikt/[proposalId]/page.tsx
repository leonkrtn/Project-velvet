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

  const { data: member } = await supabase
    .from('event_members')
    .select('event_id, role')
    .eq('user_id', user.id)
    .eq('role', 'brautpaar')
    .limit(1)
    .single()

  if (!member) redirect('/brautpaar')

  const eventId = member.event_id

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
    redirect('/brautpaar/vorschlaege')
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
        currentUserRole="brautpaar"
        myStatus={recipient?.status ?? null}
        backUrl="/brautpaar/vorschlaege"
      />
    </div>
  )
}
