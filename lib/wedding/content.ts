// lib/wedding/content.ts
// Defaults, Validierung/Normalisierung und Slug-Helfer für die Hochzeitswebsite.
// Server UND Client teilen sich diese Funktionen, damit Limits konsistent durchgesetzt werden.

import {
  WEDDING_LIMITS, MIN_STATIONS, MAX_STATIONS, MAX_SCHEDULE_ITEMS,
  STATION_ICONS, type WeddingContent, type WeddingStation,
  type WeddingImage, type WeddingScheduleItem,
} from './types'

function rid(): string {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

export function emptyStation(): WeddingStation {
  return { id: rid(), title: '', date: '', location: '', text: '', icon: 'Heart', image: null }
}

export function defaultContent(coupleName = ''): WeddingContent {
  return {
    version: 1,
    lang: 'de',
    landing: {
      hero: {
        image: null,
        headline: coupleName || 'Wir heiraten',
        subline: 'Wir freuen uns, diesen Tag mit euch zu feiern.',
      },
      location: { title: 'Location & Anfahrt', description: '', image: null },
      schedule: { title: 'Tagesablauf', items: [] },
    },
    story: {
      intro: { title: 'Unsere Geschichte', text: '' },
      stations: [emptyStation()],
    },
    rsvp: {
      title: 'Sag uns Bescheid',
      text: 'Bitte gib uns bis zum angegebenen Datum Bescheid, ob du dabei bist.',
      image: null,
    },
  }
}

function clampStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  return v.replace(/\s+\n/g, '\n').slice(0, max)
}

function sanitizeImage(v: unknown): WeddingImage | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.fileId !== 'string' || typeof o.r2Key !== 'string') return null
  const num = (x: unknown, def: number) =>
    typeof x === 'number' && isFinite(x) ? Math.min(100, Math.max(0, x)) : def
  return {
    fileId: o.fileId,
    r2Key: o.r2Key,
    focusX: num(o.focusX, 50),
    focusY: num(o.focusY, 50),
    alt: typeof o.alt === 'string' ? o.alt.slice(0, 140) : undefined,
  }
}

function sanitizeIcon(v: unknown): string {
  return (typeof v === 'string' && (STATION_ICONS as readonly string[]).includes(v)) ? v : 'Heart'
}

function sanitizeScheduleItems(v: unknown): WeddingScheduleItem[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, MAX_SCHEDULE_ITEMS).map(raw => {
    const o = (raw ?? {}) as Record<string, unknown>
    return {
      id: typeof o.id === 'string' ? o.id : rid(),
      time: clampStr(o.time, WEDDING_LIMITS.scheduleItemTime),
      label: clampStr(o.label, WEDDING_LIMITS.scheduleItemLabel),
      description: clampStr(o.description, WEDDING_LIMITS.scheduleItemDescription) || undefined,
    }
  }).filter(i => i.time || i.label)
}

function sanitizeStations(v: unknown): WeddingStation[] {
  const arr = Array.isArray(v) ? v : []
  const out = arr.slice(0, MAX_STATIONS).map(raw => {
    const o = (raw ?? {}) as Record<string, unknown>
    return {
      id: typeof o.id === 'string' ? o.id : rid(),
      title: clampStr(o.title, WEDDING_LIMITS.stationTitle),
      date: clampStr(o.date, WEDDING_LIMITS.stationDate),
      location: clampStr(o.location, WEDDING_LIMITS.stationLocation),
      text: clampStr(o.text, WEDDING_LIMITS.stationText),
      icon: sanitizeIcon(o.icon),
      image: sanitizeImage(o.image),
    }
  })
  if (out.length < MIN_STATIONS) out.push(emptyStation())
  return out
}

/** Vollständige, sichere Normalisierung beliebigen Inputs auf das WeddingContent-Schema. */
export function normalizeContent(input: unknown, coupleName = ''): WeddingContent {
  const base = defaultContent(coupleName)
  if (!input || typeof input !== 'object') return base
  const c = input as Record<string, any>
  const landing = c.landing ?? {}
  const story = c.story ?? {}
  const rsvp = c.rsvp ?? {}
  return {
    version: 1,
    lang: c.lang === 'en' ? 'en' : 'de',
    landing: {
      hero: {
        image: sanitizeImage(landing.hero?.image),
        headline: clampStr(landing.hero?.headline ?? base.landing.hero.headline, WEDDING_LIMITS.heroHeadline),
        subline: clampStr(landing.hero?.subline ?? base.landing.hero.subline, WEDDING_LIMITS.heroSubline),
      },
      location: {
        title: clampStr(landing.location?.title ?? base.landing.location.title, WEDDING_LIMITS.locationTitle),
        description: clampStr(landing.location?.description, WEDDING_LIMITS.locationDescription),
        image: sanitizeImage(landing.location?.image),
      },
      schedule: {
        title: clampStr(landing.schedule?.title ?? base.landing.schedule.title, WEDDING_LIMITS.scheduleTitle),
        items: sanitizeScheduleItems(landing.schedule?.items),
      },
    },
    story: {
      intro: {
        title: clampStr(story.intro?.title ?? base.story.intro.title, WEDDING_LIMITS.storyIntroTitle),
        text: clampStr(story.intro?.text, WEDDING_LIMITS.storyIntroText),
      },
      stations: sanitizeStations(story.stations),
    },
    rsvp: {
      title: clampStr(rsvp.title ?? base.rsvp.title, WEDDING_LIMITS.rsvpTitle),
      text: clampStr(rsvp.text ?? base.rsvp.text, WEDDING_LIMITS.rsvpText),
      image: sanitizeImage(rsvp.image),
    },
  }
}

// ── Slug ────────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // restliche Akzente entfernen
    .replace(/&/g, ' und ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

export const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,58}[a-z0-9])$/

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug)
}
