import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ParsedRow } from '../route'

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

  if (!member || member.role !== 'veranstalter') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { rows: ParsedRow[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const validRows = (body.rows ?? []).filter(r => r.action !== 'error')
  const guestRows = validRows.filter(r => r.typ === 'Gast')
  const begleitRows = validRows.filter(r => r.typ === 'Begleitperson')

  let added = 0
  let updated = 0
  const importErrors: { rowIndex: number; name: string; reason: string }[] = []

  const newGuestMap: Record<string, string> = {}

  for (const row of guestRows) {
    try {
      if (row.id) {
        const { data: existing } = await supabase
          .from('guests')
          .select('id')
          .eq('id', row.id)
          .eq('event_id', eventId)
          .single()

        if (existing) {
          const updateObj: Record<string, unknown> = {}
          if (row.name) updateObj.name = row.name
          if (row.email !== null) updateObj.email = row.email
          if (row.phone !== null) updateObj.phone = row.phone
          if (row.status !== null) updateObj.status = row.status
          if (row.side !== null) updateObj.side = row.side
          if (row.meal_choice !== null) updateObj.meal_choice = row.meal_choice
          if (row.allergy_tags.length > 0) updateObj.allergy_tags = row.allergy_tags
          if (row.allergy_custom !== null) updateObj.allergy_custom = row.allergy_custom
          if (row.trink_alkohol !== null) updateObj.trink_alkohol = row.trink_alkohol
          if (row.notes !== null) updateObj.notes = row.notes

          const { error: updateErr } = await supabase.from('guests').update(updateObj).eq('id', row.id)
          if (updateErr) {
            importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: updateErr.message })
          } else {
            newGuestMap[row.name] = row.id
            updated++
          }
          continue
        }
      }

      const insertObj: Record<string, unknown> = {
        event_id: eventId,
        name: row.name,
        created_by: user.id,
      }
      if (row.email !== null) insertObj.email = row.email
      if (row.phone !== null) insertObj.phone = row.phone
      if (row.status !== null) insertObj.status = row.status
      if (row.side !== null) insertObj.side = row.side
      if (row.meal_choice !== null) insertObj.meal_choice = row.meal_choice
      if (row.allergy_tags.length > 0) insertObj.allergy_tags = row.allergy_tags
      if (row.allergy_custom !== null) insertObj.allergy_custom = row.allergy_custom
      if (row.trink_alkohol !== null) insertObj.trink_alkohol = row.trink_alkohol
      if (row.notes !== null) insertObj.notes = row.notes

      const { data: inserted, error: insertErr } = await supabase
        .from('guests')
        .insert(insertObj)
        .select('id')
        .single()

      if (insertErr) {
        importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: insertErr.message })
      } else if (inserted) {
        newGuestMap[row.name] = inserted.id
        added++
      }
    } catch {
      importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: 'Datenbankfehler beim Verarbeiten des Gastes' })
    }
  }

  for (const row of begleitRows) {
    try {
      const hauptgastName = row.hauptgast ?? ''
      let parentGuestId: string | null = newGuestMap[hauptgastName] ?? null

      if (!parentGuestId) {
        const { data: existingGuest } = await supabase
          .from('guests')
          .select('id')
          .eq('event_id', eventId)
          .eq('name', hauptgastName)
          .single()
        if (existingGuest) {
          parentGuestId = existingGuest.id
        }
      }

      if (!parentGuestId) {
        importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: `Hauptgast "${hauptgastName}" nicht gefunden` })
        continue
      }

      if (row.id) {
        const { data: existing } = await supabase
          .from('begleitpersonen')
          .select('id')
          .eq('id', row.id)
          .eq('guest_id', parentGuestId)
          .single()

        if (existing) {
          const updateObj: Record<string, unknown> = {}
          if (row.name) updateObj.name = row.name
          if (row.meal_choice !== null) updateObj.meal_choice = row.meal_choice
          if (row.allergy_tags.length > 0) updateObj.allergy_tags = row.allergy_tags
          if (row.allergy_custom !== null) updateObj.allergy_custom = row.allergy_custom
          if (row.trink_alkohol !== null) updateObj.trink_alkohol = row.trink_alkohol
          if (row.age_category !== null) updateObj.age_category = row.age_category

          const { error: bpUpdateErr } = await supabase.from('begleitpersonen').update(updateObj).eq('id', row.id)
          if (bpUpdateErr) {
            importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: bpUpdateErr.message })
          } else {
            updated++
          }
          continue
        }
      }

      const insertObj: Record<string, unknown> = {
        guest_id: parentGuestId,
        name: row.name,
      }
      if (row.meal_choice !== null) insertObj.meal_choice = row.meal_choice
      if (row.allergy_tags.length > 0) insertObj.allergy_tags = row.allergy_tags
      if (row.allergy_custom !== null) insertObj.allergy_custom = row.allergy_custom
      if (row.trink_alkohol !== null) insertObj.trink_alkohol = row.trink_alkohol
      if (row.age_category !== null) insertObj.age_category = row.age_category

      const { error: bpInsertErr } = await supabase.from('begleitpersonen').insert(insertObj)
      if (bpInsertErr) {
        importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: bpInsertErr.message })
      } else {
        added++
      }
    } catch {
      importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: 'Datenbankfehler beim Verarbeiten der Begleitperson' })
    }
  }

  return NextResponse.json({ added, updated, errors: importErrors })
}
