export interface PdfGuest {
  id: string
  name: string
  status: string
  side: string | null
  meal_choice: string | null
  allergy_tags: string[] | null
  allergy_custom: string | null
  notes: string | null
  email: string | null
  phone: string | null
}

export interface PdfBegleitperson {
  id: string
  guest_id: string
  name: string
  meal_choice: string | null
  allergy_tags: string[] | null
  allergy_custom: string | null
}

export interface PdfSeatingTable {
  id: string
  name: string
  shape: string
  capacity: number
  pos_x: number
  pos_y: number
  rotation: number
  table_length: number
  table_width: number
}

export interface PdfSeatingAssignment {
  id: string
  table_id: string
  guest_id: string | null
  begleitperson_id: string | null
  brautpaar_slot: number | null
}

export interface PdfTimelineEntry {
  id: string
  title: string | null
  location: string | null
  start_minutes: number | null
  duration_minutes: number | null
  category: string | null
  day_index: number
  checklist: Array<{ text: string; done: boolean }>
  assigned_staff: Array<{ id: string; name: string }>
  assigned_vendors: Array<{ id: string; name: string }>
  assigned_members: Array<{ id: string; name: string; role?: string }>
}

export interface PdfAblaufplanDay {
  id: string
  day_index: number
  name: string
  start_hour: number
  end_hour: number
}

export interface PdfBudgetItem {
  id: string
  category: string
  description: string
  planned: number
  actual: number
  payment_status: string
  notes: string | null
}

export interface PdfMusicSong {
  id: string
  title: string
  artist: string
  type: string
  moment: string
  source?: string
  suggested_by_guest_name?: string | null
}

export interface PdfMusicRequirements {
  soundcheck_date: string
  soundcheck_time: string
  pa_notes: string
  stage_dimensions: string
  microphone_count: number
  power_required: string
  streaming_needed: boolean
  streaming_notes: string
  notes: string
}

export interface PdfDekoArea {
  id: string
  name: string
  color: string
  sort_order: number
}

export interface PdfDekoCanvas {
  id: string
  area_id: string | null
  name: string
  canvas_type: 'main' | 'variant' | 'moodboard'
  is_frozen: boolean
  sort_order: number
}

export interface PdfDekoItem {
  id: string
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
  x: number
  y: number
  width: number
  height: number
}

export interface PdfDekoCatalogItem {
  id: string
  item_type: 'article' | 'fabric'
  name: string
  price_per_unit: number | null
  price_per_meter: number | null
  is_free: boolean
  notes: string | null
}

export interface PdfDekoFlatRate {
  id: string
  name: string
  description: string
  amount: number
}

export interface PdfVendor {
  id: string
  name: string
  category: string
  status: string
  contact_name: string | null
  phone: string | null
  email: string | null
  price: number | null
  notes: string | null
}

export interface PdfShotItem {
  id: string
  title: string
  description: string
  type: 'must_have' | 'optional' | 'forbidden'
  category: string
  sort_order: number
}

export interface PdfEventData {
  event: {
    id: string
    title: string
    couple_name: string | null
    date: string | null
    ceremony_start: string | null
    venue: string | null
    venue_address: string | null
    location_name: string | null
    location_street: string | null
    location_zip: string | null
    location_city: string | null
    location_website: string | null
    max_begleitpersonen: number
    children_allowed: boolean
    children_note: string | null
    budget_total: number | null
    organizer_fee: number | null
    organizer_fee_type: string | null
    internal_notes: string | null
    dresscode: string | null
    projektphase: string | null
    meal_options: string[] | null
  }
  bpMembers: Array<{ name: string | null; email: string | null }>
  organizerCosts: Array<{ category: string; amount: number; notes: string | null }>

  guests: PdfGuest[]
  begleitpersonen: PdfBegleitperson[]

  roomPoints: Array<{ x: number; y: number }>
  seatingTables: PdfSeatingTable[]
  seatingAssignments: PdfSeatingAssignment[]
  coupleName: string

  timelineEntries: PdfTimelineEntry[]
  ablaufplanDays: PdfAblaufplanDay[]

  cateringPlan: {
    service_style: string | null
    location_has_kitchen: boolean
    midnight_snack: boolean
    midnight_snack_note: string
    drinks_billing: string
    drinks_selection: string[]
    champagne_finger_food: boolean
    champagne_finger_food_note: string
    service_staff: boolean
    equipment_needed: string[]
    sektempfang: boolean
    sektempfang_note: string
    weinbegleitung: boolean
    weinbegleitung_note: string
    kinder_meal_options: string[]
    menu_courses: Array<{ id: string; name: string; descriptions: Record<string, string> }>
  } | null
  cateringCosts: Array<{ category: string; price_per_person: number; notes: string | null }>
  mealCounts: Record<string, number>
  allergyCounts: Record<string, number>
  confirmedGuestCount: number

  budgetItems: PdfBudgetItem[]
  budgetTotal: number | null

  musicSongs: PdfMusicSong[]
  musicRequirements: PdfMusicRequirements | null

  dekoAreas: PdfDekoArea[]
  dekoCanvases: PdfDekoCanvas[]
  dekoItemsByCanvas: Record<string, PdfDekoItem[]>
  dekoCatalogItems: PdfDekoCatalogItem[]
  dekoFlatRates: PdfDekoFlatRate[]

  patisserieConfig: {
    cake_description: string
    layers: number
    flavors: string[]
    dietary_notes: string
    delivery_date: string
    delivery_time: string
    cooling_required: boolean
    cooling_notes: string
    setup_location: string
    cake_table_provided: boolean
    dessert_buffet: boolean
    dessert_items: string[]
    price: number
    vendor_notes: string
  } | null

  mediaBriefing: {
    photo_briefing: string
    video_briefing: string
    photo_restrictions: string
    upload_instructions: string
    delivery_deadline: string
  } | null
  mediaShotItems: PdfShotItem[]

  vendors: PdfVendor[]
}

export type PdfMode = 'intern' | 'extern'

export type PdfSection =
  | 'allgemein'
  | 'gaesteliste'
  | 'sitzplan'
  | 'ablaufplan'
  | 'catering'
  | 'budget'
  | 'musik'
  | 'dekoration'
  | 'patisserie'
  | 'medien'
  | 'dienstleister'
