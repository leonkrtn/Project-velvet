import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const REQUESTER_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

// GET — offene/beantwortete Daten-Anfragen fuer ein Event (Brautpaar-Sicht). ?eventId=
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })

  const admin = createAdminClient()
  const { data: member } = await admin.from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).maybeSingle()
  if (!member || !REQUESTER_ROLES.includes(member.role)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { data } = await admin.from('vendor_data_requests')
    .select('id, dienstleister_id, fields, status, created_at, dienstleister_profiles(company_name, name)')
    .eq('event_id', eventId).order('created_at', { ascending: false })
  return NextResponse.json({ requests: data ?? [] })
}
