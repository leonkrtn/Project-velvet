import { NextResponse } from 'next/server'
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

export async function GET() {
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

  const headers = [
    'Name', 'E-Mail', 'Telefon', 'Adresse', 'Adresszusatz',
    'Wohnstraße', 'Wohn-PLZ', 'Wohnort',
    'Status', 'Quelle', 'Veranstaltungstyp', 'Hochzeitsdatum', 'Geburtstag',
    'Veranstaltungsort', 'Gästeanzahl',
    'Umsatz', 'Offenes Angebot', 'Paar-Gesamtbudget',
    'Priorität', 'Notizen', 'Erstellt am',
  ]

  const rows = (contacts ?? []).map(c => [
    esc(c.name),
    esc(c.email),
    esc(c.phone),
    esc(c.address_line1),
    esc(c.address_line2),
    esc(c.home_street),
    esc(c.home_postal_code),
    esc(c.home_city),
    esc(STAGE_LABELS[c.lifecycle_stage] ?? c.lifecycle_stage),
    esc(SOURCE_LABELS[c.source] ?? c.source),
    esc(c.event_type),
    esc(c.wedding_date),
    esc(c.birthday),
    esc(c.location),
    esc(c.guest_count != null ? String(c.guest_count) : ''),
    esc(c.deal_value != null ? String(c.deal_value) : ''),
    esc(c.pending_offer_value != null ? String(c.pending_offer_value) : ''),
    esc(c.couple_budget != null ? String(c.couple_budget) : ''),
    esc(c.priority),
    esc(c.notes),
    esc(new Date(c.created_at).toLocaleDateString('de-DE')),
  ].join(','))

  const csv = [headers.join(','), ...rows].join('\r\n')
  const bom = '﻿'

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="crm-kontakte-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  })
}
