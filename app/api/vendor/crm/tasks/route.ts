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
  if (!dlId) return NextResponse.json({ tasks: [] })

  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contactId')
  const showDone = searchParams.get('done') === 'true'

  const admin = createAdminClient()
  let q = admin
    .from('crm_tasks')
    .select('*, crm_contacts(id, name)')
    .eq('dienstleister_id', dlId)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(200)

  if (!showDone) q = q.eq('done', false)
  if (contactId) q = q.eq('contact_id', contactId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dlId = await getDlId(user.id)
  if (!dlId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, contact_id, due_at } = body
  if (!title?.trim()) return NextResponse.json({ error: 'title fehlt' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('crm_tasks')
    .insert({
      dienstleister_id: dlId,
      contact_id: contact_id || null,
      title: title.trim(),
      due_at: due_at || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
}
