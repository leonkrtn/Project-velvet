// app/api/wedding/[eventId]/timeline/route.ts
// Liefert den Ablaufplan (timeline_entries) des Events als einfache Schedule-Items
// (Uhrzeit + Titel + optionaler Ort) zum Import in den Hochzeitswebsite-Tagesablauf.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEventRole } from '@/lib/files/permissions'

const EDIT_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

function fmtTime(row: any): string {
  if (row.time) {
    const d = new Date(row.time)
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(d)
    }
  }
  if (typeof row.start_minutes === 'number') {
    const h = Math.floor(row.start_minutes / 60) % 24
    const m = row.start_minutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return ''
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const role = await getEventRole(supabase, user.id, eventId)
  if (!role || !EDIT_ROLES.includes(role)) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const { data, error } = await supabase
    .from('timeline_entries')
    .select('id, time, title, location, sort_order, day_index, start_minutes')
    .eq('event_id', eventId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = (data ?? [])
    .map(r => ({
      _day: (r as any).day_index ?? 0,
      _t: r.time ? new Date(r.time).getTime() : ((r as any).start_minutes ?? 0) * 60000,
      _sort: r.sort_order ?? 0,
      time: fmtTime(r),
      label: (r.title ?? '').trim(),
      description: (r.location ?? '').trim() || undefined,
    }))
    .filter(i => i.time || i.label)
    .sort((a, b) => a._day - b._day || a._t - b._t || a._sort - b._sort)
    .map(({ time, label, description }) => ({ time, label, description }))

  return NextResponse.json({ items })
}
