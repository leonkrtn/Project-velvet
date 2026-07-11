// Server-only: Admin-Benachrichtigungen. Lädt die konfigurierten Empfänger
// (admin_notification_recipients) je Typ und versendet eine Mail über Resend.
// Alle Funktionen sind Best-Effort und werfen NIE — ein Mail-Fehler darf den
// auslösenden App-Flow (Signup, Einreichen, Meldung) nicht blockieren.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, emailLayout } from '@/lib/email/notify'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://project-velvet.vercel.app').replace(/\/$/, '')

// ── Typen ─────────────────────────────────────────────────────────────────────
export type AdminNotifType =
  | 'monthly_report'
  | 'vendor_signup'
  | 'vendor_submit'
  | 'vendor_report'
  | 'organizer_request'

export interface AdminNotifTypeMeta { key: AdminNotifType; label: string; desc: string }

export const ADMIN_NOTIF_TYPES: AdminNotifTypeMeta[] = [
  { key: 'vendor_signup',     label: 'Neuer Dienstleister',      desc: 'Ein Dienstleister hat sich neu auf dem Marktplatz registriert.' },
  { key: 'vendor_submit',     label: 'Profil zur Prüfung',       desc: 'Ein Dienstleister reicht sein Profil oder Änderungen zur Freigabe ein.' },
  { key: 'vendor_report',     label: 'Anbieter-Meldung',         desc: 'Eine neue Beschwerde-/Missbrauchs-Meldung zu einem Anbieter ist eingegangen.' },
  { key: 'organizer_request', label: 'Neuer Veranstalter-Antrag', desc: 'Ein Veranstalter hat sich registriert und wartet auf Freischaltung.' },
  { key: 'monthly_report',    label: 'Monatlicher Report',       desc: 'Monatliche Zusammenfassung der Anwendungsaktivitäten (automatisch zum Monatsanfang).' },
]

export const ADMIN_NOTIF_DEFAULT_TYPES: Record<string, boolean> =
  Object.fromEntries(ADMIN_NOTIF_TYPES.map(t => [t.key, true]))

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Empfänger-Adressen, die diesen Typ abonniert haben (enabled + types[typ]=true). */
async function recipientsFor(admin: SupabaseClient, type: AdminNotifType): Promise<string[]> {
  const { data } = await admin
    .from('admin_notification_recipients')
    .select('email, enabled, types')
    .eq('enabled', true)
  const rows = (data ?? []) as { email: string; enabled: boolean; types: Record<string, unknown> | null }[]
  return rows
    .filter(r => r.email && r.types && r.types[type] === true)
    .map(r => r.email.trim())
}

interface AdminMail { subject: string; heading: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string }

/** Versendet eine Admin-Mail an alle für den Typ konfigurierten Empfänger. */
export async function notifyAdmins(admin: SupabaseClient, type: AdminNotifType, mail: AdminMail): Promise<void> {
  try {
    const to = await recipientsFor(admin, type)
    if (to.length === 0) return
    await sendEmail(admin, {
      to,
      subject: mail.subject,
      html: emailLayout({ heading: mail.heading, bodyHtml: mail.bodyHtml, ctaLabel: mail.ctaLabel, ctaUrl: mail.ctaUrl }),
    })
  } catch (err) {
    console.error('[Forevr] notifyAdmins failed (ignored):', err)
  }
}

// ── Konkrete Ereignis-Mails ────────────────────────────────────────────────────

export async function notifyVendorSignup(admin: SupabaseClient, v: { name: string | null; company_name: string | null; category: string | null; email: string | null }): Promise<void> {
  const name = v.company_name || v.name || 'Unbenannter Dienstleister'
  await notifyAdmins(admin, 'vendor_signup', {
    subject: `Neuer Dienstleister: ${name}`,
    heading: 'Neuer Dienstleister registriert',
    bodyHtml: `
      <tr><td style="padding:4px 0"><strong>${esc(name)}</strong> hat sich neu auf dem Marktplatz registriert.</td></tr>
      <tr><td style="padding:6px 0 10px;color:#666">Kategorie: ${esc(v.category || '—')}${v.email ? ` · ${esc(v.email)}` : ''}</td></tr>`,
    ctaLabel: 'Im Admin öffnen', ctaUrl: `${APP_URL}/admin`,
  })
}

export async function notifyVendorSubmit(admin: SupabaseClient, v: { name: string | null; company_name: string | null; category: string | null }, isUpdate: boolean): Promise<void> {
  const name = v.company_name || v.name || 'Ein Dienstleister'
  await notifyAdmins(admin, 'vendor_submit', {
    subject: `Zur Prüfung: ${name}`,
    heading: isUpdate ? 'Profil-Änderungen zur Prüfung' : 'Profil zur Erstprüfung eingereicht',
    bodyHtml: `
      <tr><td style="padding:4px 0"><strong>${esc(name)}</strong> hat ${isUpdate ? 'Änderungen' : 'sein Profil'} zur Freigabe eingereicht.</td></tr>
      <tr><td style="padding:6px 0 10px;color:#666">Kategorie: ${esc(v.category || '—')}</td></tr>`,
    ctaLabel: 'Jetzt prüfen', ctaUrl: `${APP_URL}/admin`,
  })
}

const REPORT_REASONS: Record<string, string> = {
  falsche_angaben: 'Falsche Angaben', unangemessene_bilder: 'Unangemessene Bilder', betrug: 'Betrug', spam: 'Spam',
}

export async function notifyVendorReport(admin: SupabaseClient, v: { name: string | null; company_name: string | null }, reason: string, comment: string | null): Promise<void> {
  const name = v.company_name || v.name || 'Ein Anbieter'
  await notifyAdmins(admin, 'vendor_report', {
    subject: `Neue Meldung zu ${name}`,
    heading: 'Neue Anbieter-Meldung',
    bodyHtml: `
      <tr><td style="padding:4px 0">Zu <strong>${esc(name)}</strong> ist eine Meldung eingegangen.</td></tr>
      <tr><td style="padding:6px 0 4px;color:#666">Grund: <strong>${esc(REPORT_REASONS[reason] || reason)}</strong></td></tr>
      ${comment ? `<tr><td style="padding:2px 0 10px;color:#666">„${esc(comment)}"</td></tr>` : ''}`,
    ctaLabel: 'Meldung ansehen', ctaUrl: `${APP_URL}/admin`,
  })
}

export async function notifyOrganizerRequest(admin: SupabaseClient, o: { name: string | null; email: string | null }): Promise<void> {
  await notifyAdmins(admin, 'organizer_request', {
    subject: `Neuer Veranstalter-Antrag${o.name ? `: ${o.name}` : ''}`,
    heading: 'Neuer Veranstalter wartet auf Freischaltung',
    bodyHtml: `
      <tr><td style="padding:4px 0"><strong>${esc(o.name || 'Ein Veranstalter')}</strong> hat sich registriert und wartet auf die Freischaltung.</td></tr>
      ${o.email ? `<tr><td style="padding:6px 0 10px;color:#666">${esc(o.email)}</td></tr>` : ''}`,
    ctaLabel: 'Freischalten', ctaUrl: `${APP_URL}/admin`,
  })
}

// ── Monatlicher Aktivitäts-Report ───────────────────────────────────────────────

function monthLabel(d: Date): string {
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

/** Baut den monatlichen Plattform-Report (Vormonat) als Admin-Mail. */
export async function buildMonthlyReport(admin: SupabaseClient, ref: Date): Promise<AdminMail & { period: string }> {
  // Zeitraum = Vormonat relativ zu ref.
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1))
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1))
  const startIso = start.toISOString()
  const endIso = end.toISOString()
  const period = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`

  const cnt = async (table: string, build?: (q: any) => any): Promise<number> => {
    try {
      let q = admin.from(table).select('id', { count: 'exact', head: true })
      if (build) q = build(q)
      const { count } = await q
      return count ?? 0
    } catch { return 0 }
  }

  const inMonth = (q: any) => q.gte('created_at', startIso).lt('created_at', endIso)

  const [newVendors, approvedVendors, newRequests, newOffers, acceptedOffers, newReports, newOrganizers, totalVendors] = await Promise.all([
    cnt('dienstleister_profiles', q => inMonth(q).eq('is_marketplace', true)),
    cnt('dienstleister_profiles', q => q.eq('is_marketplace', true).eq('moderation_status', 'approved')),
    cnt('marketplace_requests', inMonth),
    cnt('vendor_offers', q => inMonth(q).neq('status', 'draft')),
    cnt('vendor_offers', q => inMonth(q).eq('status', 'accepted')),
    cnt('vendor_reports', inMonth),
    cnt('profiles', q => inMonth(q).eq('role', 'veranstalter')),
    cnt('dienstleister_profiles', q => q.eq('is_marketplace', true)),
  ])

  const row = (label: string, value: number | string) =>
    `<tr><td style="padding:5px 0;border-bottom:1px solid #f0ece4;color:#555">${label}</td><td style="padding:5px 0;border-bottom:1px solid #f0ece4;text-align:right;font-weight:700">${value}</td></tr>`

  const bodyHtml = `
    <tr><td style="padding:4px 0 12px">Zusammenfassung der Plattform-Aktivitäten für <strong>${monthLabel(start)}</strong>:</td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
        ${row('Neue Dienstleister', newVendors)}
        ${row('Neue Marktplatz-Anfragen', newRequests)}
        ${row('Erstellte Angebote', newOffers)}
        ${row('Angenommene Angebote', acceptedOffers)}
        ${row('Neue Anbieter-Meldungen', newReports)}
        ${row('Neue Veranstalter', newOrganizers)}
        ${row('Freigegebene Anbieter (gesamt)', `${approvedVendors} / ${totalVendors}`)}
      </table>
    </td></tr>`

  return {
    period,
    subject: `Forevr Monats-Report · ${monthLabel(start)}`,
    heading: `Aktivitäts-Report ${monthLabel(start)}`,
    bodyHtml,
    ctaLabel: 'Zum Admin-Dashboard', ctaUrl: `${APP_URL}/admin`,
  }
}

/** Versendet den Monats-Report einmal pro Periode (idempotent via admin_notification_log). */
export async function maybeSendMonthlyReport(admin: SupabaseClient, ref: Date = new Date()): Promise<boolean> {
  // Nur am 1. eines Monats auslösen.
  if (ref.getUTCDate() !== 1) return false
  try {
    const report = await buildMonthlyReport(admin, ref)
    // Idempotenz: Log-Zeile für (monthly_report, period) einfügen; Konflikt = schon gesendet.
    const { error } = await admin.from('admin_notification_log').insert({ kind: 'monthly_report', period: report.period })
    if (error) return false
    await notifyAdmins(admin, 'monthly_report', report)
    return true
  } catch (err) {
    console.error('[Forevr] maybeSendMonthlyReport failed (ignored):', err)
    return false
  }
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
