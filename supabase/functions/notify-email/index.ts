// Supabase Edge Function: notify-email
//
// Transaktions-E-Mails fuer Forevr (Angebote/Vertraege). Wird serverseitig ueber
// admin.functions.invoke('notify-email', ...) aufgerufen. Versand laeuft ueber
// Resend (https://resend.com) — der API-Key liegt als Function-Secret
// RESEND_API_KEY vor. Ist kein Key gesetzt, antwortet die Function mit
// { skipped: true } (No-Op), damit der App-Flow nie blockiert.
//
// Deploy:  supabase functions deploy notify-email
// Secrets: supabase secrets set RESEND_API_KEY=...  EMAIL_FROM="Forevr <noreply@forevr.app>"

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface Payload {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM') ?? 'Forevr <noreply@forevr.app>'

  let body: Payload
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const recipients = Array.isArray(body.to) ? body.to.filter(Boolean) : [body.to].filter(Boolean)
  if (recipients.length === 0 || !body.subject || !body.html) {
    return new Response(JSON.stringify({ error: 'Missing to/subject/html' }), { status: 400 })
  }

  // Kein Provider konfiguriert -> sauberer No-Op statt Fehler.
  if (!apiKey) {
    return new Response(JSON.stringify({ skipped: true, reason: 'RESEND_API_KEY not set' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: body.subject,
      html: body.html,
      ...(body.replyTo ? { reply_to: body.replyTo } : {}),
    }),
  })

  const data = await res.json().catch(() => ({}))
  return new Response(JSON.stringify({ sent: res.ok, data }), {
    status: res.ok ? 200 : 502, headers: { 'Content-Type': 'application/json' },
  })
})
