export type UserRole = 'veranstalter' | 'brautpaar' | 'brautpaar_solo' | 'dienstleister'

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
}

export interface BrautpaarPermissions {
  eventId: string
  ablaufplan: boolean
  subEvents: boolean
  erinnerungen: boolean
  sitzplan: boolean
  dienstleister: boolean
  hotel: boolean
  catering: boolean
  anzeigeeinstellungen: boolean
}
