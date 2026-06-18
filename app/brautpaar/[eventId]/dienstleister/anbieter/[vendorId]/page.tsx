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
    .select('id, name, company_name, category, email, phone, website, description, street, zip, city, price_range, logo_r2_key, verified, social_links, service_cities, service_radius_km')
    .eq('id', vendorId).eq('is_marketplace', true).eq('published', true).eq('moderation_status', 'approved').maybeSingle()
  if (!v) redirect(`/brautpaar/${eventId}/dienstleister`)

  const [{ data: photoRows }, { data: packages }, { data: faqs }, { data: reviewRows }, { data: availability }, { data: existing }] = await Promise.all([
    admin.from('marketplace_vendor_photos').select('id, r2_key, sort_order').eq('dienstleister_id', vendorId).order('sort_order'),
    admin.from('marketplace_packages').select('id, title, description, price_from, price_unit').eq('dienstleister_id', vendorId).order('sort_order'),
    admin.from('marketplace_faqs').select('id, question, answer').eq('dienstleister_id', vendorId).order('sort_order'),
    admin.from('marketplace_reviews').select('id, author_name, rating, title, body, created_at').eq('dienstleister_id', vendorId).eq('status', 'published').order('created_at', { ascending: false }),
    admin.from('marketplace_availability').select('day, status').eq('dienstleister_id', vendorId).gte('day', new Date().toISOString().slice(0, 10)).order('day'),
    admin.from('marketplace_requests').select('id, status, conversation_id').eq('event_id', eventId).eq('dienstleister_id', vendorId).in('status', ['pending', 'accepted']).order('created_at', { ascending: false }).maybeSingle(),
  ])

  const photos = await Promise.all((photoRows ?? []).map(async p => ({
    id: p.id, url: await requestDownloadUrl(p.r2_key).catch(() => null),
  })))
  const logoUrl = v.logo_r2_key ? await requestDownloadUrl(v.logo_r2_key).catch(() => null) : null

  // Kontaktfreigabe & Bewertungsberechtigung: nur nach angenommener Zusammenarbeit.
  const accepted = existing?.status === 'accepted'
  const { data: edRow } = await admin
    .from('event_dienstleister').select('id').eq('event_id', eventId).eq('dienstleister_id', vendorId).eq('status', 'akzeptiert').maybeSingle()
  const hasCollaboration = accepted || !!edRow

  const reviews = reviewRows ?? []
  const reviewCount = reviews.length
  const reviewAvg = reviewCount ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10 : 0

  return (
    <AnbieterDetailClient
      eventId={eventId}
      vendor={{
        id: v.id, name: v.name, company_name: v.company_name, category: v.category,
        email: v.email, phone: v.phone, website: v.website, description: v.description,
        street: v.street, zip: v.zip, city: v.city, price_range: v.price_range,
        verified: !!v.verified,
        social_links: (v.social_links as Record<string, string>) ?? {},
        service_cities: (v.service_cities as string[]) ?? [],
        service_radius_km: v.service_radius_km ?? null,
        logo_url: logoUrl,
        photos: photos.filter(p => p.url) as { id: string; url: string }[],
      }}
      packages={packages ?? []}
      faqs={faqs ?? []}
      reviews={reviews}
      reviewAvg={reviewAvg}
      reviewCount={reviewCount}
      availability={(availability ?? []).map(a => a.day)}
      contactUnlocked={hasCollaboration}
      canReview={hasCollaboration}
      existing={existing ?? null}
    />
  )
}
