import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function esc(v: string | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', anfrage: 'Anfrage', gebucht: 'Gebucht', ehemalig: 'Ehemalig',
}
const SOURCE_LABELS: Record<string, string> = {
  empfehlung: 'Empfehlung', marktplatz: 'Marktplatz', website: 'Website',
  messe: 'Messe', sonstige: 'Sonstige', custom: 'Sonstige',
}

const HEADERS = [
  'Name', 'E-Mail', 'Telefon', 'Adresse', 'Adresszusatz',
  'Wohnstraße', 'Wohn-PLZ', 'Wohnort',
  'Status', 'Quelle', 'Veranstaltungstyp', 'Hochzeitsdatum', 'Geburtstag',
  'Veranstaltungsort', 'Gästeanzahl',
  'Umsatz', 'Offenes Angebot', 'Paar-Gesamtbudget',
  'Priorität', 'Notizen', 'Erstellt am',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(c: any) {
  return [
    c.name ?? '',
    c.email ?? '',
    c.phone ?? '',
    c.address_line1 ?? '',
    c.address_line2 ?? '',
    c.home_street ?? '',
    c.home_postal_code ?? '',
    c.home_city ?? '',
    STAGE_LABELS[c.lifecycle_stage] ?? c.lifecycle_stage ?? '',
    SOURCE_LABELS[c.source] ?? c.source ?? '',
    c.event_type ?? '',
    c.wedding_date ?? '',
    c.birthday ?? '',
    c.location ?? '',
    c.guest_count ?? null,
    c.deal_value ?? null,
    c.pending_offer_value ?? null,
    c.couple_budget ?? null,
    c.priority ?? '',
    c.notes ?? '',
    c.created_at,
  ]
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: contacts } = await admin
    .from('crm_contacts')
    .select('*')
    .eq('dienstleister_id', link.dienstleister_id)
    .order('created_at', { ascending: true })

  const rows = (contacts ?? []).map(toRow)
  const format = req.nextUrl.searchParams.get('format') === 'excel' ? 'excel' : 'csv'
  const dateStr = new Date().toISOString().slice(0, 10)

  if (format === 'excel') {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Forevr'
    wb.created = new Date()

    const ws = wb.addWorksheet('Kontakte')
    ws.columns = [
      { header: 'Name', key: 'name', width: 22 },
      { header: 'E-Mail', key: 'email', width: 26 },
      { header: 'Telefon', key: 'phone', width: 16 },
      { header: 'Adresse', key: 'address_line1', width: 24 },
      { header: 'Adresszusatz', key: 'address_line2', width: 18 },
      { header: 'Wohnstraße', key: 'home_street', width: 22 },
      { header: 'Wohn-PLZ', key: 'home_postal_code', width: 12 },
      { header: 'Wohnort', key: 'home_city', width: 18 },
      { header: 'Status', key: 'stage', width: 14 },
      { header: 'Quelle', key: 'source', width: 14 },
      { header: 'Veranstaltungstyp', key: 'event_type', width: 18 },
      { header: 'Hochzeitsdatum', key: 'wedding_date', width: 16 },
      { header: 'Geburtstag', key: 'birthday', width: 14 },
      { header: 'Veranstaltungsort', key: 'location', width: 22 },
      { header: 'Gästeanzahl', key: 'guest_count', width: 13 },
      { header: 'Umsatz', key: 'deal_value', width: 14 },
      { header: 'Offenes Angebot', key: 'pending_offer_value', width: 16 },
      { header: 'Paar-Gesamtbudget', key: 'couple_budget', width: 18 },
      { header: 'Priorität', key: 'priority', width: 12 },
      { header: 'Notizen', key: 'notes', width: 34 },
      { header: 'Erstellt am', key: 'created_at', width: 14 },
    ]

    const hdrStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2352C8' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    }
    ws.getRow(1).eachCell(c => { Object.assign(c, hdrStyle) })
    ws.getRow(1).height = 20
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } }

    rows.forEach(r => ws.addRow(r))

    // Zahlen- und Datumsformate
    const moneyCols = ['deal_value', 'pending_offer_value', 'couple_budget']
    moneyCols.forEach(key => { ws.getColumn(key).numFmt = '#,##0 €' })
    ws.getColumn('guest_count').numFmt = '#,##0'
    ;['wedding_date', 'birthday'].forEach(key => { ws.getColumn(key).alignment = { horizontal: 'left' } })
    ws.getColumn('created_at').numFmt = 'dd.mm.yyyy'
    for (let i = 2; i <= rows.length + 1; i++) {
      const cell = ws.getRow(i).getCell('created_at')
      if (cell.value) cell.value = new Date(cell.value as string)
    }

    // Zebra-Streifen
    for (let i = 2; i <= rows.length + 1; i++) {
      if (i % 2 === 0) {
        ws.getRow(i).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FF' } } })
      }
    }

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="crm-kontakte-${dateStr}.xlsx"`,
        'Cache-Control': 'no-cache',
      },
    })
  }

  const csvLines = (contacts ?? []).map(c => [
    esc(c.name), esc(c.email), esc(c.phone), esc(c.address_line1), esc(c.address_line2),
    esc(c.home_street), esc(c.home_postal_code), esc(c.home_city),
    esc(STAGE_LABELS[c.lifecycle_stage] ?? c.lifecycle_stage), esc(SOURCE_LABELS[c.source] ?? c.source),
    esc(c.event_type), esc(c.wedding_date), esc(c.birthday), esc(c.location),
    esc(c.guest_count != null ? String(c.guest_count) : ''),
    esc(c.deal_value != null ? String(c.deal_value) : ''),
    esc(c.pending_offer_value != null ? String(c.pending_offer_value) : ''),
    esc(c.couple_budget != null ? String(c.couple_budget) : ''),
    esc(c.priority), esc(c.notes),
    esc(new Date(c.created_at).toLocaleDateString('de-DE')),
  ].join(','))

  const csv = [HEADERS.join(','), ...csvLines].join('\r\n')
  const bom = '﻿'

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="crm-kontakte-${dateStr}.csv"`,
    },
  })
}
