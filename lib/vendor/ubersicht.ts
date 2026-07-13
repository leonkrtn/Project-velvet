import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { LineItem } from '@/lib/vendor/pricing'

export interface VendorUbersichtStats {
  pendingAnfragen: number
  newAnfragenThisWeek: number
  releasedOffers: number
  offersValue: number
  acceptedOffers: number
  upcomingEvents: number
  nextEventDays: number | null
  pipelineValue: number
  pipelineAnfragenCount: number
  pipelineAnfragenValue: number
  pipelineAngeboteCount: number
  pipelineAngeboteValue: number
}

export interface VendorUbersichtAttentionItem {
  id: string
  type: 'anfrage'
  title: string
  created_at: string
}

export interface VendorUbersichtData {
  vendorName: string
  stats: VendorUbersichtStats
  attentionItems: VendorUbersichtAttentionItem[]
}

function sumLineItems(items: unknown): number {
  if (!Array.isArray(items)) return 0
  return (items as LineItem[]).reduce((sum, li) => {
    const t = typeof li?.total === 'number' ? li.total : 0
    return sum + Math.max(0, t)
  }, 0)
}

export const EMPTY_UBERSICHT: VendorUbersichtData = {
  vendorName: '',
  stats: {
    pendingAnfragen: 0, newAnfragenThisWeek: 0,
    releasedOffers: 0, offersValue: 0, acceptedOffers: 0,
    upcomingEvents: 0, nextEventDays: null,
    pipelineValue: 0,
    pipelineAnfragenCount: 0, pipelineAnfragenValue: 0,
    pipelineAngeboteCount: 0, pipelineAngeboteValue: 0,
  },
  attentionItems: [],
}

/** Loads the vendor dashboard (Übersicht) aggregates for the given auth user. */
export async function loadVendorUbersicht(userId: string): Promise<VendorUbersichtData> {
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!link) return EMPTY_UBERSICHT

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const today = new Date().toISOString().split('T')[0]

  const [
    vendorRes,
    pendingRes,
    newThisWeekRes,
    releasedRes,
    acceptedRes,
    memberEventsRes,
    attentionRes,
  ] = await Promise.all([
    admin.from('dienstleister_profiles').select('name, company_name').eq('id', link.dienstleister_id).maybeSingle(),
    admin.from('marketplace_requests').select('budget').eq('dienstleister_id', link.dienstleister_id).eq('status', 'pending'),
    admin.from('marketplace_requests').select('id', { count: 'exact', head: true }).eq('dienstleister_id', link.dienstleister_id).eq('status', 'pending').gte('created_at', weekAgo),
    admin.from('vendor_offers').select('line_items').eq('dienstleister_id', link.dienstleister_id).eq('status', 'released'),
    admin.from('vendor_offers').select('id', { count: 'exact', head: true }).eq('dienstleister_id', link.dienstleister_id).eq('status', 'accepted'),
    admin.from('event_members').select('events(date)').eq('user_id', userId).eq('role', 'dienstleister'),
    admin.from('marketplace_requests').select('id, created_at, events(couple_name, title)').eq('dienstleister_id', link.dienstleister_id).eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
  ])

  const vp = vendorRes.data
  const fullName = ((vp?.name as string | null) || (vp?.company_name as string | null) || '').trim()
  const vendorName = fullName.split(/\s+/)[0] || ''

  const pending = pendingRes.data ?? []
  const pipelineAnfragenCount = pending.length
  const pipelineAnfragenValue = pending.reduce((s, r) => s + (typeof r.budget === 'number' ? r.budget : 0), 0)

  const released = releasedRes.data ?? []
  const pipelineAngeboteCount = released.length
  const pipelineAngeboteValue = released.reduce((s, o) => s + sumLineItems(o.line_items), 0)

  const memberEvents = memberEventsRes.data ?? []
  const upcomingDates = memberEvents
    .map(m => (m.events as unknown as { date: string | null } | null)?.date)
    .filter((d): d is string => !!d && d >= today)
    .sort()

  const upcomingEvents = upcomingDates.length
  let nextEventDays: number | null = null
  if (upcomingDates.length > 0) {
    const diff = Math.ceil((new Date(upcomingDates[0]).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    nextEventDays = Math.max(0, diff)
  }

  const attentionItems = (attentionRes.data ?? []).map(r => {
    const ev = r.events as unknown as { couple_name: string | null; title: string | null } | null
    return {
      id: r.id,
      type: 'anfrage' as const,
      title: ev?.couple_name || ev?.title || 'Neue Anfrage',
      created_at: r.created_at,
    }
  })

  return {
    vendorName,
    stats: {
      pendingAnfragen: pipelineAnfragenCount,
      newAnfragenThisWeek: newThisWeekRes.count ?? 0,
      releasedOffers: pipelineAngeboteCount,
      offersValue: pipelineAngeboteValue,
      acceptedOffers: acceptedRes.count ?? 0,
      upcomingEvents,
      nextEventDays,
      pipelineValue: pipelineAnfragenValue + pipelineAngeboteValue,
      pipelineAnfragenCount,
      pipelineAnfragenValue,
      pipelineAngeboteCount,
      pipelineAngeboteValue,
    },
    attentionItems,
  }
}
