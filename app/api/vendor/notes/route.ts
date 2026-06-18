import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

// Resolves the vendor firm (dienstleister_profiles.id) for a given user + event.
// Notes are private per firm, so this is the partition key.
async function resolveFirm(admin: SupabaseClient, eventId: string, userId: string): Promise<string | null> {
  const { data: ed } = await admin
    .from('event_dienstleister')
    .select('dienstleister_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()
  if (ed?.dienstleister_id) return ed.dienstleister_id as string

  const { data: ud } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  return (ud?.dienstleister_id as string) ?? null
}

async function authVendor(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member || member.role !== 'dienstleister') {
    return { error: NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 }) }
  }
  const firmId = await resolveFirm(admin, eventId, user.id)
  if (!firmId) return { error: NextResponse.json({ error: 'Kein Dienstleister-Profil gefunden' }, { status: 404 }) }
  return { user, admin, firmId }
}

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })

  const ctx = await authVendor(eventId)
  if ('error' in ctx) return ctx.error

  const { data } = await ctx.admin
    .from('dienstleister_notes')
    .select('content, updated_at')
    .eq('event_id', eventId)
    .eq('dienstleister_id', ctx.firmId)
    .maybeSingle()

  return NextResponse.json({ content: data?.content ?? '', updatedAt: data?.updated_at ?? null })
}

export async function PUT(req: NextRequest) {
  const { eventId, content } = await req.json() as { eventId: string; content: string }
  if (!eventId) return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })

  const ctx = await authVendor(eventId)
  if ('error' in ctx) return ctx.error

  const { error } = await ctx.admin
    .from('dienstleister_notes')
    .upsert({
      event_id: eventId,
      dienstleister_id: ctx.firmId,
      content: content ?? '',
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id,dienstleister_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
