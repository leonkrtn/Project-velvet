// app/api/rsvp/[token]/memory/route.ts
// Nach der Hochzeit: Gäste können eine Erinnerung/einen Kommentar hinterlassen
// (genutzt von components/wedding/WeddingEindruecke.tsx). Schreibt ausschließlich
// in guests.message — bewusst ein eigener, schmaler Endpoint statt des vollen
// RSVP-POST (/api/rsvp/[token]), der das komplette Formular (Status, Menü, Hotel
// etc.) überschreiben würde. Token-basiert, unauthentifiziert.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, clientIp } from '@/lib/rate-limit'

const MAX_LEN = 1000

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })

  const rl = rateLimit(`${clientIp(request)}:${token}`, {
    name: 'rsvp-memory', limit: 20, windowMs: 10 * 60_000, blockMs: 15 * 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Versuche. Bitte versuche es später erneut.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  let body: { message?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Ungültiger Payload' }, { status: 400 }) }

  const message = (body.message ?? '').trim().slice(0, MAX_LEN)
  if (!message) return NextResponse.json({ error: 'Bitte gib eine Nachricht ein.' }, { status: 400 })

  const admin = createAdminClient()

  const { data: guest, error: gErr } = await admin
    .from('guests')
    .select('id')
    .eq('token', token)
    .maybeSingle()

  if (gErr)   return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!guest) return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })

  const { data: updated, error: updErr } = await admin
    .from('guests')
    .update({ message })
    .eq('id', guest.id)
    .select('message')
    .single()

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ message: updated.message })
}
