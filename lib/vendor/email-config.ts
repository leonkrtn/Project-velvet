// Server-only: laedt die (angepassten oder Standard-)E-Mail-Vorlagen eines Vendors
// und baut daraus versandfertige Mails. Genutzt vom Versand (offer-notify,
// automation-tick) und indirekt von der Editor-API.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_GREETING, DEFAULT_SIGNATURE, DEFAULT_TEMPLATES, EMAIL_TEMPLATE_KEYS,
  renderVendorEmailHtml, type EmailTemplate, type EmailTemplateKey, type PlaceholderKey, type RenderedVendorEmail,
} from './email-templates'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface VendorEmailConfig {
  templates: Record<EmailTemplateKey, EmailTemplate>
  greeting: string
  signature: string
  brand: { color: string | null; name: string | null }
  /** Impressum-Zeilen (Firmenname, Adresse, Kontakt) fuer den Mail-Fuss. */
  imprint: string[]
  /** Reply-To fuer Brautpaar-Mails = Vendor-E-Mail (best effort). */
  replyTo: string | null
}

/** Baut die Impressum-Zeilen aus den Firmenstammdaten des Dienstleisters. */
function buildImprint(p: any): string[] {
  const firm = (p.company_name || p.name || '').trim()
  const street = (p.company_street || p.street || '').trim()
  const zip = (p.company_zip || p.zip || '').trim()
  const city = (p.company_city || p.city || '').trim()
  const address = [street, [zip, city].filter(Boolean).join(' ').trim()].filter(Boolean).join(', ')
  const contact = [p.email, p.phone, p.website].map((x: unknown) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).join(' · ')
  return [firm, address, contact].filter(Boolean)
}

function mergeTemplate(key: EmailTemplateKey, row: any | undefined): EmailTemplate {
  const d = DEFAULT_TEMPLATES[key]
  if (!row) return { ...d }
  // Leere Felder fallen auf den Standard zurueck (nie eine leere Betreffzeile senden).
  return {
    subject: (row.subject ?? '').trim() || d.subject,
    heading: (row.heading ?? '').trim() || d.heading,
    body: (row.body ?? '').trim() || d.body,
    cta_label: (row.cta_label ?? '').trim() || d.cta_label,
  }
}

/** Laedt Profil + gespeicherte Vorlagen und fuellt Luecken mit den Standards. */
export async function loadVendorEmailConfig(admin: SupabaseClient, vendorId: string): Promise<VendorEmailConfig> {
  const [{ data: profile }, { data: rows }] = await Promise.all([
    admin.from('dienstleister_profiles')
      .select('name, company_name, email, phone, website, street, zip, city, company_street, company_zip, company_city, brand_color, email_greeting, email_signature')
      .eq('id', vendorId).maybeSingle(),
    admin.from('vendor_email_templates').select('*').eq('dienstleister_id', vendorId),
  ])
  const p = (profile ?? {}) as any
  const byKey = new Map<string, any>((rows ?? []).map((r: any) => [r.template_key, r]))

  const templates = {} as Record<EmailTemplateKey, EmailTemplate>
  for (const key of EMAIL_TEMPLATE_KEYS) templates[key] = mergeTemplate(key, byKey.get(key))

  return {
    templates,
    greeting: (p.email_greeting ?? '').trim() ? p.email_greeting : DEFAULT_GREETING,
    signature: (p.email_signature ?? '').trim() ? p.email_signature : DEFAULT_SIGNATURE,
    brand: { color: (p.brand_color as string) || null, name: (p.company_name || p.name || null) },
    imprint: buildImprint(p),
    replyTo: (p.email as string) || null,
  }
}

/** Kontext-Werte (Brautpaar-Name + Datum) fuer die Platzhalter eines Events. */
export async function eventPlaceholderValues(admin: SupabaseClient, eventId: string): Promise<Partial<Record<PlaceholderKey, string>>> {
  const { data: ev } = await admin.from('events').select('couple_name, title, date').eq('id', eventId).maybeSingle()
  const e = (ev ?? {}) as any
  const out: Partial<Record<PlaceholderKey, string>> = {}
  if (e.couple_name || e.title) out.brautpaar = e.couple_name || e.title
  if (e.date) {
    try { out.datum = new Date(`${String(e.date).slice(0, 10)}T00:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'UTC' }) }
    catch { out.datum = String(e.date).slice(0, 10) }
  }
  return out
}

/**
 * Baut eine versandfertige Vendor-Mail (Vorlage + Profil + Platzhalter-Werte).
 * `values` ueberschreibt/ergaenzt die Event-Kontextwerte.
 */
export async function buildVendorEmail(
  admin: SupabaseClient,
  vendorId: string,
  key: EmailTemplateKey,
  opts: { eventId?: string; values?: Partial<Record<PlaceholderKey, string>>; ctaUrl?: string },
): Promise<{ subject: string; html: string; replyTo: string | null } | null> {
  const cfg = await loadVendorEmailConfig(admin, vendorId)
  const values: Partial<Record<PlaceholderKey, string>> = {
    firma: cfg.brand.name || undefined,
    ...(opts.eventId ? await eventPlaceholderValues(admin, opts.eventId) : {}),
    ...(opts.values ?? {}),
  }
  const rendered: RenderedVendorEmail = renderVendorEmailHtml({
    template: cfg.templates[key],
    greeting: cfg.greeting,
    signature: cfg.signature,
    brand: cfg.brand,
    imprint: cfg.imprint,
    values,
    ctaUrl: opts.ctaUrl,
  })
  return { subject: rendered.subject, html: rendered.html, replyTo: cfg.replyTo }
}
