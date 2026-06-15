import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestUploadUrl, deleteR2Object } from '@/lib/files/worker-client'

const ADMIN_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

async function assertAdmin(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: member } = await supabase
    .from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).maybeSingle()
  if (!member || !ADMIN_ROLES.includes(member.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

// POST — presigned R2-Upload-URL für das RSVP-Hintergrundfoto.
export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const access = await assertAdmin(eventId)
  if (access.error) return access.error

  const { contentType } = await req.json().catch(() => ({})) as { contentType?: string }
  if (!contentType?.startsWith('image/')) {
    return NextResponse.json({ error: 'Nur Bilddateien erlaubt' }, { status: 400 })
  }
  const key = `events/${eventId}/bg-photo`
  const uploadUrl = await requestUploadUrl(key, contentType)
  return NextResponse.json({ uploadUrl, key })
}

// DELETE — Hintergrundfoto aus R2 entfernen (Key wird separat aus den Settings gelöscht).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const access = await assertAdmin(eventId)
  if (access.error) return access.error
  await deleteR2Object(`events/${eventId}/bg-photo`).catch(() => {})
  return NextResponse.json({ success: true })
}
