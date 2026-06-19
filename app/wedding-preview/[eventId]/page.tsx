// app/wedding-preview/[eventId]/page.tsx
// Authentifizierte Live-Vorschau des ENTWURFS für den Editor (im iframe eingebettet).
// Liegt bewusst außerhalb des Brautpaar-Layouts (keine Sidebar). Rendert exakt die
// öffentliche Präsentationsschicht mit draft_content.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEventRole } from '@/lib/files/permissions'
import { resolveContentImageUrls } from '@/lib/wedding/server'
import { normalizeContent } from '@/lib/wedding/content'
import { templateCssVars, getTemplate } from '@/lib/wedding/templates'
import {
  WeddingNav, WeddingFooter, LandingView, StoryView, RsvpIntroView,
  type WeddingSection,
} from '@/components/wedding/WeddingRenderer'
import '../../wedding/wedding.css'

export const dynamic = 'force-dynamic'

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@400;500;600&family=Montserrat:wght@400;500;600&family=Playfair+Display:wght@500;600&family=Italiana&display=swap'

const EDIT_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

export default async function WeddingPreviewPage({
  params, searchParams,
}: {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ section?: string }>
}) {
  const { eventId } = await params
  const { section: rawSection } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const role = await getEventRole(supabase, user.id, eventId)
  if (!role || !EDIT_ROLES.includes(role)) redirect('/login')

  // Authentifizierter Client (RLS) — kein Service-Role-Key nötig: das Event-Mitglied
  // darf wedding_sites + events ohnehin lesen.
  const { data: site } = await supabase.from('wedding_sites').select('*').eq('event_id', eventId).maybeSingle()
  const { data: ev } = await supabase
    .from('events').select('id, title, couple_name, date, venue, venue_address').eq('id', eventId).maybeSingle()

  const coupleName = (ev?.couple_name?.trim()) || (ev?.title?.trim()) || ''
  const content = normalizeContent(site?.draft_content, coupleName)
  const template = getTemplate(site?.template_id)
  const imageUrls = await resolveContentImageUrls(content)
  const styleVars = templateCssVars(site?.template_id) as React.CSSProperties

  const event = {
    id: ev?.id ?? eventId, coupleName,
    date: ev?.date ?? null, venue: ev?.venue ?? null, venueAddress: ev?.venue_address ?? null,
  }

  const section: WeddingSection =
    rawSection === 'story' ? 'story' : rawSection === 'rsvp' ? 'rsvp' : 'landing'
  const hrefFor = (s: WeddingSection) => `?section=${s}`

  return (
    <div className="wd-root" data-template={template.id} style={styleVars}>
      <link rel="stylesheet" href={FONTS_HREF} />
      <WeddingNav coupleName={coupleName} hrefFor={hrefFor} active={section} />
      {section === 'landing' && (
        <LandingView content={content} event={event} template={template} imageUrls={imageUrls} hrefFor={hrefFor} active="landing" />
      )}
      {section === 'story' && (
        <StoryView content={content} event={event} template={template} imageUrls={imageUrls} hrefFor={hrefFor} active="story" />
      )}
      {section === 'rsvp' && (
        <div className="wd-page">
          <RsvpIntroView content={content} imageUrls={imageUrls} />
          <div className="wd-section" style={{ textAlign: 'center', color: 'var(--wd-ink-soft)' }}>
            <p className="wd-body">Hier erscheint im Live-Betrieb das RSVP-Formular für eure Gäste.</p>
          </div>
        </div>
      )}
      <WeddingFooter coupleName={coupleName} date={event.date} />
    </div>
  )
}
