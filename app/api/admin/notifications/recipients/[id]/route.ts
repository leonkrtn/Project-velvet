import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { ADMIN_NOTIF_TYPES, type AdminNotifType } from '@/lib/admin/notify'

const VALID_TYPES = new Set<string>(ADMIN_NOTIF_TYPES.map(t => t.key))

// PATCH — Empfänger ändern: Label, aktiv-Status, einzelne Typ-Toggles.
// Body: { label?, enabled?, type?: <key>, value?: boolean, email? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth
  const { id } = await params

  const body = await req.json().catch(() => ({})) as {
    label?: string; enabled?: boolean; email?: string; type?: string; value?: boolean
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.label === 'string') patch.label = body.label.trim() || null
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
  if (typeof body.email === 'string') {
    const email = body.email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 })
    patch.email = email
  }

  // Einzelnen Typ-Toggle setzen (Merge in die bestehende types-Map).
  if (typeof body.type === 'string' && typeof body.value === 'boolean') {
    if (!VALID_TYPES.has(body.type)) return NextResponse.json({ error: 'Unbekannter Typ.' }, { status: 400 })
    const { data: current } = await admin
      .from('admin_notification_recipients').select('types').eq('id', id).maybeSingle()
    if (!current) return NextResponse.json({ error: 'Empfänger nicht gefunden.' }, { status: 404 })
    const types = { ...(current.types as Record<string, boolean> | null ?? {}), [body.type as AdminNotifType]: body.value }
    patch.types = types
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Keine Änderung.' }, { status: 400 })

  const { data, error } = await admin
    .from('admin_notification_recipients')
    .update(patch)
    .eq('id', id)
    .select('id, email, label, enabled, types, created_at')
    .single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Diese Adresse ist bereits hinterlegt.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ recipient: data })
}

// DELETE — Empfänger entfernen.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth
  const { id } = await params
  const { error } = await admin.from('admin_notification_recipients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
