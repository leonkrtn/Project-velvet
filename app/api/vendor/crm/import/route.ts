import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  return lines.map(line => {
    const cells: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (ch === ',' && !inQ) {
        cells.push(cur); cur = ''
      } else cur += ch
    }
    cells.push(cur)
    return cells
  })
}

const STAGE_MAP: Record<string, string> = {
  lead: 'lead', anfrage: 'anfrage', gebucht: 'gebucht', ehemalig: 'ehemalig',
}
const SOURCE_MAP: Record<string, string> = {
  empfehlung: 'empfehlung', marktplatz: 'marktplatz', website: 'website',
  messe: 'messe', sonstige: 'sonstige',
}

export async function POST(req: NextRequest) {
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

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })

  const text = await file.text()
  // Strip BOM
  const clean = text.startsWith('﻿') ? text.slice(1) : text
  const rows = parseCSV(clean)
  if (rows.length < 2) return NextResponse.json({ imported: 0 })

  const header = rows[0].map(h => h.toLowerCase().trim())
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n)
      if (i >= 0) return i
    }
    return -1
  }

  const nameIdx  = idx(['name'])
  const emailIdx = idx(['e-mail', 'email', 'mail'])
  const phoneIdx = idx(['telefon', 'phone', 'tel'])
  const addr1Idx = idx(['adresse', 'address', 'straße'])
  const addr2Idx = idx(['adresszusatz', 'plz & stadt', 'city'])
  const stageIdx = idx(['status', 'lifecycle_stage', 'stage'])
  const sourceIdx = idx(['quelle', 'source'])
  const dateIdx  = idx(['hochzeitsdatum', 'wedding_date', 'datum'])
  const valueIdx = idx(['umsatz', 'deal_value', 'wert', 'budget'])
  const notesIdx = idx(['notizen', 'notes', 'anmerkungen'])

  const inserted: { contact_id: string; dlId: string; name: string }[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const get = (idx: number) => idx >= 0 ? (row[idx] ?? '').trim() : ''
    const name = get(nameIdx)
    if (!name) continue

    const stageRaw = get(stageIdx).toLowerCase()
    const sourceRaw = get(sourceIdx).toLowerCase()

    const { data: contact } = await admin
      .from('crm_contacts')
      .insert({
        dienstleister_id: link.dienstleister_id,
        name,
        email: get(emailIdx),
        phone: get(phoneIdx),
        address_line1: get(addr1Idx),
        address_line2: get(addr2Idx),
        lifecycle_stage: STAGE_MAP[stageRaw] ?? 'lead',
        source: SOURCE_MAP[sourceRaw] ?? 'sonstige',
        wedding_date: get(dateIdx) || null,
        deal_value: get(valueIdx) ? Number(get(valueIdx).replace(/[^0-9.,]/g, '').replace(',', '.')) || null : null,
        notes: get(notesIdx),
      })
      .select('id')
      .single()

    if (contact) {
      inserted.push({ contact_id: contact.id, dlId: link.dienstleister_id, name })
    }
  }

  if (inserted.length) {
    await admin.from('crm_activities').insert(
      inserted.map(c => ({
        contact_id: c.contact_id,
        dienstleister_id: c.dlId,
        activity_type: 'imported',
        title: 'Via CSV importiert',
        body: '',
        auto_generated: true,
      }))
    )
  }

  return NextResponse.json({ imported: inserted.length })
}
