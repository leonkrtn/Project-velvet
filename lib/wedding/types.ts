// lib/wedding/types.ts
// Gemeinsames Datenmodell der öffentlichen Hochzeitswebsite.
// Der Inhalt wird als JSONB in wedding_sites.draft_content / published_content gespeichert.
// Mehrsprachig vorbereitet (lang), UI befüllt aktuell nur 'de'.

export type WeddingLang = 'de' | 'en'

/** Bildreferenz: fileId (für authentifizierte Editor-Vorschau) + r2Key (für serverseitige öffentliche Auflösung). */
export interface WeddingImage {
  fileId: string
  r2Key: string
  /** Optionaler Bildausschnitt (object-position in %), durch das Crop-Tool gesetzt. */
  focusX?: number // 0–100
  focusY?: number // 0–100
  alt?: string
}

/** Eine Station des "roten Fadens" auf der Geschichte-Seite. */
export interface WeddingStation {
  id: string
  title: string
  date: string        // freier Text, z.B. "Sommer 2019"
  location: string
  text: string
  /** Lucide-Icon-Name aus STATION_ICONS. */
  icon: string
  image: WeddingImage | null
}

export interface WeddingScheduleItem {
  id: string
  time: string         // "14:00"
  label: string        // "Freie Trauung"
  description?: string // optionaler Zusatztext / Ort
}

export interface WeddingContent {
  version: 1
  lang: WeddingLang
  landing: {
    hero: {
      image: WeddingImage | null
      headline: string
      subline: string
    }
    location: {
      title: string
      description: string
      image: WeddingImage | null
    }
    schedule: {
      title: string
      items: WeddingScheduleItem[]
    }
  }
  story: {
    intro: {
      title: string
      text: string
    }
    stations: WeddingStation[]
  }
  rsvp: {
    title: string
    text: string
    image: WeddingImage | null
  }
}

/** Zeichen-Limits pro Feld — hart durchgesetzt (Editor + Server). */
export const WEDDING_LIMITS = {
  heroHeadline: 48,
  heroSubline: 90,
  locationTitle: 40,
  locationDescription: 600,
  scheduleTitle: 40,
  scheduleItemTime: 12,
  scheduleItemLabel: 48,
  scheduleItemDescription: 140,
  storyIntroTitle: 48,
  storyIntroText: 400,
  stationTitle: 40,
  stationDate: 28,
  stationLocation: 40,
  stationText: 500,
  rsvpTitle: 48,
  rsvpText: 400,
  ogTitle: 70,
  ogDescription: 160,
} as const

export const MIN_STATIONS = 1
export const MAX_STATIONS = 10
export const MAX_SCHEDULE_ITEMS = 12

/** Auswählbare Lucide-Icons für Stationen (Name muss im Frontend gemappt werden). */
export const STATION_ICONS = [
  'Heart', 'Sparkles', 'MapPin', 'Plane', 'Home', 'Gem', 'Ring',
  'GlassWater', 'Music', 'Camera', 'Star', 'Sun', 'Coffee', 'Bike',
] as const
export type StationIcon = (typeof STATION_ICONS)[number]

export interface WeddingSiteRow {
  id: string
  event_id: string
  slug: string | null
  template_id: string
  status: 'draft' | 'published'
  is_online: boolean
  draft_content: WeddingContent
  published_content: WeddingContent | null
  og_title: string | null
  og_description: string | null
  og_image_r2_key: string | null
  published_at: string | null
}

/** Read-only Eckdaten aus dem Event (Datum/Location strikt aus dem Event). */
export interface WeddingEventData {
  id: string
  coupleName: string
  date: string | null
  venue: string | null
  venueAddress: string | null
}
