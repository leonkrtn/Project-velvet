import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadCrmContacts } from '@/lib/vendor/crm-contacts'

async function getDlId(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.dienstleister_id ?? null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  try {
    const contacts = await loadCrmContacts(user.id, {
      search:    searchParams.get('search')     ?? '',
      stage:     searchParams.get('stage')      ?? '',
      source:    searchParams.get('source')     ?? '',
      priority:  searchParams.get('priority')   ?? '',
      eventType: searchParams.get('event_type') ?? '',
      homeCity:  searchParams.get('home_city')  ?? '',
      eventCity: searchParams.get('event_city') ?? '',
    })
    return NextResponse.json({ contacts })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dlId = await getDlId(user.id)
  if (!dlId) return NextResponse.json({ error: 'Kein Dienstleister-Profil' }, { status: 403 })

  const body = await req.json()
  const {
    name, email, phone, address_line1, address_line2,
    lifecycle_stage, source, event_type, wedding_date,
    deal_value, notes, priority, custom_tags,
    offer_id, event_id, request_id, anniversary_remind,
    guest_count, location, event_title, request_message,
    additional_persons,
  } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name fehlt' }, { status: 400 })

  const admin = createAdminClient()
  const { data: contact, error } = await admin
    .from('crm_contacts')
    .insert({
      dienstleister_id: dlId,
      name: name.trim(),
      email: email?.trim() ?? '',
      phone: phone?.trim() ?? '',
      address_line1: address_line1?.trim() ?? '',
      address_line2: address_line2?.trim() ?? '',
      lifecycle_stage: lifecycle_stage ?? 'lead',
      source: source ?? 'sonstige',
      event_type: event_type ?? 'hochzeit',
      wedding_date: wedding_date || null,
      deal_value: deal_value ? Number(deal_value) : null,
      notes: notes?.trim() ?? '',
      priority: priority ?? 'standard',
      custom_tags: custom_tags ?? [],
      offer_id: offer_id || null,
      event_id: event_id || null,
      request_id: request_id || null,
      anniversary_remind: anniversary_remind ?? false,
      guest_count: guest_count ?? null,
      location: location?.trim() ?? '',
      event_title: event_title?.trim() ?? '',
      request_message: request_message?.trim() ?? '',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (additional_persons?.length) {
    await admin.from('crm_contact_persons').insert(
      additional_persons.map((p: { name: string; email: string; phone: string; role: string }) => ({
        contact_id: contact.id,
        name: p.name ?? '',
        email: p.email ?? '',
        phone: p.phone ?? '',
        role: p.role ?? 'additional',
      }))
    )
  }

  await admin.from('crm_activities').insert({
    contact_id: contact.id,
    dienstleister_id: dlId,
    activity_type: 'imported',
    title: 'Kontakt erstellt',
    body: '',
    auto_generated: true,
  })

  return NextResponse.json({ contact })
}
