// RSVP photo API — unauthenticated, validated by guest token.
// GET:  returns all active photos for the event (with presigned download URLs).
// POST: requests a presigned R2 upload URL; inserts pending guest_photo row.
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { requestUploadUrl, requestDownloadUrl } from '@/lib/files/worker-client'
import { sanitizeFilename } from '@/lib/files/types'

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif',
])
const MAX_PHOTO_BYTES = 30 * 1024 * 1024 // 30 MB

async function resolveGuest(token: string) {
  const admin = createAdminClient()
  const { data: guest } = await admin
    .from('guests')
    .select('id, event_id, name')
    .eq('token', token)
    .maybeSingle()
  return guest
}

async function getToggles(eventId: string): Promise<{ enabled: boolean; isPublic: boolean }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('feature_toggles')
    .select('key, enabled, value')
    .eq('event_id', eventId)
    .in('key', ['gaeste-fotos', 'gaeste-fotos-public', 'gaeste-fotos-unlock-at'])
  const map = Object.fromEntries((data ?? []).map(r => [r.key, r]))

  const directEnabled = map['gaeste-fotos']?.enabled ?? true
  const unlockAt: string | null = (map['gaeste-fotos-unlock-at'] as any)?.value ?? null
  const timedEnabled = unlockAt ? new Date(unlockAt) <= new Date() : false

  return {
    enabled:  directEnabled || timedEnabled,
    isPublic: map['gaeste-fotos-public']?.enabled ?? true,
  }
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const guest = await resolveGuest(token)
  if (!guest) return NextResponse.json({ error: 'Ungültiger Token' }, { status: 404 })

  const { enabled, isPublic } = await getToggles(guest.event_id)
  if (!enabled) return NextResponse.json({ photos: [], enabled: false, isPublic })

  const admin = createAdminClient()
  let query = admin
    .from('guest_photos')
    .select('id, uploader_name, uploaded_at, r2_key, guest_token')
    .eq('event_id', guest.event_id)
    .eq('status', 'active')
    .order('uploaded_at', { ascending: false })

  // When not public: guests only see their own photos
  if (!isPublic) query = query.eq('guest_token', token)

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const photos = await Promise.all(
    (rows ?? []).map(async p => {
      const url = p.r2_key ? await requestDownloadUrl(p.r2_key).catch(() => null) : null
      return {
        id: p.id,
        uploader_name: p.uploader_name,
        uploaded_at: p.uploaded_at,
        url,
        is_own: p.guest_token === token,
      }
    })
  )

  return NextResponse.json({ photos, enabled: true, isPublic })
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const guest = await resolveGuest(token)
  if (!guest) return NextResponse.json({ error: 'Ungültiger Token' }, { status: 404 })

  const { enabled } = await getToggles(guest.event_id)
  if (!enabled) return NextResponse.json({ error: 'Foto-Upload ist deaktiviert' }, { status: 403 })

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
  const r2Key = `events/${guest.event_id}/gaeste-fotos/${photoId}/${safe}`

  const admin = createAdminClient()
  const { error: dbErr } = await admin.from('guest_photos').insert({
    id: photoId,
    event_id: guest.event_id,
    uploader_name: guest.name,
    guest_token: token,
    r2_key: r2Key,
    status: 'pending',
  })
  if (dbErr) return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })

  const uploadUrl = await requestUploadUrl(r2Key, contentType)
  return NextResponse.json({ photoId, uploadUrl })
}
