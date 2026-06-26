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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dlId = await getDlId(user.id)
  if (!dlId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()
  const { data: contact, error } = await admin
    .from('crm_contacts')
    .select('*, crm_contact_persons(*), crm_tasks(*), crm_activities(*)')
    .eq('id', id)
    .eq('dienstleister_id', dlId)
    .single()

  if (error) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ contact })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dlId = await getDlId(user.id)
  if (!dlId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  const ALLOWED = [
    'name','email','phone','address_line1','address_line2',
    'lifecycle_stage','source','event_type','wedding_date',
    'deal_value','notes','priority','custom_tags',
    'offer_id','event_id','request_id','anniversary_remind',
    'guest_count','location','event_title','request_message',
    'home_street','home_postal_code','home_city',
    'pending_offer_value','couple_budget','partner_contact_id',
    'birthday',
  ]

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key]
  }

  const admin = createAdminClient()

  // Track stage change in activities
  if ('lifecycle_stage' in body) {
    const { data: existing } = await admin
      .from('crm_contacts')
      .select('lifecycle_stage')
      .eq('id', id)
      .eq('dienstleister_id', dlId)
      .single()
    if (existing && existing.lifecycle_stage !== body.lifecycle_stage) {
      await admin.from('crm_activities').insert({
        contact_id: id,
        dienstleister_id: dlId,
        activity_type: 'stage_change',
        title: `Status geändert: ${existing.lifecycle_stage} → ${body.lifecycle_stage}`,
        body: '',
        auto_generated: true,
      })
    }
  }

  const { data, error } = await admin
    .from('crm_contacts')
    .update(patch)
    .eq('id', id)
    .eq('dienstleister_id', dlId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Handle additional_persons update
  if (body.additional_persons !== undefined) {
    await admin.from('crm_contact_persons').delete().eq('contact_id', id)
    if (body.additional_persons?.length) {
      await admin.from('crm_contact_persons').insert(
        body.additional_persons.map((p: { name: string; email: string; phone: string; role: string }) => ({
          contact_id: id,
          name: p.name ?? '',
          email: p.email ?? '',
          phone: p.phone ?? '',
          role: p.role ?? 'additional',
        }))
      )
    }
  }

  return NextResponse.json({ contact: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dlId = await getDlId(user.id)
  if (!dlId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin
    .from('crm_contacts')
    .delete()
    .eq('id', id)
    .eq('dienstleister_id', dlId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
