// Server-only Abo-Logik für Solo-Brautpaar-Events.
//
// Die Zahlung ist aktuell SIMULIERT (kein Zahlungsdienstleister angebunden):
// "Verlängerung" einer aktiven Subscription passiert lazy beim Lesen, der
// Checkout in /api/subscription/checkout setzt den Status direkt. Wenn später
// ein Zahlungsdienstleister (z. B. Stripe) angebunden wird, ersetzen dessen
// Webhooks die simulate*-Stellen — die State-Berechnung hier bleibt gleich.
import { createAdminClient } from '@/lib/supabase/admin'

export const TRIAL_DAYS = 3
export const PLAN_PRICES = { basis: 25, pro: 55 } as const
export const PLAN_LABELS = { trial: 'Testphase', basis: 'Velvet', pro: 'Velvet Pro' } as const

export type SubscriptionPlan = 'trial' | 'basis' | 'pro'

export interface SubscriptionState {
  /** false = Event ohne Subscription-Zeile (veranstalter-verwaltet) — kein Gating */
  gated: boolean
  plan: SubscriptionPlan
  /** expired = Trial abgelaufen ohne Abo ODER gekündigt und Periode vorbei */
  status: 'trialing' | 'active' | 'canceled' | 'expired'
  /** Portal nutzbar (Trial läuft oder Abo aktiv/gekündigt-aber-bezahlt) */
  isActive: boolean
  /** Pro-Features (Veranstalter + Dienstleister): Trial = voller Umfang */
  isPro: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  canceledAt: string | null
  /** Verbleibende volle Tage im Trial bzw. in der bezahlten Periode */
  daysLeft: number
}

const UNGATED: SubscriptionState = {
  gated: false, plan: 'pro', status: 'active', isActive: true, isPro: true,
  trialEndsAt: null, currentPeriodEnd: null, canceledAt: null, daysLeft: 0,
}

function daysUntil(iso: string | null): number {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}

interface SubscriptionRow {
  event_id: string
  plan: SubscriptionPlan
  status: 'trialing' | 'active' | 'canceled'
  trial_ends_at: string | null
  current_period_end: string | null
  canceled_at: string | null
}

function computeState(row: SubscriptionRow): SubscriptionState {
  const now = Date.now()
  const base = {
    gated: true,
    plan: row.plan,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    canceledAt: row.canceled_at,
  }

  if (row.status === 'trialing') {
    const expired = !row.trial_ends_at || new Date(row.trial_ends_at).getTime() <= now
    return {
      ...base,
      status: expired ? 'expired' : 'trialing',
      isActive: !expired,
      isPro: !expired, // Trial = voller Pro-Umfang
      daysLeft: daysUntil(row.trial_ends_at),
    }
  }

  const periodOver = !!row.current_period_end && new Date(row.current_period_end).getTime() <= now

  if (row.status === 'canceled') {
    return {
      ...base,
      status: periodOver ? 'expired' : 'canceled',
      isActive: !periodOver,
      isPro: !periodOver && row.plan === 'pro',
      daysLeft: daysUntil(row.current_period_end),
    }
  }

  // active — Verlängerung wird simuliert (siehe getSubscriptionState)
  return {
    ...base,
    status: 'active',
    isActive: true,
    isPro: row.plan === 'pro',
    daysLeft: daysUntil(row.current_period_end),
  }
}

/**
 * Liest den Abo-Zustand eines Events (Service-Role, RLS-frei).
 * - lazyCreateTrial: legt beim ersten Portal-Besuch eines Solo-Events die
 *   Trial-Zeile an (3 Tage ab jetzt). Nur aufrufen, wenn der aufrufende User
 *   brautpaar_solo-Mitglied ist!
 * - Aktive Abos über dem Periodenende werden lazy "verlängert" (simulierte
 *   monatliche Abbuchung), solange nicht gekündigt wurde.
 */
export async function getSubscriptionState(
  eventId: string,
  opts: { lazyCreateTrial?: boolean } = {},
): Promise<SubscriptionState> {
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('event_subscriptions')
    .select('event_id, plan, status, trial_ends_at, current_period_end, canceled_at')
    .eq('event_id', eventId)
    .maybeSingle()

  if (!row) {
    if (!opts.lazyCreateTrial) return UNGATED
    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString()
    const { data: created } = await admin
      .from('event_subscriptions')
      .insert({ event_id: eventId, plan: 'trial', status: 'trialing', trial_ends_at: trialEnds })
      .select('event_id, plan, status, trial_ends_at, current_period_end, canceled_at')
      .single()
    if (!created) return UNGATED
    return computeState(created as SubscriptionRow)
  }

  // Simulierte Verlängerung: aktiv + Periode abgelaufen → neue Monatsperiode
  if (
    row.status === 'active' &&
    row.current_period_end &&
    new Date(row.current_period_end).getTime() <= Date.now()
  ) {
    const newEnd = new Date(Date.now() + 30 * 86400000).toISOString()
    await admin
      .from('event_subscriptions')
      .update({ current_period_end: newEnd, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
    row.current_period_end = newEnd
  }

  return computeState(row as SubscriptionRow)
}

/** True, wenn der User brautpaar_solo-Mitglied des Events ist (Service-Role). */
export async function isSoloMember(eventId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('role', 'brautpaar_solo')
    .maybeSingle()
  return !!data
}

/**
 * Pro-Gate für API-Routen: true = Aktion erlaubt. Events ohne Subscription
 * (veranstalter-verwaltet) sind nie gegated.
 */
export async function hasProAccess(eventId: string): Promise<boolean> {
  const state = await getSubscriptionState(eventId)
  return state.isPro
}
