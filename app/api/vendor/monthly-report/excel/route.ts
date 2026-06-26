import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { buildReportData, periodLabel } from '@/lib/vendor/monthly-report'
import type { ReportPeriod, ReportSection } from '@/lib/vendor/monthly-report'
import ExcelJS from 'exceljs'

function fmt(n: number) { return Math.round(n) }

function addSection(ws: ExcelJS.Worksheet, label: string, section: ReportSection, col: number) {
  const fin = section.finance
  const req = section.requests
  const ev  = section.events

  const rows: [string, number | string][] = [
    ['Umsatz (angenommene Angebote)', fin.accepted_revenue],
    ['Anzahl angenommene Angebote',   fin.accepted_count],
    ['Ø Auftragswert',               fin.avg_order_value],
    ['Median Auftragswert',          fin.median_order_value],
    ['Pipeline-Wert',                fin.pipeline_value],
    ['Pipeline Anzahl',              fin.pipeline_count],
    ['Anzahlungen fällig',           fin.deposits_due],
    ['Restbetrag ausstehend',        fin.balance_outstanding],
    [''],
    ['Anfragen eingegangen',         req.received],
    ['Entwürfe',                     req.offers_draft],
    ['Angebote versendet',           req.offers_sent],
    ['Angenommen',                   req.offers_accepted],
    ['Abgelehnt',                    req.offers_declined],
    ['Conversion Rate',              `${req.conversion_rate}%`],
    [''],
    ['Events im Zeitraum',           ev.count],
  ]

  rows.forEach((r, i) => {
    const wsRow = ws.getRow(i + 3)
    if (col === 1 && r[0]) wsRow.getCell(1).value = r[0]
    if (r[0]) wsRow.getCell(col + 1).value = typeof r[1] === 'number' ? fmt(r[1]) : r[1]
  })
}

export async function GET(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId, userId } = auth.ctx

  const sp = req.nextUrl.searchParams
  const type = sp.get('type') === 'quarter' ? 'quarter' : 'month'
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()), 10)
  const value = parseInt(sp.get('value') ?? String(new Date().getMonth() + 1), 10)

  const { data: profile } = await admin
    .from('dienstleister_profiles')
    .select('company_name')
    .eq('id', vendorId)
    .maybeSingle()

  const period: ReportPeriod = { type, year, value }
  const data = await buildReportData(admin, userId, vendorId, profile?.company_name ?? '', period)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Forevr'
  wb.created = new Date()

  // ── Sheet 1: Zusammenfassung ───────────────────────────────────────────────
  const summary = wb.addWorksheet('Zusammenfassung')
  summary.columns = [
    { key: 'metric', width: 32 },
    { key: 'current', width: 22 },
    { key: 'prev', width: 22 },
    { key: 'lastyear', width: 22 },
  ]

  summary.getRow(1).values = ['', data.period_label, 'Vorperiode', 'Vorjahr']
  summary.getRow(2).values = ['Finanzen', '', '', '']

  const hdrStyle: Partial<ExcelJS.Style> = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2352C8' } }, alignment: { horizontal: 'center' } }
  const metricStyle: Partial<ExcelJS.Style> = { font: { bold: true } }
  const sectionStyle: Partial<ExcelJS.Style> = { font: { bold: true, color: { argb: 'FF2352C8' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEFF' } } }

  summary.getRow(1).eachCell(c => { Object.assign(c, hdrStyle) })
  summary.getRow(2).eachCell(c => { Object.assign(c, sectionStyle) })

  addSection(summary, data.period_label, data.current, 1)
  addSection(summary, 'Vorperiode', data.prev_period, 2)
  addSection(summary, 'Vorjahr', data.same_period_last_year, 3)

  // Style metric column
  for (let r = 3; r <= 22; r++) {
    const cell = summary.getRow(r).getCell(1)
    if (cell.value) Object.assign(cell, metricStyle)
  }

  // Section header for requests at row 12
  summary.getRow(11).eachCell(c => { Object.assign(c, sectionStyle) })
  summary.getRow(11).getCell(1).value = 'Anfragen & Angebote'

  // Section header for events at row 18
  summary.getRow(19).eachCell(c => { Object.assign(c, sectionStyle) })
  summary.getRow(19).getCell(1).value = 'Events'

  // ── Sheet 2: Finanzen Detail ───────────────────────────────────────────────
  const finSheet = wb.addWorksheet('Finanzen')
  finSheet.columns = [
    { header: 'Kennzahl',                width: 32 },
    { header: data.period_label,          width: 20 },
    { header: 'Vorperiode',              width: 20 },
    { header: 'Vorjahr',                 width: 20 },
    { header: 'Δ vs. Vorperiode',        width: 20 },
    { header: 'Δ vs. Vorjahr',           width: 20 },
  ]
  finSheet.getRow(1).eachCell(c => { Object.assign(c, hdrStyle) })

  const finRows: [string, keyof ReportSection['finance']][] = [
    ['Umsatz (angenommene Angebote)',   'accepted_revenue'],
    ['Anzahl angenommene Angebote',     'accepted_count'],
    ['Ø Auftragswert',                 'avg_order_value'],
    ['Median Auftragswert',            'median_order_value'],
    ['Pipeline-Wert',                  'pipeline_value'],
    ['Pipeline Anzahl',                'pipeline_count'],
    ['Anzahlungen fällig',             'deposits_due'],
    ['Restbetrag ausstehend',          'balance_outstanding'],
  ]
  finRows.forEach(([label, key]) => {
    const cur = data.current.finance[key]
    const pre = data.prev_period.finance[key]
    const ly  = data.same_period_last_year.finance[key]
    finSheet.addRow([label, fmt(cur), fmt(pre), fmt(ly), fmt(cur - pre), fmt(cur - ly)])
  })

  // ── Sheet 3: Anfragen & Angebote ───────────────────────────────────────────
  const reqSheet = wb.addWorksheet('Anfragen & Angebote')
  reqSheet.columns = [
    { header: 'Kennzahl',         width: 28 },
    { header: data.period_label,   width: 20 },
    { header: 'Vorperiode',       width: 20 },
    { header: 'Vorjahr',          width: 20 },
  ]
  reqSheet.getRow(1).eachCell(c => { Object.assign(c, hdrStyle) })

  const reqRows: [string, keyof ReportSection['requests']][] = [
    ['Anfragen eingegangen',  'received'],
    ['Entwürfe',              'offers_draft'],
    ['Angebote versendet',    'offers_sent'],
    ['Angenommen',            'offers_accepted'],
    ['Abgelehnt',             'offers_declined'],
    ['Conversion Rate (%)',   'conversion_rate'],
  ]
  reqRows.forEach(([label, key]) => {
    reqSheet.addRow([label, data.current.requests[key], data.prev_period.requests[key], data.same_period_last_year.requests[key]])
  })

  // ── Sheet 4: Events ────────────────────────────────────────────────────────
  const evSheet = wb.addWorksheet('Events')
  evSheet.columns = [
    { header: 'Event',   width: 18 },
    { header: 'Datum',   width: 16 },
  ]
  evSheet.getRow(1).eachCell(c => { Object.assign(c, hdrStyle) })
  data.current.events.list.forEach(e => {
    evSheet.addRow([e.label, e.date])
  })
  if (data.current.events.list.length === 0) {
    evSheet.addRow(['Keine Events in diesem Zeitraum', ''])
  }

  const buf = await wb.xlsx.writeBuffer()
  const filename = `forevr-bericht-${data.period_label.replace(/\s/g, '-')}.xlsx`

  return new NextResponse(buf as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
    },
  })
}
