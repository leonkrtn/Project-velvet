// app/api/invite/create/route.ts
// Erstellt Invite-Codes für Brautpaar, Trauzeuge
// Veranstalter → kann Brautpaar + Trauzeuge einladen
// Brautpaar → kann Trauzeuge einladen
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { TrauzeugePermissions } from '@/lib/types/roles'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const body = await request.json()
  const { eventId, targetRole, permissions } = body as {
    eventId: string
    targetRole: 'brautpaar' | 'trauzeuge'
    permissions?: Partial<TrauzeugePermissions>
  }

  const ALLOWED_ROLES = ['brautpaar', 'trauzeuge']
  if (!eventId || !targetRole || !ALLOWED_ROLES.includes(targetRole)) {
    return NextResponse.json({ error: 'eventId und targetRole erforderlich' }, { status: 400 })
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
  if (targetRole === 'brautpaar' && callerRole !== 'veranstalter') {
    return NextResponse.json({ error: 'Nur Veranstalter kann Brautpaar einladen' }, { status: 403 })
  }
  if (targetRole === 'trauzeuge' && !['veranstalter', 'brautpaar'].includes(callerRole)) {
    return NextResponse.json({ error: 'Nur Veranstalter oder Brautpaar kann Trauzeugen einladen' }, { status: 403 })
  }

  const code = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const metadata = targetRole === 'trauzeuge' && permissions ? { permissions } : null

  const { data: invite, error: invErr } = await admin.from('invite_codes').insert({
    event_id: eventId,
    code,
    role: targetRole,
    expires_at: expiresAt,
    metadata,
    created_by: user.id,
  }).select('code').single()

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  return NextResponse.json({ code: invite.code, expiresAt })
}
