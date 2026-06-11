// app/api/admin/subscriptions/route.ts
// Verwaltung aller Abos (Solo-Brautpaar-Events) durch den Admin.
// GET  → Liste aller event_subscriptions inkl. Eventname + berechnetem Status
// POST → { eventId, action } mit:
//   set_plan      {plan:'basis'|'pro'}  → aktiv, Periode +30 Tage (simuliert)
//   extend_trial  {days}                → Status trialing, Trial-Ende = jetzt + days
//   grant_free    —                     → Pro/aktiv für 100 Jahre (Freischaltung)
//   cancel        —                     → Kündigung zum Periodenende
//   reactivate    —                     → Kündigung zurücknehmen
//   expire        —                     → sofort ablaufen lassen (Paywall testen)
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  const [{ data: subs, error }, { data: events }] = await Promise.all([
    admin.from('event_subscriptions')
      .select('event_id, plan, status, trial_ends_at, current_period_end, canceled_at, created_at')
      .order('created_at', { ascending: false }),
    admin.from('events').select('id, title, couple_name'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eventName = new Map((events ?? []).map(e => [e.id, e.couple_name || e.title || e.id]))
  const now = Date.now()

  const rows = (subs ?? []).map(s => {
    // Gleiche Ableitung wie lib/subscription.ts computeState
    let effective: string = s.status
    if (s.status === 'trialing' && (!s.trial_ends_at || new Date(s.trial_ends_at).getTime() <= now)) effective = 'expired'
    if (s.status === 'canceled' && s.current_period_end && new Date(s.current_period_end).getTime() <= now) effective = 'expired'
    return {
      eventId: s.event_id,
      eventName: eventName.get(s.event_id) ?? s.event_id,
      plan: s.plan,
      status: s.status,
      effectiveStatus: effective,
      trialEndsAt: s.trial_ends_at,
      currentPeriodEnd: s.current_period_end,
      canceledAt: s.canceled_at,
      createdAt: s.created_at,
    }
  })

  return NextResponse.json({ subscriptions: rows })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  const body = await req.json().catch(() => null) as {
    eventId?: string
    action?: string
    plan?: 'basis' | 'pro'
    days?: number
  } | null
  if (!body?.eventId || !body.action) {
    return NextResponse.json({ error: 'eventId und action erforderlich' }, { status: 400 })
  }

  const now = new Date()
  let patch: Record<string, unknown> | null = null

  switch (body.action) {
    case 'set_plan': {
      if (body.plan !== 'basis' && body.plan !== 'pro') {
        return NextResponse.json({ error: 'Ungültiger Plan' }, { status: 400 })
      }
      patch = {
        plan: body.plan, status: 'active', canceled_at: null,
        current_period_end: new Date(now.getTime() + 30 * 86400000).toISOString(),
      }
      break
    }
    case 'extend_trial': {
      const days = Math.min(Math.max(Math.round(body.days ?? 3), 1), 365)
      patch = {
        plan: 'trial', status: 'trialing', canceled_at: null,
        trial_ends_at: new Date(now.getTime() + days * 86400000).toISOString(),
      }
      break
    }
    case 'grant_free': {
      patch = {
        plan: 'pro', status: 'active', canceled_at: null,
        current_period_end: new Date(now.getTime() + 100 * 365 * 86400000).toISOString(),
      }
      break
    }
    case 'cancel': {
      patch = { status: 'canceled', canceled_at: now.toISOString() }
      break
    }
    case 'reactivate': {
      patch = { status: 'active', canceled_at: null }
      break
    }
    case 'expire': {
      // Sofort ablaufen lassen: Trial-/Periodenende in die Vergangenheit
      patch = {
        trial_ends_at: new Date(now.getTime() - 60000).toISOString(),
        current_period_end: new Date(now.getTime() - 60000).toISOString(),
        status: 'canceled', canceled_at: now.toISOString(),
      }
      break
    }
    default:
      return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  }

  const { error } = await admin
    .from('event_subscriptions')
    .update({ ...patch, updated_at: now.toISOString() })
    .eq('event_id', body.eventId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
