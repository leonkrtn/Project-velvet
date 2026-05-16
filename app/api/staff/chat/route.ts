import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — find or create a 1:1 conversation between a staff member and their organizer
// Body: { eventId: string, staffId: string }  (staffId = organizer_staff.id)
// Can be called by either the organizer or the staff member themselves.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const body = await request.json()
    const { eventId, staffId } = body as { eventId: string; staffId: string }
    if (!eventId || !staffId) return NextResponse.json({ error: 'eventId und staffId erforderlich' }, { status: 400 })

    const admin = createAdminClient()

    // Load the staff record to get both participant IDs
    const { data: staffRow } = await admin
      .from('organizer_staff')
      .select('id, auth_user_id, organizer_id')
      .eq('id', staffId)
      .maybeSingle()
    if (!staffRow) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })

    // Verify caller is either the organizer or the staff member
    const isOrganizer = user.id === staffRow.organizer_id
    const isStaff = user.id === staffRow.auth_user_id
    if (!isOrganizer && !isStaff) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    }

    if (!staffRow.auth_user_id) {
      return NextResponse.json({ error: 'Mitarbeiter hat noch kein Login' }, { status: 400 })
    }

    const staffAuthId = staffRow.auth_user_id
    const organizerAuthId = staffRow.organizer_id

    // Find an existing 1:1 conversation for this event with exactly these two participants
    // Strategy: find conversations for this event where both users are participants
    const { data: existingConvs } = await admin
      .from('conversations')
      .select('id, conversation_participants(user_id)')
      .eq('event_id', eventId)

    let conversationId: string | null = null

    for (const conv of existingConvs ?? []) {
      const participants = (conv.conversation_participants as { user_id: string }[]).map(p => p.user_id)
      const hasStaff = participants.includes(staffAuthId)
      const hasOrganizer = participants.includes(organizerAuthId)
      if (hasStaff && hasOrganizer && participants.length === 2) {
        conversationId = conv.id
        break
      }
    }

    if (!conversationId) {
      // Create conversation using admin client (bypasses RLS)
      const { data: staffProfile } = await admin
        .from('profiles')
        .select('name')
        .eq('id', staffAuthId)
        .maybeSingle()
      const staffName = staffProfile?.name ?? 'Mitarbeiter'

      const { data: newConv, error: convErr } = await admin
        .from('conversations')
        .insert({
          event_id: eventId,
          name: `Chat · ${staffName}`,
          created_by: organizerAuthId,
          is_staff_chat: true,
        })
        .select('id')
        .single()
      if (convErr || !newConv) throw convErr ?? new Error('Conversation creation failed')

      conversationId = newConv.id

      // Add both participants
      await admin.from('conversation_participants').insert([
        { conversation_id: conversationId, user_id: staffAuthId },
        { conversation_id: conversationId, user_id: organizerAuthId },
      ])
    }

    return NextResponse.json({ conversationId })
  } catch (err) {
    console.error('[staff/chat]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
