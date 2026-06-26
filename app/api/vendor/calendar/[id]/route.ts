import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH — update a custom calendar entry
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const { title, description, start_at, end_at, all_day, color, entry_type } = body

  if (!title || typeof title !== 'string' || !(title as string).trim()) {
    return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vendor_calendar_entries')
    .update({
      title: (title as string).trim(),
      description: (description as string | undefined) ?? '',
      start_at,
      end_at: end_at ?? null,
      all_day: all_day ?? true,
      color: (color as string | undefined) ?? '#2352C8',
      entry_type: (entry_type as string | undefined) ?? 'custom',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Nicht gefunden oder kein Zugriff' }, { status: 404 })
  }

  return NextResponse.json({ entry: data })
}

// DELETE — remove a custom calendar entry
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('vendor_calendar_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Konnte nicht gelöscht werden' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
