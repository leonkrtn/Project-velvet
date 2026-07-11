// Server-only: Katalog aller automatisch versendeten Mails als BEISPIEL-Rendern
// für die Admin-„Testen"-Seite. Jede Funktion erzeugt reine Dummy-Inhalte und
// versendet keine echten Datensätze (keine Tokens, keine Chat-Nachrichten).
// Ziel: prüfen, ob der Mailserver läuft und jede Vorlage sauber ankommt.
import 'server-only'
import { emailLayout } from '@/lib/email/notify'
import { buildRequestExcel } from '@/lib/vendor/request-excel'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://project-velvet.vercel.app').replace(/\/$/, '')

export type TestMailCategory = 'admin' | 'vendor' | 'couple' | 'guest'

export interface TestMailBuilt { subject: string; html: string; attachments?: { filename: string; content: Buffer }[] }
export interface TestMailDef {
  key: string
  category: TestMailCategory
  label: string
  description: string
  build: () => Promise<TestMailBuilt> | TestMailBuilt
}

const SAMPLE_BRAND = { color: '#B89968', name: 'Blumen Sonnenschein' }
const money = (n: number) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export const TEST_MAIL_CATEGORIES: { key: TestMailCategory; label: string }[] = [
  { key: 'admin',  label: 'Admin-Benachrichtigungen' },
  { key: 'vendor', label: 'Dienstleister-Mails' },
  { key: 'couple', label: 'Brautpaar-Mails' },
  { key: 'guest',  label: 'Gast & Einladungen' },
]

export const TEST_MAILS: TestMailDef[] = [
  // ── Admin-Benachrichtigungen ──────────────────────────────────────────────
  {
    key: 'admin_vendor_signup', category: 'admin', label: 'Neuer Dienstleister',
    description: 'Benachrichtigung bei Neuregistrierung eines Dienstleisters.',
    build: () => ({
      subject: '[TEST] Neuer Dienstleister: Blumen Sonnenschein',
      html: emailLayout({
        heading: 'Neuer Dienstleister registriert',
        bodyHtml: `<tr><td style="padding:4px 0"><strong>Blumen Sonnenschein</strong> hat sich neu auf dem Marktplatz registriert.</td></tr>
          <tr><td style="padding:6px 0 10px;color:#666">Kategorie: Floristik · kontakt@blumen-sonnenschein.de</td></tr>`,
        ctaLabel: 'Im Admin öffnen', ctaUrl: `${APP_URL}/admin`,
      }),
    }),
  },
  {
    key: 'admin_vendor_submit', category: 'admin', label: 'Profil zur Prüfung',
    description: 'Ein Dienstleister reicht sein Profil zur Freigabe ein.',
    build: () => ({
      subject: '[TEST] Zur Prüfung: Blumen Sonnenschein',
      html: emailLayout({
        heading: 'Profil zur Erstprüfung eingereicht',
        bodyHtml: `<tr><td style="padding:4px 0"><strong>Blumen Sonnenschein</strong> hat sein Profil zur Freigabe eingereicht.</td></tr>
          <tr><td style="padding:6px 0 10px;color:#666">Kategorie: Floristik</td></tr>`,
        ctaLabel: 'Jetzt prüfen', ctaUrl: `${APP_URL}/admin`,
      }),
    }),
  },
  {
    key: 'admin_vendor_report', category: 'admin', label: 'Anbieter-Meldung',
    description: 'Eine Beschwerde-/Missbrauchs-Meldung zu einem Anbieter.',
    build: () => ({
      subject: '[TEST] Neue Meldung zu Blumen Sonnenschein',
      html: emailLayout({
        heading: 'Neue Anbieter-Meldung',
        bodyHtml: `<tr><td style="padding:4px 0">Zu <strong>Blumen Sonnenschein</strong> ist eine Meldung eingegangen.</td></tr>
          <tr><td style="padding:6px 0 4px;color:#666">Grund: <strong>Falsche Angaben</strong></td></tr>
          <tr><td style="padding:2px 0 10px;color:#666">„Die angegebene Adresse stimmt nicht."</td></tr>`,
        ctaLabel: 'Meldung ansehen', ctaUrl: `${APP_URL}/admin`,
      }),
    }),
  },
  {
    key: 'admin_organizer_request', category: 'admin', label: 'Neuer Veranstalter-Antrag',
    description: 'Ein Veranstalter registriert sich und wartet auf Freischaltung.',
    build: () => ({
      subject: '[TEST] Neuer Veranstalter-Antrag: Eventwerk GmbH',
      html: emailLayout({
        heading: 'Neuer Veranstalter wartet auf Freischaltung',
        bodyHtml: `<tr><td style="padding:4px 0"><strong>Eventwerk GmbH</strong> hat sich registriert und wartet auf die Freischaltung.</td></tr>
          <tr><td style="padding:6px 0 10px;color:#666">team@eventwerk.de</td></tr>`,
        ctaLabel: 'Freischalten', ctaUrl: `${APP_URL}/admin`,
      }),
    }),
  },
  {
    key: 'admin_monthly_report', category: 'admin', label: 'Monatlicher Report',
    description: 'Monatliche Zusammenfassung der Anwendungsaktivitäten.',
    build: () => {
      const row = (label: string, value: number | string) =>
        `<tr><td style="padding:5px 0;border-bottom:1px solid #f0ece4;color:#555">${label}</td><td style="padding:5px 0;border-bottom:1px solid #f0ece4;text-align:right;font-weight:700">${value}</td></tr>`
      return {
        subject: '[TEST] Forevr Monats-Report · Beispielmonat',
        html: emailLayout({
          heading: 'Aktivitäts-Report (Beispiel)',
          bodyHtml: `<tr><td style="padding:4px 0 12px">Zusammenfassung der Plattform-Aktivitäten (Beispieldaten):</td></tr>
            <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
              ${row('Neue Dienstleister', 12)}
              ${row('Neue Marktplatz-Anfragen', 84)}
              ${row('Erstellte Angebote', 57)}
              ${row('Angenommene Angebote', 23)}
              ${row('Neue Anbieter-Meldungen', 2)}
              ${row('Neue Veranstalter', 6)}
              ${row('Freigegebene Anbieter (gesamt)', '48 / 61')}
            </table></td></tr>`,
          ctaLabel: 'Zum Admin-Dashboard', ctaUrl: `${APP_URL}/admin`,
        }),
      }
    },
  },

  // ── Dienstleister-Mails ───────────────────────────────────────────────────
  {
    key: 'vendor_offer_accepted', category: 'vendor', label: 'Angebot angenommen',
    description: 'Das Brautpaar hat ein Angebot verbindlich angenommen.',
    build: () => ({
      subject: '[TEST] Angebot angenommen: Blumenschmuck Komplett',
      html: emailLayout({
        heading: 'Euer Angebot wurde angenommen',
        bodyHtml: `<tr><td style="padding:4px 0">Das Brautpaar hat das Angebot <strong>„Blumenschmuck Komplett"</strong> über <strong>${money(2450)}</strong> verbindlich angenommen (Familie Mustermann).</td></tr>
          <tr><td style="padding:8px 0 12px;color:#666">Damit gilt der Auftrag als bestätigt.</td></tr>`,
        ctaLabel: 'Im Portal öffnen', ctaUrl: `${APP_URL}/vendor/angebote`,
      }),
    }),
  },
  {
    key: 'vendor_offer_declined', category: 'vendor', label: 'Angebot abgelehnt',
    description: 'Das Brautpaar hat ein Angebot abgelehnt.',
    build: () => ({
      subject: '[TEST] Angebot abgelehnt: Blumenschmuck Komplett',
      html: emailLayout({
        heading: 'Euer Angebot wurde abgelehnt',
        bodyHtml: `<tr><td style="padding:4px 0">Das Brautpaar hat das Angebot <strong>„Blumenschmuck Komplett"</strong> leider abgelehnt.</td></tr>`,
        ctaLabel: 'Im Portal öffnen', ctaUrl: `${APP_URL}/vendor/angebote`,
      }),
    }),
  },
  {
    key: 'vendor_reminder', category: 'vendor', label: 'Event-Erinnerung',
    description: 'Automatische Erinnerung vor einem gebuchten Event.',
    build: () => ({
      subject: '[TEST] Erinnerung: Hochzeit Mustermann steht bevor',
      html: emailLayout({
        heading: 'Bevorstehendes Event',
        bodyHtml: `<tr><td style="padding:4px 0">Erinnerung: <strong>Hochzeit Mustermann</strong> findet am <strong>2026-08-15</strong> statt.</td></tr>`,
        ctaLabel: 'Im Portal ansehen', ctaUrl: `${APP_URL}/vendor/ubersicht`,
      }),
    }),
  },
  {
    key: 'vendor_followup_lead', category: 'vendor', label: 'Inaktiver Lead',
    description: 'Hinweis auf einen länger inaktiven Lead im CRM.',
    build: () => ({
      subject: '[TEST] Lead nachfassen: Familie Beispiel',
      html: emailLayout({
        heading: 'Inaktiver Lead',
        bodyHtml: `<tr><td style="padding:4px 0"><strong>Familie Beispiel</strong> hat sich seit mehr als 14 Tagen nicht mehr gemeldet. Ein kurzes Nachfassen könnte sich lohnen.</td></tr>`,
        ctaLabel: 'Im CRM ansehen', ctaUrl: `${APP_URL}/vendor/crm`,
      }),
    }),
  },
  {
    key: 'vendor_new_request', category: 'vendor', label: 'Neue Anfrage (mit Excel)',
    description: 'Neue Marktplatz-Anfrage inkl. Excel-Anhang der Angaben.',
    build: async () => {
      const excel = await buildRequestExcel({
        vendorName: 'Blumen Sonnenschein',
        requestUrl: `${APP_URL}/vendor/anfragen`,
        standardInfo: { coupleName: 'Familie Mustermann', date: '2026-08-15', guestCount: 80, location: 'Schloss Beispiel, Musterstadt', postalCode: '12345', eventType: 'hochzeit' },
        message: 'Wir wünschen uns eine sommerliche Blumendeko in Weiß und Eukalyptus.',
        budget: 2500,
        answers: [
          { questionId: '1', sectionTitle: 'Rahmen', label: 'Stil', type: 'single', value: 'boho', display: 'Boho / Natürlich' },
          { questionId: '2', sectionTitle: 'Umfang', label: 'Anzahl Tischgestecke', type: 'number', value: 8, display: '8' },
        ],
      })
      return {
        subject: '[TEST] Neue Anfrage über Forevr von Familie Mustermann',
        html: emailLayout({
          heading: 'Neue Anfrage eingegangen',
          bodyHtml: `<tr><td style="padding:4px 0">Ihr habt eine neue Anfrage über den Forevr-Marktplatz erhalten. Alle Angaben findet ihr im Dashboard und zusätzlich als Excel-Export im Anhang dieser Mail.</td></tr>`,
          ctaLabel: 'Anfrage im Dashboard ansehen', ctaUrl: `${APP_URL}/vendor/anfragen`,
        }),
        attachments: [{ filename: 'forevr-anfrage-test.xlsx', content: excel }],
      }
    },
  },

  // ── Brautpaar-Mails ───────────────────────────────────────────────────────
  {
    key: 'couple_offer_released', category: 'couple', label: 'Neues Angebot',
    description: 'Ein Dienstleister hat dem Brautpaar ein Angebot bereitgestellt.',
    build: () => ({
      subject: '[TEST] Neues Angebot von Blumen Sonnenschein',
      html: emailLayout({
        brand: SAMPLE_BRAND,
        heading: 'Ihr habt ein neues Angebot erhalten',
        bodyHtml: `<tr><td style="padding:4px 0">Blumen Sonnenschein hat euch das Angebot <strong>„Blumenschmuck Komplett"</strong> über <strong>${money(2450)}</strong> bereitgestellt.</td></tr>
          <tr><td style="padding:8px 0 12px;color:#666">Im Portal könnt ihr es prüfen, als PDF speichern und verbindlich annehmen.</td></tr>`,
        ctaLabel: 'Angebot ansehen', ctaUrl: `${APP_URL}/brautpaar`,
      }),
    }),
  },
  {
    key: 'couple_followup_offer', category: 'couple', label: 'Angebots-Nachfrage',
    description: 'Automatisches Follow-up zu einem offenen Angebot.',
    build: () => ({
      subject: '[TEST] Habt ihr noch Fragen zu eurem Angebot?',
      html: emailLayout({
        brand: SAMPLE_BRAND,
        heading: 'Kurze Nachfrage zu eurem Angebot',
        bodyHtml: `<tr><td style="padding:4px 0">wir wollten uns kurz melden: Habt ihr Fragen zu unserem Angebot über <strong>${money(2450)}</strong>? Wir helfen gern weiter.</td></tr>`,
        ctaLabel: 'Angebot ansehen', ctaUrl: `${APP_URL}/brautpaar`,
      }),
    }),
  },
  {
    key: 'couple_review_invite', category: 'couple', label: 'Bewertungs-Einladung',
    description: 'Einladung an das Brautpaar, den Dienstleister zu bewerten.',
    build: () => ({
      subject: '[TEST] Wie war eure Erfahrung mit Blumen Sonnenschein?',
      html: emailLayout({
        brand: SAMPLE_BRAND,
        heading: 'Wir freuen uns über eure Bewertung',
        bodyHtml: `<tr><td style="padding:4px 0">vielen Dank für die schöne Zusammenarbeit! Eure Rückmeldung hilft uns sehr — es dauert nur eine Minute.</td></tr>`,
        ctaLabel: 'Jetzt bewerten', ctaUrl: `${APP_URL}/review/beispiel-token`,
      }),
    }),
  },

  // ── Gast & Einladungen ────────────────────────────────────────────────────
  {
    key: 'guest_rsvp_confirm', category: 'guest', label: 'RSVP-Bestätigung',
    description: 'Bestätigung mit persönlichem Link nach der Gäste-Anmeldung.',
    build: () => ({
      subject: '[TEST] Eure Anmeldung zur Hochzeit ist bestätigt',
      html: emailLayout({
        heading: 'Schön, dass ihr dabei seid!',
        bodyHtml: `<tr><td style="padding:4px 0">eure Anmeldung wurde gespeichert. Über euren persönlichen Link könnt ihr eure Angaben jederzeit anpassen.</td></tr>`,
        ctaLabel: 'Zu meinen Angaben', ctaUrl: `${APP_URL}/wedding/beispiel/rsvp`,
      }),
    }),
  },
  {
    key: 'invite_code', category: 'guest', label: 'Einladung (Code)',
    description: 'Einladungs-Mail mit Beitrittscode (Brautpaar/Veranstalter/Partner).',
    build: () => ({
      subject: '[TEST] Du wurdest zu einem Forevr-Event eingeladen',
      html: emailLayout({
        heading: 'Deine Einladung',
        bodyHtml: `<tr><td style="padding:4px 0">Du wurdest zu einem Event auf Forevr eingeladen. Nutze den folgenden Code, um beizutreten:</td></tr>
          <tr><td style="padding:6px 0 10px"><span style="font-family:monospace;font-size:18px;font-weight:700;letter-spacing:0.1em">ABCD-1234</span></td></tr>`,
        ctaLabel: 'Jetzt beitreten', ctaUrl: `${APP_URL}/join`,
      }),
    }),
  },
  {
    key: 'invite_vendor', category: 'guest', label: 'Einladung Dienstleister',
    description: 'Einladung eines Dienstleisters zu einem Event.',
    build: () => ({
      subject: '[TEST] Ihr wurdet als Dienstleister eingeladen',
      html: emailLayout({
        heading: 'Einladung als Dienstleister',
        bodyHtml: `<tr><td style="padding:4px 0">Ihr wurdet eingeladen, ein Event auf Forevr als Dienstleister zu begleiten. Mit dem Code unten könnt ihr beitreten:</td></tr>
          <tr><td style="padding:6px 0 10px"><span style="font-family:monospace;font-size:18px;font-weight:700;letter-spacing:0.1em">DL-5678</span></td></tr>`,
        ctaLabel: 'Zum Beitritt', ctaUrl: `${APP_URL}/vendor/join`,
      }),
    }),
  },
]

export function testMailByKey(key: string): TestMailDef | undefined {
  return TEST_MAILS.find(m => m.key === key)
}
