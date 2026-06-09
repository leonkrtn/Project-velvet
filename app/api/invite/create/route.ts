// app/api/invite/create/route.ts
// Erstellt Invite-Codes für Brautpaar / Veranstalter / Solo-Partner
// Erlaubte Kombinationen (Caller-Rolle → Ziel-Rolle):
//   veranstalter   → brautpaar       (klassischer Flow)
//   brautpaar_solo → veranstalter    (Veranstalter nachträglich "dazuschalten")
//   brautpaar_solo → brautpaar_solo  (Partner / Partnerin einladen)
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const body = await request.json()
  const { eventId, targetRole } = body as {
    eventId: string
    targetRole: 'brautpaar' | 'veranstalter' | 'brautpaar_solo'
  }

  const validTargets = ['brautpaar', 'veranstalter', 'brautpaar_solo']
  if (!eventId || !validTargets.includes(targetRole)) {
    return NextResponse.json({ error: 'eventId und gültige targetRole erforderlich' }, { status: 400 })
  }

  const admin = getServiceClient()

  // Caller-Rolle im Event prüfen
  const { data: member } = await admin
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Kein Zugriff auf dieses Event' }, { status: 403 })

  const callerRole = member.role as string
  const allowed =
    (callerRole === 'veranstalter' && targetRole === 'brautpaar') ||
    (callerRole === 'brautpaar_solo' && (targetRole === 'veranstalter' || targetRole === 'brautpaar_solo'))

  if (!allowed) {
    return NextResponse.json({ error: 'Keine Berechtigung für diese Einladung' }, { status: 403 })
  }

  const code = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: invite, error: invErr } = await admin.from('invite_codes').insert({
    event_id: eventId,
    code,
    role: targetRole,
    expires_at: expiresAt,
    metadata: null,
    created_by: user.id,
  }).select('code').single()

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  return NextResponse.json({ code: invite.code, expiresAt })
}
