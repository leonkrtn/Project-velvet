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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dlId = await getDlId(user.id)
  if (!dlId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('done' in body) {
    patch.done = body.done
    patch.done_at = body.done ? new Date().toISOString() : null
  }
  if ('title' in body) patch.title = body.title
  if ('due_at' in body) patch.due_at = body.due_at
  if ('contact_id' in body) patch.contact_id = body.contact_id

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('crm_tasks')
    .update(patch)
    .eq('id', id)
    .eq('dienstleister_id', dlId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
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
    .from('crm_tasks')
    .delete()
    .eq('id', id)
    .eq('dienstleister_id', dlId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
