import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requestDownloadUrl } from '@/lib/files/worker-client'

// GET — veröffentlichte Marktplatz-Vendors durchsuchen.
// Query: ?category=&city=&q=  oder  ?id=<vendorId> für Detail (inkl. aller Fotos)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const admin = createAdminClient()
  const sp = req.nextUrl.searchParams
  const id = sp.get('id')

  if (id) {
    const { data: v } = await admin
      .from('dienstleister_profiles')
      .select('*')
      .eq('id', id)
      .eq('is_marketplace', true)
      .eq('published', true)
      .eq('moderation_status', 'approved')
      .maybeSingle()
    if (!v) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

    const { data: photos } = await admin
      .from('marketplace_vendor_photos')
      .select('id, r2_key, sort_order')
      .eq('dienstleister_id', id)
      .order('sort_order')

    const vendor = {
      ...v,
      logo_url: v.logo_r2_key ? await requestDownloadUrl(v.logo_r2_key).catch(() => null) : null,
      photos: await Promise.all((photos ?? []).map(async p => ({
        id: p.id, url: await requestDownloadUrl(p.r2_key).catch(() => null),
      }))),
    }
    return NextResponse.json({ vendor })
  }

  let query = admin
    .from('dienstleister_profiles')
    .select('id, company_name, category, city, price_range, description, logo_r2_key, verified, tier, service_cities, service_radius_km')
    .eq('is_marketplace', true)
    .eq('published', true)
    .eq('moderation_status', 'approved')

  const category = sp.get('category')
  const q = sp.get('q')
  if (category) query = query.eq('category', category)
  if (q) query = query.or(`company_name.ilike.%${q}%,description.ilike.%${q}%`)

  const { data, error } = await query.order('company_name', { nullsFirst: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Erstes Galerie-Foto je Vendor als Cover ermitteln (für bildgeführte Karten)
  const ids = (data ?? []).map(v => v.id)
  const coverByVendor: Record<string, string> = {}
  if (ids.length) {
    const { data: photos } = await admin
      .from('marketplace_vendor_photos')
      .select('dienstleister_id, r2_key, sort_order')
      .in('dienstleister_id', ids)
      .order('sort_order')
    for (const p of photos ?? []) {
      const dlId = (p as { dienstleister_id: string }).dienstleister_id
      if (!coverByVendor[dlId]) coverByVendor[dlId] = (p as { r2_key: string }).r2_key
    }
  }

  const vendors = await Promise.all((data ?? []).map(async v => {
    const logoUrl = v.logo_r2_key ? await requestDownloadUrl(v.logo_r2_key).catch(() => null) : null
    const coverKey = coverByVendor[v.id]
    const coverUrl = coverKey ? await requestDownloadUrl(coverKey).catch(() => null) : null
    return {
      id: v.id,
      company_name: v.company_name,
      category: v.category,
      city: v.city,
      price_range: v.price_range,
      description: v.description,
      logo_url: logoUrl,
      cover_url: coverUrl ?? logoUrl,
      verified: !!v.verified,
      tier: v.tier ?? 'free',
      service_cities: (v.service_cities as string[]) ?? [],
      service_radius_km: v.service_radius_km ?? null,
    }
  }))

  // Featured/Premium-Anbieter zuerst (Architektur für spätere Monetarisierung).
  const rank: Record<string, number> = { premium: 0, featured: 1, free: 2 }
  vendors.sort((a, b) => (rank[a.tier] ?? 2) - (rank[b.tier] ?? 2))

  return NextResponse.json({ vendors, count: vendors.length })
}
