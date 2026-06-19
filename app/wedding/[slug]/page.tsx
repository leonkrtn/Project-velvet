// app/wedding/[slug]/page.tsx — Landing Page der Hochzeitswebsite
import { loadWeddingSiteBySlug, resolveContentImageUrls } from '@/lib/wedding/server'
import { getTemplate } from '@/lib/wedding/templates'
import { LandingView, type WeddingSection } from '@/components/wedding/WeddingRenderer'

export const dynamic = 'force-dynamic'

export default async function WeddingLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const loaded = await loadWeddingSiteBySlug(slug)
  if (!loaded?.publishedContent || !loaded.meta.isOnline || loaded.meta.status !== 'published') return null

  const content = loaded.publishedContent
  const imageUrls = await resolveContentImageUrls(content)
  const base = `/wedding/${slug}`
  const hrefFor = (s: WeddingSection) =>
    s === 'landing' ? base : `${base}/${s === 'story' ? 'geschichte' : 'rsvp'}`

  return (
    <LandingView
      content={content}
      event={loaded.meta.event}
      template={getTemplate(loaded.meta.templateId)}
      imageUrls={imageUrls}
      hrefFor={hrefFor}
      active="landing"
    />
  )
}
