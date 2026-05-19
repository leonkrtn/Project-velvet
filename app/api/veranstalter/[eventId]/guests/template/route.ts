import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'veranstalter') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('Gästeliste')

  sheet.columns = [
    { header: 'Typ', key: 'typ', width: 16 },
    { header: 'Hauptgast', key: 'hauptgast', width: 28 },
    { header: 'ID (nicht ändern)', key: 'id', width: 38 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'E-Mail', key: 'email', width: 30 },
    { header: 'Telefon', key: 'phone', width: 18 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Seite', key: 'side', width: 14 },
    { header: 'Menüwahl', key: 'meal_choice', width: 18 },
    { header: 'Allergien', key: 'allergy_tags', width: 28 },
    { header: 'Allergie (Freitext)', key: 'allergy_custom', width: 24 },
    { header: 'Trinkt Alkohol', key: 'trink_alkohol', width: 16 },
    { header: 'Alter (nur Begleitung)', key: 'age_category', width: 22 },
    { header: 'Notizen', key: 'notes', width: 30 },
    { header: 'Tischname (nur Info)', key: 'table_name', width: 22 },
    { header: 'Hotel (nur Info)', key: 'hotel', width: 24 },
    { header: 'Zimmer (nur Info)', key: 'room', width: 22 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.eachCell((cell, colNumber) => {
    const isReadOnly = colNumber >= 15
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isReadOnly ? 'FF64748B' : 'FF1E293B' },
    }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 }
    cell.alignment = { vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF334155' } } }
  })
  headerRow.height = 32

  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: 'A1', to: 'Q1' }

  const exampleFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFDE7' },
  }

  const guestRow = sheet.addRow({
    typ: 'Gast',
    hauptgast: '',
    id: '',
    name: 'Max Mustermann',
    email: 'max@beispiel.de',
    phone: '+49 123 456789',
    status: 'angelegt',
    side: 'Bräutigam',
    meal_choice: 'Fleisch',
    allergy_tags: 'Glutenfrei, Laktosefrei',
    allergy_custom: '',
    trink_alkohol: 'Ja',
    age_category: '',
    notes: 'Sitzt gerne vorne',
    table_name: '',
    hotel: '',
    room: '',
  })
  guestRow.eachCell(cell => { cell.fill = exampleFill })

  const begleitRow = sheet.addRow({
    typ: 'Begleitperson',
    hauptgast: 'Max Mustermann',
    id: '',
    name: 'Erika Muster',
    email: '',
    phone: '',
    status: '',
    side: '',
    meal_choice: 'Vegetarisch',
    allergy_tags: '',
    allergy_custom: '',
    trink_alkohol: 'Nein',
    age_category: 'erwachsen',
    notes: '',
    table_name: '',
    hotel: '',
    room: '',
  })
  begleitRow.eachCell(cell => { cell.fill = exampleFill })

  const noteRow = sheet.addRow({
    typ: 'Hinweise: Leere Zellen werden beim Import ignoriert. Pflichtfeld: Name. ID leer lassen für neue Einträge.',
  })
  noteRow.getCell(1).font = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 }
  sheet.mergeCells(`A4:Q4`)

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="gaesteliste-vorlage.xlsx"',
    },
  })
}
