import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient as createAdmin } from '@/lib/supabase/admin'
import { hasProAccess } from '@/lib/subscription'
import { sendEmail, emailLayout } from '@/lib/email/notify'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://project-velvet.vercel.app').replace(/\/$/, '')

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const body = await req.json()
    const { eventId, category, requestedService, requestMessage, email } = body as {
      eventId:  string
      category: string
      requestedService?: string
      requestMessage?: string
      email?: string
    }

    if (!eventId || !category) {
      return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })
    }

    // Berechtigung prüfen
    const { data: member } = await supabase
      .from('event_members')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!member || !['veranstalter', 'brautpaar_solo'].includes(member.role as string)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    // Dienstleister einladen ist für Solo-Paare ein Pro-Feature
    if (member.role === 'brautpaar_solo' && !(await hasProAccess(eventId))) {
      return NextResponse.json(
        { error: 'Dienstleister einladen ist Teil von Forevr Pro. Upgradet euren Tarif, um euer Profi-Team dazuzuholen.', code: 'PRO_REQUIRED' },
        { status: 403 },
      )
    }

    const admin = createAdmin()
    const { data: invitation, error } = await admin
      .from('event_invitations')
      .insert({
        event_id:   eventId,
        role:       'dienstleister',
        created_by: user.id,
        metadata:   {
          category,
          requested_service: requestedService ?? category,
          request_message:   requestMessage ?? null,
        },
      })
      .select('code')
      .single()

    if (error || !invitation) {
      console.error('Einladung erstellen:', error)
      return NextResponse.json({ error: 'Einladung konnte nicht erstellt werden' }, { status: 500 })
    }

    const targetEmail = (email ?? '').trim().toLowerCase()
    if (targetEmail) {
      const { data: inviter } = await admin.from('profiles').select('name').eq('id', user.id).maybeSingle()
      const inviterName = inviter?.name || 'Ein Brautpaar'
      await sendEmail(null, {
        to: targetEmail,
        subject: `Einladung als Dienstleister: ${category}`,
        html: emailLayout({
          heading: 'Ihr wurdet als Dienstleister eingeladen',
          bodyHtml: `<tr><td style="padding:4px 0">${inviterName} hat euch als <strong>${category}</strong> zu einem Event auf Forevr eingeladen.</td></tr>
            <tr><td style="padding:8px 0 4px;color:#666">Der Link ist nur einmal einlösbar.</td></tr>`,
          ctaLabel: 'Einladung annehmen',
          ctaUrl: `${APP_URL}/vendor/join?code=${invitation.code}`,
        }),
      })
    }

    return NextResponse.json({ code: invitation.code })
  } catch (err) {
    console.error('POST /api/vendor/invite:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
