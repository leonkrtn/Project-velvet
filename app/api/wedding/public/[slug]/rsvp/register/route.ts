// app/api/wedding/public/[slug]/rsvp/register/route.ts
// Öffentlich: neuer Gast meldet sich erstmals an (Name + E-Mail). Legt einen guests-Eintrag
// im Event der Hochzeitswebsite an; short_code + token werden per DB-Trigger/Default erzeugt.
// E-Mail-Versand des persönlichen Links ist als TODO vorgesehen (siehe unten).
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { titleCaseName } from '@/lib/text'

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
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

  // TODO(E-Mail): Bestätigungsmail mit persönlichem Link + Code versenden,
  // sobald ein Mail-Dienst (z.B. Resend) angebunden ist. Aktuell wird der
  // persönliche Code/Link dem Gast direkt auf der Seite angezeigt.

  return NextResponse.json({ token: created.token, code: created.short_code, name: created.name, existing: false })
}
