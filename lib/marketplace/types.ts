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

