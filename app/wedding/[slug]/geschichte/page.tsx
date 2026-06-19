// app/wedding/[slug]/geschichte/page.tsx — "Unsere Geschichte" (Roter Faden)
import { loadWeddingSiteBySlug, resolveContentImageUrls } from '@/lib/wedding/server'
import { resolveStyle } from '@/lib/wedding/style'
import { StoryView } from '@/components/wedding/WeddingRenderer'

export const dynamic = 'force-dynamic'

export default async function WeddingStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const loaded = await loadWeddingSiteBySlug(slug)
  if (!loaded?.publishedContent || !loaded.meta.isOnline || loaded.meta.status !== 'published') return null

  const content = loaded.publishedContent
  const imageUrls = await resolveContentImageUrls(content)
  const rs = resolveStyle(loaded.meta.templateId, content.style)

  return (
    <StoryView content={content} imageUrls={imageUrls} story={rs.story} />
  )
}
