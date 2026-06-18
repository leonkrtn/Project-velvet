export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureVendorConversation } from '@/lib/vendor/ensureChat'
import { redirect } from 'next/navigation'
import BerechtigungenDLClient, { type ShareRow } from '@/app/veranstalter/[eventId]/berechtigungen/[dienstleisterId]/BerechtigungenClient'

interface Props {
  params: Promise<{ eventId: string; dienstleisterId: string }>
}

// Datenfreigabe-Übersicht für Solo-Brautpaare — gleiche Komponente wie im
// Veranstalter-Portal (steuert dienstleister_data_shares; RLS via is_event_member).
export default async function SoloDienstleisterBerechtigungenPage({ params }: Props) {
  const { eventId, dienstleisterId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || member.role !== 'brautpaar_solo') redirect(`/brautpaar/${eventId}/uebersicht`)

  const { data: dlProfile } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('id', dienstleisterId)
    .maybeSingle()

  if (!dlProfile) redirect(`/brautpaar/${eventId}/dienstleister`)

  const { data: dlMember } = await supabase
    .from('event_members')
    .select('id, role')
    .eq('event_id', eventId)
    .eq('user_id', dienstleisterId)
    .maybeSingle()

  if (!dlMember || dlMember.role !== 'dienstleister') redirect(`/brautpaar/${eventId}/dienstleister`)

  const admin = createAdminClient()
  const conversationId = await ensureVendorConversation(admin, eventId, dienstleisterId)

  let shares: ShareRow[] = []
  if (conversationId) {
    const { data } = await admin
      .from('dienstleister_data_shares')
      .select('id, module, mode, status, created_at')
      .eq('conversation_id', conversationId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })
    shares = (data ?? []) as ShareRow[]
  }

  return (
    <div className="bp-page">
      <BerechtigungenDLClient
        eventId={eventId}
        dienstleisterId={dienstleisterId}
        dienstleisterName={dlProfile.name ?? 'Dienstleister'}
        dienstleisterEmail={dlProfile.email ?? ''}
        conversationId={conversationId}
        initialShares={shares}
        backHref={`/brautpaar/${eventId}/dienstleister`}
        backLabel="Zurück zu Dienstleister"
      />
    </div>
  )
}
