// Isomorph (Server + Client): Definition, Standard-Texte, Platzhalter und Rendering
// der E-Mails, die Forevr im NAMEN des Dienstleisters an das Brautpaar versendet.
//
// KEIN 'server-only' — die Live-Vorschau im Editor rendert exakt dieselbe HTML wie
// der Versand (renderVendorEmailHtml), damit „Vorschau == verschickte Mail" gilt.

export type EmailTemplateKey = 'offer_released' | 'followup_offer' | 'review_request'

export const EMAIL_TEMPLATE_KEYS: EmailTemplateKey[] = ['offer_released', 'followup_offer', 'review_request']

export interface EmailTemplate {
  subject: string
  heading: string
  /** Markdown-lite: **fett**, *kursiv*, [Text](url), Zeilen mit „- " werden zur Liste. */
  body: string
  cta_label: string
}

export type PlaceholderKey = 'firma' | 'brautpaar' | 'betrag' | 'angebot' | 'datum'

export interface PlaceholderDef { key: PlaceholderKey; label: string; sample: string }

export const PLACEHOLDERS: PlaceholderDef[] = [
  { key: 'firma',     label: 'Dein Firmenname',  sample: 'Blumen Meyer' },
  { key: 'brautpaar', label: 'Brautpaar',        sample: 'Anna & Tom' },
  { key: 'betrag',    label: 'Angebotssumme',    sample: '2.450,00 €' },
  { key: 'angebot',   label: 'Angebots-Titel',   sample: 'Floristik Komplettpaket' },
  { key: 'datum',     label: 'Event-Datum',      sample: '15.08.2026' },
]

export interface EmailTemplateMeta {
  key: EmailTemplateKey
  title: string
  /** Wann diese Mail automatisch rausgeht. */
  trigger: string
  /** Welche Platzhalter hier sinnvoll sind (Reihenfolge = Chip-Reihenfolge). */
  placeholders: PlaceholderKey[]
  /** Hinweis zum fest verdrahteten Button-Ziel. */
  ctaNote: string
}

export const EMAIL_TEMPLATE_META: Record<EmailTemplateKey, EmailTemplateMeta> = {
  offer_released: {
    key: 'offer_released',
    title: 'Angebot freigegeben',
    trigger: 'Sobald du ein Angebot für das Brautpaar freigibst.',
    placeholders: ['firma', 'brautpaar', 'angebot', 'betrag', 'datum'],
    ctaNote: 'Der Button verlinkt automatisch auf das Angebot im Portal.',
  },
  followup_offer: {
    key: 'followup_offer',
    title: 'Offenes Angebot nachfassen',
    trigger: 'Über die Automatik-Regel „Offenes Angebot nachfassen", X Tage nach der Freigabe.',
    placeholders: ['firma', 'brautpaar', 'betrag', 'datum'],
    ctaNote: 'Der Button verlinkt automatisch auf das Angebot im Portal.',
  },
  review_request: {
    key: 'review_request',
    title: 'Bewertung anfragen',
    trigger: 'Über die Automatik-Regel „Bewertung anfragen", X Tage nach dem Event.',
    placeholders: ['firma', 'brautpaar', 'datum'],
    ctaNote: 'Der Button verlinkt automatisch auf das Bewertungsformular.',
  },
}

// Anrede + Signatur werden zentral gepflegt und gelten für alle drei Mails.
export const DEFAULT_GREETING = 'Hallo {brautpaar},'
export const DEFAULT_SIGNATURE = 'Herzliche Grüße\n{firma}'

export const DEFAULT_TEMPLATES: Record<EmailTemplateKey, EmailTemplate> = {
  offer_released: {
    subject: 'Neues Angebot von {firma}',
    heading: 'Ihr habt ein neues Angebot erhalten',
    body: '{firma} hat euch das Angebot **„{angebot}"** über **{betrag}** bereitgestellt.\n\nIm Portal könnt ihr es prüfen, als PDF speichern und verbindlich annehmen.',
    cta_label: 'Angebot ansehen',
  },
  followup_offer: {
    subject: 'Habt ihr noch Fragen zu eurem Angebot?',
    heading: 'Kurze Nachfrage zu eurem Angebot',
    body: 'wir wollten uns kurz melden: Habt ihr Fragen zu unserem Angebot über **{betrag}**? Wir helfen gern weiter.',
    cta_label: 'Angebot ansehen',
  },
  review_request: {
    subject: 'Wie war eure Erfahrung mit {firma}?',
    heading: 'Wir freuen uns über eure Bewertung',
    body: 'vielen Dank für die schöne Zusammenarbeit! Eure Rückmeldung hilft uns sehr — es dauert nur eine Minute.',
    cta_label: 'Jetzt bewerten',
  },
}

// ── Rendering-Helfer ─────────────────────────────────────────────────────────

const BRAND_GOLD = '#B89968'

export function safeBrandColor(c?: string | null): string {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : BRAND_GOLD
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Ersetzt {platzhalter} durch die uebergebenen Werte (fehlend -> leer). */
export function substitutePlaceholders(text: string, values: Partial<Record<PlaceholderKey, string>>): string {
  return text.replace(/\{(firma|brautpaar|betrag|angebot|datum)\}/g, (_m, k) => values[k as PlaceholderKey] ?? '')
}

// Markdown-lite auf bereits HTML-escaptem Text (nur ein sicherer Subset).
function inlineMd(escaped: string): string {
  let s = escaped
  // Links: [Text](http/https/mailto …) — nur sichere Schemata.
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    (_m, txt, url) => `<a href="${url}" style="color:inherit;text-decoration:underline">${txt}</a>`)
  // **fett** vor *kursiv*.
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  return s
}

/** Markdown-lite -> sicheres HTML (Absaetze, Listen, fett/kursiv, Links). */
export function renderRichText(md: string): string {
  const escaped = escapeHtml((md || '').replace(/\r\n/g, '\n'))
  const blocks = escaped.split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
  const out: string[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    if (lines.every(l => /^\s*[-*]\s+/.test(l))) {
      const items = lines.map(l => `<li>${inlineMd(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')
      out.push(`<ul style="margin:6px 0;padding-left:20px">${items}</ul>`)
    } else {
      out.push(`<p style="margin:0 0 10px">${inlineMd(lines.join('<br>'))}</p>`)
    }
  }
  return out.join('')
}

export interface RenderVendorEmailInput {
  template: EmailTemplate
  greeting: string
  signature: string
  brand: { color?: string | null; name?: string | null }
  values: Partial<Record<PlaceholderKey, string>>
  /** Ziel des CTA-Buttons. Fehlt es (z. B. Vorschau), zeigt der Button auf '#'. */
  ctaUrl?: string
}

export interface RenderedVendorEmail { subject: string; html: string }

/**
 * Baut die vollstaendige, gebrandete HTML-Mail — identisch fuer Vorschau und Versand.
 * Aufbau: Wortmarke · Ueberschrift · Anrede · Text · [Button] · Signatur.
 */
export function renderVendorEmailHtml(input: RenderVendorEmailInput): RenderedVendorEmail {
  const sub = (s: string) => substitutePlaceholders(s || '', input.values)
  const accent = safeBrandColor(input.brand.color)
  const wordmark = (input.brand.name && input.brand.name.trim()) || 'FOREVR'
  const isVendor = wordmark !== 'FOREVR'

  const subject = sub(input.template.subject)
  const greetingHtml = input.greeting.trim() ? renderRichText(sub(input.greeting)) : ''
  const bodyHtml = renderRichText(sub(input.template.body))
  const signatureHtml = input.signature.trim() ? renderRichText(sub(input.signature)) : ''

  const ctaLabel = (input.template.cta_label || '').trim()
  const ctaRow = ctaLabel
    ? `<tr><td style="padding:12px 0 4px"><a href="${input.ctaUrl || '#'}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px">${escapeHtml(ctaLabel)}</a></td></tr>`
    : ''

  const rows =
    (greetingHtml ? `<tr><td style="padding:2px 0 8px;font-size:14px;line-height:1.6;color:#333">${greetingHtml}</td></tr>` : '') +
    `<tr><td style="padding:0 0 2px;font-size:14px;line-height:1.6;color:#333">${bodyHtml}</td></tr>` +
    ctaRow +
    (signatureHtml ? `<tr><td style="padding:16px 0 0;font-size:14px;line-height:1.6;color:#555">${signatureHtml}</td></tr>` : '')

  const wordmarkStyle = isVendor
    ? `font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:20px;letter-spacing:0.02em;color:${accent};font-weight:700`
    : `font-family:Georgia,serif;font-size:22px;letter-spacing:0.16em;color:${accent};font-weight:500`
  const footer = isVendor ? `${escapeHtml(wordmark)} · gesendet über Forevr` : 'Forevr · Diese E-Mail wurde automatisch versendet.'

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f7f5f1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c1c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f1;padding:28px 0">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ece7df">
<tr><td style="padding:22px 28px 8px">
<div style="${wordmarkStyle}">${escapeHtml(wordmark)}</div>
</td></tr>
<tr><td style="padding:8px 28px 4px"><h1 style="font-size:18px;margin:0 0 6px;font-weight:700">${escapeHtml(sub(input.template.heading))}</h1></td></tr>
<tr><td style="padding:6px 28px 22px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows}</table>
</td></tr>
</table>
<p style="font-size:11px;color:#9a958c;margin:16px 0 0">${footer}</p>
</td></tr></table></body></html>`

  return { subject, html }
}
