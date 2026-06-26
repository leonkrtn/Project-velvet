import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const dlId = link.dienstleister_id

  // Find accepted offers not yet in CRM
  const { data: existingOfferIds } = await admin
    .from('crm_contacts')
    .select('offer_id')
    .eq('dienstleister_id', dlId)
    .not('offer_id', 'is', null)

  const usedOfferIds = new Set((existingOfferIds ?? []).map(r => r.offer_id as string))

  const { data: acceptedOffers } = await admin
    .from('vendor_offers')
    .select('id, title, total, event_id, standard_info, events(title, date, couple_name, location_city)')
    .eq('dienstleister_id', dlId)
    .eq('status', 'accepted')

  let imported = 0

  for (const offer of acceptedOffers ?? []) {
    if (usedOfferIds.has(offer.id)) continue

    const info = (offer.standard_info ?? {}) as Record<string, string>
    const evRaw = offer.events
    const ev = (Array.isArray(evRaw) ? evRaw[0] : evRaw) as { title: string; date: string | null; couple_name: string | null; location_city: string | null } | null
    const name = info.client_name || ev?.couple_name || ev?.title || offer.title || 'Unbekannt'
    const email = info.client_email || ''
    const phone = info.client_phone || ''
    const address1 = info.client_address_line1 || ''
    const address2 = info.client_address_line2 || ''
    const weddingDate = ev?.date ? ev.date.slice(0, 10) : null

    const { data: contact } = await admin
      .from('crm_contacts')
      .insert({
        dienstleister_id: dlId,
        name,
        email,
        phone,
        address_line1: address1,
        address_line2: address2,
        lifecycle_stage: 'gebucht',
        source: 'marktplatz',
        event_type: 'hochzeit',
        wedding_date: weddingDate,
        deal_value: offer.total ?? null,
        offer_id: offer.id,
        event_id: offer.event_id ?? null,
        anniversary_remind: !!weddingDate,
      })
      .select('id')
      .single()

    if (contact) {
      await admin.from('crm_activities').insert({
        contact_id: contact.id,
        dienstleister_id: dlId,
        activity_type: 'offer_accepted',
        title: `Angebot angenommen: ${offer.title || 'Angebot'}`,
        body: '',
        auto_generated: true,
      })
      imported++
    }
  }

  return NextResponse.json({ imported })
}
