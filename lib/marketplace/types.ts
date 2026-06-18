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
export type PriceRange = (typeof PRICE_RANGES)[number]

export function categoryLabel(key: string | null | undefined): string {
  if (!key) return 'Sonstiges'
  return MARKETPLACE_CATEGORIES.find(c => c.key === key)?.label ?? key
}

export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export type ModerationStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended'
export type VendorTier = 'free' | 'featured' | 'premium'

// Felder, deren Änderung an einem freigegebenen Profil erneut geprüft wird
// (gehen über pending_changes; Live-Listing bleibt unverändert sichtbar).
export const SENSITIVE_FIELDS = ['name', 'company_name', 'category', 'street', 'zip', 'city', 'logo_r2_key'] as const
export type SensitiveField = (typeof SENSITIVE_FIELDS)[number]

// Sofort live editierbare Felder.
export const INSTANT_FIELDS = ['description', 'email', 'phone', 'website', 'price_range', 'social_links', 'service_cities', 'service_radius_km'] as const

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

export interface MarketplaceVendor {
  id: string
  name: string
  company_name: string | null
  category: string
  email: string | null
  phone: string | null
  website: string | null
  description: string | null
  street: string | null
  zip: string | null
  city: string | null
  price_range: string | null
  logo_r2_key: string | null
  is_marketplace: boolean
  published: boolean
  moderation_status: ModerationStatus
  pending_changes: Record<string, unknown> | null
  verified: boolean
  rejected_reason: string | null
  tier: VendorTier
  social_links: Record<string, string>
  service_cities: string[]
  service_radius_km: number | null
  created_at?: string
}

export interface MarketplacePackage {
  id: string
  dienstleister_id: string
  title: string
  description: string
  price_from: number | null
  price_unit: string
  sort_order: number
}

export interface MarketplaceFaq {
  id: string
  dienstleister_id: string
  question: string
  answer: string
  sort_order: number
}

export interface MarketplaceAvailability {
  id: string
  dienstleister_id: string
  day: string
  status: 'blocked' | 'booked'
}

export interface MarketplaceReview {
  id: string
  dienstleister_id: string
  event_id: string | null
  author_user_id: string | null
  author_name: string
  rating: number
  title: string
  body: string
  status: 'published' | 'hidden'
  created_at: string
}

export interface MarketplaceVendorPhoto {
  id: string
  dienstleister_id: string
  r2_key: string
  sort_order: number
  /** zur Laufzeit aufgelöste presigned URL */
  url?: string
}

export interface MarketplaceRequest {
  id: string
  event_id: string
  dienstleister_id: string
  requested_by: string | null
  message: string
  budget: number | null
  status: RequestStatus
  conversation_id: string | null
  created_at: string
  responded_at: string | null
}
