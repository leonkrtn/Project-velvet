import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireAdmin } from '@/lib/admin/require-admin'
import { requestUploadUrl } from '@/lib/files/worker-client'

// POST — presigned R2-Upload-URL für Logo oder Galerie-Foto anfordern.
// Body: { kind: 'logo' | 'photo', contentType: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params

  const { kind, contentType } = await req.json().catch(() => ({})) as { kind?: string; contentType?: string }
  if (!contentType?.startsWith('image/')) {
    return NextResponse.json({ error: 'Nur Bilddateien erlaubt' }, { status: 400 })
  }

  const key = kind === 'logo'
    ? `marketplace/${id}/logo`
    : `marketplace/${id}/photos/${randomUUID()}`

  const uploadUrl = await requestUploadUrl(key, contentType)
  return NextResponse.json({ uploadUrl, key })
}
