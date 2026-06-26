import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { buildReportData } from '@/lib/vendor/monthly-report'
import type { ReportPeriod } from '@/lib/vendor/monthly-report'

export async function GET(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId, userId } = auth.ctx

  const sp = req.nextUrl.searchParams
  const type = sp.get('type') === 'quarter' ? 'quarter' : 'month'
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()), 10)
  const value = parseInt(sp.get('value') ?? String(new Date().getMonth() + 1), 10)

  if (isNaN(year) || isNaN(value) || value < 1 || (type === 'month' && value > 12) || (type === 'quarter' && value > 4)) {
    return NextResponse.json({ error: 'Ungültige Periode' }, { status: 400 })
  }

  const { data: profile } = await admin
    .from('dienstleister_profiles')
    .select('company_name')
    .eq('id', vendorId)
    .maybeSingle()

  const period: ReportPeriod = { type, year, value }
  const data = await buildReportData(admin, userId, vendorId, profile?.company_name ?? '', period)

  return NextResponse.json(data)
}
