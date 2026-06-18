import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { requestDownloadUrl } from '@/lib/files/worker-client'
import { SENSITIVE_FIELDS } from '@/lib/marketplace/types'

// GET — vollständige Vorschaudaten eines Profils für die Admin-Prüfung. Liefert
// exakt die Felder der Kundenansicht. Bei Änderungs-Prüfungen werden die
// vorgeschlagenen (pending_changes) Werte eingemischt, damit der Admin die neue
// Version sieht.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth
  const { id } = await params

  const { data: v } = await admin.from('dienstleister_profiles').select('*').eq('id', id).maybeSingle()
  if (!v) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  // Vorgeschlagene sensible Änderungen einmischen.
  const pc = (v.pending_changes as Record<string, unknown> | null) ?? {}
  const merged: Record<string, unknown> = { ...v }
  for (const key of SENSITIVE_FIELDS) {
    if (key in pc) merged[key] = pc[key]
  }

  const [{ data: photoRows }, { data: packages }, { data: faqs }, { data: reviewRows }, { data: availability }] = await Promise.all([
    admin.from('marketplace_vendor_photos').select('id, r2_key, sort_order').eq('dienstleister_id', id).order('sort_order'),
    admin.from('marketplace_packages').select('id, title, description, price_from, price_unit').eq('dienstleister_id', id).order('sort_order'),
    admin.from('marketplace_faqs').select('id, question, answer').eq('dienstleister_id', id).order('sort_order'),
    admin.from('marketplace_reviews').select('id, author_name, rating, title, body, created_at').eq('dienstleister_id', id).eq('status', 'published').order('created_at', { ascending: false }),
    admin.from('marketplace_availability').select('day').eq('dienstleister_id', id).gte('day', new Date().toISOString().slice(0, 10)).order('day'),
  ])

  const photos = (await Promise.all((photoRows ?? []).map(async p => ({
    id: p.id, url: await requestDownloadUrl(p.r2_key).catch(() => null),
  })))).filter(p => p.url) as { id: string; url: string }[]

  const logoKey = (merged.logo_r2_key as string | null) ?? null
  const logoUrl = logoKey ? await requestDownloadUrl(logoKey).catch(() => null) : null

  const reviews = reviewRows ?? []
  const reviewCount = reviews.length
  const reviewAvg = reviewCount ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10 : 0

  return NextResponse.json({
    vendor: {
      company_name: merged.company_name ?? null,
      category: merged.category ?? 'sonstiges',
      description: merged.description ?? null,
      street: merged.street ?? null, zip: merged.zip ?? null, city: merged.city ?? null,
      price_range: merged.price_range ?? null,
      verified: !!v.verified,
      social_links: (v.social_links as Record<string, string>) ?? {},
      service_cities: (v.service_cities as string[]) ?? [],
      service_radius_km: v.service_radius_km ?? null,
      logo_url: logoUrl,
      photos,
    },
    packages: packages ?? [],
    faqs: faqs ?? [],
    reviews,
    reviewAvg,
    reviewCount,
    availability: (availability ?? []).map(a => a.day),
    meta: {
      moderation_status: v.moderation_status,
      has_pending: Object.keys(pc).length > 0,
      pending_fields: Object.keys(pc),
      login_email: v.email ?? null,
    },
  })
}
