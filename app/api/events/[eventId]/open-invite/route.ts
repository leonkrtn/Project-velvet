// app/api/events/[eventId]/open-invite/route.ts
// Sammel-Link (offene Gast-Selbstregistrierung) aktivieren/deaktivieren.
// Beim ersten Aktivieren wird ein Token generiert; es bleibt danach stabil,
// damit bereits verteilte Links beim Re-Aktivieren weiter funktionieren.
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { enabled } = await request.json() as { enabled: boolean }
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) erforderlich' }, { status: 400 })
  }

  const admin = getServiceClient()

  const { data: member } = await admin
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !ALLOWED_ROLES.includes(member.role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { data: event } = await admin
    .from('events')
    .select('open_invite_token')
    .eq('id', eventId)
    .single()

  if (!event) return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 })

  const token = event.open_invite_token ?? randomUUID()

  const { error: updateErr } = await admin
    .from('events')
    .update({ open_invite_token: token, open_invite_enabled: enabled })
    .eq('id', eventId)

  if (updateErr) {
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ token, enabled })
}
