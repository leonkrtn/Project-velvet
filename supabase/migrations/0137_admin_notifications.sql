-- Admin-Benachrichtigungen: konfigurierbare Empfänger-Adressen + pro-Typ-Toggle.
-- Wer bekommt welche Art von Admin-Mail (neuer Dienstleister, Profil zur Prüfung,
-- Anbieter-Meldung, Veranstalter-Antrag, monatlicher Aktivitäts-Report).
--
-- Zugriff ausschließlich über die Service-Role-APIs unter /api/admin/notifications
-- (dort wird profiles.is_admin geprüft). RLS ist aktiv OHNE User-Policy → die
-- Tabellen sind für normale Clients gesperrt.

create table if not exists public.admin_notification_recipients (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  label       text,
  enabled     boolean not null default true,
  -- Map Benachrichtigungstyp -> bool. Fehlt ein Key, gilt er als aus.
  -- Keys: monthly_report, vendor_signup, vendor_submit, vendor_report, organizer_request
  types       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create unique index if not exists admin_notification_recipients_email_key
  on public.admin_notification_recipients (lower(email));

alter table public.admin_notification_recipients enable row level security;
-- Bewusst keine Policy: nur Service-Role (Admin-APIs) darf lesen/schreiben.

-- Idempotenz-Log für zeitgesteuerte Admin-Mails (z. B. Monats-Report einmal je Periode).
create table if not exists public.admin_notification_log (
  id       uuid primary key default gen_random_uuid(),
  kind     text not null,
  period   text not null,          -- z. B. '2026-07' für den Monats-Report
  sent_at  timestamptz not null default now(),
  unique (kind, period)
);

alter table public.admin_notification_log enable row level security;
-- Bewusst keine Policy: nur Service-Role.
