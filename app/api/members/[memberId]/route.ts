// app/api/members/[memberId]/route.ts
// DELETE — entfernt Mitglied aus dem Event (nur event_members-Row).
// Auth-User + Profil bleiben unangetastet. Schutz: Caller muss das Ziel-Mitglied
// per can_manage_member() managen dürfen, und das letzte verbleibende
// veranstalter-Mitglied darf nicht entfernt werden.
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _request: Request,
  { params }: { params: { memberId: string } }
) {
  const memberId = params.memberId
  if (!memberId) {
    return NextResponse.json({ error: 'memberId fehlt' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const admin = createAdminClient()

  // 1. Target-Member laden
  const { data: target } = await admin
    .from('event_members')
    .select('id, event_id, user_id, role')
    .eq('id', memberId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  // 2. Caller-Rolle im selben Event prüfen
  const { data: caller } = await admin
    .from('event_members')
    .select('role')
    .eq('event_id', target.event_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!caller) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const callerRole = caller.role as string
  const targetRole = target.role as string

  // 3. Rollen-Guard (spiegelt can_manage_member() wider)
  const allowed =
    callerRole === 'veranstalter' ||
    (callerRole === 'brautpaar' && targetRole === 'trauzeuge')

  if (!allowed) {
    return NextResponse.json({ error: 'Keine Berechtigung für diese Rolle' }, { status: 403 })
  }

  // 4. Letzter Veranstalter darf nicht entfernt werden
  if (targetRole === 'veranstalter') {
    const { count } = await admin
      .from('event_members')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', target.event_id)
      .eq('role', 'veranstalter')
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Letzter Veranstalter kann nicht entfernt werden' },
        { status: 400 },
      )
    }
  }

  // 5. Löschen
  const { error: delErr } = await admin
    .from('event_members')
    .delete()
    .eq('id', memberId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
