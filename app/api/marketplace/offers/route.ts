import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const REQUESTER_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

// GET — alle für das Brautpaar sichtbaren Angebote eines Events (Status ab
// 'released'), inkl. Vendor-Basisdaten. Grundlage für den Angebotsvergleich.
// Query: ?eventId=
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member || !REQUESTER_ROLES.includes(member.role)) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: offers, error } = await admin
    .from('vendor_offers')
    .select('id, request_id, dienstleister_id, status, subtotal, tax_amount, total, line_items, released_at, accepted_at, created_at')
    .eq('event_id', eventId)
    .not('request_id', 'is', null)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = offers ?? []
  const vendorIds = Array.from(new Set(rows.map(o => o.dienstleister_id).filter(Boolean)))
  const offerIds = rows.map(o => o.id)

  const [{ data: vendors }, { data: variantRows }] = await Promise.all([
    vendorIds.length
      ? admin.from('dienstleister_profiles').select('id, company_name, name, category').in('id', vendorIds)
      : Promise.resolve({ data: [] as { id: string; company_name: string | null; name: string | null; category: string }[] }),
    offerIds.length
      ? admin.from('vendor_offer_variants').select('offer_id').in('offer_id', offerIds)
      : Promise.resolve({ data: [] as { offer_id: string }[] }),
  ])
  const vendorById = new Map((vendors ?? []).map(v => [v.id, v]))
  const variantCount = new Map<string, number>()
  for (const v of variantRows ?? []) variantCount.set(v.offer_id, (variantCount.get(v.offer_id) ?? 0) + 1)

  return NextResponse.json({
    offers: rows.map(o => {
      const vendor = vendorById.get(o.dienstleister_id)
      return {
        id: o.id,
        request_id: o.request_id,
        dienstleister_id: o.dienstleister_id,
        vendor_name: vendor?.company_name || vendor?.name || 'Dienstleister',
        category: vendor?.category ?? null,
        status: o.status,
        total: o.total,
        line_item_count: Array.isArray(o.line_items) ? o.line_items.length : 0,
        variant_count: variantCount.get(o.id) ?? 0,
        released_at: o.released_at,
        accepted_at: o.accepted_at,
      }
    }),
  })
}
