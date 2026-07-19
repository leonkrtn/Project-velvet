// app/api/wedding/public/[slug]/rsvp/register/route.ts
// Öffentlich: neuer Gast meldet sich erstmals an (Name + E-Mail). Legt einen guests-Eintrag
// im Event der Hochzeitswebsite an; short_code + token werden per DB-Trigger/Default erzeugt.
// Verschickt anschliessend eine Bestaetigungsmail mit dem persoenlichen Link/Code.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { titleCaseName } from '@/lib/text'
import { sendEmail, emailLayout } from '@/lib/email/notify'
import { escapeHtml } from '@/lib/vendor/email-templates'
import { rateLimit, clientIp } from '@/lib/rate-limit'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://project-velvet.vercel.app').replace(/\/$/, '')

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  // Missbrauchsschutz: Der Endpoint legt Gast-Zeilen an und verschickt eine
  // Mail an eine beliebige Adresse. Ohne Limit ließe er sich als Spam-Relay
  // missbrauchen (Mails an fremde Adressen) bzw. zur Enumeration bestehender
  // Gäste. Eng pro IP+Slug begrenzen.
  const rl = rateLimit(`${clientIp(request)}:${slug}`, {
    name: 'wedding-rsvp-register', limit: 8, windowMs: 10 * 60_000, blockMs: 30 * 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anmeldungen. Bitte versuche es später erneut.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  let body: { vorname?: string; nachname?: string; email?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Ungültiger Payload' }, { status: 400 }) }

  const vorname = (body.vorname ?? '').trim()
  const nachname = (body.nachname ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  if (vorname.length < 1) return NextResponse.json({ error: 'Bitte gib deinen Vornamen ein.' }, { status: 400 })
  if (nachname.length < 1) return NextResponse.json({ error: 'Bitte gib deinen Nachnamen ein.' }, { status: 400 })
  if (!isEmail(email)) return NextResponse.json({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' }, { status: 400 })

  const vornameClean = titleCaseName(vorname)
  const nachnameClean = titleCaseName(nachname)
  const name = `${vornameClean} ${nachnameClean}`.trim()

  const admin = createAdminClient()

  const { data: site } = await admin
    .from('wedding_sites')
    .select('event_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!site) return NextResponse.json({ error: 'Hochzeitswebsite nicht gefunden' }, { status: 404 })

  const { data: event } = await admin
    .from('events')
    .select('couple_name, title')
    .eq('id', site.event_id)
    .maybeSingle()
  const coupleName = event?.couple_name || event?.title || 'Das Brautpaar'

  // Bereits vorhandener Gast mit dieser E-Mail? → bestehenden Zugang zurückgeben (keine Dublette).
  const { data: existing } = await admin
    .from('guests')
    .select('token, short_code, name')
    .eq('event_id', site.event_id)
    .ilike('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ token: existing.token, code: existing.short_code, name: existing.name, existing: true })
  }

  const { data: created, error } = await admin
    .from('guests')
    .insert({
      event_id: site.event_id,
      name,
      vorname: vornameClean,
      nachname: nachnameClean,
      email,
      status: 'angelegt',
    })
    .select('token, short_code, name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sendEmail(null, {
    to: email,
    subject: `Deine Anmeldung zur Hochzeit von ${coupleName}`,
    html: emailLayout({
      heading: 'Schön, dass du dabei bist!',
      bodyHtml: `
        <tr><td style="padding:4px 0">Hallo ${escapeHtml(vornameClean)},</td></tr>
        <tr><td style="padding:8px 0 4px">deine Anmeldung zur Hochzeit von <strong>${escapeHtml(coupleName)}</strong> ist eingegangen. Über den Button unten kommst du jederzeit zu deiner persönlichen RSVP-Seite.</td></tr>
        <tr><td style="padding:8px 0 4px;color:#666">Dein persönlicher Code: <strong>${escapeHtml(created.short_code)}</strong></td></tr>`,
      ctaLabel: 'Zu meiner RSVP-Seite',
      ctaUrl: `${APP_URL}/rsvp/${created.token}`,
    }),
  })

  return NextResponse.json({ token: created.token, code: created.short_code, name: created.name, existing: false })
}
