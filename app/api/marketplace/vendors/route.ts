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
    .select('id, name, company_name, category, city, price_range, description, logo_r2_key')
    .eq('is_marketplace', true)
    .eq('published', true)

  const category = sp.get('category')
  const city = sp.get('city')
  const q = sp.get('q')
  if (category) query = query.eq('category', category)
  if (city) query = query.ilike('city', `%${city}%`)
  if (q) query = query.or(`name.ilike.%${q}%,company_name.ilike.%${q}%,description.ilike.%${q}%`)

  const { data, error } = await query.order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const vendors = await Promise.all((data ?? []).map(async v => ({
    id: v.id,
    name: v.name,
    company_name: v.company_name,
    category: v.category,
    city: v.city,
    price_range: v.price_range,
    description: v.description,
    logo_url: v.logo_r2_key ? await requestDownloadUrl(v.logo_r2_key).catch(() => null) : null,
  })))
  return NextResponse.json({ vendors })
}
