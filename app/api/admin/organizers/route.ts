// app/api/admin/organizers/route.ts
// Verwaltung: Veranstalter auflisten (offene Anfragen + Bestand) und anlegen.
// Zugriff nur für Accounts mit profiles.is_admin (requireAdmin).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

interface AdminListUser {
  id: string
  email?: string
  created_at?: string
  user_metadata?: Record<string, unknown>
}

async function listAllAuthUsers(admin: AdminClient): Promise<AdminListUser[]> {
  const users: AdminListUser[] = []
  let page = 1
  // Sicherheitslimit: max. 20 Seiten à 200 Nutzer
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    users.push(...(data.users as AdminListUser[]))
    if (data.users.length < 200) break
    page++
  }
  return users
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  try {
    const [authUsers, profilesRes, membersRes] = await Promise.all([
      listAllAuthUsers(admin),
      admin.from('profiles').select('id, name, email, is_approved_organizer, is_admin, created_at'),
      admin.from('event_members').select('user_id').eq('role', 'veranstalter'),
    ])

    const profiles = profilesRes.data ?? []
    const profileById = new Map(profiles.map(p => [p.id, p]))

    const eventCounts = new Map<string, number>()
    for (const m of membersRes.data ?? []) {
      eventCounts.set(m.user_id, (eventCounts.get(m.user_id) ?? 0) + 1)
    }

    // Offene Anfragen: Self-Service-Registrierung (/signup/veranstalter),
    // noch nicht freigeschaltet
    const pending = authUsers
      .filter(u => u.user_metadata?.signup_role === 'veranstalter')
      .filter(u => !profileById.get(u.id)?.is_approved_organizer)
      .map(u => ({
        id: u.id,
        name: profileById.get(u.id)?.name ?? (u.user_metadata?.name as string) ?? 'Unbekannt',
        email: u.email ?? profileById.get(u.id)?.email ?? '',
        company: (u.user_metadata?.company_name as string) ?? null,
        createdAt: u.created_at ?? null,
      }))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

    // Bestand: alle freigeschalteten Veranstalter
    const authById = new Map(authUsers.map(u => [u.id, u]))
    const organizers = profiles
      .filter(p => p.is_approved_organizer)
      .map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        company: (authById.get(p.id)?.user_metadata?.company_name as string) ?? null,
        eventCount: eventCounts.get(p.id) ?? 0,
        isAdmin: p.is_admin === true,
        createdAt: p.created_at ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ pending, organizers })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Laden fehlgeschlagen' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const company = typeof body.company === 'string' ? body.company.trim() : ''

  if (!name || !email || password.length < 8) {
    return NextResponse.json({ error: 'Name, E-Mail und Passwort (mind. 8 Zeichen) erforderlich' }, { status: 400 })
  }

  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      signup_role: 'veranstalter',
      ...(company ? { company_name: company } : {}),
    },
  })

  if (createErr || !newUser.user) {
    return NextResponse.json({ error: createErr?.message ?? 'Account konnte nicht erstellt werden' }, { status: 500 })
  }

  const { error: approveErr } = await admin.rpc('approve_organizer', { p_user_id: newUser.user.id })
  if (approveErr) {
    return NextResponse.json({ error: approveErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, userId: newUser.user.id })
}
