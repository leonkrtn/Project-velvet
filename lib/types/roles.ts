export type UserRole = 'veranstalter' | 'brautpaar' | 'trauzeuge' | 'dienstleister'

export type DienstleisterCategory =
  | 'Catering' | 'DJ' | 'Fotografie' | 'Videografie' | 'Floristik'
  | 'Musik / Band' | 'Location' | 'Transport' | 'Konditorei' | 'Sonstiges'

export type DienstleisterScope =
  | 'catering'
  | 'allergies'
  | 'timeline'
  | 'guests_readonly'
  | 'budget_readonly'
  | 'vendors'
  | 'seating_readonly'

export interface DienstleisterProfile {
  id: string
  name: string
  companyName?: string
  category: DienstleisterCategory | string
  email?: string
  phone?: string
  website?: string
  description?: string
  createdAt?: string
}

export interface EventDienstleister {
  id: string
  eventId: string
  dienstleisterId: string
  userId?: string
  category: DienstleisterCategory | string
  scopes: DienstleisterScope[]
  status: 'eingeladen' | 'akzeptiert' | 'abgelehnt' | 'beendet'
  invitedBy?: string
  invitedAt: string
  acceptedAt?: string
  profile?: DienstleisterProfile
}

export interface TrauzeugePermissions {
  eventId: string
  userId: string
  canViewGuests: boolean
  canEditGuests: boolean
  canViewSeating: boolean
  canEditSeating: boolean
  canViewBudget: boolean
  canViewCatering: boolean
  canViewTimeline: boolean
  canEditTimeline: boolean
  canViewVendors: boolean
  canManageDeko: boolean
}

export interface BrautpaarPermissions {
  eventId: string
  ablaufplan: boolean
  subEvents: boolean
  erinnerungen: boolean
  sitzplan: boolean
  dekorationen: boolean
  dienstleister: boolean
  hotel: boolean
  catering: boolean
  anzeigeeinstellungen: boolean
}

export const DEFAULT_BRAUTPAAR_PERMISSIONS: Omit<BrautpaarPermissions, 'eventId'> = {
  ablaufplan: true,
  subEvents: false,
  erinnerungen: true,
  sitzplan: true,
  dekorationen: true,
  dienstleister: true,
  hotel: true,
  catering: false,
  anzeigeeinstellungen: false,
}

export const DEFAULT_TRAUZEUGE_PERMISSIONS: Omit<TrauzeugePermissions, 'eventId' | 'userId'> = {
  canViewGuests: true,
  canEditGuests: false,
  canViewSeating: true,
  canEditSeating: true,
  canViewBudget: false,
  canViewCatering: false,
  canViewTimeline: true,
  canEditTimeline: false,
  canViewVendors: false,
  canManageDeko: true,
}
