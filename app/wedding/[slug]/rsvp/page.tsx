// app/wedding/[slug]/rsvp/page.tsx — RSVP-Seite der Hochzeitswebsite
import { loadWeddingSiteBySlug, resolveContentImageUrls } from '@/lib/wedding/server'
import { RsvpIntroView } from '@/components/wedding/WeddingRenderer'
import WeddingRsvp from '@/components/wedding/WeddingRsvp'

export const dynamic = 'force-dynamic'

export default async function WeddingRsvpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const loaded = await loadWeddingSiteBySlug(slug)
  if (!loaded?.publishedContent || !loaded.meta.isOnline || loaded.meta.status !== 'published') return null

  const content = loaded.publishedContent
  const imageUrls = await resolveContentImageUrls(content)

  return (
    <div className="wd-page">
      <RsvpIntroView content={content} imageUrls={imageUrls} />
      <WeddingRsvp slug={slug} />
    </div>
  )
}
