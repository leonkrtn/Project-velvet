import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { requestUploadUrl } from '@/lib/files/worker-client'

// POST — presigned R2-Upload-URL für Logo oder Galerie-Foto des eigenen Profils.
// Body: { kind: 'logo' | 'photo', contentType: string }
export async function POST(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { vendorId } = auth.ctx

  const { kind, contentType } = await req.json().catch(() => ({})) as { kind?: string; contentType?: string }
  if (!contentType?.startsWith('image/')) {
    return NextResponse.json({ error: 'Nur Bilddateien erlaubt' }, { status: 400 })
  }

  const key = kind === 'logo'
    ? `marketplace/${vendorId}/logo-${randomUUID().slice(0, 8)}`
    : `marketplace/${vendorId}/photos/${randomUUID()}`

  const uploadUrl = await requestUploadUrl(key, contentType)
  return NextResponse.json({ uploadUrl, key })
}
