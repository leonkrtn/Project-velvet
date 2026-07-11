import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { ADMIN_NOTIF_DEFAULT_TYPES, ADMIN_NOTIF_TYPES } from '@/lib/admin/notify'

// GET — alle Benachrichtigungs-Empfänger. Ist die Liste leer, wird die
// eingeloggte Admin-Adresse einmalig mit allen Typen als erster Empfänger
// angelegt (bequemer Start; danach frei editier-/löschbar).
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin, userId } = auth

  let { data } = await admin
    .from('admin_notification_recipients')
    .select('id, email, label, enabled, types, created_at')
    .order('created_at', { ascending: true })

  if (!data || data.length === 0) {
    const { data: profile } = await admin.from('profiles').select('email, name').eq('id', userId).maybeSingle()
    if (profile?.email) {
      const { data: seeded } = await admin
        .from('admin_notification_recipients')
        .insert({ email: profile.email, label: profile.name || 'Admin', types: ADMIN_NOTIF_DEFAULT_TYPES })
        .select('id, email, label, enabled, types, created_at')
      data = seeded ?? []
    }
  }

  return NextResponse.json({ recipients: data ?? [], types: ADMIN_NOTIF_TYPES })
}

// POST — neuen Empfänger anlegen (standardmäßig alle Typen aktiv).
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  const body = await req.json().catch(() => ({})) as { email?: string; label?: string }
  const email = (body.email || '').trim()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('admin_notification_recipients')
    .insert({ email, label: (body.label || '').trim() || null, types: ADMIN_NOTIF_DEFAULT_TYPES })
    .select('id, email, label, enabled, types, created_at')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Diese Adresse ist bereits hinterlegt.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ recipient: data })
}
