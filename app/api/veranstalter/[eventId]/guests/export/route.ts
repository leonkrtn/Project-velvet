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

  const [
    { data: guests },
    { data: begleitpersonen },
    { data: seatingAssignments },
  ] = await Promise.all([
    supabase
      .from('guests')
      .select('id, name, email, phone, status, side, meal_choice, allergy_tags, allergy_custom, trink_alkohol, notes:message, arrival_date, departure_date, transport_mode, hotel_room_id')
      .eq('event_id', eventId)
      .order('name'),
    supabase
      .from('begleitpersonen')
      .select('id, guest_id, name, age_category, meal_choice, allergy_tags, allergy_custom, trink_alkohol')
      .in('guest_id',
        (await supabase.from('guests').select('id').eq('event_id', eventId)).data?.map(g => g.id) ?? []
      ),
    supabase
      .from('seating_assignments')
      .select('guest_id, begleitperson_id, table_id, seating_tables(name)')
      .eq('event_id', eventId),
  ])

  const hotelRoomIds = [...new Set((guests ?? []).map(g => g.hotel_room_id).filter(Boolean))]
  let hotelRoomMap: Record<string, { room_type: string; room_number: string | null; hotel_name: string }> = {}
  if (hotelRoomIds.length > 0) {
    const { data: rooms } = await supabase
      .from('hotel_rooms')
      .select('id, room_type, room_number, hotels(name)')
      .in('id', hotelRoomIds)
    if (rooms) {
      for (const r of rooms) {
        hotelRoomMap[r.id] = {
          room_type: r.room_type,
          room_number: r.room_number,
          hotel_name: (r.hotels as { name: string } | null)?.name ?? '',
        }
      }
    }
  }

  const guestTableMap: Record<string, string> = {}
  const begleitTableMap: Record<string, string> = {}
  for (const sa of seatingAssignments ?? []) {
    const tableName = (sa.seating_tables as { name: string } | null)?.name ?? ''
    if (sa.guest_id) guestTableMap[sa.guest_id] = tableName
    if (sa.begleitperson_id) begleitTableMap[sa.begleitperson_id] = tableName
  }

  const guestNameMap: Record<string, string> = {}
  for (const g of guests ?? []) {
    guestNameMap[g.id] = g.name
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

  for (const g of guests ?? []) {
    const room = g.hotel_room_id ? hotelRoomMap[g.hotel_room_id] : null
    sheet.addRow({
      typ: 'Gast',
      hauptgast: '',
      id: g.id,
      name: g.name,
      email: g.email ?? '',
      phone: g.phone ?? '',
      status: g.status ?? '',
      side: g.side ?? '',
      meal_choice: g.meal_choice ?? '',
      allergy_tags: (g.allergy_tags ?? []).join(', '),
      allergy_custom: g.allergy_custom ?? '',
      trink_alkohol: g.trink_alkohol === true ? 'Ja' : g.trink_alkohol === false ? 'Nein' : '',
      age_category: '',
      notes: g.notes ?? '',
      table_name: guestTableMap[g.id] ?? '',
      hotel: room?.hotel_name ?? '',
      room: room ? [room.room_type, room.room_number].filter(Boolean).join(' ') : '',
    })

    for (const bp of (begleitpersonen ?? []).filter(b => b.guest_id === g.id)) {
      sheet.addRow({
        typ: 'Begleitperson',
        hauptgast: g.name,
        id: bp.id,
        name: bp.name ?? '',
        email: '',
        phone: '',
        status: '',
        side: '',
        meal_choice: bp.meal_choice ?? '',
        allergy_tags: (bp.allergy_tags ?? []).join(', '),
        allergy_custom: bp.allergy_custom ?? '',
        trink_alkohol: bp.trink_alkohol === true ? 'Ja' : bp.trink_alkohol === false ? 'Nein' : '',
        age_category: bp.age_category ?? '',
        notes: '',
        table_name: begleitTableMap[bp.id] ?? '',
        hotel: '',
        room: '',
      })
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer as Buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="gaesteliste.xlsx"',
    },
  })
}
