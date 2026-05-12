import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canDeleteFile, getEventRole } from '@/lib/files/permissions'
import { deleteR2Object } from '@/lib/files/worker-client'

interface Params { params: Promise<{ fileId: string }> }

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { fileId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const admin = createAdminClient()

    const { data: file } = await admin
      .from('file_metadata')
      .select('id, event_id, r2_key, original_name, uploaded_by, status')
      .eq('id', fileId)
      .maybeSingle()

    if (!file || file.status === 'deleted') {
      return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 })
    }

    const role = await getEventRole(supabase, user.id, file.event_id)
    const allowed = await canDeleteFile(supabase, user.id, file.event_id, file.uploaded_by)
    if (!allowed || !role) {
      return NextResponse.json({ error: 'Keine Löschberechtigung' }, { status: 403 })
    }

    // Soft-delete in DB first — if R2 delete fails, record is still marked deleted
    const { error: dbErr } = await admin
      .from('file_metadata')
      .update({ status: 'deleted' })
      .eq('id', fileId)

    if (dbErr) {
      console.error('[files/delete] DB update:', dbErr)
      return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
    }

    // Hard-delete from R2 (best-effort)
    try {
      await deleteR2Object(file.r2_key)
    } catch (r2Err) {
      // Log but don't fail — DB record already soft-deleted, object can be cleaned up later
      console.error('[files/delete] R2 delete failed (soft-delete succeeded):', r2Err)
    }

    await admin.from('file_access_log').insert({
      file_id: fileId,
      event_id: file.event_id,
      user_id: user.id,
      action: 'delete',
      meta: { filename: file.original_name },
    })

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[files/delete]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
