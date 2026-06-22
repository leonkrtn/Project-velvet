# Angebots-Workspace für Dienstleister — Deploy & Runbook

Eigenständiger Angebots-/Vertrags-Bereich im Event-Sidemenü des Dienstleisters
(neben Kommunikation & Informationen) plus Brautpaar-Gegenstück
("Angebote & Verträge"). Ersetzt das beengte Inline-Angebot in der
Marktplatz-Anfrage durch einen Vollbild-Editor mit Versionierung, Bausteinen,
Anzahlung/Zahlungsplan und verbindlicher Annahme mit AGB-Bestätigung.

## Go-Live-Schritte (Supabase, schreibt in Produktion)

### 1. Migration anwenden
`supabase/migrations/0112_vendor_offers_workspace.sql`

- Entkoppelt `vendor_offers` von der 1:1-Anfrage (`request_id` optional,
  nicht mehr UNIQUE) → mehrere Angebote/Varianten/Nachträge pro Event.
- Neue Spalten: `title`, `version`, `parent_offer_id`, `conversation_id`,
  `created_by`, `deposit_*`, `payment_terms`, `balance_due_note`,
  `agb_text`/`agb_required`, `accepted_by_name`/`agb_accepted_at`.
- Status um `superseded` erweitert.
- Neue Tabelle `vendor_offer_blocks` (eigene Bausteinbibliothek, RLS owner-only).
- Idempotent & rein additiv — gefahrlos mehrfach anwendbar.

Anwenden via Supabase-Pipeline/CLI (`supabase db push`) oder MCP
`apply_migration`. **Bis dahin liefern die neuen `/api/vendor/event-offers`-
und `/api/couple/offers`-Routen 500er** (Spalten/Tabelle fehlen).

> Hinweis: `messages.message_type = 'offer'` kommt bereits aus 0111.

### 2. E-Mail-Benachrichtigung (Edge Function)
`supabase/functions/notify-email/`

Versand läuft **über den in Supabase hinterlegten SMTP-Server** (dieselben
Zugangsdaten wie für die Auth-Mails) via Deno-SMTP-Client (`denomailer`) —
kein Drittanbieter-API-SDK.

```bash
supabase functions deploy notify-email
# = eure Supabase-SMTP-Einstellungen:
supabase secrets set SMTP_HOST=smtp.example.com SMTP_PORT=465 \
  SMTP_USER=... SMTP_PASS=... EMAIL_FROM="Forevr <noreply@forevr.app>"
```

- Port 465 = implizites TLS, 587/25 = STARTTLS.
- Ohne gesetzte SMTP-Secrets ist die Function ein **No-Op**
  (`{ skipped: true }`) — Chat-Karte + Portal-Badge funktionieren trotzdem,
  nur ohne Mail.
- Aufruf erfolgt serverseitig best-effort via `admin.functions.invoke`
  (`lib/email/notify.ts`); Mail-Fehler blockieren den App-Flow nie.
- Die Edge Function ist Deno-Code und vom Next-Typecheck ausgeschlossen
  (`tsconfig.json` → `exclude`), analog zum Cloudflare-Worker.

## Flow

**Dienstleister:** Event → *Angebote* → *Neues Angebot* (aus Preislogik
vorbefüllt oder leer) → Positionen via Gewerk-Bausteinen/eigener Bibliothek,
Typen Menge/Pauschale/Rabatt/optional → Anzahlung + Zahlungsplan + AGB →
*Freigeben & senden*. Änderungen nach Freigabe = *Neue Version*.

**Brautpaar:** *Angebote* → Detail → optionale Positionen wählen → Name +
AGB-Häkchen → *Verbindlich annehmen*. PDF beidseitig.

**Benachrichtigung:** Chat-Karte (`message_type='offer'`) + E-Mail
(Release → Brautpaar, Annahme/Ablehnung → Dienstleister) + Badge über die
Status-Listen.

## Relevante Dateien
- DB: `supabase/migrations/0112_vendor_offers_workspace.sql`, `supabase/functions/notify-email/`
- Logik: `lib/vendor/{pricing,offer-blocks,offer-service,offer-notify}.ts`, `lib/email/notify.ts`
- Vendor-API: `app/api/vendor/event-offers/**`, `app/api/vendor/offer-blocks/**`
- Couple-API: `app/api/couple/offers/**`
- Vendor-UI: `app/vendor/dashboard/[eventId]/angebote/**`, `components/vendor/OfferEditorFull.tsx`
- Couple-UI: `app/brautpaar/[eventId]/angebote/**`
