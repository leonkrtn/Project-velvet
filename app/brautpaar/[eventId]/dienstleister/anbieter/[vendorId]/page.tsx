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
    .select('id, name, company_name, category, email, phone, website, description, street, zip, city, price_range, logo_r2_key')
    .eq('id', vendorId).eq('is_marketplace', true).eq('published', true).maybeSingle()
  if (!v) redirect(`/brautpaar/${eventId}/dienstleister`)

  const { data: photoRows } = await admin
    .from('marketplace_vendor_photos').select('id, r2_key, sort_order').eq('dienstleister_id', vendorId).order('sort_order')
  const photos = await Promise.all((photoRows ?? []).map(async p => ({
    id: p.id, url: await requestDownloadUrl(p.r2_key).catch(() => null),
  })))
  const logoUrl = v.logo_r2_key ? await requestDownloadUrl(v.logo_r2_key).catch(() => null) : null

  const { data: existing } = await admin
    .from('marketplace_requests')
    .select('id, status, conversation_id')
    .eq('event_id', eventId).eq('dienstleister_id', vendorId)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })
    .maybeSingle()

  return (
    <AnbieterDetailClient
      eventId={eventId}
      vendor={{
        id: v.id, name: v.name, company_name: v.company_name, category: v.category,
        email: v.email, phone: v.phone, website: v.website, description: v.description,
        street: v.street, zip: v.zip, city: v.city, price_range: v.price_range,
        logo_url: logoUrl,
        photos: photos.filter(p => p.url) as { id: string; url: string }[],
      }}
      existing={existing ?? null}
    />
  )
}
