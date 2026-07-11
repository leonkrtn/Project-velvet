import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id, dienstleister_profiles(company_name, moderation_status)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!link) return NextResponse.json({ companyName: '', pendingAnfragen: 0, unreadNachrichten: 0, moderationStatus: null })

  const profile = Array.isArray(link.dienstleister_profiles) ? link.dienstleister_profiles[0] : link.dienstleister_profiles

  const { count: pendingAnfragen } = await admin
    .from('marketplace_requests')
    .select('*', { count: 'exact', head: true })
    .eq('dienstleister_id', link.dienstleister_id)
    .eq('status', 'pending')

  // Unread: count conversations with messages newer than last read
  const { data: convParticipants } = await admin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user.id)

  let unreadNachrichten = 0
  if (convParticipants && convParticipants.length > 0) {
    const convIds = convParticipants.map(p => p.conversation_id)
    const { count } = await admin
      .from('messages')
      .select('conversation_id', { count: 'exact', head: true })
      .in('conversation_id', convIds)
      .neq('sender_id', user.id)
      .gt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    unreadNachrichten = count ?? 0
  }

  return NextResponse.json({
    companyName: profile?.company_name ?? '',
    pendingAnfragen: pendingAnfragen ?? 0,
    unreadNachrichten,
    moderationStatus: profile?.moderation_status ?? null,
  })
}
