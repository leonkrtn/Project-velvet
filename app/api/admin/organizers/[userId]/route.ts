// app/api/admin/organizers/[userId]/route.ts
// Verwaltung: einzelnen Veranstalter freischalten / Freischaltung entziehen
// (PATCH) oder Account komplett löschen (DELETE — auch für abgelehnte
// Anfragen). Zugriff nur für Admins.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin, userId: callerId } = auth
  const { userId } = await params

  const { action } = await request.json().catch(() => ({})) as { action?: string }

  if (action === 'approve') {
    const { error } = await admin.rpc('approve_organizer', { p_user_id: userId })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'revoke') {
    if (userId === callerId) {
      return NextResponse.json({ error: 'Du kannst dir nicht selbst die Freischaltung entziehen.' }, { status: 400 })
    }
    const { error } = await admin
      .from('profiles')
      .update({ is_approved_organizer: false })
      .eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin, userId: callerId } = auth
  const { userId } = await params

  if (userId === callerId) {
    return NextResponse.json({ error: 'Du kannst deinen eigenen Account nicht löschen.' }, { status: 400 })
  }

  // Andere Admins nicht über diese Oberfläche löschen
  const { data: target } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()
  if (target?.is_admin) {
    return NextResponse.json({ error: 'Admin-Accounts können hier nicht gelöscht werden.' }, { status: 400 })
  }

  // Löscht auth.users → profiles (CASCADE) → event_members (CASCADE).
  // Events bleiben bestehen (events.created_by ist ON DELETE SET NULL).
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
