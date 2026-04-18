// app/api/members/[memberId]/reset-password/route.ts
// POST — sendet Recovery-Mail an das Mitglied. Kein direktes Passwort-Setzen;
// Mitglied setzt sein neues Passwort über den Supabase-Recovery-Flow selbst.
// Gate: Caller muss das Mitglied managen dürfen (veranstalter, oder brautpaar für trauzeuge).
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
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

  // 1. Target-Member + E-Mail laden
  const { data: target } = await admin
    .from('event_members')
    .select('id, event_id, user_id, role, profiles(email)')
    .eq('id', memberId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  const email = (target as any).profiles?.email
  if (!email) {
    return NextResponse.json({ error: 'E-Mail unbekannt — Reset nicht möglich' }, { status: 400 })
  }

  // 2. Caller-Rolle prüfen
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
  const allowed =
    callerRole === 'veranstalter' ||
    (callerRole === 'brautpaar' && targetRole === 'trauzeuge')

  if (!allowed) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // 3. Recovery-Link generieren — Supabase verschickt die Mail automatisch,
  //    sofern SMTP/Auth-Email-Templates konfiguriert sind.
  const origin = new URL(request.url).origin
  const { error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${origin}/reset-password` },
  })

  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email })
}
