// Member photo confirm (PATCH) + delete (DELETE).
// PATCH: confirms pending upload → sets status active.
// DELETE: only veranstalter / brautpaar may delete any photo.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteR2Object } from '@/lib/files/worker-client'

async function getAuthedMember(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return null
  return { user, role: member.role as string }
}

// ── PATCH (confirm upload) ────────────────────────────────────────────────────
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; photoId: string }> }
) {
  const { eventId, photoId } = await params
  const member = await getAuthedMember(eventId)
  if (!member) return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 401 })

  const admin = createAdminClient()
  const { data: photo } = await admin
    .from('guest_photos')
    .select('status')
    .eq('id', photoId)
    .eq('event_id', eventId)
    .maybeSingle()

  if (!photo) return NextResponse.json({ error: 'Foto nicht gefunden' }, { status: 404 })
  if (photo.status !== 'pending') return NextResponse.json({ error: 'Bereits bestätigt' }, { status: 409 })

  await admin
    .from('guest_photos')
    .update({ status: 'active', uploaded_at: new Date().toISOString() })
    .eq('id', photoId)

  return NextResponse.json({ ok: true })
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; photoId: string }> }
) {
  const { eventId, photoId } = await params
  const member = await getAuthedMember(eventId)
  if (!member) return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 401 })

  if (member.role !== 'veranstalter' && member.role !== 'brautpaar') {
    return NextResponse.json({ error: 'Keine Lösch-Berechtigung' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: photo } = await admin
    .from('guest_photos')
    .select('r2_key')
    .eq('id', photoId)
    .eq('event_id', eventId)
    .maybeSingle()

  if (!photo) return NextResponse.json({ error: 'Foto nicht gefunden' }, { status: 404 })

  if (photo.r2_key) await deleteR2Object(photo.r2_key).catch(() => null)
  await admin.from('guest_photos').update({ status: 'deleted' }).eq('id', photoId)

  return NextResponse.json({ ok: true })
}
