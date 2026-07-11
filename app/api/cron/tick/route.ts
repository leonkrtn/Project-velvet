import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAutomationTick } from '@/lib/vendor/automation-tick'
import { maybeSendMonthlyReport } from '@/lib/admin/notify'

export const runtime = 'nodejs'
// Kein Caching — wird vom Scheduler aufgerufen.
export const dynamic = 'force-dynamic'

// POST — taeglicher Automatisierungs-Tick (von pg_cron via pg_net). Geschuetzt
// durch CRON_SECRET (Header x-cron-secret ODER ?secret=). Idempotent.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET nicht konfiguriert' }, { status: 503 })
  const provided = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (provided !== secret) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const admin = createAdminClient()
  const result = await runAutomationTick(admin)
  // Monatlicher Admin-Report (nur am 1. des Monats, idempotent).
  const monthlyReportSent = await maybeSendMonthlyReport(admin)
  return NextResponse.json({ ok: true, ...result, monthlyReportSent })
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }
