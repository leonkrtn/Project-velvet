// Server-only: Best-Effort-Versand von Transaktions-E-Mails ueber Resend.
// Wirft NIE — Mail-Fehler duerfen den App-Flow (Angebot freigeben/annehmen,
// Einladung erzeugen, ...) nicht blockieren. Ist kein RESEND_API_KEY gesetzt,
// ist der Versand ein No-Op (mit Konsolen-Warnung).
import 'server-only'
import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

interface MailAttachment {
  filename: string
  content: Buffer
}

interface MailInput {
  to: string | string[]
  subject: string
  html: string
  /** Optionaler Plaintext. Fehlt er, wird er aus dem HTML abgeleitet. */
  text?: string
  replyTo?: string
  attachments?: MailAttachment[]
}

// Deliverability: Spamfilter bewerten reine HTML-Mails ohne Text-Alternative
// schlechter. Wir liefern daher immer eine lesbare multipart/alternative
// Plaintext-Fassung mit. Grobe, aber robuste HTML→Text-Wandlung (Links bleiben
// als "Text (URL)" erhalten).
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, txt) => {
      const label = txt.replace(/<[^>]+>/g, '').trim()
      return label && href && !label.includes(href) ? `${label} (${href})` : (label || href)
    })
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|h3|li|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&uuml;/g, 'ü').replace(/&Uuml;/g, 'Ü').replace(/&auml;/g, 'ä').replace(/&Auml;/g, 'Ä')
    .replace(/&ouml;/g, 'ö').replace(/&Ouml;/g, 'Ö').replace(/&szlig;/g, 'ß').replace(/&euro;/gi, '€')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#34;/gi, '"').replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&bdquo;|&ldquo;|&rdquo;/gi, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

// Absender-Domain muss in Resend verifiziert sein. Verifiziert ist die
// Subdomain mail.forevrweddings.de (NICHT die Root-Domain) — daher ist der
// Default no-reply@mail.forevrweddings.de. Über EMAIL_FROM überschreibbar.
const EMAIL_FROM = process.env.EMAIL_FROM || 'Forevr <no-reply@mail.forevrweddings.de>'
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || undefined

let resendClient: Resend | null | undefined

function getResend(): Resend | null {
  if (resendClient !== undefined) return resendClient
  const apiKey = process.env.RESEND_API_KEY
  resendClient = apiKey ? new Resend(apiKey) : null
  return resendClient
}

// admin-Parameter bleibt aus Kompatibilitaetsgruenden mit bestehenden Call-Sites
// erhalten, wird fuer den Versand selbst aber nicht mehr benoetigt.
export async function sendEmail(admin: SupabaseClient | null, input: MailInput): Promise<void> {
  void admin
  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).filter(Boolean)
  if (recipients.length === 0) return
  const resend = getResend()
  if (!resend) {
    console.warn('[Forevr] RESEND_API_KEY not configured — email skipped:', input.subject)
    return
  }
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject: input.subject,
      html: input.html,
      text: input.text || htmlToText(input.html),
      replyTo: input.replyTo || REPLY_TO_EMAIL,
      attachments: input.attachments?.map(a => ({ filename: a.filename, content: a.content })),
    })
    if (error) console.error('[Forevr] Resend send failed (ignored):', error)
  } catch (err) {
    console.error('[Forevr] Resend send threw (ignored):', err)
  }
}

// Wie sendEmail, aber mit Ergebnis-Rückgabe — für die Admin-„Testen"-Seite,
// die dem Betreiber Erfolg/Fehler pro Mail anzeigen muss.
export async function sendEmailChecked(input: MailInput): Promise<{ ok: boolean; error?: string }> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).filter(Boolean)
  if (recipients.length === 0) return { ok: false, error: 'Keine Empfänger.' }
  const resend = getResend()
  if (!resend) return { ok: false, error: 'RESEND_API_KEY ist nicht konfiguriert.' }
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject: input.subject,
      html: input.html,
      text: input.text || htmlToText(input.html),
      replyTo: input.replyTo || REPLY_TO_EMAIL,
      attachments: input.attachments?.map(a => ({ filename: a.filename, content: a.content })),
    })
    if (error) return { ok: false, error: (error as { message?: string }).message || 'Resend-Fehler' }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' }
  }
}

const BRAND = '#B89968'

/** Optionales Vendor-Branding fuer an das Brautpaar gerichtete Vendor-Mails. */
export interface EmailBrand {
  /** Akzentfarbe (Hex). Leer/ungueltig -> Forevr-Gold. */
  color?: string | null
  /** Wortmarke im Kopf. Leer -> 'FOREVR'. */
  name?: string | null
}

function safeColor(c?: string | null): string {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : BRAND
}

/** Schlankes HTML-Geruest fuer Forevr-Mails; optional mit Vendor-Branding. */
export function emailLayout(opts: { heading: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string; brand?: EmailBrand }): string {
  const accent = safeColor(opts.brand?.color)
  const wordmark = (opts.brand?.name && opts.brand.name.trim()) || 'FOREVR'
  const isVendor = wordmark !== 'FOREVR'
  const footer = isVendor
    ? `${wordmark} · gesendet über Forevr`
    : 'Forevr · Diese E-Mail wurde automatisch versendet.'
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<tr><td style="padding:8px 0 4px"><a href="${opts.ctaUrl}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px">${opts.ctaLabel}</a></td></tr>`
    : ''
  const wordmarkStyle = isVendor
    ? `font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:20px;letter-spacing:0.02em;color:${accent};font-weight:700`
    : `font-family:Georgia,serif;font-size:22px;letter-spacing:0.16em;color:${accent};font-weight:500`
  return `<!DOCTYPE html><html><body style="margin:0;background:#f7f5f1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c1c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f1;padding:28px 0">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ece7df">
<tr><td style="padding:22px 28px 8px">
<div style="${wordmarkStyle}">${wordmark}</div>
</td></tr>
<tr><td style="padding:8px 28px 4px"><h1 style="font-size:18px;margin:0 0 6px;font-weight:700">${opts.heading}</h1></td></tr>
<tr><td style="padding:6px 28px 22px;font-size:14px;line-height:1.6;color:#333">
<table role="presentation" cellpadding="0" cellspacing="0">${opts.bodyHtml}${cta}</table>
</td></tr>
</table>
<p style="font-size:11px;color:#9a958c;margin:16px 0 0">${footer}</p>
</td></tr></table></body></html>`
}
