import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface CalendarEntry {
  id: string
  title: string
  description: string
  start_at: string
  end_at: string | null
  all_day: boolean
  color: string
  entry_type: 'event' | 'reminder' | 'payment' | 'custom'
  editable: boolean
}

// GET — returns merged calendar entries for the logged-in vendor
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // ── 1. Custom entries from DB ────────────────────────────────────────────────
  const { data: custom } = await admin
    .from('vendor_calendar_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('start_at', { ascending: true })

  const customEntries: CalendarEntry[] = (custom ?? []).map(e => ({
    id: e.id,
    title: e.title,
    description: e.description ?? '',
    start_at: e.start_at,
    end_at: e.end_at ?? null,
    all_day: e.all_day,
    color: e.color,
    entry_type: e.entry_type as CalendarEntry['entry_type'],
    editable: true,
  }))

  // ── 2. Wedding dates from event_members ──────────────────────────────────────
  const { data: members } = await admin
    .from('event_members')
    .select('event_id, events(id, title, date, couple_name)')
    .eq('user_id', user.id)
    .eq('role', 'dienstleister')

  const eventEntries: CalendarEntry[] = (members ?? [])
    .map((m): CalendarEntry | null => {
      const ev = Array.isArray(m.events) ? m.events[0] : m.events as { id: string; title: string | null; date: string | null; couple_name: string | null } | null
      if (!ev?.date) return null
      const label = ev.couple_name ? `Hochzeit ${ev.couple_name}` : (ev.title ?? 'Hochzeit')
      return {
        id: `event-${m.event_id}`,
        title: label,
        description: '',
        start_at: `${ev.date}T00:00:00.000Z`,
        end_at: null,
        all_day: true,
        color: '#2352C8',
        entry_type: 'event',
        editable: false,
      }
    })
    .filter((e): e is CalendarEntry => e !== null)

  // ── 3. Offer deadlines (only if vendor has marketplace profile) ──────────────
  const offerEntries: CalendarEntry[] = []
  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (link?.dienstleister_id) {
    const { data: offers } = await admin
      .from('vendor_offers')
      .select('id, event_id, status, valid_until, accepted_at, deposit_type, deposit_due_days, events(title, couple_name)')
      .eq('dienstleister_id', link.dienstleister_id)
      .in('status', ['released', 'draft', 'accepted'])

    for (const o of offers ?? []) {
      const ev = Array.isArray(o.events) ? (o.events[0] as { title: string | null; couple_name: string | null } | null) : o.events as { title: string | null; couple_name: string | null } | null
      const evLabel = ev?.couple_name ?? ev?.title ?? 'Angebot'

      // Offer valid_until reminder
      if (o.valid_until && (o.status === 'released' || o.status === 'draft')) {
        offerEntries.push({
          id: `offer-expire-${o.id}`,
          title: `Angebot läuft ab: ${evLabel}`,
          description: 'Gültigkeitsfrist des Angebots endet.',
          start_at: `${o.valid_until}T00:00:00.000Z`,
          end_at: null,
          all_day: true,
          color: '#D97706',
          entry_type: 'reminder',
          editable: false,
        })
      }

      // Deposit deadline for accepted offers
      if (o.status === 'accepted' && o.accepted_at && o.deposit_type && o.deposit_type !== 'none' && o.deposit_due_days) {
        const acceptedDate = new Date(o.accepted_at)
        acceptedDate.setDate(acceptedDate.getDate() + Number(o.deposit_due_days))
        offerEntries.push({
          id: `offer-deposit-${o.id}`,
          title: `Anzahlung fällig: ${evLabel}`,
          description: `Anzahlung ${o.deposit_due_days} Tage nach Annahme des Angebots.`,
          start_at: acceptedDate.toISOString(),
          end_at: null,
          all_day: true,
          color: '#1E7E34',
          entry_type: 'payment',
          editable: false,
        })
      }
    }
  }

  const entries = [...eventEntries, ...offerEntries, ...customEntries]
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  return NextResponse.json({ entries })
}

// POST — create a new custom calendar entry
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const { title, description, start_at, end_at, all_day, color, entry_type } = body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 })
  }
  if (!start_at || typeof start_at !== 'string') {
    return NextResponse.json({ error: 'Datum erforderlich' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vendor_calendar_entries')
    .insert({
      user_id: user.id,
      title: (title as string).trim(),
      description: (description as string | undefined) ?? '',
      start_at,
      end_at: end_at ?? null,
      all_day: all_day ?? true,
      color: (color as string | undefined) ?? '#2352C8',
      entry_type: (entry_type as string | undefined) ?? 'custom',
    })
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Konnte nicht erstellt werden' }, { status: 500 })
  }

  const entry: CalendarEntry = {
    id: data.id,
    title: data.title,
    description: data.description ?? '',
    start_at: data.start_at,
    end_at: data.end_at ?? null,
    all_day: data.all_day,
    color: data.color,
    entry_type: data.entry_type as CalendarEntry['entry_type'],
    editable: true,
  }

  return NextResponse.json({ entry }, { status: 201 })
}
