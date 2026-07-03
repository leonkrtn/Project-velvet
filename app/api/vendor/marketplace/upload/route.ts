import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { requestUploadUrl } from '@/lib/files/worker-client'
import { AUDIO_MIME_TYPES } from '@/lib/marketplace/types'

// POST — presigned R2-Upload-URL für Logo, Galerie-Foto oder Hörprobe des eigenen Profils.
// Body: { kind: 'logo' | 'photo' | 'audio', contentType: string }
export async function POST(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { vendorId } = auth.ctx

  const { kind, contentType } = await req.json().catch(() => ({})) as { kind?: string; contentType?: string }

  let key: string
  if (kind === 'audio') {
    if (!contentType || !(AUDIO_MIME_TYPES as readonly string[]).includes(contentType)) {
      return NextResponse.json({ error: 'Nur Audiodateien erlaubt (z. B. MP3)' }, { status: 400 })
    }
    key = `marketplace/${vendorId}/audio/${randomUUID()}`
  } else {
    if (!contentType?.startsWith('image/')) {
      return NextResponse.json({ error: 'Nur Bilddateien erlaubt' }, { status: 400 })
    }
    key = kind === 'logo'
      ? `marketplace/${vendorId}/logo-${randomUUID().slice(0, 8)}`
      : `marketplace/${vendorId}/photos/${randomUUID()}`
  }

  const uploadUrl = await requestUploadUrl(key, contentType)
  return NextResponse.json({ uploadUrl, key })
}
