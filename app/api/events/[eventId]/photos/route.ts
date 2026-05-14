// Authenticated member photo routes.
// GET:  returns all active photos for the event with presigned download URLs.
// POST: requests a presigned R2 upload URL; inserts a pending guest_photo row.
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requestUploadUrl, requestDownloadUrl } from '@/lib/files/worker-client'
import { sanitizeFilename } from '@/lib/files/types'

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif',
])
const MAX_PHOTO_BYTES = 30 * 1024 * 1024 // 30 MB

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

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const member = await getAuthedMember(eventId)
  if (!member) return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 401 })

  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('guest_photos')
    .select('id, uploader_name, uploaded_at, r2_key, guest_token')
    .eq('event_id', eventId)
    .eq('status', 'active')
    .order('uploaded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const canDeleteAll = member.role === 'veranstalter' || member.role === 'brautpaar'
  const photos = await Promise.all(
    (rows ?? []).map(async p => {
      const url = p.r2_key ? await requestDownloadUrl(p.r2_key).catch(() => null) : null
      return {
        id: p.id,
        uploader_name: p.uploader_name,
        uploaded_at: p.uploaded_at,
        url,
        can_delete: canDeleteAll,
      }
    })
  )

  return NextResponse.json({ photos })
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const member = await getAuthedMember(eventId)
  if (!member) return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 401 })

  const body = await req.json() as { filename: string; contentType: string; sizeBytes?: number }
  const { filename, contentType, sizeBytes } = body

  if (!filename || !contentType) {
    return NextResponse.json({ error: 'filename und contentType erforderlich' }, { status: 400 })
  }
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Nur Bilder erlaubt (JPEG, PNG, WebP, HEIC)' }, { status: 400 })
  }
  if (sizeBytes && sizeBytes > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: 'Datei zu groß (max. 30 MB)' }, { status: 400 })
  }

  const photoId = randomUUID()
  const safe = sanitizeFilename(filename)
  const r2Key = `events/${eventId}/gaeste-fotos/${photoId}/${safe}`

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', member.user.id)
    .maybeSingle()

  const admin = createAdminClient()
  const { error: dbErr } = await admin.from('guest_photos').insert({
    id: photoId,
    event_id: eventId,
    uploader_name: profile?.name ?? 'Mitglied',
    guest_token: null,
    r2_key: r2Key,
    status: 'pending',
  })
  if (dbErr) return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })

  const uploadUrl = await requestUploadUrl(r2Key, contentType)
  return NextResponse.json({ photoId, uploadUrl })
}
