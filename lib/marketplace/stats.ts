// Aggregation der Marktplatz-Interaktionen (marketplace_vendor_events).
// Serverseitig, wiederverwendet von Vendor-Statistik und Admin-Panel.

import type { SupabaseClient } from '@supabase/supabase-js'

export const EVENT_TYPES = ['profile_view', 'contact_email', 'contact_phone', 'website', 'social', 'request'] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const EVENT_LABELS: Record<EventType, string> = {
  profile_view:  'Profilaufrufe',
  contact_email: 'E-Mail-Klicks',
  contact_phone: 'Telefon-Klicks',
  website:       'Website-Klicks',
  social:        'Social-Klicks',
  request:       'Anfragen',
}

export type Counts = Record<EventType, number>
export interface DayPoint { day: string; counts: Counts }
export interface StatsResult {
  total: Counts
  last30: Counts
  series: DayPoint[] // letzte 30 Tage, chronologisch
}

function emptyCounts(): Counts {
  return { profile_view: 0, contact_email: 0, contact_phone: 0, website: 0, social: 0, request: 0 }
}

function isType(v: unknown): v is EventType {
  return typeof v === 'string' && (EVENT_TYPES as readonly string[]).includes(v)
}

interface Row { event_type: string; created_at: string; dienstleister_id?: string }

function buildSeries(rows: Row[]): DayPoint[] {
  const byDay = new Map<string, Counts>()
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    byDay.set(d.toISOString().slice(0, 10), emptyCounts())
  }
  const since = now.getTime() - 30 * 86400000
  for (const r of rows) {
    if (!isType(r.event_type)) continue
    const t = new Date(r.created_at).getTime()
    if (t < since) continue
    const key = new Date(r.created_at).toISOString().slice(0, 10)
    const c = byDay.get(key)
    if (c) c[r.event_type]++
  }
  return Array.from(byDay.entries()).map(([day, counts]) => ({ day, counts }))
}

function tally(rows: Row[]): { total: Counts; last30: Counts } {
  const total = emptyCounts()
  const last30 = emptyCounts()
  const since = Date.now() - 30 * 86400000
  for (const r of rows) {
    if (!isType(r.event_type)) continue
    total[r.event_type]++
    if (new Date(r.created_at).getTime() >= since) last30[r.event_type]++
  }
  return { total, last30 }
}

/** Statistik eines einzelnen Anbieters (alle Zeit + letzte 30 Tage + Tagesverlauf). */
export async function loadVendorStats(admin: SupabaseClient, vendorId: string): Promise<StatsResult> {
  const { data } = await admin
    .from('marketplace_vendor_events')
    .select('event_type, created_at')
    .eq('dienstleister_id', vendorId)
    .limit(100000)
  const rows = (data ?? []) as Row[]
  const { total, last30 } = tally(rows)
  return { total, last30, series: buildSeries(rows) }
}

export interface AdminVendorStat { dienstleister_id: string; total: Counts; last30: Counts }
export interface AdminStatsResult extends StatsResult {
  perVendor: Record<string, { total: Counts; last30: Counts }>
}

/** Gesamt-Statistik + Aufschlüsselung pro Anbieter (Admin). */
export async function loadAdminStats(admin: SupabaseClient): Promise<AdminStatsResult> {
  const { data } = await admin
    .from('marketplace_vendor_events')
    .select('event_type, created_at, dienstleister_id')
    .limit(200000)
  const rows = (data ?? []) as Row[]
  const { total, last30 } = tally(rows)
  const series = buildSeries(rows)

  const perVendor: Record<string, { total: Counts; last30: Counts }> = {}
  const since = Date.now() - 30 * 86400000
  for (const r of rows) {
    if (!isType(r.event_type) || !r.dienstleister_id) continue
    const v = perVendor[r.dienstleister_id] ?? (perVendor[r.dienstleister_id] = { total: emptyCounts(), last30: emptyCounts() })
    v.total[r.event_type]++
    if (new Date(r.created_at).getTime() >= since) v.last30[r.event_type]++
  }
  return { total, last30, series, perVendor }
}
