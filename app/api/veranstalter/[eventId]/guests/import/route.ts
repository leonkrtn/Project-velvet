import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

export type ParsedRow = {
  rowIndex: number
  typ: string
  hauptgast: string | null
  id: string | null
  name: string
  email: string | null
  phone: string | null
  status: string | null
  side: string | null
  meal_choice: string | null
  allergy_tags: string[]
  allergy_custom: string | null
  trink_alkohol: boolean | null
  age_category: string | null
  notes: string | null
  errors: string[]
  action: 'create' | 'update' | 'error'
}

const VALID_STATUS = ['angelegt', 'eingeladen', 'zugesagt', 'abgesagt']
const VALID_SIDE = ['Braut', 'Bräutigam', 'Beide']
const VALID_AGE = ['erwachsen', '13-17', '6-12', '0-6']

export async function POST(
  req: NextRequest,
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

  if (!member || !['veranstalter', 'brautpaar_solo'].includes(member.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let arrayBuffer: ArrayBuffer
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Keine Datei gefunden' }, { status: 400 })
    arrayBuffer = await file.arrayBuffer()
  } catch {
    return NextResponse.json({ error: 'Datei konnte nicht gelesen werden' }, { status: 400 })
  }

  const wb = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (wb.xlsx as any).load(arrayBuffer)
  const sheet = wb.worksheets[0]
  if (!sheet) return NextResponse.json({ error: 'Kein Arbeitsblatt gefunden' }, { status: 400 })

  const rows: ParsedRow[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const getCellText = (col: number): string => {
      const cell = row.getCell(col)
      if (cell.value === null || cell.value === undefined) return ''
      return String(cell.value).trim()
    }

    const typ = getCellText(1)
    const hauptgast = getCellText(2)
    const id = getCellText(3)
    const name = getCellText(4)
    const email = getCellText(5)
    const phone = getCellText(6)
    const status = getCellText(7)
    const side = getCellText(8)
    const meal_choice = getCellText(9)
    const allergyRaw = getCellText(10)
    const allergy_custom = getCellText(11)
    const trinkRaw = getCellText(12)
    const age_category = getCellText(13)
    const notes = getCellText(14)

    const allCells = [typ, hauptgast, id, name, email, phone, status, side, meal_choice, allergyRaw, allergy_custom, trinkRaw, age_category, notes]
    if (allCells.every(c => c === '')) return
    if (typ.startsWith('Hinweise:')) return

    const errors: string[] = []

    if (!name) errors.push('Name fehlt')

    let normalizedStatus: string | null = null
    if (status) {
      const lower = status.toLowerCase()
      if (VALID_STATUS.includes(lower)) {
        normalizedStatus = lower
      } else {
        errors.push(`Ungültiger Status: "${status}"`)
      }
    }

    let normalizedSide: string | null = null
    if (side) {
      const trimmed = side.trim()
      if (VALID_SIDE.includes(trimmed)) {
        normalizedSide = trimmed
      } else {
        errors.push(`Ungültige Seite: "${side}"`)
      }
    }

    let trink_alkohol: boolean | null = null
    if (trinkRaw) {
      if (trinkRaw === 'Ja') {
        trink_alkohol = true
      } else if (trinkRaw === 'Nein') {
        trink_alkohol = false
      } else {
        errors.push('Ungültiger Wert für Trinkt Alkohol')
      }
    }

    let normalizedAge: string | null = null
    if (age_category) {
      if (VALID_AGE.includes(age_category)) {
        normalizedAge = age_category
      } else {
        errors.push(`Ungültige Alterskategorie: "${age_category}"`)
      }
    }

    const typNorm = typ.trim()
    if (typNorm === 'Begleitperson' && !hauptgast) {
      errors.push('Hauptgast fehlt')
    }

    const allergy_tags = allergyRaw
      ? allergyRaw.split(',').map(t => t.trim()).filter(t => t !== '')
      : []

    rows.push({
      rowIndex: rowNumber,
      typ: typNorm || 'Gast',
      hauptgast: hauptgast || null,
      id: id || null,
      name,
      email: email || null,
      phone: phone || null,
      status: normalizedStatus,
      side: normalizedSide,
      meal_choice: meal_choice || null,
      allergy_tags,
      allergy_custom: allergy_custom || null,
      trink_alkohol,
      age_category: normalizedAge,
      notes: notes || null,
      errors,
      action: errors.length > 0 ? 'error' : 'create', // finalized below after DB check
    })
  })

  // Check which IDs in the file actually exist in this event's DB records.
  // This determines whether a row truly updates an existing entry or creates a new one.
  const guestIdsToCheck = rows
    .filter(r => r.id && r.typ !== 'Begleitperson' && r.errors.length === 0)
    .map(r => r.id as string)

  const bpIdsToCheck = rows
    .filter(r => r.id && r.typ === 'Begleitperson' && r.errors.length === 0)
    .map(r => r.id as string)

  const existingGuestIds = new Set<string>()
  const existingBpIds = new Set<string>()

  if (guestIdsToCheck.length > 0) {
    const { data } = await supabase
      .from('guests')
      .select('id')
      .eq('event_id', eventId)
      .in('id', guestIdsToCheck)
    for (const g of data ?? []) existingGuestIds.add(g.id)
  }

  if (bpIdsToCheck.length > 0) {
    const { data } = await supabase
      .from('begleitpersonen')
      .select('id')
      .in('id', bpIdsToCheck)
    for (const bp of data ?? []) existingBpIds.add(bp.id)
  }

  for (const row of rows) {
    if (row.errors.length > 0) continue
    if (!row.id) {
      row.action = 'create'
    } else if (row.typ === 'Begleitperson') {
      if (existingBpIds.has(row.id)) {
        row.action = 'update'
      } else {
        row.action = 'create'
        row.id = null
      }
    } else {
      if (existingGuestIds.has(row.id)) {
        row.action = 'update'
      } else {
        row.action = 'create'
        row.id = null
      }
    }
  }

  const total = rows.length
  const toCreate = rows.filter(r => r.action === 'create').length
  const toUpdate = rows.filter(r => r.action === 'update').length
  const errors = rows.filter(r => r.action === 'error').length

  return NextResponse.json({ rows, stats: { total, toCreate, toUpdate, errors } })
}
