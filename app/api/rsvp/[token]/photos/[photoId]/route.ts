// RSVP photo confirm + guest-owned delete — unauthenticated, validated by token.
// PATCH: confirms a pending upload (sets status → active).
// DELETE: lets a guest delete their own photo (validated via guest_token column).
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteR2Object } from '@/lib/files/worker-client'

async function resolveGuest(token: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guests')
    .select('id, event_id')
    .eq('token', token)
    .maybeSingle()
  return data
}

// ── PATCH (confirm upload) ────────────────────────────────────────────────────
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; photoId: string }> }
) {
  const { token, photoId } = await params
  const guest = await resolveGuest(token)
  if (!guest) return NextResponse.json({ error: 'Ungültiger Token' }, { status: 404 })

  const admin = createAdminClient()
  const { data: photo } = await admin
    .from('guest_photos')
    .select('id, guest_token, status')
    .eq('id', photoId)
    .eq('event_id', guest.event_id)
    .maybeSingle()

  if (!photo) return NextResponse.json({ error: 'Foto nicht gefunden' }, { status: 404 })
  if (photo.guest_token !== token) return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  if (photo.status !== 'pending') return NextResponse.json({ error: 'Foto bereits bestätigt' }, { status: 409 })

  const { error } = await admin
    .from('guest_photos')
    .update({ status: 'active', uploaded_at: new Date().toISOString() })
    .eq('id', photoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// ── DELETE (guest owns photo) ─────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; photoId: string }> }
) {
  const { token, photoId } = await params
  const guest = await resolveGuest(token)
  if (!guest) return NextResponse.json({ error: 'Ungültiger Token' }, { status: 404 })

  const admin = createAdminClient()
  const { data: photo } = await admin
    .from('guest_photos')
    .select('id, guest_token, r2_key, status')
    .eq('id', photoId)
    .eq('event_id', guest.event_id)
    .maybeSingle()

  if (!photo) return NextResponse.json({ error: 'Foto nicht gefunden' }, { status: 404 })
  if (photo.guest_token !== token) return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })

  if (photo.r2_key) await deleteR2Object(photo.r2_key).catch(() => null)

  await admin.from('guest_photos').update({ status: 'deleted' }).eq('id', photoId)
  return NextResponse.json({ ok: true })
}
