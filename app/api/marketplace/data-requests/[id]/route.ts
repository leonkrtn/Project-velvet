import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const REQUESTER_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

interface Field { key: string; label: string; value: string }

// PATCH — Daten-Anfrage beantworten. Body: { answers: { [key]: value } }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({})) as { answers?: Record<string, string> }
  const answers = body.answers ?? {}

  const admin = createAdminClient()
  const { data: dr } = await admin.from('vendor_data_requests').select('*').eq('id', id).maybeSingle()
  if (!dr) return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })

  const { data: member } = await admin.from('event_members').select('role').eq('event_id', dr.event_id).eq('user_id', user.id).maybeSingle()
  if (!member || !REQUESTER_ROLES.includes(member.role)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const fields: Field[] = (Array.isArray(dr.fields) ? dr.fields : []).map((f: Field) => ({
    key: f.key, label: f.label, value: typeof answers[f.key] === 'string' ? answers[f.key].trim() : (f.value ?? ''),
  }))

  const { error } = await admin.from('vendor_data_requests')
    .update({ fields, status: 'answered', answered_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Antwort als Chat-Nachricht posten (sichtbar fuer den Dienstleister).
  if (dr.conversation_id) {
    const summary = fields.filter(f => f.value).map(f => `${f.label}: ${f.value}`).join(' · ')
    await admin.from('messages').insert({
      conversation_id: dr.conversation_id, event_id: dr.event_id, sender_id: user.id, message_type: 'text',
      content: summary ? `Daten übermittelt — ${summary}` : 'Daten übermittelt.',
    })
    await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', dr.conversation_id)
  }

  return NextResponse.json({ success: true })
}
