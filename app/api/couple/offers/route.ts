import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const COUPLE_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

// GET ?eventId= — alle dem Brautpaar sichtbaren Angebote (ab Freigabe).
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).maybeSingle()
  if (!member || !COUPLE_ROLES.includes(member.role)) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const { data: offers } = await admin
    .from('vendor_offers')
    .select('id, title, status, total, currency, valid_until, dienstleister_id, released_at, accepted_at, created_at')
    .eq('event_id', eventId)
    .in('status', ['released', 'accepted', 'declined'])
    .order('released_at', { ascending: false })

  // Anbieternamen ergaenzen.
  const vendorIds = Array.from(new Set((offers ?? []).map(o => o.dienstleister_id)))
  const nameById = new Map<string, string>()
  if (vendorIds.length) {
    const { data: vendors } = await admin
      .from('dienstleister_profiles').select('id, name, company_name, category').in('id', vendorIds)
    for (const v of (vendors ?? [])) nameById.set(v.id, (v.company_name || v.name || 'Dienstleister'))
  }

  const result = (offers ?? []).map(o => ({ ...o, vendor_name: nameById.get(o.dienstleister_id) ?? 'Dienstleister' }))
  return NextResponse.json({ offers: result })
}
