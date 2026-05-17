import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — find or create a 1:1 conversation between two staff members
// Body: { eventId: string, targetStaffId: string }  (both are organizer_staff.id)
// Caller must be a staff member of the same organizer as the target.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const body = await request.json()
    const { eventId, targetStaffId } = body as { eventId: string; targetStaffId: string }
    if (!eventId || !targetStaffId) {
      return NextResponse.json({ error: 'eventId und targetStaffId erforderlich' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Load caller's staff record
    const { data: callerRow } = await admin
      .from('organizer_staff')
      .select('id, auth_user_id, organizer_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (!callerRow?.auth_user_id) {
      return NextResponse.json({ error: 'Kein Mitarbeiter-Konto gefunden' }, { status: 403 })
    }

    // Load target's staff record
    const { data: targetRow } = await admin
      .from('organizer_staff')
      .select('id, auth_user_id, organizer_id, name')
      .eq('id', targetStaffId)
      .maybeSingle()
    if (!targetRow?.auth_user_id) {
      return NextResponse.json({ error: 'Ziel-Mitarbeiter hat noch kein Login' }, { status: 400 })
    }

    // Both must belong to the same organizer
    if (callerRow.organizer_id !== targetRow.organizer_id) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    }

    // Check that staff chat is enabled for this organizer
    const { data: settings } = await admin
      .from('organizer_settings')
      .select('staff_chat_enabled')
      .eq('organizer_id', callerRow.organizer_id)
      .maybeSingle()
    if (!settings?.staff_chat_enabled) {
      return NextResponse.json({ error: 'Mitarbeiter-Chat ist nicht aktiviert' }, { status: 403 })
    }

    const callerAuthId = callerRow.auth_user_id
    const targetAuthId = targetRow.auth_user_id

    // Find existing 1:1 conversation between these two for this event
    const { data: existingConvs } = await admin
      .from('conversations')
      .select('id, conversation_participants(user_id)')
      .eq('event_id', eventId)
      .eq('is_staff_chat', true)

    let conversationId: string | null = null
    for (const conv of existingConvs ?? []) {
      const participants = (conv.conversation_participants as { user_id: string }[]).map(p => p.user_id)
      if (
        participants.includes(callerAuthId) &&
        participants.includes(targetAuthId) &&
        participants.length === 2
      ) {
        conversationId = conv.id
        break
      }
    }

    if (!conversationId) {
      const { data: newConv, error: convErr } = await admin
        .from('conversations')
        .insert({
          event_id: eventId,
          name: targetRow.name,
          created_by: callerAuthId,
          is_staff_chat: true,
        })
        .select('id')
        .single()
      if (convErr || !newConv) throw convErr ?? new Error('Conversation creation failed')

      conversationId = newConv.id
      await admin.from('conversation_participants').insert([
        { conversation_id: conversationId, user_id: callerAuthId },
        { conversation_id: conversationId, user_id: targetAuthId },
      ])
    }

    return NextResponse.json({ conversationId })
  } catch (err) {
    console.error('[staff/direct-chat]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
