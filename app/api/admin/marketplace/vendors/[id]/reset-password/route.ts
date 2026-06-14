import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'

// POST — Passwort des verknüpften Vendor-Logins zurücksetzen.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth
  const { id } = await params

  const { password } = await req.json().catch(() => ({})) as { password?: string }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Passwort muss mind. 8 Zeichen haben' }, { status: 400 })
  }

  const { data: link } = await admin
    .from('user_dienstleister')
    .select('user_id')
    .eq('dienstleister_id', id)
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'Kein Login verknüpft' }, { status: 404 })

  const { error } = await admin.auth.admin.updateUserById((link as { user_id: string }).user_id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
