import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyOrganizerRequest } from '@/lib/admin/notify'

// POST — Best-Effort-Hinweis an die Admins, dass sich ein Veranstalter neu
// registriert hat. Der Veranstalter-Signup läuft rein clientseitig über
// supabase.auth.signUp (kein Server-Hook), daher meldet der Client hier.
//
// Missbrauchsschutz: Es wird NUR benachrichtigt, wenn wirklich ein passendes,
// noch nicht freigeschaltetes Profil existiert, das gerade eben angelegt wurde.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { email?: string }
  const email = (body.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ ok: false }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('name, email, role, is_approved_organizer, created_at')
    .ilike('email', email)
    .maybeSingle()

  // Nur echte, frische, noch nicht freigeschaltete Veranstalter-Anträge.
  if (!profile || profile.is_approved_organizer || profile.role === 'dienstleister') {
    return NextResponse.json({ ok: true })
  }
  const ageMs = profile.created_at ? Date.now() - new Date(profile.created_at).getTime() : Infinity
  if (ageMs > 15 * 60 * 1000) return NextResponse.json({ ok: true })

  await notifyOrganizerRequest(admin, { name: profile.name ?? null, email: profile.email ?? email })
  return NextResponse.json({ ok: true })
}
