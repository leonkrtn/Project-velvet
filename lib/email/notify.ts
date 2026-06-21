// Server-only: Best-Effort-Versand von Transaktions-E-Mails ueber die Supabase
// Edge Function 'notify-email'. Wirft NIE — Mail-Fehler duerfen den App-Flow
// (Angebot freigeben/annehmen) nicht blockieren. Bei fehlendem Provider ist die
// Function ein No-Op.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

interface MailInput {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail(admin: SupabaseClient, input: MailInput): Promise<void> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).filter(Boolean)
  if (recipients.length === 0) return
  try {
    await admin.functions.invoke('notify-email', {
      body: { to: recipients, subject: input.subject, html: input.html, replyTo: input.replyTo },
    })
  } catch (err) {
    console.error('[Forevr] notify-email failed (ignored):', err)
  }
}

const BRAND = '#B89968'

/** Schlankes, markenkonformes HTML-Geruest fuer Forevr-Mails. */
export function emailLayout(opts: { heading: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string }): string {
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<tr><td style="padding:8px 0 4px"><a href="${opts.ctaUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px">${opts.ctaLabel}</a></td></tr>`
    : ''
  return `<!DOCTYPE html><html><body style="margin:0;background:#f7f5f1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c1c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f1;padding:28px 0">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ece7df">
<tr><td style="padding:22px 28px 8px">
<div style="font-family:Georgia,serif;font-size:22px;letter-spacing:0.16em;color:${BRAND};font-weight:500">FOREVR</div>
</td></tr>
<tr><td style="padding:8px 28px 4px"><h1 style="font-size:18px;margin:0 0 6px;font-weight:700">${opts.heading}</h1></td></tr>
<tr><td style="padding:6px 28px 22px;font-size:14px;line-height:1.6;color:#333">
<table role="presentation" cellpadding="0" cellspacing="0">${opts.bodyHtml}${cta}</table>
</td></tr>
</table>
<p style="font-size:11px;color:#9a958c;margin:16px 0 0">Forevr · Diese E-Mail wurde automatisch versendet.</p>
</td></tr></table></body></html>`
}
