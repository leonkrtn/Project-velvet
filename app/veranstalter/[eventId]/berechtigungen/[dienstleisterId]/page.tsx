import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureVendorConversation } from '@/lib/vendor/ensureChat'
import { redirect } from 'next/navigation'
import BerechtigungenDLClient, { type ShareRow } from './BerechtigungenClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ eventId: string; dienstleisterId: string }>
}

export default async function DienstleisterBerechtigungenPage({ params }: Props) {
  const { eventId, dienstleisterId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'veranstalter') redirect('/veranstalter')

  const { data: dlProfile } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('id', dienstleisterId)
    .maybeSingle()

  if (!dlProfile) redirect(`/veranstalter/${eventId}/mitglieder`)

  const { data: dlMember } = await supabase
    .from('event_members')
    .select('id, role')
    .eq('event_id', eventId)
    .eq('user_id', dienstleisterId)
    .single()

  if (!dlMember || dlMember.role !== 'dienstleister') redirect(`/veranstalter/${eventId}/mitglieder`)

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
    <BerechtigungenDLClient
      eventId={eventId}
      dienstleisterId={dienstleisterId}
      dienstleisterName={dlProfile.name ?? 'Dienstleister'}
      dienstleisterEmail={dlProfile.email ?? ''}
      conversationId={conversationId}
      initialShares={shares}
      chatHref={`/veranstalter/${eventId}/chats`}
    />
  )
}
