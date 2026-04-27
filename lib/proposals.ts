// lib/proposals.ts
// Typen und Hilfsfunktionen für das Vorschlagssystem

import { createClient } from '@/lib/supabase/client'

// ── Kern-Enums ──────────────────────────────────────────────────────────────

export type ProposalModule = 'catering' | 'ablaufplan' | 'sitzplan' | 'deko' | 'musik' | 'patisserie' | 'vendor' | 'hotel'
export type ProposalRole   = 'dienstleister' | 'veranstalter' | 'brautpaar'
export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'conflict' | 'resolved'
export type ResponseStatus = 'pending' | 'accepted' | 'rejected' | 'countered'
export type ConflictStatus = 'open' | 'resolved'

// ── Datenbank-Typen ─────────────────────────────────────────────────────────

export interface Proposal {
  id: string
  event_id: string
  proposer_id: string
  proposer_role: ProposalRole
  module: ProposalModule
  title: string | null
  status: ProposalStatus
  created_at: string
  updated_at: string
}

export interface ProposalSubmission {
  id: string
  proposal_id: string
  submitted_by: string
  submitted_by_role: ProposalRole
  data: ProposalModuleData
  sections_enabled: string[]
  parent_submission_id: string | null
  created_at: string
}

export interface ProposalResponse {
  id: string
  submission_id: string
  recipient_id: string
  recipient_role: ProposalRole
  status: ResponseStatus
  responded_at: string | null
}

export interface ProposalConflict {
  id: string
  proposal_id: string
  submission_id: string
  conversation_id: string | null
  joint_draft: ProposalModuleData
  joint_sections_enabled: string[]
  veranstalter_approved: boolean
  brautpaar_approved: boolean
  status: ConflictStatus
  created_at: string
}

// Angereicherte Typen für UI
export interface ProposalWithDetails extends Proposal {
  submissions: ProposalSubmission[]
  latest_submission?: ProposalSubmission
  my_response?: ProposalResponse
  all_responses: ProposalResponse[]
  conflict?: ProposalConflict
  proposer_name?: string
}

// ── Modul-Daten-Strukturen ──────────────────────────────────────────────────

export interface CateringProposalData {
  service_style?: string
  location_has_kitchen?: boolean
  midnight_snack?: boolean
  midnight_snack_note?: string
  drinks_billing?: string
  drinks_selection?: string[]
  champagne_finger_food?: boolean
  champagne_finger_food_note?: string
  sektempfang?: boolean
  sektempfang_note?: string
  service_staff?: boolean
  equipment_needed?: string[]
  budget_per_person?: number
  budget_includes_drinks?: boolean
  catering_notes?: string
  weinbegleitung?: boolean
  weinbegleitung_note?: string
  kinder_meal_options?: string[]
  menu_courses?: Array<{ id: string; name: string; descriptions: Record<string, string> }>
  plan_guest_count_enabled?: boolean
  plan_guest_count?: number
}

export interface AblaufplanProposalData {
  entries?: Array<{
    id: string
    start_minutes: number
    title: string
    description?: string
    location?: string
    sort_order: number
    assigned_staff?: string[]
    assigned_vendors?: string[]
  }>
}

export interface SitzplanProposalData {
  tables?: Array<{
    id: string
    name: string
    shape: string
    capacity: number
    x: number
    y: number
    guest_ids: string[]
  }>
  notes?: string
}

export interface DekoProposalData {
  wishes?: Array<{
    id: string
    title: string
    notes?: string
    image_url?: string
    priority?: string
  }>
  general_style?: string
  color_palette?: string
  budget?: number
  notes?: string
}

export interface MusikProposalData {
  songs?: Array<{
    id: string
    title: string
    artist: string
    type: string
    moment?: string
    notes?: string
  }>
  requirements?: {
    soundcheck_date?: string
    soundcheck_time?: string
    pa_notes?: string
    stage_dimensions?: string
    microphone_count?: number
    power_required?: string
    streaming_needed?: boolean
    streaming_notes?: string
    notes?: string
  }
  setlist_notes?: string
}

export interface PatisserieProposalData {
  cake_description?: string
  layers?: number
  flavors?: string[]
  dietary_notes?: string
  delivery_date?: string
  delivery_time?: string
  cooling_required?: boolean
  cooling_notes?: string
  setup_location?: string
  cake_table_provided?: boolean
  dessert_buffet?: boolean
  dessert_items?: string[]
  price?: number
  vendor_notes?: string
}

export interface VendorProposalData {
  name?: string
  category?: string
  description?: string
  price_estimate?: number
  contact_email?: string
  contact_phone?: string
  website?: string
  notes?: string
}

export interface HotelProposalData {
  name?: string
  address?: string
  distance_km?: number
  price_per_night?: number
  total_rooms?: number
  description?: string
  contact_email?: string
  website?: string
  notes?: string
}

export type ProposalModuleData =
  | CateringProposalData
  | AblaufplanProposalData
  | SitzplanProposalData
  | DekoProposalData
  | MusikProposalData
  | PatisserieProposalData
  | VendorProposalData
  | HotelProposalData

// ── Abschnitte je Modul ─────────────────────────────────────────────────────

export interface ProposalSection {
  key: string
  label: string
}

export const MODULE_SECTIONS: Record<ProposalModule, ProposalSection[]> = {
  catering: [
    { key: 'service',       label: 'Service & Stil' },
    { key: 'midnight',      label: 'Mitternachtssnack' },
    { key: 'drinks',        label: 'Getränke' },
    { key: 'champagne',     label: 'Sektempfang & Fingerfood' },
    { key: 'staff',         label: 'Personal & Equipment' },
    { key: 'budget',        label: 'Budget' },
    { key: 'menu_courses',  label: 'Menügänge' },
    { key: 'kinder',        label: 'Kinder-Menü' },
    { key: 'notes',         label: 'Anmerkungen' },
  ],
  ablaufplan: [
    { key: 'entries', label: 'Ablaufplan-Einträge' },
  ],
  sitzplan: [
    { key: 'tables', label: 'Tische & Sitzordnung' },
    { key: 'notes',  label: 'Anmerkungen' },
  ],
  deko: [
    { key: 'wishes', label: 'Dekorationswünsche' },
    { key: 'style',  label: 'Stil & Farbpalette' },
    { key: 'budget', label: 'Budget' },
    { key: 'notes',  label: 'Anmerkungen' },
  ],
  musik: [
    { key: 'songs',        label: 'Musikwünsche & No-Gos' },
    { key: 'requirements', label: 'Technische Anforderungen' },
    { key: 'notes',        label: 'Anmerkungen' },
  ],
  patisserie: [
    { key: 'cake',     label: 'Torten-Konfiguration' },
    { key: 'delivery', label: 'Lieferung & Aufbau' },
    { key: 'dessert',  label: 'Dessert-Buffet' },
    { key: 'notes',    label: 'Preise & Anmerkungen' },
  ],
  vendor: [
    { key: 'info',    label: 'Dienstleister-Info' },
    { key: 'contact', label: 'Kontakt' },
    { key: 'notes',   label: 'Anmerkungen' },
  ],
  hotel: [
    { key: 'info',    label: 'Hotel-Info' },
    { key: 'contact', label: 'Kontakt & Buchung' },
    { key: 'notes',   label: 'Anmerkungen' },
  ],
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

// ── Supabase Helpers ────────────────────────────────────────────────────────

export async function createProposalDraft(
  eventId: string,
  proposerRole: ProposalRole,
  module: ProposalModule,
  title?: string,
): Promise<Proposal> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { data, error } = await supabase
    .from('proposals')
    .insert({ event_id: eventId, proposer_id: user.id, proposer_role: proposerRole, module, title: title ?? null, status: 'draft' })
    .select()
    .single()

  if (error) throw error
  return data as Proposal
}

export async function saveProposalDraft(
  proposalId: string,
  data: ProposalModuleData,
  sectionsEnabled: string[],
  existingSubmissionId?: string,
): Promise<ProposalSubmission> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  // Hole Proposer-Rolle aus dem Proposal
  const { data: proposal } = await supabase
    .from('proposals').select('proposer_role').eq('id', proposalId).single()

  // Always insert a new submission — multiple submissions per proposal are fine,
  // fetchProposalsForEvent picks the latest one. No DELETE policy needed.
  const { data: submission, error } = await supabase
    .from('proposal_submissions')
    .insert({
      proposal_id: proposalId,
      submitted_by: user.id,
      submitted_by_role: proposal?.proposer_role ?? 'dienstleister',
      data,
      sections_enabled: sectionsEnabled,
    })
    .select()
    .single()

  if (error) throw error
  return submission as ProposalSubmission
}

export async function sendProposal(
  proposalId: string,
  submissionId: string,
  recipientIds: { userId: string; role: ProposalRole }[],
): Promise<void> {
  const supabase = createClient()

  // Empfänger-Antworten erstellen (status: pending)
  const responses = recipientIds.map(r => ({
    submission_id: submissionId,
    recipient_id: r.userId,
    recipient_role: r.role,
    status: 'pending' as const,
  }))

  const { error: rErr } = await supabase.from('proposal_responses').insert(responses)
  if (rErr) throw rErr

  // Proposal-Status auf 'sent' setzen
  const { error: pErr } = await supabase
    .from('proposals')
    .update({ status: 'sent', updated_at: new Date().toISOString() })
    .eq('id', proposalId)
  if (pErr) throw pErr
}

export async function respondToProposal(
  submissionId: string,
  responseId: string,
  status: 'accepted' | 'rejected',
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('proposal_responses')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', responseId)
  if (error) throw error

  // Prüfen ob alle Empfänger geantwortet haben → Proposal-Status aktualisieren
  const { data: allResponses } = await supabase
    .from('proposal_responses')
    .select('status')
    .eq('submission_id', submissionId)

  if (allResponses) {
    const allAnswered = allResponses.every(r => r.status !== 'pending')
    const anyAccepted = allResponses.some(r => r.status === 'accepted')
    const allRejected = allResponses.every(r => r.status === 'rejected')

    if (allAnswered) {
      const { data: sub } = await supabase
        .from('proposal_submissions')
        .select('proposal_id')
        .eq('id', submissionId)
        .single()

      if (sub) {
        const newStatus = allRejected ? 'rejected' : anyAccepted ? 'accepted' : 'sent'
        await supabase
          .from('proposals')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', sub.proposal_id)
      }
    }
  }
}

export async function counterPropose(
  proposalId: string,
  parentSubmissionId: string,
  myResponseId: string,
  data: ProposalModuleData,
  sectionsEnabled: string[],
  myRole: ProposalRole,
  originalProposerId: string,
  originalProposerRole: ProposalRole,
): Promise<ProposalSubmission> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  // Eigene Antwort auf 'countered' setzen
  await supabase
    .from('proposal_responses')
    .update({ status: 'countered', responded_at: new Date().toISOString() })
    .eq('id', myResponseId)

  // Neue Submission als Gegenvorschlag erstellen
  const { data: newSub, error } = await supabase
    .from('proposal_submissions')
    .insert({
      proposal_id: proposalId,
      submitted_by: user.id,
      submitted_by_role: myRole,
      data,
      sections_enabled: sectionsEnabled,
      parent_submission_id: parentSubmissionId,
    })
    .select()
    .single()

  if (error) throw error

  // Antwort für den Original-Proposer erstellen
  await supabase.from('proposal_responses').insert({
    submission_id: newSub.id,
    recipient_id: originalProposerId,
    recipient_role: originalProposerRole,
    status: 'pending',
  })

  // Prüfen ob Konflikt entsteht (beide Empfänger haben geantwortet mit countered)
  const { data: allResponses } = await supabase
    .from('proposal_responses')
    .select('status, recipient_role')
    .eq('submission_id', parentSubmissionId)

  if (allResponses) {
    const counteredCount = allResponses.filter(r => r.status === 'countered').length
    const hasBothRoles = allResponses.some(r => r.recipient_role === 'veranstalter') &&
                         allResponses.some(r => r.recipient_role === 'brautpaar')

    if (counteredCount >= 2 && hasBothRoles) {
      // Konflikt erstellen
      await supabase.from('proposal_conflicts').insert({
        proposal_id: proposalId,
        submission_id: parentSubmissionId,
        joint_draft: {},
        joint_sections_enabled: sectionsEnabled,
        status: 'open',
      })
      await supabase
        .from('proposals')
        .update({ status: 'conflict', updated_at: new Date().toISOString() })
        .eq('id', proposalId)
    }
  }

  return newSub as ProposalSubmission
}

export async function fetchProposalsForEvent(eventId: string): Promise<ProposalWithDetails[]> {
  const supabase = createClient()

  const { data: proposals, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error || !proposals) return []

  const proposalIds = proposals.map(p => p.id)

  const [{ data: submissions }, { data: responses }, { data: conflicts }] = await Promise.all([
    supabase.from('proposal_submissions').select('*').in('proposal_id', proposalIds).order('created_at'),
    supabase.from('proposal_responses').select('*').in('submission_id',
      (await supabase.from('proposal_submissions').select('id').in('proposal_id', proposalIds)).data?.map(s => s.id) ?? []
    ),
    supabase.from('proposal_conflicts').select('*').in('proposal_id', proposalIds),
  ])

  const { data: { user } } = await supabase.auth.getUser()

  return proposals.map(p => {
    const pSubs = (submissions ?? []).filter(s => s.proposal_id === p.id)
    const latestSub = pSubs[pSubs.length - 1]
    const subIds = pSubs.map(s => s.id)
    const allResponses = (responses ?? []).filter(r => subIds.includes(r.submission_id))
    const myResponse = user ? allResponses.find(r => r.recipient_id === user.id) : undefined
    const conflict = (conflicts ?? []).find(c => c.proposal_id === p.id)

    return {
      ...p,
      submissions: pSubs,
      latest_submission: latestSub,
      my_response: myResponse,
      all_responses: allResponses,
      conflict,
    } as ProposalWithDetails
  })
}

export async function deleteProposal(proposalId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('proposals').delete().eq('id', proposalId)
  if (error) throw error
}

export function subscribeToProposals(eventId: string, callback: () => void): () => void {
  const supabase = createClient()
  const channelName = `proposals:${eventId}:${Math.random().toString(36).slice(2)}`
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals', filter: `event_id=eq.${eventId}` }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_responses' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_conflicts' }, callback)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export function countOpenProposals(proposals: ProposalWithDetails[], userId: string): number {
  return proposals.filter(p => {
    const myResponse = p.my_response
    return myResponse?.status === 'pending' || p.status === 'conflict'
  }).length
}
