import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildModuleSnapshot } from '@/lib/vendor/snapshot'
import type { ShareModule } from '@/lib/vendor/shares'

interface Params { params: Promise<{ shareId: string }> }

const COUPLE_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

// GET — returns the share + its rendered snapshot.
// Live shares are rebuilt fresh on every read; snapshot/frozen return stored data.
export async function GET(_req: NextRequest, { params }: Params) {
  const { shareId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  // RLS ensures only conversation participants can read the row.
  const { data: share } = await supabase
    .from('dienstleister_data_shares')
    .select('id, event_id, conversation_id, module, mode, status, snapshot, created_at, updated_at')
    .eq('id', shareId)
    .maybeSingle()

  if (!share) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  if (share.status === 'revoked') {
    return NextResponse.json({ error: 'Diese Freigabe wurde zurückgezogen', status: 'revoked' }, { status: 410 })
  }

  let snapshot = share.snapshot
  if (share.mode === 'live' && share.status === 'active') {
    const admin = createAdminClient()
    snapshot = await buildModuleSnapshot(admin, share.event_id, share.module as ShareModule)
  }

  return NextResponse.json({ share: { ...share, snapshot } })
}

// PATCH { action: 'freeze' | 'revoke' | 'reactivate' } — couple/organizer only.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { shareId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { action } = await req.json() as { action: 'freeze' | 'revoke' | 'reactivate' }

  const admin = createAdminClient()
  const { data: share } = await admin
    .from('dienstleister_data_shares')
    .select('id, event_id, module, mode, status')
    .eq('id', shareId)
    .maybeSingle()
  if (!share) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const { data: member } = await admin
    .from('event_members')
    .select('role')
    .eq('event_id', share.event_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member || !COUPLE_ROLES.includes(member.role as string)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (action === 'freeze') {
    // Capture current data so the box is fixed from now on.
    patch.status = 'frozen'
    patch.mode = 'snapshot'
    patch.snapshot = await buildModuleSnapshot(admin, share.event_id, share.module as ShareModule)
  } else if (action === 'revoke') {
    patch.status = 'revoked'
  } else if (action === 'reactivate') {
    patch.status = 'active'
  } else {
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
  }

  const { error } = await admin.from('dienstleister_data_shares').update(patch).eq('id', shareId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, status: patch.status ?? share.status })
}
