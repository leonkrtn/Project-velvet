import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { requestUploadUrl } from '@/lib/files/worker-client'
import { sanitizeFilename } from '@/lib/files/types'

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif',
])
const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { eventId, filename, contentType, sizeBytes } =
    await req.json() as { eventId: string; filename: string; contentType: string; sizeBytes?: number }

  if (!eventId || !filename || !contentType)
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })

  if (!ALLOWED_IMAGE_TYPES.has(contentType))
    return NextResponse.json({ error: 'Nur Bilder erlaubt (JPEG, PNG, WebP, GIF, SVG, AVIF)' }, { status: 400 })

  if (sizeBytes && sizeBytes > MAX_BYTES)
    return NextResponse.json({ error: 'Bild zu groß (max. 20 MB)' }, { status: 400 })

  // Verify event membership
  const { data: member } = await supabase
    .from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const fileId = randomUUID()
  const r2Key = `events/${eventId}/deko/${fileId}/${sanitizeFilename(filename)}`

  const uploadUrl = await requestUploadUrl(r2Key, contentType)
  return NextResponse.json({ uploadUrl, r2Key })
}
