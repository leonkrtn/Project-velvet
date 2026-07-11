import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { requestDownloadUrl } from '@/lib/files/worker-client'
import { loadAdminStats, type Counts } from '@/lib/marketplace/stats'

const emptyCounts = (): Counts => ({ profile_view: 0, contact_email: 0, contact_phone: 0, website: 0, social: 0, request: 0 })

// GET — Liste aller Marktplatz-Vendor-Profile (mit verknüpfter Login-E-Mail).
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  const { data: vendors, error } = await admin
    .from('dienstleister_profiles')
    .select('*')
    .eq('is_marketplace', true)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Verknüpfte Login-Accounts (user_dienstleister → profiles) auflösen.
  const ids = (vendors ?? []).map(v => v.id)
  const linkByVendor: Record<string, { user_id: string; email: string | null }> = {}
  if (ids.length) {
    const { data: links } = await admin
      .from('user_dienstleister')
      .select('dienstleister_id, user_id, profiles:profiles!user_dienstleister_user_id_fkey(email)')
      .in('dienstleister_id', ids)
    for (const raw of links ?? []) {
      const l = raw as unknown as {
        dienstleister_id: string
        user_id: string
        profiles?: { email: string | null } | { email: string | null }[] | null
      }
      const prof = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles
      linkByVendor[l.dienstleister_id] = { user_id: l.user_id, email: prof?.email ?? null }
    }
  }

  // Tracking-Statistik (best effort — leer, falls Migration noch nicht angewandt).
  let adminStats = { total: emptyCounts(), last30: emptyCounts(), series: [] as { day: string; counts: Counts }[], perVendor: {} as Record<string, { total: Counts; last30: Counts }> }
  try { adminStats = await loadAdminStats(admin) } catch { /* leer lassen */ }

  // Veröffentlichte Bewertungen pro Anbieter zählen.
  const reviewByVendor: Record<string, number> = {}
  if (ids.length) {
    const { data: revs } = await admin
      .from('marketplace_reviews')
      .select('dienstleister_id')
      .eq('status', 'published')
      .in('dienstleister_id', ids)
    for (const r of revs ?? []) reviewByVendor[r.dienstleister_id] = (reviewByVendor[r.dienstleister_id] ?? 0) + 1
  }

  const result = await Promise.all((vendors ?? []).map(async v => ({
    ...v,
    login_email: linkByVendor[v.id]?.email ?? v.email ?? null,
    login_user_id: linkByVendor[v.id]?.user_id ?? null,
    logo_url: v.logo_r2_key ? await requestDownloadUrl(v.logo_r2_key).catch(() => null) : null,
    stats: adminStats.perVendor[v.id] ?? { total: emptyCounts(), last30: emptyCounts() },
    review_count: reviewByVendor[v.id] ?? 0,
  })))

  return NextResponse.json({
    vendors: result,
    adminStats: { total: adminStats.total, last30: adminStats.last30, series: adminStats.series },
  })
}

// POST — neues Vendor-Profil + Login-Account anlegen.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const name = (body.name as string)?.trim()
  const email = (body.email as string)?.trim().toLowerCase()
  const password = body.password as string | undefined
  const category = (body.category as string)?.trim() || 'sonstiges'

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, E-Mail und Passwort erforderlich' }, { status: 400 })
  }

  // 1. Auth-Account anlegen
  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, signup_role: 'dienstleister' },
  })
  if (createErr || !newUser.user) {
    return NextResponse.json({ error: createErr?.message ?? 'Account konnte nicht erstellt werden' }, { status: 500 })
  }
  const userId = newUser.user.id

  // profiles.role auf dienstleister setzen (Trigger legt Zeile bereits an)
  await admin.from('profiles').update({ role: 'dienstleister', name, email }).eq('id', userId)

  // 2. Vendor-Profil anlegen
  const { data: vendor, error: vErr } = await admin
    .from('dienstleister_profiles')
    .insert({
      name,
      company_name: (body.companyName as string)?.trim() || null,
      category,
      email,
      phone: (body.phone as string)?.trim() || null,
      website: (body.website as string)?.trim() || null,
      description: (body.description as string)?.trim() || null,
      street: (body.street as string)?.trim() || null,
      zip: (body.zip as string)?.trim() || null,
      city: (body.city as string)?.trim() || null,
      price_range: (body.priceRange as string)?.trim() || null,
      is_marketplace: true,
      published: Boolean(body.published),
      moderation_status: 'approved',
    })
    .select('id')
    .single()
  if (vErr || !vendor) {
    // Rollback: Auth-Account wieder entfernen
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return NextResponse.json({ error: vErr?.message ?? 'Profil konnte nicht erstellt werden' }, { status: 500 })
  }

  // 3. Verknüpfung Login ↔ Vendor
  await admin.from('user_dienstleister').insert({ user_id: userId, dienstleister_id: vendor.id })

  return NextResponse.json({ success: true, id: vendor.id, userId })
}
