// Marktplatz — gemeinsame Typen & Konstanten

export const MARKETPLACE_CATEGORIES = [
  { key: 'fotograf', label: 'Fotograf' },
  { key: 'videograf', label: 'Videograf' },
  { key: 'catering', label: 'Catering' },
  { key: 'dj_musik', label: 'DJ / Musik' },
  { key: 'band', label: 'Band' },
  { key: 'floristik', label: 'Floristik' },
  { key: 'location', label: 'Location' },
  { key: 'konditorei', label: 'Konditorei / Torte' },
  { key: 'deko', label: 'Dekoration' },
  { key: 'hair_makeup', label: 'Hair & Make-up' },
  { key: 'planer', label: 'Hochzeitsplaner' },
  { key: 'sonstiges', label: 'Sonstiges' },
] as const

export const PRICE_RANGES = ['€', '€€', '€€€'] as const

export function categoryLabel(key: string | null | undefined): string {
  if (!key) return 'Sonstiges'
  return MARKETPLACE_CATEGORIES.find(c => c.key === key)?.label ?? key
}

export type ModerationStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended'

// Felder, deren Änderung an einem freigegebenen Profil erneut geprüft wird
// (gehen über pending_changes; Live-Listing bleibt unverändert sichtbar).
export const SENSITIVE_FIELDS = ['name', 'company_name', 'category', 'street', 'zip', 'city', 'logo_r2_key'] as const

export const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'pinterest', label: 'Pinterest' },
  { key: 'youtube', label: 'YouTube' },
] as const

export const PRICE_UNITS = [
  { key: 'ab', label: 'ab' },
  { key: 'fix', label: 'Festpreis' },
  { key: 'pro_person', label: 'pro Person' },
  { key: 'pro_stunde', label: 'pro Stunde' },
] as const

// ── Vendor-Medien (Migration 0133) ─────────────────────────────
export const MAX_VIDEO_URLS = 3

/** Erlaubte MIME-Types für die Hörprobe (Upload via R2). */
export const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/x-m4a', 'audio/ogg'] as const

/**
 * Extrahiert die YouTube-Video-ID aus allen gängigen URL-Formaten
 * (watch?v=, youtu.be/, shorts/, embed/, live/). null = kein YouTube-Link.
 */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  let u: URL
  try {
    u = new URL(trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\.|^m\./, '').toLowerCase()
  const idOk = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null)
  if (host === 'youtu.be') return idOk(u.pathname.split('/')[1])
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') return idOk(u.searchParams.get('v'))
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/)
    return idOk(m?.[1])
  }
  return null
}

/** Privacy-freundliche Embed-URL für eine YouTube-Video-ID. */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`
}

export function moderationLabel(status: ModerationStatus, hasPending = false): string {
  if (hasPending) return 'Änderungen in Prüfung'
  switch (status) {
    case 'draft': return 'Entwurf'
    case 'pending': return 'In Prüfung'
    case 'approved': return 'Freigegeben'
    case 'rejected': return 'Abgelehnt'
    case 'suspended': return 'Gesperrt'
  }
}

