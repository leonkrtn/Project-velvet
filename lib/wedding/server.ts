// lib/wedding/server.ts
// Server-only: lädt Hochzeitswebsite-Daten (Service-Role) und löst R2-Bildschlüssel zu
// presigned URLs auf. Wird von den öffentlichen Seiten und der Editor-Vorschau genutzt.
import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { requestDownloadUrl } from '@/lib/files/worker-client'
import { normalizeContent } from './content'
import type { WeddingContent, WeddingEventData, WeddingImage } from './types'

export interface LoadedWeddingSite {
  id: string
  eventId: string
  slug: string | null
  templateId: string
  status: 'draft' | 'published'
  isOnline: boolean
  og: { title: string | null; description: string | null; imageKey: string | null }
  event: WeddingEventData
}

function toEventData(ev: any): WeddingEventData {
  const coupleName = (ev?.couple_name && ev.couple_name.trim())
    || (ev?.title && ev.title.trim()) || ''
  return {
    id: ev.id,
    coupleName,
    date: ev.date ?? null,
    venue: ev.venue ?? null,
    venueAddress: ev.venue_address ?? null,
  }
}

/** Lädt die Site per Slug inkl. Event-Eckdaten. Liefert null, wenn nicht gefunden.
 *  Per React cache memoisiert → Layout + Page teilen sich denselben DB-Treffer. */
export const loadWeddingSiteBySlug = cache(async (slug: string): Promise<{
  meta: LoadedWeddingSite
  publishedContent: WeddingContent | null
} | null> => {
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    // Service-Role-Key fehlt (z.B. nicht in der Preview-Umgebung gesetzt) →
    // keine harte Server-Exception, sondern "nicht verfügbar".
    console.error('[wedding] admin client unavailable:', e)
    return null
  }
  const { data: site } = await admin
    .from('wedding_sites')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (!site) return null

  const { data: ev } = await admin
    .from('events')
    .select('id, title, couple_name, date, venue, venue_address')
    .eq('id', site.event_id)
    .maybeSingle()
  if (!ev) return null

  return {
    meta: {
      id: site.id,
      eventId: site.event_id,
      slug: site.slug,
      templateId: site.template_id,
      status: site.status,
      isOnline: site.is_online,
      og: { title: site.og_title, description: site.og_description, imageKey: site.og_image_r2_key },
      event: toEventData(ev),
    },
    publishedContent: site.published_content
      ? normalizeContent(site.published_content, toEventData(ev).coupleName)
      : null,
  }
})

/**
 * Sammelt alle r2Keys aus dem Inhalt und liefert eine Map key → presigned GET URL.
 * Fehler werden still ignoriert (fehlendes Bild → kein Eintrag).
 */
export async function resolveContentImageUrls(content: WeddingContent): Promise<Record<string, string>> {
  const keys = new Set<string>()
  const add = (img: WeddingImage | null | undefined) => { if (img?.r2Key) keys.add(img.r2Key) }
  add(content.landing.hero.image)
  add(content.landing.location.image)
  add(content.rsvp.image)
  for (const s of content.story.stations) add(s.image)

  const entries = await Promise.all(
    Array.from(keys).map(async key => {
      try { return [key, await requestDownloadUrl(key)] as const }
      catch { return null }
    }),
  )
  const map: Record<string, string> = {}
  for (const e of entries) if (e) map[e[0]] = e[1]
  return map
}

export async function resolveOgImageUrl(key: string | null): Promise<string | null> {
  if (!key) return null
  try { return await requestDownloadUrl(key) } catch { return null }
}
