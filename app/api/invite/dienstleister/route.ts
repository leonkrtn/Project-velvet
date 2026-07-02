// app/api/invite/dienstleister/route.ts
// Erstellt globalen DienstleisterProfile + EventDienstleister + Invite-Code
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { hasProAccess } from '@/lib/subscription'
import { sendEmail, emailLayout } from '@/lib/email/notify'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://project-velvet.vercel.app').replace(/\/$/, '')

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const body = await request.json()
  const {
    eventId,
    name,
    category,
    email,
    scopes = [],
    dienstleisterProfileId,
    requestedService,
    requestMessage,
  } = body as {
    eventId: string
    name: string
    category: string
    email?: string
    scopes?: string[]
    dienstleisterProfileId?: string
    requestedService?: string
    requestMessage?: string
  }

  if (!eventId || !name || !category) {
    return NextResponse.json({ error: 'eventId, name und category erforderlich' }, { status: 400 })
  }

  const admin = getServiceClient()

  // Caller-Rolle im Event prüfen
  const { data: member } = await admin
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['veranstalter', 'brautpaar', 'brautpaar_solo'].includes(member.role as string)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Dienstleister einladen ist für Solo-Paare ein Pro-Feature
  if (member.role === 'brautpaar_solo' && !(await hasProAccess(eventId))) {
    return NextResponse.json(
      { error: 'Dienstleister einladen ist Teil von Forevr Pro. Upgradet euren Tarif, um euer Profi-Team dazuzuholen.', code: 'PRO_REQUIRED' },
      { status: 403 },
    )
  }

  // DienstleisterProfile erstellen oder vorhandenen nutzen
  let dlId = dienstleisterProfileId
  if (!dlId) {
    const { data: dl, error: dlErr } = await admin.from('dienstleister_profiles').insert({
      name,
      category,
      email: email ?? null,
    }).select('id').single()
    if (dlErr) return NextResponse.json({ error: dlErr.message }, { status: 500 })
    dlId = dl.id
  }

  // EventDienstleister erstellen
  const edId = crypto.randomUUID()
  await admin.from('event_dienstleister').insert({
    id: edId,
    event_id: eventId,
    dienstleister_id: dlId,
    category,
    scopes,
    status: 'eingeladen',
    invited_by: user.id,
  })

  // Invite-Code mit Referenz auf event_dienstleister
  const code = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: invite, error: invErr } = await admin.from('invite_codes').insert({
    event_id: eventId,
    code,
    role: 'dienstleister',
    expires_at: expiresAt,
    metadata: {
      event_dienstleister_id: edId,
      category,
      requested_service: requestedService ?? category,
      request_message:    requestMessage ?? null,
    },
    created_by: user.id,
  }).select('code').single()

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  const targetEmail = (email ?? '').trim().toLowerCase()
  if (targetEmail) {
    const { data: inviter } = await admin.from('profiles').select('name').eq('id', user.id).maybeSingle()
    const inviterName = inviter?.name || 'Ein Brautpaar'
    await sendEmail(null, {
      to: targetEmail,
      subject: `Einladung als Dienstleister: ${category}`,
      html: emailLayout({
        heading: 'Ihr wurdet als Dienstleister eingeladen',
        bodyHtml: `<tr><td style="padding:4px 0">${inviterName} hat euch (${name}) als <strong>${category}</strong> zu einem Event auf Forevr eingeladen.</td></tr>
          <tr><td style="padding:8px 0 4px;color:#666">Der Link ist 7 Tage gültig und kann einmal eingelöst werden.</td></tr>`,
        ctaLabel: 'Einladung annehmen',
        ctaUrl: `${APP_URL}/vendor/join?code=${invite.code}`,
      }),
    })
  }

  return NextResponse.json({
    code: invite.code,
    expiresAt,
    dienstleisterId: dlId,
    eventDienstleisterId: edId,
  })
}
