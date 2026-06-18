import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildModuleSnapshot } from '@/lib/vendor/snapshot'
import { SHARE_MODULE_LABELS, isShareModule, type ShareMode } from '@/lib/vendor/shares'

const COUPLE_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

// GET /api/vendor/shares?conversationId=...  → list active/frozen shares for a conversation
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const conversationId = req.nextUrl.searchParams.get('conversationId')
  if (!conversationId) return NextResponse.json({ error: 'conversationId fehlt' }, { status: 400 })

  // RLS restricts rows to conversation participants.
  const { data, error } = await supabase
    .from('dienstleister_data_shares')
    .select('id, event_id, conversation_id, module, mode, status, shared_by, message_id, created_at, updated_at')
    .eq('conversation_id', conversationId)
    .neq('status', 'revoked')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shares: data ?? [] })
}

// POST /api/vendor/shares  { conversationId, module, mode }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const { conversationId, module, mode } = await req.json() as {
      conversationId: string; module: string; mode: ShareMode
    }
    if (!conversationId || !module || !isShareModule(module)) {
      return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
    }
    if (mode !== 'snapshot' && mode !== 'live') {
      return NextResponse.json({ error: 'Ungültiger Modus' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Resolve conversation + event, and verify the caller may share (couple/organizer + participant).
    const { data: conv } = await admin
      .from('conversations')
      .select('id, event_id')
      .eq('id', conversationId)
      .maybeSingle()
    if (!conv) return NextResponse.json({ error: 'Chat nicht gefunden' }, { status: 404 })

    const { data: member } = await admin
      .from('event_members')
      .select('role')
      .eq('event_id', conv.event_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!member || !COUPLE_ROLES.includes(member.role as string)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const { data: isParticipant } = await admin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!isParticipant) {
      return NextResponse.json({ error: 'Du bist kein Teilnehmer dieses Chats' }, { status: 403 })
    }

    // Snapshot mode captures data now; live mode rebuilds on every read.
    const snapshot = mode === 'snapshot'
      ? await buildModuleSnapshot(admin, conv.event_id, module)
      : null

    const { data: share, error: shareErr } = await admin
      .from('dienstleister_data_shares')
      .insert({
        event_id: conv.event_id,
        conversation_id: conversationId,
        module,
        mode,
        status: 'active',
        snapshot,
        shared_by: user.id,
      })
      .select('id')
      .single()
    if (shareErr || !share) {
      console.error('[vendor/shares] insert share', shareErr)
      return NextResponse.json({ error: 'Teilen fehlgeschlagen' }, { status: 500 })
    }

    const label = SHARE_MODULE_LABELS[module]
    const content = mode === 'live'
      ? `${label} wird jetzt live geteilt`
      : `${label} als Auszug geteilt`

    const { data: msg } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        event_id: conv.event_id,
        sender_id: user.id,
        content,
        message_type: 'data_share',
        metadata: { share_id: share.id, module, mode },
      })
      .select('id')
      .single()

    if (msg) {
      await admin.from('dienstleister_data_shares').update({ message_id: msg.id }).eq('id', share.id)
    }
    await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

    return NextResponse.json({ shareId: share.id, messageId: msg?.id ?? null })
  } catch (err) {
    console.error('[vendor/shares] POST', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
