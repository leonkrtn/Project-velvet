import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/* eslint-disable @typescript-eslint/no-explicit-any */

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

  // ── Collect already-linked IDs for deduplication ─────────────────
  const { data: existing } = await admin
    .from('crm_contacts')
    .select('id, offer_id, event_id, request_id, email')
    .eq('dienstleister_id', dlId)

  const usedOfferIds   = new Set((existing ?? []).map(r => r.offer_id).filter(Boolean) as string[])
  const usedEventIds   = new Set((existing ?? []).map(r => r.event_id).filter(Boolean) as string[])
  const usedRequestIds = new Set((existing ?? []).map(r => r.request_id).filter(Boolean) as string[])
  const emailToContactId = new Map<string, string>(
    (existing ?? []).filter(r => r.email).map(r => [r.email as string, r.id as string])
  )

  let imported = 0

  // ════════════════════════════════════════════════════════════════
  // SOURCE 1: Marketplace Requests
  // ════════════════════════════════════════════════════════════════
  const { data: requests } = await admin
    .from('marketplace_requests')
    .select(`
      id, event_id, message, budget, status, created_at,
      events ( title, couple_name, date, location_name, location_city, venue, venue_address, event_type ),
      requester:profiles!marketplace_requests_requested_by_fkey ( name, email, phone )
    `)
    .in('dienstleister_id', [dlId])
    .neq('status', 'cancelled')

  // Fetch vendor offers for these requests (to get pending offer amounts)
  const reqIds = (requests ?? []).map((r: any) => r.id).filter(Boolean)
  const offerByRequest: Record<string, { total: number | null; status: string }> = {}
  if (reqIds.length) {
    const { data: reqOffers } = await admin
      .from('vendor_offers')
      .select('request_id, total, status')
      .eq('dienstleister_id', dlId)
      .in('request_id', reqIds)
    for (const o of (reqOffers ?? []) as any[]) {
      if (!offerByRequest[o.request_id] || o.status === 'accepted') {
        offerByRequest[o.request_id] = { total: o.total, status: o.status }
      }
    }
  }

  // Fetch brautpaar contacts + extended profiles for all request events
  const reqEventIds = Array.from(new Set(
    (requests ?? []).map((r: any) => r.event_id).filter(Boolean)
  ))

  const coupleByEvent: Record<string, {
    name: string; email: string; phone: string
    first_name?: string; last_name?: string
    street?: string; postal_code?: string; city?: string
  }[]> = {}

  if (reqEventIds.length) {
    const { data: mem } = await admin
      .from('event_members')
      .select('event_id, profiles!user_id ( name, first_name, last_name, email, phone, street, postal_code, city )')
      .in('event_id', reqEventIds)
      .in('role', ['brautpaar', 'brautpaar_solo'])
    for (const m of (mem ?? []) as any[]) {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      if (!p) continue
      ;(coupleByEvent[m.event_id] ??= []).push({
        name: p.name ?? '',
        email: p.email ?? '',
        phone: p.phone ?? '',
        first_name: p.first_name ?? '',
        last_name: p.last_name ?? '',
        street: p.street ?? '',
        postal_code: p.postal_code ?? '',
        city: p.city ?? '',
      })
    }
  }

  for (const req of (requests ?? []) as any[]) {
    const ev = (Array.isArray(req.events) ? req.events[0] : req.events) ?? {}
    const requester = (Array.isArray(req.requester) ? req.requester[0] : req.requester) ?? {}
    const coupleContacts = coupleByEvent[req.event_id] ?? []
    const primary = coupleContacts[0] ?? requester
    const email = primary?.email ?? ''

    const offer = offerByRequest[req.id]
    const dealValue = offer?.status === 'accepted' ? (offer?.total ?? null) : null
    const pendingOfferValue = offer && offer.status !== 'accepted' ? (offer?.total ?? null) : null

    const name = ev.couple_name || primary?.name || 'Unbekannt'
    const location = ev.venue
      ? [ev.venue, ev.venue_address].filter(Boolean).join(', ')
      : [ev.location_name, ev.location_city].filter(Boolean).join(', ')
    const stage = req.status === 'accepted' ? 'gebucht' : 'anfrage'

    const contactData = {
      dienstleister_id:    dlId,
      name,
      email,
      phone:               primary?.phone ?? '',
      home_street:         primary?.street ?? '',
      home_postal_code:    primary?.postal_code ?? '',
      home_city:           primary?.city ?? '',
      lifecycle_stage:     stage,
      source:              'marktplatz',
      event_type:          ev.event_type ?? 'hochzeit',
      wedding_date:        ev.date ? ev.date.slice(0, 10) : null,
      deal_value:          dealValue,
      pending_offer_value: pendingOfferValue,
      couple_budget:       req.budget ?? null,
      request_id:          req.id,
      event_id:            req.event_id ?? null,
      event_title:         ev.title ?? '',
      location:            location ?? '',
      guest_count:         null,
      request_message:     req.message ?? '',
      anniversary_remind:  !!ev.date,
      updated_at:          new Date().toISOString(),
    }

    // Update if email already exists, otherwise insert
    const existingId = email ? emailToContactId.get(email) : null
    if (existingId || usedRequestIds.has(req.id)) {
      const updateId = existingId ?? (existing ?? []).find(r => r.request_id === req.id)?.id
      if (updateId) {
        await admin.from('crm_contacts').update(contactData).eq('id', updateId)
        usedRequestIds.add(req.id)
        continue
      }
    }

    const { data: contact } = await admin
      .from('crm_contacts')
      .insert(contactData)
      .select('id')
      .single()

    if (contact) {
      const additional = coupleContacts.slice(1)
      if (additional.length) {
        await admin.from('crm_contact_persons').upsert(
          additional.map((p: any) => ({
            contact_id: contact.id,
            name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.name,
            email: p.email ?? '',
            phone: p.phone ?? '',
            role: 'partner',
          })),
          { onConflict: 'contact_id,email', ignoreDuplicates: true }
        )
      }
      await admin.from('crm_activities').insert({
        contact_id:     contact.id,
        dienstleister_id: dlId,
        activity_type:  'imported',
        title:          `Via Marktplatz-Anfrage importiert (${req.status === 'accepted' ? 'angenommen' : 'offen'})`,
        body:           req.message ? req.message.slice(0, 200) : '',
        auto_generated: true,
      })
      if (email) emailToContactId.set(email, contact.id)
      usedRequestIds.add(req.id)
      imported++
    }
  }

  // ════════════════════════════════════════════════════════════════
  // SOURCE 2: Accepted Offers (marketplace + standalone)
  // ════════════════════════════════════════════════════════════════
  const { data: acceptedOffers } = await admin
    .from('vendor_offers')
    .select('id, title, total, event_id, standard_info, request_id, events(title, date, couple_name, venue, venue_address, location_name, location_city, event_type)')
    .eq('dienstleister_id', dlId)
    .eq('status', 'accepted')

  for (const offer of (acceptedOffers ?? []) as any[]) {
    if (usedOfferIds.has(offer.id)) continue
    if (offer.request_id && usedRequestIds.has(offer.request_id)) {
      // Update deal_value on existing contact
      const existingContact = (existing ?? []).find(r => r.request_id === offer.request_id)
      if (existingContact) {
        await admin.from('crm_contacts')
          .update({ deal_value: offer.total ?? null, pending_offer_value: null, updated_at: new Date().toISOString() })
          .eq('id', existingContact.id)
      }
      usedOfferIds.add(offer.id)
      continue
    }

    const info = (offer.standard_info ?? {}) as Record<string, string>
    const evRaw = offer.events
    const ev = (Array.isArray(evRaw) ? evRaw[0] : evRaw) as any

    const name = info.client_name || ev?.couple_name || ev?.title || offer.title || 'Unbekannt'
    const email = info.client_email || ''

    if (email && emailToContactId.has(email)) {
      await admin.from('crm_contacts')
        .update({ deal_value: offer.total ?? null, pending_offer_value: null, offer_id: offer.id, lifecycle_stage: 'gebucht', updated_at: new Date().toISOString() })
        .eq('id', emailToContactId.get(email)!)
      usedOfferIds.add(offer.id)
      continue
    }

    const location = ev?.venue
      ? [ev.venue, ev.venue_address].filter(Boolean).join(', ')
      : ev
      ? [ev.location_name, ev.location_city].filter(Boolean).join(', ')
      : info.location || ''

    const { data: contact } = await admin
      .from('crm_contacts')
      .insert({
        dienstleister_id: dlId,
        name,
        email,
        phone:            info.client_phone || '',
        address_line1:    info.client_address_line1 ?? '',
        address_line2:    info.client_address_line2 ?? '',
        lifecycle_stage:  'gebucht',
        source:           offer.event_id ? 'marktplatz' : 'sonstige',
        event_type:       ev?.event_type ?? info.eventType ?? 'hochzeit',
        wedding_date:     ev?.date ? ev.date.slice(0, 10) : (info.date ? info.date.slice(0, 10) : null),
        deal_value:       offer.total ?? null,
        offer_id:         offer.id,
        event_id:         offer.event_id ?? null,
        event_title:      ev?.title ?? offer.title ?? '',
        location,
        anniversary_remind: !!(ev?.date || info.date),
      })
      .select('id')
      .single()

    if (contact) {
      await admin.from('crm_activities').insert({
        contact_id:     contact.id,
        dienstleister_id: dlId,
        activity_type:  'offer_accepted',
        title:          `Angebot angenommen: ${offer.title || 'Angebot'}`,
        body:           '',
        auto_generated: true,
      })
      if (email) emailToContactId.set(email, contact.id)
      usedOfferIds.add(offer.id)
      imported++
    }
  }

  // ════════════════════════════════════════════════════════════════
  // SOURCE 3: Events where vendor is a member
  // ════════════════════════════════════════════════════════════════
  const { data: eventMemberships } = await admin
    .from('event_members')
    .select('event_id, events(id, title, date, couple_name, venue, venue_address, event_type, location_name, location_city)')
    .eq('user_id', user.id)
    .eq('role', 'dienstleister')

  const memberEventIds = (eventMemberships ?? [])
    .map((m: any) => m.event_id as string)
    .filter(Boolean)

  const coupleForEvent: Record<string, any[]> = {}
  const partnerForEvent: Record<string, any> = {}

  if (memberEventIds.length) {
    const { data: coupleMembers } = await admin
      .from('event_members')
      .select('event_id, profiles!user_id ( name, first_name, last_name, email, phone, street, postal_code, city )')
      .in('event_id', memberEventIds)
      .in('role', ['brautpaar', 'brautpaar_solo'])
    for (const m of (coupleMembers ?? []) as any[]) {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      if (p) (coupleForEvent[m.event_id] ??= []).push(p)
    }

    // Fetch partner profiles captured at signup
    const { data: partnerRows } = await admin
      .from('event_partner_profiles')
      .select('event_id, first_name, last_name, email, phone')
      .in('event_id', memberEventIds)
    for (const p of (partnerRows ?? []) as any[]) {
      partnerForEvent[p.event_id] = p
    }

    const { data: gcRows } = await admin
      .from('v_event_guest_counts')
      .select('event_id, confirmed_guests, confirmed_plus_ones')
      .in('event_id', memberEventIds)
    const gcByEvent: Record<string, number> = {}
    for (const g of (gcRows ?? []) as any[]) {
      gcByEvent[g.event_id] = (g.confirmed_guests ?? 0) + (g.confirmed_plus_ones ?? 0)
    }

    for (const membership of (eventMemberships ?? []) as any[]) {
      const eventId = membership.event_id
      if (usedEventIds.has(eventId)) {
        // Update existing contact with latest profile data
        const contacts = coupleForEvent[eventId] ?? []
        const primary = contacts[0]
        if (primary?.email && emailToContactId.has(primary.email)) {
          await admin.from('crm_contacts').update({
            phone:            primary.phone ?? '',
            home_street:      primary.street ?? '',
            home_postal_code: primary.postal_code ?? '',
            home_city:        primary.city ?? '',
            guest_count:      gcByEvent[eventId] ?? null,
            updated_at:       new Date().toISOString(),
          }).eq('id', emailToContactId.get(primary.email)!)
        }
        continue
      }

      const evRaw = membership.events
      const ev = (Array.isArray(evRaw) ? evRaw[0] : evRaw) as any
      if (!ev) continue

      const contacts = coupleForEvent[eventId] ?? []
      const primary = contacts[0]
      const email = primary?.email ?? ''

      if (email && emailToContactId.has(email)) {
        usedEventIds.add(eventId)
        continue
      }

      const location = ev.venue
        ? [ev.venue, ev.venue_address].filter(Boolean).join(', ')
        : [ev.location_name, ev.location_city].filter(Boolean).join(', ')

      const { data: contact } = await admin
        .from('crm_contacts')
        .insert({
          dienstleister_id: dlId,
          name:             ev.couple_name || `${primary?.first_name ?? ''} ${primary?.last_name ?? ''}`.trim() || primary?.name || ev.title || 'Unbekannt',
          email,
          phone:            primary?.phone ?? '',
          home_street:      primary?.street ?? '',
          home_postal_code: primary?.postal_code ?? '',
          home_city:        primary?.city ?? '',
          lifecycle_stage:  'gebucht',
          source:           'sonstige',
          event_type:       ev.event_type ?? 'hochzeit',
          wedding_date:     ev.date ? ev.date.slice(0, 10) : null,
          event_id:         eventId,
          event_title:      ev.title ?? '',
          location,
          guest_count:      gcByEvent[eventId] ?? null,
          anniversary_remind: !!ev.date,
        })
        .select('id')
        .single()

      if (contact) {
        if (email) emailToContactId.set(email, contact.id)

        // Import partner as separate CRM contact and cross-link
        const partner = partnerForEvent[eventId] ?? (contacts.length > 1 ? contacts[1] : null)
        if (partner && (partner.email || partner.first_name)) {
          const partnerEmail = partner.email ?? ''
          const partnerExistingId = partnerEmail ? emailToContactId.get(partnerEmail) : null

          let partnerContactId: string | null = partnerExistingId ?? null

          if (!partnerExistingId) {
            const { data: partnerContact } = await admin
              .from('crm_contacts')
              .insert({
                dienstleister_id:  dlId,
                name:              `${partner.first_name ?? ''} ${partner.last_name ?? ''}`.trim() || partner.name || 'Partner',
                email:             partnerEmail,
                phone:             partner.phone ?? '',
                lifecycle_stage:   'gebucht',
                source:            'sonstige',
                event_type:        ev.event_type ?? 'hochzeit',
                wedding_date:      ev.date ? ev.date.slice(0, 10) : null,
                event_id:          eventId,
                event_title:       ev.title ?? '',
                location,
                partner_contact_id: contact.id,
                anniversary_remind: !!ev.date,
              })
              .select('id')
              .single()

            if (partnerContact) {
              partnerContactId = partnerContact.id
              if (partnerEmail) emailToContactId.set(partnerEmail, partnerContact.id)
              imported++
            }
          }

          // Cross-link the primary contact to the partner
          if (partnerContactId) {
            await admin.from('crm_contacts')
              .update({ partner_contact_id: partnerContactId })
              .eq('id', contact.id)
          }
        } else if (contacts.length > 1) {
          await admin.from('crm_contact_persons').insert(
            contacts.slice(1).map((p: any) => ({
              contact_id: contact.id,
              name: (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.name) ?? '',
              email: p.email ?? '',
              phone: p.phone ?? '',
              role: 'partner',
            }))
          )
        }

        await admin.from('crm_activities').insert({
          contact_id:     contact.id,
          dienstleister_id: dlId,
          activity_type:  'imported',
          title:          `Via Event importiert: ${ev.title || ev.couple_name || 'Veranstaltung'}`,
          body:           '',
          auto_generated: true,
        })

        usedEventIds.add(eventId)
        imported++
      }
    }
  }

  return NextResponse.json({ imported })
}
