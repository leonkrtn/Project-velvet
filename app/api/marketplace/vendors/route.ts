import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requestDownloadUrl } from '@/lib/files/worker-client'

// Max. Anzahl Galerie-Bilder, die pro Vendor in der Listing-Karte mitgeliefert werden.
const CARD_GALLERY_LIMIT = 5

// GET — veröffentlichte Marktplatz-Vendors durchsuchen.
// Query: ?category=&city=&q=&date=YYYY-MM-DD  oder  ?id=<vendorId> für Detail (inkl. aller Fotos)
// date: Hochzeitstermin — liefert pro Vendor booked_on_date (true, wenn der Tag
// in marketplace_availability als belegt/blockiert markiert ist).
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
    .select('id, company_name, category, city, company_city, price_range, description, logo_r2_key, verified, tier, service_cities, service_radius_km')
    .eq('is_marketplace', true)
    .eq('published', true)
    .eq('moderation_status', 'approved')

  const category = sp.get('category')
  const q = sp.get('q')
  if (category) query = query.eq('category', category)
  if (q) query = query.or(`company_name.ilike.%${q}%,description.ilike.%${q}%`)

  const { data, error } = await query.order('company_name', { nullsFirst: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Galerie-Fotos je Vendor ermitteln (für bildgeführte Karten + Slider; max. CARD_GALLERY_LIMIT).
  const ids = (data ?? []).map(v => v.id)
  const photosByVendor: Record<string, string[]> = {}
  // Bewertungs-Aggregat + Termin-Belegung je Vendor
  const ratingByVendor: Record<string, { sum: number; count: number }> = {}
  const bookedOnDate = new Set<string>()
  const date = sp.get('date')
  if (ids.length) {
    const [{ data: photos }, { data: reviewRows }, availRes] = await Promise.all([
      admin
        .from('marketplace_vendor_photos')
        .select('dienstleister_id, r2_key, sort_order')
        .in('dienstleister_id', ids)
        .order('sort_order'),
      admin
        .from('marketplace_reviews')
        .select('dienstleister_id, rating')
        .eq('status', 'published')
        .in('dienstleister_id', ids),
      date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? admin
            .from('marketplace_availability')
            .select('dienstleister_id')
            .eq('day', date)
            .in('dienstleister_id', ids)
        : Promise.resolve({ data: null }),
    ])
    for (const p of photos ?? []) {
      const dlId = (p as { dienstleister_id: string }).dienstleister_id
      const list = photosByVendor[dlId] ?? (photosByVendor[dlId] = [])
      if (list.length < CARD_GALLERY_LIMIT) list.push((p as { r2_key: string }).r2_key)
    }
    for (const r of reviewRows ?? []) {
      const agg = ratingByVendor[r.dienstleister_id] ?? (ratingByVendor[r.dienstleister_id] = { sum: 0, count: 0 })
      agg.sum += r.rating
      agg.count += 1
    }
    for (const a of availRes.data ?? []) bookedOnDate.add(a.dienstleister_id)
  }

  const vendors = await Promise.all((data ?? []).map(async v => {
    const logoUrl = v.logo_r2_key ? await requestDownloadUrl(v.logo_r2_key).catch(() => null) : null
    const galleryKeys = photosByVendor[v.id] ?? []
    const galleryUrls = (await Promise.all(galleryKeys.map(k => requestDownloadUrl(k).catch(() => null))))
      .filter((u): u is string => !!u)
    const coverUrl = galleryUrls[0] ?? null
    const agg = ratingByVendor[v.id]
    return {
      id: v.id,
      company_name: v.company_name,
      category: v.category,
      city: v.city,
      company_city: v.company_city ?? null,
      price_range: v.price_range,
      description: v.description,
      logo_url: logoUrl,
      cover_url: coverUrl ?? logoUrl,
      gallery_urls: galleryUrls.length ? galleryUrls : (logoUrl ? [logoUrl] : []),
      verified: !!v.verified,
      tier: v.tier ?? 'free',
      service_cities: (v.service_cities as string[]) ?? [],
      service_radius_km: v.service_radius_km ?? null,
      review_avg: agg ? Math.round((agg.sum / agg.count) * 10) / 10 : 0,
      review_count: agg?.count ?? 0,
      booked_on_date: bookedOnDate.has(v.id),
    }
  }))

  // Featured/Premium-Anbieter zuerst (Architektur für spätere Monetarisierung).
  const rank: Record<string, number> = { premium: 0, featured: 1, free: 2 }
  vendors.sort((a, b) => (rank[a.tier] ?? 2) - (rank[b.tier] ?? 2))

  return NextResponse.json({ vendors, count: vendors.length })
}
