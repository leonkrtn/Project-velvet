export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requestDownloadUrl } from '@/lib/files/worker-client'
import AnbieterDetailClient from './AnbieterDetailClient'

export default async function AnbieterDetailPage({ params }: { params: Promise<{ eventId: string; vendorId: string }> }) {
  const { eventId, vendorId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).maybeSingle()
  if (!member) redirect('/login')

  const admin = createAdminClient()
  const { data: v } = await admin
    .from('dienstleister_profiles')
    .select('id, company_name, category, email, phone, website, description, street, zip, city, company_street, company_zip, company_city, price_range, logo_r2_key, verified, social_links, service_cities, service_radius_km, video_urls, audio_r2_key, audio_title')
    .eq('id', vendorId).eq('is_marketplace', true).eq('published', true).eq('moderation_status', 'approved').maybeSingle()
  if (!v) redirect(`/brautpaar/${eventId}/dienstleister`)

  const [{ data: photoRows }, { data: packages }, { data: faqs }, { data: reviewRows }, { data: availability }, { data: existing }] = await Promise.all([
    admin.from('marketplace_vendor_photos').select('id, r2_key, sort_order').eq('dienstleister_id', vendorId).order('sort_order'),
    admin.from('marketplace_packages').select('id, title, description, price_from, price_unit').eq('dienstleister_id', vendorId).order('sort_order'),
    admin.from('marketplace_faqs').select('id, question, answer').eq('dienstleister_id', vendorId).order('sort_order'),
    admin.from('marketplace_reviews').select('id, author_name, rating, title, body, created_at, photo_r2_keys').eq('dienstleister_id', vendorId).eq('status', 'published').order('created_at', { ascending: false }),
    admin.from('marketplace_availability').select('day, status').eq('dienstleister_id', vendorId).gte('day', new Date().toISOString().slice(0, 10)).order('day'),
    admin.from('marketplace_requests').select('id, status, conversation_id').eq('event_id', eventId).eq('dienstleister_id', vendorId).in('status', ['pending', 'accepted']).order('created_at', { ascending: false }).maybeSingle(),
  ])

  const photos = await Promise.all((photoRows ?? []).map(async p => ({
    id: p.id, url: await requestDownloadUrl(p.r2_key).catch(() => null),
  })))
  const logoUrl = v.logo_r2_key ? await requestDownloadUrl(v.logo_r2_key).catch(() => null) : null
  const audioUrl = v.audio_r2_key ? await requestDownloadUrl(v.audio_r2_key).catch(() => null) : null

  // Kontaktfreigabe & Bewertungsberechtigung: nur nach angenommener Zusammenarbeit.
  const accepted = existing?.status === 'accepted'
  const { data: edRow } = await admin
    .from('event_dienstleister').select('id').eq('event_id', eventId).eq('dienstleister_id', vendorId).eq('status', 'akzeptiert').maybeSingle()
  const hasCollaboration = accepted || !!edRow

  const reviews = reviewRows ?? []
  const reviewCount = reviews.length
  const reviewAvg = reviewCount ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10 : 0

  // Bewertungs-Fotos auflösen (presigned GET, 1h); R2-Keys bleiben serverseitig.
  const reviewsWithPhotos = await Promise.all(reviews.map(async r => ({
    id: r.id, author_name: r.author_name, rating: r.rating, title: r.title, body: r.body, created_at: r.created_at,
    photo_urls: (await Promise.all(((r.photo_r2_keys as string[]) ?? []).map(k => requestDownloadUrl(k).catch(() => null))))
      .filter((u): u is string => !!u),
  })))

  // ── Ähnliche Anbieter: gleiche Kategorie, beste Bewertung zuerst ────────────
  const { data: similarRows } = await admin
    .from('dienstleister_profiles')
    .select('id, company_name, category, city, company_city, logo_r2_key, verified')
    .eq('is_marketplace', true).eq('published', true).eq('moderation_status', 'approved')
    .eq('category', v.category)
    .neq('id', vendorId)
    .limit(8)
  const similarIds = (similarRows ?? []).map(s => s.id)
  const similarRatings: Record<string, { sum: number; count: number }> = {}
  const similarCoverKeys: Record<string, string> = {}
  if (similarIds.length) {
    const [{ data: simReviews }, { data: simPhotos }] = await Promise.all([
      admin.from('marketplace_reviews').select('dienstleister_id, rating').eq('status', 'published').in('dienstleister_id', similarIds),
      admin.from('marketplace_vendor_photos').select('dienstleister_id, r2_key, sort_order').in('dienstleister_id', similarIds).order('sort_order'),
    ])
    for (const r of simReviews ?? []) {
      const a = similarRatings[r.dienstleister_id] ?? (similarRatings[r.dienstleister_id] = { sum: 0, count: 0 })
      a.sum += r.rating; a.count += 1
    }
    for (const p of simPhotos ?? []) {
      if (!similarCoverKeys[p.dienstleister_id]) similarCoverKeys[p.dienstleister_id] = p.r2_key
    }
  }
  const similar = (await Promise.all((similarRows ?? [])
    .map(s => {
      const agg = similarRatings[s.id]
      return {
        row: s,
        review_avg: agg ? Math.round((agg.sum / agg.count) * 10) / 10 : 0,
        review_count: agg?.count ?? 0,
      }
    })
    .sort((a, b) => (b.review_avg - a.review_avg) || (b.review_count - a.review_count))
    .slice(0, 3)
    .map(async ({ row, review_avg, review_count }) => ({
      id: row.id,
      company_name: row.company_name,
      city: row.company_city ?? row.city ?? null,
      verified: !!row.verified,
      review_avg,
      review_count,
      cover_url: similarCoverKeys[row.id]
        ? await requestDownloadUrl(similarCoverKeys[row.id]).catch(() => null)
        : (row.logo_r2_key ? await requestDownloadUrl(row.logo_r2_key).catch(() => null) : null),
    }))))

  return (
    <AnbieterDetailClient
      eventId={eventId}
      vendor={{
        id: v.id, company_name: v.company_name, category: v.category,
        email: v.email, phone: v.phone, website: v.website, description: v.description,
        street: v.street, zip: v.zip, city: v.city,
        company_street: v.company_street, company_zip: v.company_zip, company_city: v.company_city,
        price_range: v.price_range,
        verified: !!v.verified,
        social_links: (v.social_links as Record<string, string>) ?? {},
        service_cities: (v.service_cities as string[]) ?? [],
        service_radius_km: v.service_radius_km ?? null,
        logo_url: logoUrl,
        photos: photos.filter(p => p.url) as { id: string; url: string }[],
        video_urls: (v.video_urls as string[]) ?? [],
        audio_url: audioUrl,
        audio_title: v.audio_title ?? null,
      }}
      packages={packages ?? []}
      faqs={faqs ?? []}
      reviews={reviewsWithPhotos}
      similar={similar}
      reviewAvg={reviewAvg}
      reviewCount={reviewCount}
      availability={(availability ?? []).map(a => a.day)}
      contactUnlocked={hasCollaboration}
      canReview={hasCollaboration}
      existing={existing ?? null}
    />
  )
}
