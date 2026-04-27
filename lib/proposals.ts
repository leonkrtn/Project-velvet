// ══════════════════════════════════════════════════════════════════════════════
// lib/proposals.ts — Proposals V2
// Echtzeit-Verhandlungs- und Merge-System
//
// Struktur:
//   TYPES          → DB-Interfaces + Segment-Datenmodelle
//   FIELD PATHS    → Utilitys für field_path Strings
//   DELTA ENGINE   → Snapshot-zu-Proposal Differenzberechnung
//   PROPOSAL CRUD  → Erstellen, Laden, Senden
//   SNAPSHOTS      → Snapshot erstellen & lesen
//   FIELDS         → Feld-Deltas upserten & lesen
//   RECIPIENTS     → Empfänger verwalten & abstimmen
//   CASES          → Verhandlungsraum & Chat
//   LOCKS          → Field Locking (acquire, release, heartbeat)
//   MERGE          → Validierung & finaler Merge
//   HISTORY        → Audit-Trail lesen
//   REALTIME       → Subscriptions
// ══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client'

// ══════════════════════════════════════════════════════════════════════════════
// TYPES — Datenbank-Tabellen
// ══════════════════════════════════════════════════════════════════════════════

export type UserRole = 'veranstalter' | 'brautpaar' | 'dienstleister'
export type ProposalModule =
  | 'catering' | 'ablaufplan' | 'sitzplan' | 'deko' | 'musik' | 'patisserie' | 'vendor' | 'hotel'
export type ProposalStatus = 'draft' | 'pending' | 'in_case' | 'accepted' | 'rejected'
export type RecipientStatus = 'pending' | 'accepted' | 'rejected' | 'countered'

export interface Proposal {
  id: string
  event_id: string
  created_by: string
  created_by_role: UserRole
  module: ProposalModule
  title: string
  status: ProposalStatus
  base_version: string
  created_at: string
  updated_at: string
}

export interface ProposalRecipient {
  id: string
  proposal_id: string
  user_id: string
  role: UserRole
  status: RecipientStatus
  responded_at: string | null
  // joined
  profile?: { name: string | null; }
}

export interface ProposalSnapshot {
  id: string
  proposal_id: string
  snapshot_json: SegmentData
  created_at: string
}

export interface ProposalField {
  id: string
  proposal_id: string
  segment: string
  entity_id: string
  field_key: string
  value_old: unknown
  value_new: unknown
  is_changed: boolean
  created_at: string
}

export interface Case {
  id: string
  proposal_id: string
  created_by: string
  status: 'open' | 'resolved'
  resolved_at: string | null
  created_at: string
}

export interface CaseMessage {
  id: string
  case_id: string
  user_id: string
  content: string
  created_at: string
  profile?: { name: string | null; }
}

export interface FieldLock {
  id: string
  proposal_id: string
  field_path: string
  locked_by: string
  locked_at: string
  expires_at: string
}

export interface HistoryEntry {
  id: string
  entity_type: 'proposal' | 'case' | 'field' | 'merge'
  entity_id: string
  action: string
  old_state: unknown
  new_state: unknown
  changed_by: string
  changed_by_role: string
  proposal_id: string | null
  created_at: string
  profile?: { name: string | null }
}

// Angereicherter Typ für UI-Darstellung
export interface ProposalWithDetails extends Proposal {
  recipients: ProposalRecipient[]
  snapshot: ProposalSnapshot | null
  fields: ProposalField[]
  case: Case | null
  creator_profile?: { name: string | null; }
}


// ══════════════════════════════════════════════════════════════════════════════
// TYPES — Segment-Datenmodelle (alle mit stabilen IDs)
// ══════════════════════════════════════════════════════════════════════════════

// ── Catering (Matrix: Gänge × Optionen) ─────────────────────────────────────

export interface CateringRow {
  row_id: string
  name: string
  order: number
  notes?: string
}

export interface CateringOption {
  option_id: string
  name: string
  description?: string
}

export interface CateringItem {
  item_id: string
  row_id: string
  option_id: string
  description?: string
  price?: number
  allergens?: string[]
  available: boolean
}

export interface CateringSegmentData {
  rows: CateringRow[]
  options: CateringOption[]
  items: CateringItem[]
  service_style?: string
  min_persons?: number
  notes?: string
}

// ── Ablaufplan (Timeline mit stabilen Slot-IDs) ──────────────────────────────

export type SlotCategory =
  | 'ceremony' | 'reception' | 'dinner' | 'party' | 'photo' | 'other'

export interface TimelineSlot {
  slot_id: string
  time: string                // HH:mm
  duration_minutes: number
  title: string
  description?: string
  location?: string
  responsible?: string[]
  category: SlotCategory
  color?: string
  visible_to: UserRole[]      // Rollenbasierte Sichtbarkeit
}

export interface AblaufplanSegmentData {
  slots: TimelineSlot[]
  date?: string               // ISO Datum des Events
  notes?: string
}

// ── Hotel ─────────────────────────────────────────────────────────────────────

export interface HotelRoomType {
  room_type_id: string
  hotel_id: string
  name: string
  capacity: number
  price_per_night: number
  contingent: number
  booked: number
  amenities?: string[]
  notes?: string
}

export interface HotelOption {
  hotel_id: string
  name: string
  address?: string
  stars?: number
  website?: string
  distance_km?: number
  contact_person?: string
  contact_phone?: string
  notes?: string
  room_types: HotelRoomType[]
}

export interface HotelSegmentData {
  hotels: HotelOption[]
  check_in_date?: string
  check_out_date?: string
  notes?: string
}

// ── Musik & Technik (rollenbasiertes Sichtbarkeitsmodell) ────────────────────

export type MusicActType = 'DJ' | 'Band' | 'Soloist' | 'Ensemble' | 'Choir' | 'Other'

export interface MusicAct {
  act_id: string
  name: string
  type: MusicActType
  set_duration_minutes: number
  setup_time_minutes: number
  price: number
  notes_public?: string           // Brautpaar sieht dies
  notes_internal?: string         // Nur Veranstalter + Dienstleister
  visible_to_brautpaar: boolean
}

export interface MusicEquipment {
  equipment_id: string
  name: string
  quantity: number
  provided_by: 'venue' | 'artist' | 'rental'
  notes?: string
}

export interface MusikSegmentData {
  acts: MusicAct[]
  equipment: MusicEquipment[]
  stage_setup_notes?: string
  sound_check_time?: string
  load_in_time?: string
}

// ── Deko & Moodboard ─────────────────────────────────────────────────────────

export interface DekoItem {
  deko_id: string
  name: string
  category: string
  quantity: number
  price?: number
  image_url?: string
  supplier?: string
  tags: string[]
  notes?: string
}

export interface DekoSegmentData {
  items: DekoItem[]
  moodboard_urls: string[]
  style_tags: string[]
  color_palette?: string[]
  theme?: string
  notes?: string
}

// ── Patisserie ────────────────────────────────────────────────────────────────

export interface CakeItem {
  cake_id: string
  name: string
  flavors: string[]
  tiers: number
  servings: number
  price: number
  customizations?: string
  image_url?: string
  allergens?: string[]
}

export interface DessertItem {
  dessert_id: string
  name: string
  quantity: number
  price_per_unit: number
  allergens?: string[]
  notes?: string
}

export interface PatisserieSegmentData {
  cakes: CakeItem[]
  desserts: DessertItem[]
  servings_total: number
  delivery_time?: string
  setup_time?: string
  notes?: string
}

// ── Vendor (Dienstleister-Paket) ─────────────────────────────────────────────

export interface VendorPackage {
  package_id: string
  name: string
  description?: string
  price: number
  includes: string[]
  duration_hours?: number
  travel_included?: boolean
}

export interface VendorSegmentData {
  vendor_profile_id?: string
  packages: VendorPackage[]
  selected_package_id?: string
  availability_confirmed: boolean
  availability_date?: string
  deposit_amount?: number
  deposit_due_date?: string
  contract_notes?: string
}

// ── Sitzplan ─────────────────────────────────────────────────────────────────

export interface SitzplanTable {
  table_id: string
  name: string
  capacity: number
  shape: 'round' | 'rectangular' | 'other'
  x: number
  y: number
  rotation?: number
}

export interface SitzplanAssignment {
  assignment_id: string
  table_id: string
  guest_id: string
  seat_number?: number
}

export interface SitzplanSegmentData {
  tables: SitzplanTable[]
  assignments: SitzplanAssignment[]
  notes?: string
}

// Union aller Segment-Daten
export type SegmentData =
  | CateringSegmentData
  | AblaufplanSegmentData
  | HotelSegmentData
  | MusikSegmentData
  | DekoSegmentData
  | PatisserieSegmentData
  | VendorSegmentData
  | SitzplanSegmentData


// ══════════════════════════════════════════════════════════════════════════════
// TYPES — Delta Engine
// ══════════════════════════════════════════════════════════════════════════════

export interface DeltaField {
  segment: string
  entity_id: string
  field_key: string
  value_old: unknown
  value_new: unknown
  label?: string         // Lesbare Bezeichnung für UI
  is_addition: boolean   // Neues Entity (value_old = null)
  is_deletion: boolean   // Gelöschtes Entity (value_new = null)
}

export interface ProposalFieldInput {
  segment: string
  entity_id: string
  field_key: string
  value_old: unknown
  value_new: unknown
}

// Merge-Auswahl: pro Feld entscheiden ob neuer oder alter Wert übernommen wird
export type FieldMergeSelection = Record<string, 'keep_new' | 'keep_old'>
// Key-Format: `${segment}.${entity_id}.${field_key}`


// ══════════════════════════════════════════════════════════════════════════════
// FIELD PATHS — Utilities
// ══════════════════════════════════════════════════════════════════════════════

export function buildFieldPath(segment: string, entity_id: string, field_key: string): string {
  return `${segment}.${entity_id}.${field_key}`
}

export function parseFieldPath(path: string): { segment: string; entity_id: string; field_key: string } | null {
  const parts = path.split('.')
  if (parts.length < 3) return null
  const field_key = parts[parts.length - 1]
  const entity_id = parts[parts.length - 2]
  const segment   = parts.slice(0, parts.length - 2).join('.')
  return { segment, entity_id, field_key }
}

export function fieldToPath(f: Pick<ProposalField, 'segment' | 'entity_id' | 'field_key'>): string {
  return buildFieldPath(f.segment, f.entity_id, f.field_key)
}


// ══════════════════════════════════════════════════════════════════════════════
// DELTA ENGINE — Snapshot vs. Proposed State
// ══════════════════════════════════════════════════════════════════════════════

function diffValues(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b)
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  return Object.entries(obj).reduce<Record<string, unknown>>((acc, [key, val]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(acc, flattenObject(val as Record<string, unknown>, path))
    } else {
      acc[path] = val
    }
    return acc
  }, {})
}

// Berechnet alle geänderten Felder zwischen einem Snapshot und dem Proposed State.
export function computeDeltas(
  snapshotData: SegmentData | null,
  proposedData: SegmentData,
  module: ProposalModule
): ProposalFieldInput[] {
  switch (module) {
    case 'catering':
      return computeCateringDeltas(
        snapshotData as CateringSegmentData | null,
        proposedData as CateringSegmentData
      )
    case 'ablaufplan':
      return computeAblaufplanDeltas(
        snapshotData as AblaufplanSegmentData | null,
        proposedData as AblaufplanSegmentData
      )
    case 'hotel':
      return computeHotelDeltas(
        snapshotData as HotelSegmentData | null,
        proposedData as HotelSegmentData
      )
    case 'musik':
      return computeMusikDeltas(
        snapshotData as MusikSegmentData | null,
        proposedData as MusikSegmentData
      )
    case 'deko':
      return computeDekoDeltas(
        snapshotData as DekoSegmentData | null,
        proposedData as DekoSegmentData
      )
    case 'patisserie':
      return computePatisserieDeltas(
        snapshotData as PatisserieSegmentData | null,
        proposedData as PatisserieSegmentData
      )
    case 'vendor':
      return computeVendorDeltas(
        snapshotData as VendorSegmentData | null,
        proposedData as VendorSegmentData
      )
    case 'sitzplan':
      return computeSitzplanDeltas(
        snapshotData as SitzplanSegmentData | null,
        proposedData as SitzplanSegmentData
      )
    default:
      return []
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function diffEntities(
  segment: string,
  idKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oldList: any[] | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  newList: any[]
): ProposalFieldInput[] {
  const deltas: ProposalFieldInput[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oldMap = new Map<string, any>((oldList ?? []).map((e: any) => [e[idKey] as string, e]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newMap = new Map<string, any>(newList.map((e: any) => [e[idKey] as string, e]))

  // Neue oder geänderte Entities
  Array.from(newMap.entries()).forEach(([id, newEntity]) => {
    const oldEntity = oldMap.get(id)
    if (!oldEntity) {
      deltas.push({ segment, entity_id: id, field_key: '__entity__', value_old: null, value_new: newEntity })
    } else {
      const oldFlat = flattenObject(oldEntity)
      const newFlat = flattenObject(newEntity)
      const allKeys = Array.from(new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)]))
      allKeys.forEach(key => {
        if (key === idKey) return
        if (diffValues(oldFlat[key], newFlat[key])) {
          deltas.push({
            segment,
            entity_id: id,
            field_key: key,
            value_old: oldFlat[key] ?? null,
            value_new: newFlat[key] ?? null,
          })
        }
      })
    }
  })

  // Gelöschte Entities
  Array.from(oldMap.entries()).forEach(([id, oldEntity]) => {
    if (!newMap.has(id)) {
      deltas.push({ segment, entity_id: id, field_key: '__entity__', value_old: oldEntity, value_new: null })
    }
  })

  return deltas
}

function diffTopLevel(
  segment: string,
  entityId: string,
  oldObj: Record<string, unknown> | null | undefined,
  newObj: Record<string, unknown>
): ProposalFieldInput[] {
  const deltas: ProposalFieldInput[] = []
  const oldFlat = flattenObject(oldObj ?? {})
  const newFlat = flattenObject(newObj)
  const allKeys = Array.from(new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)]))
  allKeys.forEach(key => {
    if (diffValues(oldFlat[key], newFlat[key])) {
      deltas.push({
        segment,
        entity_id: entityId,
        field_key: key,
        value_old: oldFlat[key] ?? null,
        value_new: newFlat[key] ?? null,
      })
    }
  })
  return deltas
}

function computeCateringDeltas(snap: CateringSegmentData | null, data: CateringSegmentData): ProposalFieldInput[] {
  return [
    ...diffEntities('catering.row',    'row_id',    snap?.rows,    data.rows),
    ...diffEntities('catering.option', 'option_id', snap?.options, data.options),
    ...diffEntities('catering.item',   'item_id',   snap?.items,   data.items),
    ...diffTopLevel('catering.meta',   '__meta__',
      snap ? { service_style: snap.service_style, min_persons: snap.min_persons, notes: snap.notes } : null,
      { service_style: data.service_style, min_persons: data.min_persons, notes: data.notes }
    ),
  ]
}

function computeAblaufplanDeltas(snap: AblaufplanSegmentData | null, data: AblaufplanSegmentData): ProposalFieldInput[] {
  return [
    ...diffEntities('ablaufplan.slot', 'slot_id', snap?.slots, data.slots),
    ...diffTopLevel('ablaufplan.meta', '__meta__',
      snap ? { date: snap.date, notes: snap.notes } : null,
      { date: data.date, notes: data.notes }
    ),
  ]
}

function computeHotelDeltas(snap: HotelSegmentData | null, data: HotelSegmentData): ProposalFieldInput[] {
  const deltas: ProposalFieldInput[] = []
  for (const hotel of data.hotels) {
    const snapHotel = snap?.hotels.find(h => h.hotel_id === hotel.hotel_id)
    const { room_types: _nr, ...hotelMeta } = hotel
    const { room_types: _sr, ...snapMeta } = snapHotel ?? { room_types: [] }
    deltas.push(...diffTopLevel('hotel.info', hotel.hotel_id, snapHotel ? snapMeta as Record<string,unknown> : null, hotelMeta as Record<string,unknown>))
    deltas.push(...diffEntities('hotel.room_type', 'room_type_id', snapHotel?.room_types, hotel.room_types))
  }
  for (const snapHotel of (snap?.hotels ?? [])) {
    if (!data.hotels.find(h => h.hotel_id === snapHotel.hotel_id)) {
      deltas.push({ segment: 'hotel.info', entity_id: snapHotel.hotel_id, field_key: '__entity__', value_old: snapHotel, value_new: null })
    }
  }
  deltas.push(...diffTopLevel('hotel.meta', '__meta__',
    snap ? { check_in_date: snap.check_in_date, check_out_date: snap.check_out_date, notes: snap.notes } : null,
    { check_in_date: data.check_in_date, check_out_date: data.check_out_date, notes: data.notes }
  ))
  return deltas
}

function computeMusikDeltas(snap: MusikSegmentData | null, data: MusikSegmentData): ProposalFieldInput[] {
  return [
    ...diffEntities('musik.act',       'act_id',       snap?.acts,      data.acts),
    ...diffEntities('musik.equipment', 'equipment_id', snap?.equipment, data.equipment),
    ...diffTopLevel('musik.meta', '__meta__',
      snap ? { stage_setup_notes: snap.stage_setup_notes, sound_check_time: snap.sound_check_time, load_in_time: snap.load_in_time } : null,
      { stage_setup_notes: data.stage_setup_notes, sound_check_time: data.sound_check_time, load_in_time: data.load_in_time }
    ),
  ]
}

function computeDekoDeltas(snap: DekoSegmentData | null, data: DekoSegmentData): ProposalFieldInput[] {
  return [
    ...diffEntities('deko.item', 'deko_id', snap?.items, data.items),
    ...diffTopLevel('deko.meta', '__meta__',
      snap ? { moodboard_urls: snap.moodboard_urls, style_tags: snap.style_tags, color_palette: snap.color_palette, theme: snap.theme, notes: snap.notes } : null,
      { moodboard_urls: data.moodboard_urls, style_tags: data.style_tags, color_palette: data.color_palette, theme: data.theme, notes: data.notes }
    ),
  ]
}

function computePatisserieDeltas(snap: PatisserieSegmentData | null, data: PatisserieSegmentData): ProposalFieldInput[] {
  return [
    ...diffEntities('patisserie.cake',    'cake_id',    snap?.cakes,    data.cakes),
    ...diffEntities('patisserie.dessert', 'dessert_id', snap?.desserts, data.desserts),
    ...diffTopLevel('patisserie.meta', '__meta__',
      snap ? { servings_total: snap.servings_total, delivery_time: snap.delivery_time, setup_time: snap.setup_time, notes: snap.notes } : null,
      { servings_total: data.servings_total, delivery_time: data.delivery_time, setup_time: data.setup_time, notes: data.notes }
    ),
  ]
}

function computeVendorDeltas(snap: VendorSegmentData | null, data: VendorSegmentData): ProposalFieldInput[] {
  return [
    ...diffEntities('vendor.package', 'package_id', snap?.packages, data.packages),
    ...diffTopLevel('vendor.meta', '__meta__',
      snap ? { vendor_profile_id: snap.vendor_profile_id, selected_package_id: snap.selected_package_id, availability_confirmed: snap.availability_confirmed, deposit_amount: snap.deposit_amount } : null,
      { vendor_profile_id: data.vendor_profile_id, selected_package_id: data.selected_package_id, availability_confirmed: data.availability_confirmed, deposit_amount: data.deposit_amount }
    ),
  ]
}

function computeSitzplanDeltas(snap: SitzplanSegmentData | null, data: SitzplanSegmentData): ProposalFieldInput[] {
  return [
    ...diffEntities('sitzplan.table',      'table_id',      snap?.tables,      data.tables),
    ...diffEntities('sitzplan.assignment', 'assignment_id', snap?.assignments, data.assignments),
    ...diffTopLevel('sitzplan.meta', '__meta__', snap ? { notes: snap.notes } : null, { notes: data.notes }),
  ]
}

// Konvertiert proposal_fields in angezeigte DeltaField-Liste
export function buildDeltaFields(fields: ProposalField[]): DeltaField[] {
  return fields.filter(f => f.is_changed).map(f => ({
    segment:     f.segment,
    entity_id:   f.entity_id,
    field_key:   f.field_key,
    value_old:   f.value_old,
    value_new:   f.value_new,
    is_addition: f.value_old === null,
    is_deletion: f.value_new === null,
  }))
}


// ══════════════════════════════════════════════════════════════════════════════
// PROPOSAL CRUD
// ══════════════════════════════════════════════════════════════════════════════

export async function createProposalDraft(params: {
  event_id: string
  module: ProposalModule
  title: string
  created_by_role: UserRole
  snapshot: SegmentData
}): Promise<{ proposal: Proposal; snapshot: ProposalSnapshot } | { error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const base_version = new Date().toISOString()

  const { data: proposal, error: pErr } = await supabase
    .from('proposals')
    .insert({
      event_id:        params.event_id,
      created_by:      user.id,
      created_by_role: params.created_by_role,
      module:          params.module,
      title:           params.title,
      status:          'draft',
      base_version,
    })
    .select()
    .single()

  if (pErr || !proposal) return { error: pErr?.message ?? 'insert_failed' }

  const { data: snap, error: sErr } = await supabase
    .from('proposal_snapshots')
    .insert({ proposal_id: proposal.id, snapshot_json: params.snapshot })
    .select()
    .single()

  if (sErr || !snap) return { error: sErr?.message ?? 'snapshot_failed' }

  return { proposal: proposal as Proposal, snapshot: snap as ProposalSnapshot }
}

export async function fetchProposal(proposalId: string): Promise<ProposalWithDetails | null> {
  const supabase = createClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*, creator_profile:profiles!created_by(name)')
    .eq('id', proposalId)
    .single()

  if (!proposal) return null

  const [
    { data: recipients },
    { data: snapshot },
    { data: fields },
    { data: caseData },
  ] = await Promise.all([
    supabase
      .from('proposal_recipients')
      .select('*, profile:profiles!user_id(name)')
      .eq('proposal_id', proposalId)
      .order('id'),
    supabase
      .from('proposal_snapshots')
      .select('*')
      .eq('proposal_id', proposalId)
      .single(),
    supabase
      .from('proposal_fields')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at'),
    supabase
      .from('cases')
      .select('*')
      .eq('proposal_id', proposalId)
      .single(),
  ])

  return {
    ...(proposal as Proposal),
    creator_profile: (proposal as Record<string, unknown>).creator_profile as ProposalWithDetails['creator_profile'],
    recipients:      (recipients ?? []) as ProposalRecipient[],
    snapshot:        (snapshot ?? null) as ProposalSnapshot | null,
    fields:          (fields ?? []) as ProposalField[],
    case:            (caseData ?? null) as Case | null,
  }
}

export async function fetchProposalsForEvent(eventId: string): Promise<ProposalWithDetails[]> {
  const supabase = createClient()

  const { data: proposals } = await supabase
    .from('proposals')
    .select('*, creator_profile:profiles!created_by(name)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (!proposals || proposals.length === 0) return []

  const ids = proposals.map((p: Record<string, unknown>) => p.id as string)

  const [{ data: recipients }, { data: snapshots }] = await Promise.all([
    supabase
      .from('proposal_recipients')
      .select('*, profile:profiles!user_id(name)')
      .in('proposal_id', ids),
    supabase
      .from('proposal_snapshots')
      .select('*')
      .in('proposal_id', ids),
  ])

  return proposals.map((p: Record<string, unknown>) => ({
    ...(p as unknown as Proposal),
    creator_profile: p.creator_profile as ProposalWithDetails['creator_profile'],
    recipients: ((recipients ?? []) as ProposalRecipient[]).filter(r => r.proposal_id === p.id as string),
    snapshot: (((snapshots ?? []) as ProposalSnapshot[]).find(s => s.proposal_id === p.id as string) ?? null),
    fields: [],
    case: null,
  }))
}

export async function sendProposal(proposalId: string): Promise<{ error?: string }> {
  const supabase = createClient()

  const { data: recipients } = await supabase
    .from('proposal_recipients')
    .select('id')
    .eq('proposal_id', proposalId)

  if (!recipients || recipients.length === 0) return { error: 'no_recipients' }

  const { error } = await supabase
    .from('proposals')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('status', 'draft')

  return { error: error?.message }
}

export async function deleteProposal(proposalId: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', proposalId)
    .eq('status', 'draft')
  return { error: error?.message }
}


// ══════════════════════════════════════════════════════════════════════════════
// SNAPSHOTS
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchSnapshot(proposalId: string): Promise<ProposalSnapshot | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('proposal_snapshots')
    .select('*')
    .eq('proposal_id', proposalId)
    .single()
  return (data ?? null) as ProposalSnapshot | null
}


// ══════════════════════════════════════════════════════════════════════════════
// FIELDS — Feld-Deltas verwalten
// ══════════════════════════════════════════════════════════════════════════════

export async function upsertProposalFields(
  proposalId: string,
  fields: ProposalFieldInput[]
): Promise<{ error?: string }> {
  if (fields.length === 0) return {}
  const supabase = createClient()

  const rows = fields.map(f => ({
    proposal_id: proposalId,
    segment:     f.segment,
    entity_id:   f.entity_id,
    field_key:   f.field_key,
    value_old:   f.value_old ?? null,
    value_new:   f.value_new ?? null,
    is_changed:  true,
  }))

  const { error } = await supabase
    .from('proposal_fields')
    .upsert(rows, { onConflict: 'proposal_id,segment,entity_id,field_key' })

  return { error: error?.message }
}

export async function computeAndSaveDeltas(
  proposalId: string,
  module: ProposalModule,
  proposedData: SegmentData
): Promise<{ deltas: ProposalFieldInput[]; error?: string }> {
  const snapshot = await fetchSnapshot(proposalId)
  const deltas = computeDeltas(snapshot?.snapshot_json ?? null, proposedData, module)

  if (deltas.length > 0) {
    const { error } = await upsertProposalFields(proposalId, deltas)
    if (error) return { deltas, error }
  }

  return { deltas }
}

export async function fetchProposalFields(proposalId: string): Promise<ProposalField[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('proposal_fields')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at')
  return (data ?? []) as ProposalField[]
}


// ══════════════════════════════════════════════════════════════════════════════
// RECIPIENTS — Empfänger verwalten & abstimmen
// ══════════════════════════════════════════════════════════════════════════════

export async function addRecipient(params: {
  proposal_id: string
  user_id: string
  role: UserRole
}): Promise<{ error?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('proposal_recipients')
    .insert({ ...params, status: 'pending' })
  return { error: error?.message }
}

export async function removeRecipient(proposalId: string, userId: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('proposal_recipients')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('user_id', userId)
  return { error: error?.message }
}

export async function fetchRecipients(proposalId: string): Promise<ProposalRecipient[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('proposal_recipients')
    .select('*, profile:profiles!user_id(name)')
    .eq('proposal_id', proposalId)
  return (data ?? []) as ProposalRecipient[]
}

export async function acceptProposal(proposalId: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const { error } = await supabase
    .from('proposal_recipients')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('proposal_id', proposalId)
    .eq('user_id', user.id)
    .eq('status', 'pending')

  return { error: error?.message }
}

export async function rejectProposal(proposalId: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const { error: rErr } = await supabase
    .from('proposal_recipients')
    .update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('proposal_id', proposalId)
    .eq('user_id', user.id)

  if (rErr) return { error: rErr.message }

  const { error: pErr } = await supabase
    .from('proposals')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', proposalId)

  return { error: pErr?.message }
}

// Gegenvorschlag: öffnet einen Case via DB-Funktion (Reset-Modell)
export async function counterProposal(
  proposalId: string,
  counterFields: ProposalFieldInput[]
): Promise<{ case_id: string; error?: string }> {
  const supabase = createClient()

  const { data: caseId, error: fnErr } = await supabase
    .rpc('open_case_for_proposal', { p_proposal_id: proposalId })

  if (fnErr || !caseId) return { case_id: '', error: fnErr?.message ?? 'case_open_failed' }

  if (counterFields.length > 0) {
    const { error: fErr } = await upsertProposalFields(proposalId, counterFields)
    if (fErr) return { case_id: caseId as string, error: fErr }
  }

  return { case_id: caseId as string }
}


// ══════════════════════════════════════════════════════════════════════════════
// CASES — Verhandlungsraum
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchCase(proposalId: string): Promise<Case | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('cases')
    .select('*')
    .eq('proposal_id', proposalId)
    .single()
  return (data ?? null) as Case | null
}

export async function sendCaseMessage(caseId: string, content: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }
  if (!content.trim()) return { error: 'empty_content' }

  const { error } = await supabase
    .from('case_messages')
    .insert({ case_id: caseId, user_id: user.id, content: content.trim() })

  return { error: error?.message }
}

export async function fetchCaseMessages(caseId: string): Promise<CaseMessage[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('case_messages')
    .select('*, profile:profiles!user_id(name)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
  return (data ?? []) as CaseMessage[]
}

export async function resolveCase(caseId: string, proposalId: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('cases')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', caseId)

  if (error) return { error: error.message }

  await supabase
    .from('proposals')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('status', 'in_case')

  return {}
}


// ══════════════════════════════════════════════════════════════════════════════
// LOCKS — Field Locking
// ══════════════════════════════════════════════════════════════════════════════

export interface LockResult {
  success: boolean
  acquired?: boolean
  extended?: boolean
  expires_at?: string
  reason?: string
  locked_by?: string
}

export async function acquireFieldLock(
  proposalId: string,
  segment: string,
  entityId: string,
  fieldKey: string
): Promise<LockResult> {
  const supabase = createClient()
  const fieldPath = buildFieldPath(segment, entityId, fieldKey)

  const { data, error } = await supabase
    .rpc('acquire_field_lock', { p_proposal_id: proposalId, p_field_path: fieldPath })

  if (error) return { success: false, reason: error.message }
  return data as LockResult
}

export async function releaseFieldLock(
  proposalId: string,
  segment: string,
  entityId: string,
  fieldKey: string
): Promise<boolean> {
  const supabase = createClient()
  const fieldPath = buildFieldPath(segment, entityId, fieldKey)
  const { data } = await supabase
    .rpc('release_field_lock', { p_proposal_id: proposalId, p_field_path: fieldPath })
  return !!data
}

export async function heartbeatFieldLock(
  proposalId: string,
  segment: string,
  entityId: string,
  fieldKey: string
): Promise<boolean> {
  const supabase = createClient()
  const fieldPath = buildFieldPath(segment, entityId, fieldKey)
  const { data } = await supabase
    .rpc('heartbeat_field_lock', { p_proposal_id: proposalId, p_field_path: fieldPath })
  return !!data
}

export async function fetchActiveLocks(proposalId: string): Promise<FieldLock[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('field_locks')
    .select('*')
    .eq('proposal_id', proposalId)
    .gt('expires_at', new Date().toISOString())
  return (data ?? []) as FieldLock[]
}

export function isFieldLockedByOther(
  locks: FieldLock[],
  currentUserId: string,
  segment: string,
  entityId: string,
  fieldKey: string
): { locked: boolean; locked_by?: string; expires_at?: string } {
  const path = buildFieldPath(segment, entityId, fieldKey)
  const lock = locks.find(l => l.field_path === path && new Date(l.expires_at) > new Date())
  if (!lock) return { locked: false }
  if (lock.locked_by === currentUserId) return { locked: false }
  return { locked: true, locked_by: lock.locked_by, expires_at: lock.expires_at }
}

// Startet Heartbeat-Intervall für alle eigenen Locks. Gibt cleanup-Funktion zurück.
export function startLockHeartbeat(
  proposalId: string,
  lockedFields: Array<{ segment: string; entity_id: string; field_key: string }>,
  intervalMs = 20_000
): () => void {
  const timer = setInterval(async () => {
    await Promise.all(
      lockedFields.map(f =>
        heartbeatFieldLock(proposalId, f.segment, f.entity_id, f.field_key)
      )
    )
  }, intervalMs)
  return () => clearInterval(timer)
}


// ══════════════════════════════════════════════════════════════════════════════
// MERGE — Validierung & Durchführung
// ══════════════════════════════════════════════════════════════════════════════

export interface MergeValidationResult {
  ok: boolean
  reason?: string
  status?: string
}

export async function validateMerge(proposalId: string): Promise<MergeValidationResult> {
  const supabase = createClient()
  const { data, error } = await supabase
    .rpc('validate_merge_proposal', { p_proposal_id: proposalId })
  if (error) return { ok: false, reason: error.message }
  return data as MergeValidationResult
}

// Wendet die Nutzer-Auswahl (keep_new / keep_old) auf Snapshot + Felder an.
// Gibt den finalen Merged State zurück.
export function applyMergeSelections(
  snapshot: SegmentData,
  proposedFields: ProposalField[],
  selections: FieldMergeSelection
): SegmentData {
  const result = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>

  for (const f of proposedFields.filter(pf => pf.is_changed)) {
    const selKey = buildFieldPath(f.segment, f.entity_id, f.field_key)
    const choice = selections[selKey] ?? 'keep_new'
    if (choice === 'keep_new') {
      applyFieldValue(result, f.segment, f.entity_id, f.field_key, f.value_new)
    }
    // 'keep_old' → nichts tun, Snapshot-Wert bleibt erhalten
  }

  return result as unknown as SegmentData
}

function applyFieldValue(
  data: Record<string, unknown>,
  segment: string,
  entityId: string,
  fieldKey: string,
  value: unknown
): void {
  const arrayKey  = getEntityArrayKey(segment)
  const idKey     = getEntityIdKey(segment)

  if (!arrayKey || !idKey) return

  // Für Meta-Segmente (segment.meta) direkt auf Top-Level setzen
  if (entityId === '__meta__') {
    setNestedValue(data, fieldKey.split('.'), value)
    return
  }

  const arr = data[arrayKey] as Array<Record<string, unknown>> | undefined
  if (!arr) {
    data[arrayKey] = []
  }
  const target = data[arrayKey] as Array<Record<string, unknown>>

  if (fieldKey === '__entity__') {
    if (value === null) {
      const idx = target.findIndex(e => e[idKey] === entityId)
      if (idx >= 0) target.splice(idx, 1)
    } else {
      const idx = target.findIndex(e => e[idKey] === entityId)
      if (idx >= 0) target[idx] = value as Record<string, unknown>
      else target.push(value as Record<string, unknown>)
    }
  } else {
    const entity = target.find(e => e[idKey] === entityId)
    if (entity) {
      setNestedValue(entity, fieldKey.split('.'), value)
    }
  }
}

function getEntityArrayKey(segment: string): string | null {
  const map: Record<string, string> = {
    'catering.row':         'rows',
    'catering.option':      'options',
    'catering.item':        'items',
    'ablaufplan.slot':      'slots',
    'hotel.info':           'hotels',
    'hotel.room_type':      'room_types',
    'musik.act':            'acts',
    'musik.equipment':      'equipment',
    'deko.item':            'items',
    'patisserie.cake':      'cakes',
    'patisserie.dessert':   'desserts',
    'vendor.package':       'packages',
    'sitzplan.table':       'tables',
    'sitzplan.assignment':  'assignments',
  }
  return map[segment] ?? null
}

function getEntityIdKey(segment: string): string | null {
  const map: Record<string, string> = {
    'catering.row':         'row_id',
    'catering.option':      'option_id',
    'catering.item':        'item_id',
    'ablaufplan.slot':      'slot_id',
    'hotel.info':           'hotel_id',
    'hotel.room_type':      'room_type_id',
    'musik.act':            'act_id',
    'musik.equipment':      'equipment_id',
    'deko.item':            'deko_id',
    'patisserie.cake':      'cake_id',
    'patisserie.dessert':   'dessert_id',
    'vendor.package':       'package_id',
    'sitzplan.table':       'table_id',
    'sitzplan.assignment':  'assignment_id',
  }
  return map[segment] ?? null
}

function setNestedValue(obj: Record<string, unknown>, keys: string[], value: unknown): void {
  if (keys.length === 0) return
  if (keys.length === 1) {
    obj[keys[0]] = value
    return
  }
  if (typeof obj[keys[0]] !== 'object' || obj[keys[0]] === null) {
    obj[keys[0]] = {}
  }
  setNestedValue(obj[keys[0]] as Record<string, unknown>, keys.slice(1), value)
}

// Markiert Proposal als accepted und schreibt History
export async function finalizeMerge(
  proposalId: string,
  mergedState: SegmentData
): Promise<{ error?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .rpc('finalize_merge', {
      p_proposal_id:  proposalId,
      p_merged_state: mergedState,
    })
  return { error: error?.message }
}

// Vollständiger Merge-Flow: validieren → berechnen → finalisieren
export async function executeMerge(
  proposalId: string,
  selections: FieldMergeSelection
): Promise<{ mergedState?: SegmentData; error?: string }> {
  const validation = await validateMerge(proposalId)
  if (!validation.ok) return { error: validation.reason }

  const [snapshot, fields] = await Promise.all([
    fetchSnapshot(proposalId),
    fetchProposalFields(proposalId),
  ])

  if (!snapshot) return { error: 'snapshot_not_found' }

  const mergedState = applyMergeSelections(snapshot.snapshot_json, fields, selections)

  const { error } = await finalizeMerge(proposalId, mergedState)
  if (error) return { error }

  return { mergedState }
}


// ══════════════════════════════════════════════════════════════════════════════
// HISTORY — Audit-Trail
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchProposalHistory(proposalId: string): Promise<HistoryEntry[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('history_log')
    .select('*, profile:profiles!changed_by(name)')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })
  return (data ?? []) as HistoryEntry[]
}

export async function writeHistory(params: {
  entity_type: HistoryEntry['entity_type']
  entity_id: string
  action: string
  old_state?: unknown
  new_state?: unknown
  proposal_id?: string
}): Promise<{ error?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .rpc('write_proposal_history', {
      p_entity_type: params.entity_type,
      p_entity_id:   params.entity_id,
      p_action:      params.action,
      p_old_state:   params.old_state ?? null,
      p_new_state:   params.new_state ?? null,
      p_proposal_id: params.proposal_id ?? null,
    })
  return { error: error?.message }
}


// ══════════════════════════════════════════════════════════════════════════════
// REALTIME — Subscriptions
// ══════════════════════════════════════════════════════════════════════════════

export type RealtimePayload<T> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: Partial<T>
}

export interface ProposalSubscription {
  unsubscribe: () => void
}

// Alle Änderungen an einem Proposal (Status, Felder, Empfänger, Locks, Case)
export function subscribeToProposal(
  proposalId: string,
  callbacks: {
    onProposalChange?:  (payload: RealtimePayload<Proposal>) => void
    onRecipientChange?: (payload: RealtimePayload<ProposalRecipient>) => void
    onFieldChange?:     (payload: RealtimePayload<ProposalField>) => void
    onLockChange?:      (payload: RealtimePayload<FieldLock>) => void
    onCaseChange?:      (payload: RealtimePayload<Case>) => void
  }
): ProposalSubscription {
  const supabase = createClient()

  const channel = supabase
    .channel(`proposal:${proposalId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'proposals', filter: `id=eq.${proposalId}` },
      (p) => callbacks.onProposalChange?.(p as unknown as RealtimePayload<Proposal>)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'proposal_recipients', filter: `proposal_id=eq.${proposalId}` },
      (p) => callbacks.onRecipientChange?.(p as unknown as RealtimePayload<ProposalRecipient>)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'proposal_fields', filter: `proposal_id=eq.${proposalId}` },
      (p) => callbacks.onFieldChange?.(p as unknown as RealtimePayload<ProposalField>)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'field_locks', filter: `proposal_id=eq.${proposalId}` },
      (p) => callbacks.onLockChange?.(p as unknown as RealtimePayload<FieldLock>)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cases', filter: `proposal_id=eq.${proposalId}` },
      (p) => callbacks.onCaseChange?.(p as unknown as RealtimePayload<Case>)
    )
    .subscribe()

  return { unsubscribe: () => supabase.removeChannel(channel) }
}

// Live-Chat in einem Case
export function subscribeToCaseMessages(
  caseId: string,
  onMessage: (payload: RealtimePayload<CaseMessage>) => void
): ProposalSubscription {
  const supabase = createClient()

  const channel = supabase
    .channel(`case_messages:${caseId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'case_messages', filter: `case_id=eq.${caseId}` },
      (p) => onMessage(p as unknown as RealtimePayload<CaseMessage>)
    )
    .subscribe()

  return { unsubscribe: () => supabase.removeChannel(channel) }
}

// Alle Proposals eines Events beobachten
export function subscribeToEventProposals(
  eventId: string,
  onProposalChange: (payload: RealtimePayload<Proposal>) => void
): ProposalSubscription {
  const supabase = createClient()

  const channel = supabase
    .channel(`event_proposals:${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'proposals', filter: `event_id=eq.${eventId}` },
      (p) => onProposalChange(p as unknown as RealtimePayload<Proposal>)
    )
    .subscribe()

  return { unsubscribe: () => supabase.removeChannel(channel) }
}


// ══════════════════════════════════════════════════════════════════════════════
// BACKWARD-COMPAT — Alte Typen & Konstanten für bestehende Komponenten
// ══════════════════════════════════════════════════════════════════════════════

export type ProposalRole = UserRole

export interface ProposalSection {
  key: string
  label: string
}

export const MODULE_LABELS: Record<ProposalModule, string> = {
  catering:   'Catering & Menü',
  ablaufplan: 'Ablaufplan',
  sitzplan:   'Sitzplan',
  deko:       'Dekoration',
  musik:      'Musik',
  patisserie: 'Patisserie',
  vendor:     'Dienstleister',
  hotel:      'Hotel',
}

export const MODULE_SECTIONS: Record<ProposalModule, ProposalSection[]> = {
  catering: [
    { key: 'service',      label: 'Service & Stil' },
    { key: 'midnight',     label: 'Mitternachtssnack' },
    { key: 'drinks',       label: 'Getränke' },
    { key: 'champagne',    label: 'Sektempfang & Fingerfood' },
    { key: 'staff',        label: 'Personal & Equipment' },
    { key: 'budget',       label: 'Budget' },
    { key: 'menu_courses', label: 'Menügänge' },
    { key: 'kinder',       label: 'Kinder-Menü' },
    { key: 'notes',        label: 'Anmerkungen' },
  ],
  ablaufplan: [{ key: 'entries', label: 'Ablaufplan-Einträge' }],
  sitzplan:   [{ key: 'tables', label: 'Tische & Sitzordnung' }, { key: 'notes', label: 'Anmerkungen' }],
  deko:       [{ key: 'wishes', label: 'Dekorationswünsche' }, { key: 'style', label: 'Stil & Farbpalette' }, { key: 'budget', label: 'Budget' }, { key: 'notes', label: 'Anmerkungen' }],
  musik:      [{ key: 'songs', label: 'Musikwünsche & No-Gos' }, { key: 'requirements', label: 'Technische Anforderungen' }, { key: 'notes', label: 'Anmerkungen' }],
  patisserie: [{ key: 'cake', label: 'Torten-Konfiguration' }, { key: 'delivery', label: 'Lieferung & Aufbau' }, { key: 'dessert', label: 'Dessert-Buffet' }, { key: 'notes', label: 'Preise & Anmerkungen' }],
  vendor:     [{ key: 'info', label: 'Dienstleister-Info' }, { key: 'contact', label: 'Kontakt' }, { key: 'notes', label: 'Anmerkungen' }],
  hotel:      [{ key: 'info', label: 'Hotel-Info' }, { key: 'contact', label: 'Kontakt & Buchung' }, { key: 'notes', label: 'Anmerkungen' }],
}

export interface CateringProposalData {
  service_style?: string; location_has_kitchen?: boolean; midnight_snack?: boolean
  midnight_snack_note?: string; drinks_billing?: string; drinks_selection?: string[]
  champagne_finger_food?: boolean; champagne_finger_food_note?: string
  sektempfang?: boolean; sektempfang_note?: string; service_staff?: boolean
  equipment_needed?: string[]; budget_per_person?: number; budget_includes_drinks?: boolean
  catering_notes?: string; weinbegleitung?: boolean; weinbegleitung_note?: string
  kinder_meal_options?: string[]
  menu_courses?: Array<{ id: string; name: string; descriptions: Record<string, string> }>
  plan_guest_count_enabled?: boolean; plan_guest_count?: number
}

export interface AblaufplanProposalData {
  entries?: Array<{
    id: string; start_minutes: number; title: string; description?: string
    location?: string; sort_order: number; assigned_staff?: string[]; assigned_vendors?: string[]
  }>
}

export interface SitzplanProposalData {
  tables?: Array<{ id: string; name: string; shape: string; capacity: number; x: number; y: number; guest_ids: string[] }>
  notes?: string
}

export interface DekoProposalData {
  wishes?: Array<{ id: string; title: string; notes?: string; image_url?: string; priority?: string }>
  general_style?: string; color_palette?: string; budget?: number; notes?: string
}

export interface MusikProposalData {
  songs?: Array<{ id: string; title: string; artist: string; type: string; moment?: string; notes?: string }>
  requirements?: {
    soundcheck_date?: string; soundcheck_time?: string; pa_notes?: string
    stage_dimensions?: string; microphone_count?: number; power_required?: string
    streaming_needed?: boolean; streaming_notes?: string; notes?: string
  }
  setlist_notes?: string
}

export interface PatisserieProposalData {
  cake_description?: string; layers?: number; flavors?: string[]; dietary_notes?: string
  delivery_date?: string; delivery_time?: string; cooling_required?: boolean; cooling_notes?: string
  setup_location?: string; cake_table_provided?: boolean; dessert_buffet?: boolean
  dessert_items?: string[]; price?: number; vendor_notes?: string
}

export interface VendorProposalData {
  name?: string; category?: string; description?: string; price_estimate?: number
  contact_email?: string; contact_phone?: string; website?: string; notes?: string
}

export interface HotelProposalData {
  name?: string; address?: string; distance_km?: number; price_per_night?: number
  total_rooms?: number; description?: string; contact_email?: string; website?: string; notes?: string
}

export type ProposalModuleData =
  | CateringProposalData | AblaufplanProposalData | SitzplanProposalData
  | DekoProposalData | MusikProposalData | PatisserieProposalData
  | VendorProposalData | HotelProposalData

// subscribeToProposals: Wrapper für V1-Kompatibilität
export function subscribeToProposals(eventId: string, callback: () => void): () => void {
  const sub = subscribeToEventProposals(eventId, callback)
  return () => sub.unsubscribe()
}

// countOpenProposals für V2 ProposalWithDetails
export function countOpenProposals(proposals: ProposalWithDetails[], userId: string): number {
  return proposals.filter(p => {
    const myRecipient = p.recipients.find(r => r.user_id === userId)
    return myRecipient?.status === 'pending' || p.status === 'in_case'
  }).length
}
