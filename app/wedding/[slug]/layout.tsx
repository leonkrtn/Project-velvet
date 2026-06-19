// app/wedding/[slug]/layout.tsx
// Theme-Wrapper der öffentlichen Hochzeitswebsite: lädt die Site per Slug,
// setzt Template-CSS-Variablen + Schriftarten und rendert Navigation + Footer.
import type { Metadata } from 'next'
import Link from 'next/link'
import { loadWeddingSiteBySlug, resolveOgImageUrl } from '@/lib/wedding/server'
import { templateCssVars, getTemplate } from '@/lib/wedding/templates'
import { WeddingNav, WeddingFooter, type WeddingSection } from '@/components/wedding/WeddingRenderer'
import '../wedding.css'

export const dynamic = 'force-dynamic'

interface Props { children: React.ReactNode; params: Promise<{ slug: string }> }

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@400;500;600&family=Montserrat:wght@400;500;600&family=Playfair+Display:wght@500;600&family=Italiana&display=swap'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const loaded = await loadWeddingSiteBySlug(slug)
  if (!loaded) return { title: 'Hochzeitswebsite' }
  const { meta } = loaded
  const coupleName = meta.event.coupleName || 'Unsere Hochzeit'
  const title = meta.og.title || `${coupleName} — Wir heiraten`
  const description = meta.og.description || 'Wir freuen uns, diesen Tag mit euch zu feiern.'
  const ogImage = await resolveOgImageUrl(meta.og.imageKey)
  const isVisible = meta.isOnline && meta.status === 'published'
  return {
    title,
    description,
    robots: isVisible ? undefined : { index: false, follow: false },
    openGraph: { title, description, type: 'website', images: ogImage ? [{ url: ogImage }] : undefined },
    twitter: { card: ogImage ? 'summary_large_image' : 'summary', title, description, images: ogImage ? [ogImage] : undefined },
  }
}

export default async function WeddingLayout({ children, params }: Props) {
  const { slug } = await params
  const loaded = await loadWeddingSiteBySlug(slug)

  const styleVars = templateCssVars(loaded?.meta.templateId) as React.CSSProperties
  const dataTemplate = getTemplate(loaded?.meta.templateId).id

  // Fonts immer laden (auch auf Statusseiten).
  const fonts = <link rel="stylesheet" href={FONTS_HREF} />

  // Nicht gefunden / offline / unveröffentlicht → freundliche Statusseite.
  const isLive = loaded && loaded.meta.isOnline && loaded.meta.status === 'published' && loaded.publishedContent
  if (!isLive) {
    return (
      <div className="wd-root" data-template={dataTemplate} style={styleVars}>
        {fonts}
        <div className="wd-status">
          <h1 className="wd-h1">{!loaded ? 'Seite nicht gefunden' : 'Bald verfügbar'}</h1>
          <p className="wd-body">
            {!loaded
              ? 'Diese Hochzeitswebsite existiert nicht (mehr).'
              : 'Diese Hochzeitswebsite ist derzeit nicht öffentlich verfügbar.'}
          </p>
          <Link className="wd-btn wd-btn-ghost" href="/">Zur Startseite</Link>
        </div>
      </div>
    )
  }

  const base = `/wedding/${slug}`
  const hrefFor = (s: WeddingSection) =>
    s === 'landing' ? base : `${base}/${s === 'story' ? 'geschichte' : 'rsvp'}`

  return (
    <div className="wd-root" data-template={dataTemplate} style={styleVars}>
      {fonts}
      <WeddingNav coupleName={loaded.meta.event.coupleName} hrefFor={hrefFor} />
      {children}
      <WeddingFooter coupleName={loaded.meta.event.coupleName} date={loaded.meta.event.date} />
    </div>
  )
}
