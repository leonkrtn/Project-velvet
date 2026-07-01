// app/api/geschenke/[wishId]/image/route.ts
// Product image upload for a Geschenk-Wunsch (geschenk_wuensche.image_r2_key).
// Same R2 presigned-upload pattern as app/api/files/request-upload/route.ts, but
// scoped to a dedicated, lightweight flow — only a presigned URL is generated here;
// the resulting r2_key is written to geschenk_wuensche.image_r2_key by the client via
// the normal Supabase update/insert call (RLS-protected, same as title/description),
// see GeschenkTab.tsx `save()`.
//   POST   → validate auth+permission, return presigned PUT URL for a new image
//   DELETE → best-effort remove an R2 object (called when replacing/removing an image
//            before the wish row is saved with the new key)
// wishId is "new" for a not-yet-created wish — permission is then checked on eventId
// (passed in the body) instead of an existing row.
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEventRole } from '@/lib/files/permissions'
import { requestUploadUrl, deleteR2Object } from '@/lib/files/worker-client'
import { sanitizeFilename } from '@/lib/files/types'

const EDIT_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
const MAX_IMAGE_BYTES = 15 * 1024 * 1024 // 15 MB

interface Params { params: Promise<{ wishId: string }> }

async function resolveEventId(wishId: string, bodyEventId: string | undefined): Promise<
  { eventId: string } | { error: NextResponse }
> {
  if (wishId === 'new') {
    if (!bodyEventId) return { error: NextResponse.json({ error: 'eventId fehlt' }, { status: 400 }) }
    return { eventId: bodyEventId }
  }
  const admin = createAdminClient()
  const { data: wish } = await admin
    .from('geschenk_wuensche')
    .select('event_id')
    .eq('id', wishId)
    .maybeSingle()
  if (!wish) return { error: NextResponse.json({ error: 'Wunsch nicht gefunden' }, { status: 404 }) }
  return { eventId: wish.event_id }
}

async function authForEvent(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) }

  const role = await getEventRole(supabase, user.id, eventId)
  if (!role || !EDIT_ROLES.includes(role)) {
    return { error: NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 }) }
  }
  return { user }
}

// POST — request a presigned PUT URL for a new product image
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { wishId } = await params

    const body = await request.json().catch(() => ({}))
    const { filename, contentType, sizeBytes, eventId: bodyEventId } = body as {
      filename?: string; contentType?: string; sizeBytes?: number; eventId?: string
    }

    const resolved = await resolveEventId(wishId, bodyEventId)
    if ('error' in resolved) return resolved.error
    const { eventId } = resolved

    const auth = await authForEvent(eventId)
    if ('error' in auth) return auth.error

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })
    }
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Nur Bilddateien erlaubt (JPEG, PNG, WebP, GIF, HEIC)' }, { status: 400 })
    }
    if (sizeBytes && sizeBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Bild zu groß (max. 15 MB)' }, { status: 400 })
    }

    const safeFilename = sanitizeFilename(filename)
    const r2Key = `events/${eventId}/geschenke/${randomUUID()}-${safeFilename}`

    const uploadUrl = await requestUploadUrl(r2Key, contentType)

    return NextResponse.json({ uploadUrl, r2Key })
  } catch (err) {
    console.error('[geschenke/image POST]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}

// DELETE — best-effort remove an R2 object by key (e.g. replacing/clearing an image
// in the modal before save, or removing the image of an already-saved wish).
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { wishId } = await params

    const body = await request.json().catch(() => ({}))
    const { r2Key, eventId: bodyEventId } = body as { r2Key?: string; eventId?: string }
    if (!r2Key) return NextResponse.json({ error: 'r2Key fehlt' }, { status: 400 })

    const resolved = await resolveEventId(wishId, bodyEventId)
    if ('error' in resolved) return resolved.error
    const { eventId } = resolved

    const auth = await authForEvent(eventId)
    if ('error' in auth) return auth.error

    if (!r2Key.startsWith(`events/${eventId}/geschenke/`)) {
      return NextResponse.json({ error: 'Ungültiger Schlüssel' }, { status: 400 })
    }

    // If this is an existing, saved wish, clear the column too (defense in depth —
    // the client also persists this via the normal Supabase update on save).
    if (wishId !== 'new') {
      const admin = createAdminClient()
      await admin
        .from('geschenk_wuensche')
        .update({ image_r2_key: null })
        .eq('id', wishId)
        .eq('image_r2_key', r2Key)
    }

    try {
      await deleteR2Object(r2Key)
    } catch (r2Err) {
      console.error('[geschenke/image DELETE] R2 delete failed:', r2Err)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[geschenke/image DELETE]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
