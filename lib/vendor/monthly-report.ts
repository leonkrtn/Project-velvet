import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReportPeriod {
  type: 'month' | 'quarter'
  year: number
  /** 1–12 for month, 1–4 for quarter */
  value: number
}

export interface ReportSection {
  finance: {
    accepted_revenue: number
    accepted_count: number
    avg_order_value: number
    median_order_value: number
    pipeline_value: number
    pipeline_count: number
    deposits_due: number
    balance_outstanding: number
  }
  requests: {
    received: number
    offers_draft: number
    offers_sent: number
    offers_accepted: number
    offers_declined: number
    conversion_rate: number
  }
  events: {
    count: number
    list: Array<{ label: string; date: string; event_id: string }>
  }
}

export interface ReportData {
  period_label: string
  period_type: 'month' | 'quarter'
  year: number
  value: number
  company_name: string
  generated_at: string
  current: ReportSection
  prev_period: ReportSection
  same_period_last_year: ReportSection
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodBounds(p: ReportPeriod): { from: Date; to: Date } {
  if (p.type === 'month') {
    const from = new Date(p.year, p.value - 1, 1, 0, 0, 0, 0)
    const to   = new Date(p.year, p.value, 0, 23, 59, 59, 999)
    return { from, to }
  }
  const startMonth = (p.value - 1) * 3
  const from = new Date(p.year, startMonth, 1, 0, 0, 0, 0)
  const to   = new Date(p.year, startMonth + 3, 0, 23, 59, 59, 999)
  return { from, to }
}

function prevPeriod(p: ReportPeriod): ReportPeriod {
  if (p.type === 'month') {
    return p.value === 1
      ? { type: 'month', year: p.year - 1, value: 12 }
      : { type: 'month', year: p.year, value: p.value - 1 }
  }
  return p.value === 1
    ? { type: 'quarter', year: p.year - 1, value: 4 }
    : { type: 'quarter', year: p.year, value: p.value - 1 }
}

function samePeriodLastYear(p: ReportPeriod): ReportPeriod {
  return { ...p, year: p.year - 1 }
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function periodLabel(p: ReportPeriod): string {
  if (p.type === 'month') {
    return new Date(p.year, p.value - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  }
  return `Q${p.value} ${p.year}`
}

// ── Core data fetch ───────────────────────────────────────────────────────────

async function fetchSection(
  admin: SupabaseClient,
  userId: string,
  vendorId: string | null,
  period: ReportPeriod,
): Promise<ReportSection> {
  const { from, to } = periodBounds(period)
  const fromISO = from.toISOString()
  const toISO   = to.toISOString()

  // ── Finance: only if marketplace vendor ──────────────────────────────────
  let financeData = {
    accepted_revenue: 0, accepted_count: 0,
    avg_order_value: 0, median_order_value: 0,
    pipeline_value: 0, pipeline_count: 0,
    deposits_due: 0, balance_outstanding: 0,
  }

  if (vendorId) {
    const { data: offers } = await admin
      .from('vendor_offers')
      .select('id, total, status, accepted_at, deposit_type, deposit_value, deposit_due_days')
      .eq('dienstleister_id', vendorId)

    const all = offers ?? []

    // Accepted in period
    const accepted = all.filter(o =>
      o.status === 'accepted' && o.accepted_at &&
      new Date(o.accepted_at) >= from && new Date(o.accepted_at) <= to
    )
    const totals = accepted.map(o => Number(o.total ?? 0))
    const sum = totals.reduce((a, b) => a + b, 0)

    // Pipeline (current snapshot, not period-filtered)
    const pipeline = all.filter(o => ['draft', 'released'].includes(o.status))

    // Deposits due in period (accepted offers, deposit_type != none)
    let deposits_due = 0
    let balance_outstanding = 0
    for (const o of all.filter(o => o.status === 'accepted' && o.deposit_type && o.deposit_type !== 'none')) {
      if (o.accepted_at && o.deposit_due_days) {
        const dueDate = new Date(o.accepted_at)
        dueDate.setDate(dueDate.getDate() + Number(o.deposit_due_days))
        if (dueDate >= from && dueDate <= to) {
          const t = Number(o.total ?? 0)
          const dv = o.deposit_type === 'percent'
            ? t * Number(o.deposit_value ?? 0) / 100
            : Number(o.deposit_value ?? 0)
          deposits_due += dv
          balance_outstanding += t - dv
        }
      }
    }

    financeData = {
      accepted_revenue: sum,
      accepted_count: accepted.length,
      avg_order_value: accepted.length > 0 ? sum / accepted.length : 0,
      median_order_value: median(totals),
      pipeline_value: pipeline.reduce((a, o) => a + Number(o.total ?? 0), 0),
      pipeline_count: pipeline.length,
      deposits_due,
      balance_outstanding,
    }
  }

  // ── Anfragen & Angebote ──────────────────────────────────────────────────
  let requestsData = {
    received: 0, offers_draft: 0, offers_sent: 0,
    offers_accepted: 0, offers_declined: 0, conversion_rate: 0,
  }

  if (vendorId) {
    const { data: offers } = await admin
      .from('vendor_offers')
      .select('status, created_at, released_at')
      .eq('dienstleister_id', vendorId)

    const all = offers ?? []

    const received    = all.filter(o => new Date(o.created_at) >= from && new Date(o.created_at) <= to)
    const sentInPeriod = all.filter(o => o.released_at && new Date(o.released_at) >= from && new Date(o.released_at) <= to)

    // Offer status snapshot for period-received offers
    const draft    = received.filter(o => o.status === 'draft').length
    const sent     = received.filter(o => ['released','accepted','declined','superseded'].includes(o.status)).length
    const accepted = received.filter(o => o.status === 'accepted').length
    const declined = received.filter(o => o.status === 'declined').length

    requestsData = {
      received: received.length,
      offers_draft: draft,
      offers_sent: sent,
      offers_accepted: accepted,
      offers_declined: declined,
      conversion_rate: sent > 0 ? Math.round((accepted / sent) * 100) : 0,
    }

    void sentInPeriod
  }

  // ── Events in period ─────────────────────────────────────────────────────
  const { data: members } = await admin
    .from('event_members')
    .select('event_id, events(id, title, date, couple_name)')
    .eq('user_id', userId)
    .eq('role', 'dienstleister')

  const eventsInPeriod = (members ?? [])
    .map((m, idx) => {
      const ev = Array.isArray(m.events) ? m.events[0] : m.events as { id: string; title: string | null; date: string | null; couple_name: string | null } | null
      if (!ev?.date) return null
      const evDate = new Date(ev.date + 'T12:00:00')
      if (evDate < from || evDate > to) return null
      return {
        label: `Hochzeit ${String.fromCharCode(65 + (idx % 26))}`,
        date: ev.date,
        event_id: m.event_id as string,
      }
    })
    .filter((e): e is { label: string; date: string; event_id: string } => e !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    finance: financeData,
    requests: requestsData,
    events: { count: eventsInPeriod.length, list: eventsInPeriod },
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function buildReportData(
  admin: SupabaseClient,
  userId: string,
  vendorId: string | null,
  companyName: string,
  period: ReportPeriod,
): Promise<ReportData> {
  const [current, prev, lastYear] = await Promise.all([
    fetchSection(admin, userId, vendorId, period),
    fetchSection(admin, userId, vendorId, prevPeriod(period)),
    fetchSection(admin, userId, vendorId, samePeriodLastYear(period)),
  ])

  return {
    period_label: periodLabel(period),
    period_type: period.type,
    year: period.year,
    value: period.value,
    company_name: companyName,
    generated_at: new Date().toISOString(),
    current,
    prev_period: prev,
    same_period_last_year: lastYear,
  }
}
