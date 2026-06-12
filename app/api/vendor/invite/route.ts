import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient as createAdmin } from '@/lib/supabase/admin'
import { hasProAccess } from '@/lib/subscription'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const body = await req.json()
    const { eventId, category } = body as {
      eventId:  string
      category: string
    }

    if (!eventId || !category) {
      return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })
    }

    // Berechtigung prüfen
    const { data: member } = await supabase
      .from('event_members')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!member || !['veranstalter', 'brautpaar_solo'].includes(member.role as string)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    // Dienstleister einladen ist für Solo-Paare ein Pro-Feature
    if (member.role === 'brautpaar_solo' && !(await hasProAccess(eventId))) {
      return NextResponse.json(
        { error: 'Dienstleister einladen ist Teil von Forevr Pro. Upgradet euren Tarif, um euer Profi-Team dazuzuholen.', code: 'PRO_REQUIRED' },
        { status: 403 },
      )
    }

    const admin = createAdmin()
    const { data: invitation, error } = await admin
      .from('event_invitations')
      .insert({
        event_id:   eventId,
        role:       'dienstleister',
        created_by: user.id,
        metadata:   { category },
      })
      .select('code')
      .single()

    if (error || !invitation) {
      console.error('Einladung erstellen:', error)
      return NextResponse.json({ error: 'Einladung konnte nicht erstellt werden' }, { status: 500 })
    }

    return NextResponse.json({ code: invitation.code })
  } catch (err) {
    console.error('POST /api/vendor/invite:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
