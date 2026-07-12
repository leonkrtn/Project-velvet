import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendEmail, emailLayout } from '@/lib/email/notify'

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Auth "Send Email" Hook → Versand über Resend
//
// Damit laufen ALLE Auth-Mails (inkl. des Registrierungs-Codes) über
// unser Resend-Setup (lib/email/notify.ts) statt über den Supabase-SMTP.
//
// Einrichtung (Supabase-Dashboard, einmalig):
//   Authentication → Hooks → "Send Email" → HTTPS-Hook auf
//     https://<deine-domain>/api/auth/send-email
//   Das generierte Secret (Format "v1,whsec_…") als Env-Var
//   SEND_EMAIL_HOOK_SECRET hinterlegen (Vercel).
//   Der Code ist 6-stellig (Supabase-Standard, keine OTP-Length-Änderung nötig).
//
// Ist der Hook nicht eingerichtet, wird diese Route nie aufgerufen — das
// bestehende Verhalten bleibt unverändert.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

type EmailActionType =
  | 'signup' | 'magiclink' | 'recovery' | 'invite' | 'email_change' | 'email'

interface HookPayload {
  user: { email?: string }
  email_data: {
    token: string
    token_hash: string
    redirect_to?: string
    email_action_type: EmailActionType
    site_url?: string
  }
}

/** Standard-Webhooks-Signaturprüfung (HMAC-SHA256), wie von Supabase genutzt. */
function verifySignature(rawSecret: string, headers: Headers, payload: string): boolean {
  const id = headers.get('webhook-id')
  const timestamp = headers.get('webhook-signature-timestamp') || headers.get('webhook-timestamp')
  const sigHeader = headers.get('webhook-signature')
  if (!id || !timestamp || !sigHeader) return false

  // Zeitfenster prüfen (±5 Min gegen Replay)
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

  // Secret "v1,whsec_<base64>" → Rohschlüssel-Bytes
  let secret = rawSecret.trim()
  if (secret.startsWith('v1,')) secret = secret.slice(3)
  if (secret.startsWith('whsec_')) secret = secret.slice(6)
  let key: Buffer
  try { key = Buffer.from(secret, 'base64') } catch { return false }

  const signedContent = `${id}.${timestamp}.${payload}`
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64')
  const expectedBuf = Buffer.from(expected)

  // Header enthält leerzeichengetrennte Einträge "v1,<sig>"
  for (const part of sigHeader.split(' ')) {
    const sig = part.includes(',') ? part.split(',')[1] : part
    const sigBuf = Buffer.from(sig)
    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return true
    }
  }
  return false
}

function verifyUrl(payload: HookPayload['email_data']): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const redirect = payload.redirect_to || payload.site_url || ''
  const params = new URLSearchParams({
    token: payload.token_hash,
    type: payload.email_action_type,
    ...(redirect ? { redirect_to: redirect } : {}),
  })
  return `${base}/auth/v1/verify?${params.toString()}`
}

/** Baut Betreff + HTML je nach Auth-Aktion. */
function buildMail(data: HookPayload['email_data']): { subject: string; html: string } {
  const codeRow = `
    <tr><td style="padding:6px 0 4px;font-size:14px;line-height:1.6;color:#333">Gib diesen Code in Forevr ein, um fortzufahren:</td></tr>
    <tr><td style="padding:8px 0 14px">
      <div style="font-size:30px;font-weight:700;letter-spacing:0.34em;background:#f5f0e8;border:1px solid #ece3d0;border-radius:10px;padding:16px 0;text-align:center;color:#1c1c1c">${data.token}</div>
    </td></tr>
    <tr><td style="font-size:12px;color:#8a857c;line-height:1.5">Der Code ist rund 60&nbsp;Minuten gültig. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</td></tr>`

  switch (data.email_action_type) {
    case 'signup':
    case 'email':
      return {
        subject: 'Dein Forevr-Bestätigungscode',
        html: emailLayout({ heading: 'Bestätige deine E-Mail-Adresse', bodyHtml: codeRow }),
      }
    case 'magiclink':
      return {
        subject: 'Dein Forevr-Anmeldecode',
        html: emailLayout({ heading: 'Anmelden bei Forevr', bodyHtml: codeRow }),
      }
    case 'recovery':
      return {
        subject: 'Passwort zurücksetzen',
        html: emailLayout({
          heading: 'Passwort zurücksetzen',
          bodyHtml: `<tr><td style="font-size:14px;line-height:1.6;color:#333;padding-bottom:6px">Klicke auf den Button, um ein neues Passwort zu vergeben. Alternativ kannst du diesen Code verwenden: <strong style="letter-spacing:0.12em">${data.token}</strong>.</td></tr>`,
          ctaLabel: 'Neues Passwort festlegen',
          ctaUrl: verifyUrl(data),
        }),
      }
    case 'email_change':
      return {
        subject: 'E-Mail-Änderung bestätigen',
        html: emailLayout({ heading: 'E-Mail-Adresse bestätigen', bodyHtml: codeRow }),
      }
    case 'invite':
      return {
        subject: 'Du wurdest zu Forevr eingeladen',
        html: emailLayout({
          heading: 'Einladung zu Forevr',
          bodyHtml: `<tr><td style="font-size:14px;line-height:1.6;color:#333;padding-bottom:6px">Du wurdest zu Forevr eingeladen. Klicke auf den Button, um dein Konto zu aktivieren.</td></tr>`,
          ctaLabel: 'Einladung annehmen',
          ctaUrl: verifyUrl(data),
        }),
      }
    default:
      return {
        subject: 'Forevr',
        html: emailLayout({ heading: 'Forevr', bodyHtml: codeRow }),
      }
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET
  if (!secret) {
    console.error('[Forevr] SEND_EMAIL_HOOK_SECRET nicht konfiguriert — Auth-Mail-Hook abgelehnt')
    return NextResponse.json({ error: 'Hook not configured' }, { status: 500 })
  }

  const raw = await req.text()
  if (!verifySignature(secret, req.headers, raw)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: HookPayload
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const email = payload.user?.email
  if (!email || !payload.email_data?.token) {
    // Nichts zu senden — trotzdem 200, damit der Auth-Flow nicht blockiert.
    return NextResponse.json({})
  }

  const { subject, html } = buildMail(payload.email_data)
  await sendEmail(null, { to: email, subject, html })

  return NextResponse.json({})
}
