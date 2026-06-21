import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface Params {
  params: Promise<{ eventId: string }>
}

// Sensible Felder (internal_notes, Budget/Honorar) NICHT pauschal ausliefern:
// Die RLS-Policy `events_dl_select` erlaubt Dienstleistern SELECT auf die ganze
// Zeile. Deshalb wird die Spaltenauswahl rollenabhängig eingeschränkt.
const PUBLIC_EVENT_COLUMNS = [
  'id', 'title', 'couple_name', 'date', 'ceremony_start', 'description',
  'venue', 'venue_address',
  'location_name', 'location_street', 'location_zip', 'location_city', 'location_website',
  'max_begleitpersonen', 'children_allowed', 'children_note',
  'meal_options', 'menu_type', 'collect_allergies', 'dresscode',
  'event_type', 'event_code', 'created_at',
].join(', ')

const ADMIN_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo', 'trauzeuge']

export async function GET(_req: NextRequest, { params }: Params) {
  const { eventId } = await params
  const supabase = await createClient()

  // Rolle des Aufrufers bestimmen — nur Event-Admins erhalten interne Felder.
  let columns = PUBLIC_EVENT_COLUMNS
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: member } = await supabase
      .from('event_members')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (member && ADMIN_ROLES.includes(member.role)) {
      columns = '*'
    }
  }

  const { data, error } = await supabase
    .from('events')
    .select(columns)
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

  // Verify event admin role (veranstalter or autonomous solo couple)
  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || !['veranstalter', 'brautpaar_solo'].includes(member.role)) {
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
