// Server-only: baut eine Excel-Datei mit allen Daten einer Marktplatz-Anfrage
// (Standard-Infos + Fragebogen-Antworten), damit ein Dienstleister sie per
// Mail erhalten und außerhalb von Forevr fuer ein Angebot nutzen kann. Reine
// Darstellung — keine Preislogik, keine Seiteneffekte.
import 'server-only'
import ExcelJS from 'exceljs'
import type { Answer } from './questionnaire'
import type { StandardInfo } from './pricing'

export interface RequestExcelData {
  vendorName: string
  requestUrl: string
  standardInfo: StandardInfo
  message: string
  budget: number | null
  answers: Answer[]
}

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB89968' } },
}
const LABEL_STYLE: Partial<ExcelJS.Style> = { font: { bold: true } }

export async function buildRequestExcel(data: RequestExcelData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Forevr'
  wb.created = new Date()

  // ── Sheet 1: Übersicht ─────────────────────────────────────────────────────
  const overview = wb.addWorksheet('Übersicht')
  overview.columns = [{ key: 'label', width: 26 }, { key: 'value', width: 50 }]
  overview.getRow(1).values = ['Neue Anfrage', data.vendorName]
  overview.getRow(1).eachCell(c => { Object.assign(c, HEADER_STYLE) })

  const { standardInfo: si } = data
  const rows: [string, string][] = [
    ['Brautpaar', si.coupleName ?? '—'],
    ['Datum', si.date ?? '—'],
    ['Gästezahl', si.guestCount != null ? String(si.guestCount) : '—'],
    ['Location', si.location ?? '—'],
    ['Event-Typ', si.eventType ?? '—'],
    ['Budget', data.budget != null ? `${data.budget.toLocaleString('de-DE')} €` : '—'],
    ['Nachricht', data.message || '—'],
    ['Link zur Anfrage', data.requestUrl],
  ]
  rows.forEach(([label, value], i) => {
    const row = overview.getRow(i + 3)
    row.getCell(1).value = label
    row.getCell(2).value = value
    Object.assign(row.getCell(1), LABEL_STYLE)
    row.getCell(2).alignment = { wrapText: true }
  })

  // ── Sheet 2: Fragebogen-Antworten ───────────────────────────────────────────
  const qSheet = wb.addWorksheet('Fragebogen-Antworten')
  qSheet.columns = [
    { header: 'Abschnitt', key: 'section', width: 24 },
    { header: 'Frage', key: 'label', width: 40 },
    { header: 'Antwort', key: 'display', width: 40 },
  ]
  qSheet.getRow(1).eachCell(c => { Object.assign(c, HEADER_STYLE) })
  if (data.answers.length === 0) {
    qSheet.addRow(['—', 'Kein Fragebogen hinterlegt', '—'])
  } else {
    data.answers.forEach(a => qSheet.addRow([a.sectionTitle, a.label, a.display]))
  }
  qSheet.getColumn('display').alignment = { wrapText: true }
  qSheet.getColumn('label').alignment = { wrapText: true }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
