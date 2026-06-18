import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { SENSITIVE_FIELDS } from '@/lib/marketplace/types'

// POST — Moderationsaktion auf ein Marktplatz-Profil.
// Body: { action: 'approve' | 'reject' | 'verify' | 'unverify' | 'suspend' | 'unsuspend', reason? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth
  const { id } = await params
  const { action, reason } = await req.json().catch(() => ({})) as { action?: string; reason?: string }

  const { data: v } = await admin
    .from('dienstleister_profiles')
    .select('moderation_status, pending_changes')
    .eq('id', id)
    .eq('is_marketplace', true)
    .maybeSingle()
  if (!v) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const pending = (v.pending_changes as Record<string, unknown> | null) ?? null

  if (action === 'approve') {
    const patch: Record<string, unknown> = { moderation_status: 'approved', rejected_reason: null }
    if (pending) {
      // Gestaffelte Änderungen an einem freigegebenen Profil übernehmen —
      // Online-Status bleibt unverändert.
      for (const key of SENSITIVE_FIELDS) {
        if (key in pending) patch[key] = pending[key]
      }
      patch.pending_changes = null
    } else {
      // Erst-/Neufreigabe → sofort im Marktplatz sichtbar.
      patch.published = true
    }
    const { error } = await admin.from('dienstleister_profiles').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'reject') {
    if (pending) {
      // Es ging nur um Änderungen an einem freigegebenen Profil → verwerfen,
      // Live-Version bleibt unverändert online.
      const { error } = await admin.from('dienstleister_profiles')
        .update({ pending_changes: null })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, discardedChanges: true })
    }
    const { error } = await admin.from('dienstleister_profiles')
      .update({ moderation_status: 'rejected', rejected_reason: (reason ?? '').trim() || 'Bitte überarbeite dein Profil.', published: false })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'verify' || action === 'unverify') {
    const verified = action === 'verify'
    const { error } = await admin.from('dienstleister_profiles')
      .update({ verified, verified_at: verified ? new Date().toISOString() : null })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'suspend') {
    const { error } = await admin.from('dienstleister_profiles')
      .update({ moderation_status: 'suspended' })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'unsuspend') {
    const { error } = await admin.from('dienstleister_profiles')
      .update({ moderation_status: 'approved' })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
