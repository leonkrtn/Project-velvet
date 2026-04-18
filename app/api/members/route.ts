// app/api/members/route.ts
// GET ?eventId=... — Mitgliederliste inkl. E-Mail für ein Event.
// Gate: Caller muss Mitglied (veranstalter/brautpaar/trauzeuge) des Events sein.
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const eventId = url.searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'eventId erforderlich' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const admin = createAdminClient()

  // Caller-Rolle prüfen
  const { data: caller } = await admin
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!caller || !['veranstalter', 'brautpaar'].includes(caller.role as string)) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  // Mitglieder laden — Service-Role, damit profiles.email garantiert kommt.
  const { data: rows, error } = await admin
    .from('event_members')
    .select('id, user_id, role, joined_at, profiles(id, name, email)')
    .eq('event_id', eventId)
    .order('joined_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const members = (rows ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at,
    name: row.profiles?.name ?? null,
    email: row.profiles?.email ?? null,
  }))

  return NextResponse.json({ members })
}
