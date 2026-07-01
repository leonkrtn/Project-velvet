// app/wedding/[slug]/rsvp/page.tsx — RSVP-Seite der Hochzeitswebsite
import { loadWeddingSiteBySlug, resolveContentImageUrls } from '@/lib/wedding/server'
import { RsvpIntroView } from '@/components/wedding/WeddingRenderer'
import WeddingRsvp from '@/components/wedding/WeddingRsvp'

export const dynamic = 'force-dynamic'

// Datumsvergleich ohne Uhrzeit-Probleme: beide Daten auf Tagesgranularität
// (lokale Zeitzone des Servers) normalisieren, bevor verglichen wird.
function isAfterWeddingDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const wedding = new Date(dateStr)
  if (Number.isNaN(wedding.getTime())) return false
  const weddingDay = new Date(wedding.getFullYear(), wedding.getMonth(), wedding.getDate())
  const today = new Date()
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return todayDay.getTime() > weddingDay.getTime()
}

export default async function WeddingRsvpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const loaded = await loadWeddingSiteBySlug(slug)
  if (!loaded?.publishedContent || !loaded.meta.isOnline || loaded.meta.status !== 'published') return null

  const content = loaded.publishedContent
  const imageUrls = await resolveContentImageUrls(content)
  const isAfterWedding = isAfterWeddingDate(loaded.meta.event.date)

  return (
    <div className="wd-page">
      <RsvpIntroView content={content} imageUrls={imageUrls} />
      <WeddingRsvp slug={slug} isAfterWedding={isAfterWedding} coupleName={loaded.meta.event.coupleName} />
    </div>
  )
}
