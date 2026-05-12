import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canUploadFiles } from '@/lib/files/permissions'
import { requestUploadUrl } from '@/lib/files/worker-client'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  sanitizeFilename,
  type FileModule,
} from '@/lib/files/types'

interface RequestBody {
  eventId: string
  module: FileModule
  filename: string
  contentType: string
  sizeBytes?: number
  category?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const body = await request.json() as RequestBody
    const { eventId, module, filename, contentType, sizeBytes, category = 'sonstiges' } = body

    if (!eventId || !module || !filename || !contentType) {
      return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })
    }

    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Dateityp nicht erlaubt' }, { status: 400 })
    }

    if (sizeBytes && sizeBytes > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Datei zu groß (max. 500 MB)' }, { status: 400 })
    }

    const allowed = await canUploadFiles(supabase, user.id, eventId, module)
    if (!allowed) {
      return NextResponse.json({ error: 'Keine Upload-Berechtigung für dieses Modul' }, { status: 403 })
    }

    const fileId = randomUUID()
    const safeFilename = sanitizeFilename(filename)
    // R2 key structure: events/{eventId}/{module}/{fileId}/{filename}
    const r2Key = `events/${eventId}/${module}/${fileId}/${safeFilename}`

    // Insert pending record via service role (bypasses RLS)
    const admin = createAdminClient()
    const { error: dbErr } = await admin.from('file_metadata').insert({
      id: fileId,
      event_id: eventId,
      r2_key: r2Key,
      original_name: filename,
      mime_type: contentType,
      size_bytes: sizeBytes ?? null,
      module,
      category,
      uploaded_by: user.id,
      status: 'pending',
    })

    if (dbErr) {
      console.error('[files/request-upload] DB insert:', dbErr)
      return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
    }

    // Request presigned PUT URL from Cloudflare Worker
    const uploadUrl = await requestUploadUrl(r2Key, contentType)

    // Audit: record upload intent
    await admin.from('file_access_log').insert({
      file_id: fileId,
      event_id: eventId,
      user_id: user.id,
      action: 'upload',
      meta: { filename, contentType, sizeBytes: sizeBytes ?? null, module },
    })

    return NextResponse.json({ fileId, uploadUrl, r2Key })
  } catch (err) {
    console.error('[files/request-upload]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
