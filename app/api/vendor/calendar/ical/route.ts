import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function generateToken(userId: string): string {
  const secret = process.env.FILE_WORKER_INTERNAL_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'forevr-ical'
  return createHmac('sha256', secret).update(userId).digest('hex').slice(0, 40)
}

function icalDate(isoStr: string, allDay: boolean): string {
  const d = new Date(isoStr)
  if (allDay) {
    // DATE format: YYYYMMDD
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  }
  // DATETIME format: YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function icalEscape(str: string): string {
  return (str ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function foldLine(line: string): string {
  // iCal lines must be max 75 octets; fold longer lines with CRLF + space
  const chunks: string[] = []
  while (line.length > 75) {
    chunks.push(line.slice(0, 75))
    line = ' ' + line.slice(75)
  }
  chunks.push(line)
  return chunks.join('\r\n')
}

async function buildIcal(userId: string): Promise<string> {
  const admin = createAdminClient()

  // Custom entries
  const { data: custom } = await admin
    .from('vendor_calendar_entries')
    .select('*')
    .eq('user_id', userId)

  // Event dates
  const { data: members } = await admin
    .from('event_members')
    .select('event_id, events(id, title, date, couple_name)')
    .eq('user_id', userId)
    .eq('role', 'dienstleister')

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Forevr//Vendor Calendar//DE',
    'X-WR-CALNAME:Forevr Kalender',
    'X-WR-CALDESC:Termine aus deinem Forevr-Dienstleister-Portal',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  const addEvent = (uid: string, summary: string, description: string, startIso: string, endIso: string | null, allDay: boolean) => {
    const startStr = icalDate(startIso, allDay)
    let endStr = endIso ? icalDate(endIso, allDay) : null
    if (!endStr && allDay) {
      // DTEND for all-day = next day
      const d = new Date(startIso)
      d.setUTCDate(d.getUTCDate() + 1)
      endStr = icalDate(d.toISOString(), true)
    }

    lines.push('BEGIN:VEVENT')
    lines.push(foldLine(`UID:${uid}@forevr.app`))
    if (allDay) {
      lines.push(foldLine(`DTSTART;VALUE=DATE:${startStr}`))
      if (endStr) lines.push(foldLine(`DTEND;VALUE=DATE:${endStr}`))
    } else {
      lines.push(foldLine(`DTSTART:${startStr}`))
      if (endStr) lines.push(foldLine(`DTEND:${endStr}`))
    }
    lines.push(foldLine(`SUMMARY:${icalEscape(summary)}`))
    if (description) lines.push(foldLine(`DESCRIPTION:${icalEscape(description)}`))
    lines.push(`DTSTAMP:${icalDate(new Date().toISOString(), false)}`)
    lines.push('END:VEVENT')
  }

  // Auto: wedding dates
  for (const m of members ?? []) {
    const ev = Array.isArray(m.events) ? m.events[0] : m.events as { title: string | null; date: string | null; couple_name: string | null } | null
    if (!ev?.date) continue
    const label = ev.couple_name ? `Hochzeit ${ev.couple_name}` : (ev.title ?? 'Hochzeit')
    addEvent(`event-${m.event_id}`, label, '', `${ev.date}T00:00:00.000Z`, null, true)
  }

  // Custom entries
  for (const e of custom ?? []) {
    addEvent(e.id, e.title, e.description ?? '', e.start_at, e.end_at, e.all_day)
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

// GET — returns .ics file
// Supports session-based auth OR token-based public access (?uid=...&token=...)
export async function GET(req: NextRequest) {
  let userId: string | null = null

  const uid = req.nextUrl.searchParams.get('uid')
  const token = req.nextUrl.searchParams.get('token')

  if (uid && token) {
    // Public token-based access (for calendar subscription)
    if (token !== generateToken(uid)) {
      return NextResponse.json({ error: 'Ungültiger Token' }, { status: 401 })
    }
    userId = uid
  } else {
    // Session-based access (for direct download)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
  }

  const ical = await buildIcal(userId)

  return new NextResponse(ical, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="forevr-kalender.ics"',
      'Cache-Control': 'no-cache',
    },
  })
}

// POST — returns the webcal subscription URL for this user
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = generateToken(user.id)
  return NextResponse.json({ userId: user.id, token })
}
