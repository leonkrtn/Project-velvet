import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  const dlId = await getDlId(user.id)
  if (!dlId) return NextResponse.json({ activities: [] })

  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contactId')

  const admin = createAdminClient()
  let q = admin
    .from('crm_activities')
    .select('*')
    .eq('dienstleister_id', dlId)
    .order('activity_at', { ascending: false })
    .limit(100)

  if (contactId) q = q.eq('contact_id', contactId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activities: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dlId = await getDlId(user.id)
  if (!dlId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { contact_id, activity_type, title, body: bodyText, activity_at } = body

  if (!contact_id || !title?.trim()) {
    return NextResponse.json({ error: 'contact_id und title erforderlich' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify contact belongs to this vendor
  const { data: contact } = await admin
    .from('crm_contacts')
    .select('id')
    .eq('id', contact_id)
    .eq('dienstleister_id', dlId)
    .maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Kontakt nicht gefunden' }, { status: 404 })

  const { data, error } = await admin
    .from('crm_activities')
    .insert({
      contact_id,
      dienstleister_id: dlId,
      activity_type: activity_type ?? 'note',
      title: title.trim(),
      body: bodyText?.trim() ?? '',
      activity_at: activity_at ?? new Date().toISOString(),
      auto_generated: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activity: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dlId = await getDlId(user.id)
  if (!dlId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('crm_activities')
    .delete()
    .eq('id', id)
    .eq('dienstleister_id', dlId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
