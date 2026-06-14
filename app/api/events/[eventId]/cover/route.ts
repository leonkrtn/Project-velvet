import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requestUploadUrl, deleteR2Object } from '@/lib/files/worker-client'

// Roles allowed to manage the event cover image (couple-facing nicety).
const COVER_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

async function assertCoverAccess(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || !COVER_ROLES.includes(member.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

// POST — request a presigned R2 upload URL for the event cover image.
export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const access = await assertCoverAccess(eventId)
  if (access.error) return access.error

  const { contentType } = await req.json() as { contentType?: string }
  if (!contentType?.startsWith('image/')) {
    return NextResponse.json({ error: 'Nur Bilddateien erlaubt' }, { status: 400 })
  }

  // Fixed key per event — re-uploading overwrites the previous cover.
  const key = `events/${eventId}/cover`
  const uploadUrl = await requestUploadUrl(key, contentType)
  return NextResponse.json({ uploadUrl, key })
}

// PATCH — persist the cover R2 key after the upload completed.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const access = await assertCoverAccess(eventId)
  if (access.error) return access.error

  const { cover_image_r2_key } = await req.json() as { cover_image_r2_key?: string | null }

  // Service role: a regular brautpaar has no UPDATE RLS on events, but is
  // allowed to set the cover via this gated route.
  const admin = createAdminClient()
  const { error } = await admin
    .from('events')
    .update({ cover_image_r2_key: cover_image_r2_key ?? null })
    .eq('id', eventId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

// DELETE — remove the cover image (clears key + deletes the R2 object).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const access = await assertCoverAccess(eventId)
  if (access.error) return access.error

  const admin = createAdminClient()
  await admin.from('events').update({ cover_image_r2_key: null }).eq('id', eventId)
  await deleteR2Object(`events/${eventId}/cover`).catch(() => { /* object may not exist */ })
  return NextResponse.json({ success: true })
}
