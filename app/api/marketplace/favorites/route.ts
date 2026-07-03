import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const REQUESTER_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

async function assertEventMember(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) }
  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member || !REQUESTER_ROLES.includes(member.role)) {
    return { error: NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 }) }
  }
  return { user }
}

// GET — Merkliste eines Events. Query: ?eventId=
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })
  const auth = await assertEventMember(eventId)
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('marketplace_favorites')
    .select('dienstleister_id')
    .eq('event_id', eventId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vendorIds: (data ?? []).map(f => f.dienstleister_id) })
}

// POST — Anbieter merken. Body: { eventId, vendorId }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { eventId?: string; vendorId?: string }
  if (!body.eventId || !body.vendorId) return NextResponse.json({ error: 'eventId/vendorId fehlt' }, { status: 400 })
  const auth = await assertEventMember(body.eventId)
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const { data: vendor } = await admin
    .from('dienstleister_profiles')
    .select('id')
    .eq('id', body.vendorId)
    .eq('is_marketplace', true)
    .eq('published', true)
    .eq('moderation_status', 'approved')
    .maybeSingle()
  if (!vendor) return NextResponse.json({ error: 'Anbieter nicht gefunden' }, { status: 404 })

  const { error } = await admin
    .from('marketplace_favorites')
    .upsert(
      { event_id: body.eventId, dienstleister_id: body.vendorId, created_by: auth.user.id },
      { onConflict: 'event_id,dienstleister_id' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — Anbieter von der Merkliste entfernen. Query: ?eventId=&vendorId=
export async function DELETE(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('eventId')
  const vendorId = req.nextUrl.searchParams.get('vendorId')
  if (!eventId || !vendorId) return NextResponse.json({ error: 'eventId/vendorId fehlt' }, { status: 400 })
  const auth = await assertEventMember(eventId)
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const { error } = await admin
    .from('marketplace_favorites')
    .delete()
    .eq('event_id', eventId)
    .eq('dienstleister_id', vendorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
