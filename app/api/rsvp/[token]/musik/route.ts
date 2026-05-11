// app/api/rsvp/[token]/musik/route.ts
// POST: Gast fügt einen Musikwunsch nach dem RSVP hinzu.
// Speichert in rsvp_music_suggestions. Non-authenticated, token-basiert.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })

  let body: { songTitle: string; songArtist: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Payload' }, { status: 400 })
  }

  const songTitle  = body.songTitle?.trim()
  const songArtist = body.songArtist?.trim()
  if (!songTitle || !songArtist) {
    return NextResponse.json({ error: 'Titel und Interpret erforderlich' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: guest, error: gErr } = await admin
    .from('guests')
    .select('id, event_id, name, status')
    .eq('token', token)
    .maybeSingle()

  if (gErr)   return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!guest) return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
  if (guest.status !== 'zugesagt') {
    return NextResponse.json({ error: 'Nur für zugesagte Gäste' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('rsvp_music_suggestions')
    .insert({
      event_id:   guest.event_id,
      guest_token: token,
      guest_name:  guest.name,
      song_title:  songTitle,
      artist:      songArtist,
    })
    .select('id, song_title, artist')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ suggestion: data })
}
