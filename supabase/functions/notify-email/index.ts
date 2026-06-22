// Supabase Edge Function: notify-email
//
// Transaktions-E-Mails fuer Forevr (Angebote/Vertraege). Wird serverseitig ueber
// admin.functions.invoke('notify-email', ...) aufgerufen. Versand laeuft ueber
// den SMTP-Server, der in Supabase hinterlegt ist (dieselben Zugangsdaten wie
// fuer die Auth-Mails) — kein Drittanbieter-API-SDK. Sind keine SMTP-Secrets
// gesetzt, antwortet die Function mit { skipped: true } (No-Op), damit der
// App-Flow nie blockiert.
//
// Deploy:  supabase functions deploy notify-email
// Secrets (= eure Supabase-SMTP-Einstellungen):
//   supabase secrets set SMTP_HOST=smtp.example.com SMTP_PORT=465 \
//     SMTP_USER=apikey SMTP_PASS=...  EMAIL_FROM="Forevr <noreply@forevr.app>"

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

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

  const host = Deno.env.get('SMTP_HOST')
  const port = Number(Deno.env.get('SMTP_PORT') ?? '465')
  const username = Deno.env.get('SMTP_USER')
  const password = Deno.env.get('SMTP_PASS')
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

  // Kein SMTP konfiguriert -> sauberer No-Op statt Fehler.
  if (!host || !username || !password) {
    return new Response(JSON.stringify({ skipped: true, reason: 'SMTP not configured' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Port 465 = implizites TLS; 587/25 = STARTTLS.
  const client = new SMTPClient({
    connection: { hostname: host, port, tls: port === 465, auth: { username, password } },
  })

  try {
    await client.send({
      from,
      to: recipients,
      replyTo: body.replyTo,
      subject: body.subject,
      content: 'text/html; charset=utf-8',
      html: body.html,
    })
    await client.close()
    return new Response(JSON.stringify({ sent: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    try { await client.close() } catch { /* ignore */ }
    return new Response(JSON.stringify({ sent: false, error: String(err) }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    })
  }
})
