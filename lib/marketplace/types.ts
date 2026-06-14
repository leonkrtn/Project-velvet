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
  created_at?: string
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
