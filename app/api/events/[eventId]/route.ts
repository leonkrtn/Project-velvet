import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface Params {
  params: Promise<{ eventId: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify veranstalter role
  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'veranstalter') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Allowlist of patchable fields
  const allowed = [
    'title', 'couple_name', 'date', 'ceremony_start', 'description',
    'venue', 'venue_address',
    'location_name', 'location_street', 'location_zip', 'location_city', 'location_website',
    'max_begleitpersonen', 'children_allowed', 'children_note',
    'meal_options', 'menu_type', 'collect_allergies',
    'budget_total', 'organizer_fee', 'organizer_fee_type',
    'internal_notes', 'dresscode',
  ]

  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const { data, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', eventId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
