// app/api/admin/promo-codes/route.ts
// Admin-Verwaltung der Influencer-/Promo-Codes.
//   GET  → alle Codes inkl. Statistik (Einlösungen, Conversion, Rabattsumme,
//          Umsatz) + Einlöse-Verlauf
//   POST → neuen Code anlegen
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { PLAN_PRICES } from '@/lib/subscription'

function normCode(s: string) {
  return s.trim().toUpperCase()
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  const [{ data: codes, error }, { data: reds }, { data: events }] = await Promise.all([
    admin.from('promo_codes').select('*').order('created_at', { ascending: false }),
    admin.from('promo_redemptions').select('id, code_id, event_id, type, plan, percent_off, free_months, discount_eur, created_at'),
    admin.from('events').select('id, title, couple_name'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eventName = new Map((events ?? []).map(e => [e.id, e.couple_name || e.title || e.id]))
  const redemptions = reds ?? []

  const withStats = (codes ?? []).map(c => {
    const mine = redemptions.filter(r => r.code_id === c.id)
    const converted = mine.filter(r => r.plan != null) // bezahlt (percent) bzw. freigeschaltet (free_months)
    const discountSum = mine.reduce((s, r) => s + Number(r.discount_eur || 0), 0)
    const revenue = converted.reduce((s, r) => {
      const price = PLAN_PRICES[r.plan as 'basis' | 'pro'] ?? 0
      return s + Math.max(0, price - Number(r.discount_eur || 0))
    }, 0)
    return {
      ...c,
      redemptions: mine.length,
      conversions: converted.length,
      conversionRate: mine.length ? Math.round((converted.length / mine.length) * 100) : 0,
      discountSum: +discountSum.toFixed(2),
      revenue: +revenue.toFixed(2),
    }
  })

  const codeName = new Map((codes ?? []).map(c => [c.id, c.code]))
  const history = redemptions
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50)
    .map(r => ({
      id: r.id,
      code: codeName.get(r.code_id) ?? '—',
      eventName: eventName.get(r.event_id) ?? r.event_id,
      type: r.type,
      plan: r.plan,
      percentOff: r.percent_off,
      freeMonths: r.free_months,
      discountEur: Number(r.discount_eur || 0),
      converted: r.plan != null,
      createdAt: r.created_at,
    }))

  return NextResponse.json({ codes: withStats, history })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin, userId } = auth

  const b = await req.json().catch(() => null) as {
    code?: string
    label?: string
    type?: 'percent' | 'free_months'
    percentOff?: number
    duration?: 'first_month' | 'forever'
    freeMonths?: number
    appliesTo?: 'all' | 'basis' | 'pro'
    maxRedemptions?: number | null
    validUntil?: string | null
  } | null

  if (!b?.code?.trim()) return NextResponse.json({ error: 'Code erforderlich' }, { status: 400 })
  if (b.type !== 'percent' && b.type !== 'free_months') {
    return NextResponse.json({ error: 'Ungültiger Typ' }, { status: 400 })
  }

  const row: Record<string, unknown> = {
    code: b.code.trim(),
    code_norm: normCode(b.code),
    label: b.label?.trim() || null,
    type: b.type,
    applies_to: ['all', 'basis', 'pro'].includes(b.appliesTo ?? '') ? b.appliesTo : 'all',
    max_redemptions: b.maxRedemptions && b.maxRedemptions > 0 ? Math.round(b.maxRedemptions) : null,
    valid_until: b.validUntil || null,
    created_by: userId,
  }

  if (b.type === 'percent') {
    const p = Math.round(b.percentOff ?? 0)
    if (p < 1 || p > 100) return NextResponse.json({ error: 'Prozentwert 1–100' }, { status: 400 })
    row.percent_off = p
    row.duration = b.duration === 'forever' ? 'forever' : 'first_month'
  } else {
    const m = Math.round(b.freeMonths ?? 0)
    if (m < 1 || m > 36) return NextResponse.json({ error: 'Gratismonate 1–36' }, { status: 400 })
    row.free_months = m
  }

  const { error } = await admin.from('promo_codes').insert(row)
  if (error) {
    const msg = error.code === '23505' ? 'Dieser Code existiert bereits.' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
