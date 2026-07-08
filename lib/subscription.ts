// Server-only Abo-Logik für Solo-Brautpaar-Events.
//
// Die Zahlung ist aktuell SIMULIERT (kein Zahlungsdienstleister angebunden):
// "Verlängerung" einer aktiven Subscription passiert lazy beim Lesen, der
// Checkout in /api/subscription/checkout setzt den Status direkt. Wenn später
// ein Zahlungsdienstleister (z. B. Stripe) angebunden wird, ersetzen dessen
// Webhooks die simulate*-Stellen — die State-Berechnung hier bleibt gleich.
import { createAdminClient } from '@/lib/supabase/admin'
import { BILLING_ENABLED } from '@/lib/billing'

export const TRIAL_DAYS = 14
export const PLAN_PRICES = { basis: 25, pro: 55 } as const

export type SubscriptionPlan = 'trial' | 'basis' | 'pro'

export interface SubscriptionState {
  /** false = Event ohne Subscription-Zeile (veranstalter-verwaltet) — kein Gating */
  gated: boolean
  plan: SubscriptionPlan
  /** expired = Trial abgelaufen ohne Abo ODER gekündigt und Periode vorbei */
  status: 'trialing' | 'active' | 'canceled' | 'expired'
  /** Portal nutzbar (Trial läuft oder Abo aktiv/gekündigt-aber-bezahlt) */
  isActive: boolean
  /** Pro-Features (Chat mit Team, Veranstalter + Dienstleister): NUR mit Pro-Abo — der Trial entspricht dem Basis-Umfang */
  isPro: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  canceledAt: string | null
  /** Verbleibende volle Tage im Trial bzw. in der bezahlten Periode */
  daysLeft: number
  /** Angehängter Promo-Code (Prozent-Rabatt) für Preis-Anzeige/Checkout */
  promo: { percent: number; duration: 'first_month' | 'forever'; appliesTo: 'all' | 'basis' | 'pro' } | null
}

const UNGATED: SubscriptionState = {
  gated: false, plan: 'pro', status: 'active', isActive: true, isPro: true,
  trialEndsAt: null, currentPeriodEnd: null, canceledAt: null, daysLeft: 0, promo: null,
}

// Gratis-Phase (BILLING_ENABLED=false): jeder Solo-Account ist dauerhaft
// kostenlos auf Basis-Niveau aktiv — kein Trial, kein Ablauf, keine
// Tarifauswahl. Chat ist Teil von Basis (siehe unten). `isPro: false` hält die
// echten Pro-Funktionen (Dienstleister direkt einladen, Veranstalter onboarden)
// weiterhin gesperrt; deren Oberflächen werden in der Gratis-Phase zusätzlich
// gar nicht erst angezeigt/beworben.
const FREE_BASIS: SubscriptionState = {
  gated: true, plan: 'basis', status: 'active', isActive: true, isPro: false,
  trialEndsAt: null, currentPeriodEnd: null, canceledAt: null, daysLeft: 0, promo: null,
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
  promo_percent?: number | null
  promo_duration?: string | null
  promo_applies_to?: string | null
}

function computeState(row: SubscriptionRow): SubscriptionState {
  const now = Date.now()
  const promo = row.promo_percent
    ? {
        percent: row.promo_percent,
        duration: (row.promo_duration === 'forever' ? 'forever' : 'first_month') as 'first_month' | 'forever',
        appliesTo: (['basis', 'pro'].includes(row.promo_applies_to ?? '') ? row.promo_applies_to : 'all') as 'all' | 'basis' | 'pro',
      }
    : null
  const base = {
    gated: true,
    plan: row.plan,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    canceledAt: row.canceled_at,
    promo,
  }

  if (row.status === 'trialing') {
    const expired = !row.trial_ends_at || new Date(row.trial_ends_at).getTime() <= now
    return {
      ...base,
      status: expired ? 'expired' : 'trialing',
      isActive: !expired,
      isPro: false, // Trial = Basis-Umfang; Chat/Dienstleister/Veranstalter erst mit Pro
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
  // Gratis-Phase: kein Abo-System — jeder ist kostenlos auf Basis aktiv.
  // (Kein DB-Zugriff, keine lazy Trial-Zeile.)
  if (!BILLING_ENABLED) return FREE_BASIS

  const admin = createAdminClient()

  const { data: row } = await admin
    .from('event_subscriptions')
    .select('event_id, plan, status, trial_ends_at, current_period_end, canceled_at, promo_percent, promo_duration, promo_applies_to')
    .eq('event_id', eventId)
    .maybeSingle()

  if (!row) {
    if (!opts.lazyCreateTrial) return UNGATED
    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString()
    const { data: created } = await admin
      .from('event_subscriptions')
      .insert({ event_id: eventId, plan: 'trial', status: 'trialing', trial_ends_at: trialEnds })
      .select('event_id, plan, status, trial_ends_at, current_period_end, canceled_at, promo_percent, promo_duration, promo_applies_to')
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
