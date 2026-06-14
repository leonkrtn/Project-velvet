// app/api/admin/promo-codes/[id]/route.ts
//   PATCH  { active?: boolean }  → Code aktiv/inaktiv schalten
//   DELETE                       → Code löschen (Einlösungen werden mitgelöscht)
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params

  const b = await req.json().catch(() => null) as { active?: boolean } | null
  if (typeof b?.active !== 'boolean') {
    return NextResponse.json({ error: 'active (boolean) erforderlich' }, { status: 400 })
  }

  const { error } = await auth.admin.from('promo_codes').update({ active: b.active }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params

  const { error } = await auth.admin.from('promo_codes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
