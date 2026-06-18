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

// GET — Anfragen eines Events (für das Brautpaar). Query: ?eventId=
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })
  const access = await assertEventMember(eventId)
  if (access.error) return access.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('marketplace_requests')
    .select('id, dienstleister_id, message, budget, status, conversation_id, created_at, responded_at, dienstleister_profiles(name, company_name, category)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}

// POST — neue Anfrage an einen Vendor. Body: { eventId, dienstleisterId, message, budget? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const eventId = body.eventId as string
  const dienstleisterId = body.dienstleisterId as string
  if (!eventId || !dienstleisterId) {
    return NextResponse.json({ error: 'eventId und dienstleisterId erforderlich' }, { status: 400 })
  }
  const access = await assertEventMember(eventId)
  if (access.error) return access.error

  const admin = createAdminClient()
  // Vendor muss ein veröffentlichtes Marktplatz-Profil sein
  const { data: vendor } = await admin
    .from('dienstleister_profiles')
    .select('id')
    .eq('id', dienstleisterId)
    .eq('is_marketplace', true)
    .eq('published', true)
    .eq('moderation_status', 'approved')
    .maybeSingle()
  if (!vendor) return NextResponse.json({ error: 'Dienstleister nicht verfügbar' }, { status: 404 })

  // Bereits offene Anfrage? — Duplikate vermeiden
  const { data: existing } = await admin
    .from('marketplace_requests')
    .select('id')
    .eq('event_id', eventId)
    .eq('dienstleister_id', dienstleisterId)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Es besteht bereits eine offene Anfrage', id: existing.id }, { status: 409 })

  const budgetRaw = body.budget
  const budget = typeof budgetRaw === 'number' ? budgetRaw
    : (typeof budgetRaw === 'string' && budgetRaw.trim() ? parseFloat(budgetRaw) : null)

  const { data, error } = await admin
    .from('marketplace_requests')
    .insert({
      event_id: eventId,
      dienstleister_id: dienstleisterId,
      requested_by: access.user.id,
      message: (body.message as string)?.trim() || '',
      budget: Number.isFinite(budget as number) ? budget : null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id })
}
