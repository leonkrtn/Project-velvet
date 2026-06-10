// app/api/open-invite/[token]/route.ts
// Öffentliche Endpoints für den Sammel-Link (Gast-Selbstregistrierung).
// GET  → Event-Vorschau (Titel/Paarname), nur wenn der Link aktiv ist
// POST → legt einen Gast mit pending_approval=true an und gibt dessen
//        persönlichen RSVP-Token zurück (Weiterleitung in den normalen
//        RSVP-Flow). Bestätigung erfolgt später durch das Brautpaar.
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function findEvent(token: string) {
  const admin = getServiceClient()
  const { data: event } = await admin
    .from('events')
    .select('id, title, couple_name, date, open_invite_enabled')
    .eq('open_invite_token', token)
    .maybeSingle()
  return { admin, event }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const { event } = await findEvent(token)

  if (!event || !event.open_invite_enabled) {
    return NextResponse.json({ error: 'Link ungültig oder deaktiviert' }, { status: 404 })
  }

  return NextResponse.json({
    title: event.title,
    coupleName: event.couple_name,
    date: event.date,
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const { admin, event } = await findEvent(token)

  if (!event || !event.open_invite_enabled) {
    return NextResponse.json({ error: 'Link ungültig oder deaktiviert' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const side = typeof body.side === 'string' && body.side.trim() ? body.side.trim() : null

  if (!name || name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: 'Bitte gib deinen Namen an.' }, { status: 400 })
  }

  const guestToken = randomUUID()
  const { data: guest, error: insertErr } = await admin
    .from('guests')
    .insert({
      event_id: event.id,
      name,
      side,
      status: 'angelegt',
      token: guestToken,
      pending_approval: true,
    })
    .select('id, token')
    .single()

  if (insertErr || !guest) {
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ rsvpToken: guest.token })
}
