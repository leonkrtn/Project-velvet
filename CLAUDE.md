# Forevr – Claude Code Context

> Auto-loaded by Claude Code at session start. Keep up to date when schema or architecture changes.
> Detailed references: [DATABASE](docs/DATABASE.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [KNOWN_ISSUES](docs/KNOWN_ISSUES.md)

---

## ⚠️ AGB-Pflichthinweis (CRM)

Das CRM-System speichert automatisch Kundendaten aus Marktplatz-Anfragen, angenommenen Angeboten und verknüpften Events:
- Name, E-Mail, Telefon, Adresse
- Hochzeitsdatum / Veranstaltungsdatum
- Anfrage-Nachricht des Brautpaars
- Budget/Umsatz-Informationen
- Gästezahl (Snapshot zum Import-Zeitpunkt)

**TODO für Rechtsabteilung / AGB-Update:**
In den AGB des Dienstleisters (und ggf. der Forevr-Plattform-AGB) muss explizit erwähnt werden:
- Welche Kundendaten im CRM gespeichert werden und woher sie stammen (Plattform-Anfragen, Angebote)
- Zweck der Verarbeitung (Kundenverwaltung, Folge-Kommunikation)
- Aufbewahrungsdauer und Löschung auf Anfrage (DSGVO Art. 17)
- Dass Brautpaar-Kontaktdaten (inkl. Telefon) nach Annahme einer Anfrage an den Dienstleister weitergegeben werden

---

## ⚠️ Branding: Forevr (ehemals Velvet)

- Der Produktname ist **Forevr** — im UI als Wordmark **FOREVR** (Cormorant Garamond, Letterspacing ~0.16em, Großbuchstaben), im Fließtext **Forevr**, Tarife **Forevr** / **Forevr Pro**.
- Der alte Name "Velvet" darf in neuem Code, UI-Texten, Doku und Kommentaren **nie wieder verwendet werden**.
- Ausnahme — bestehende technische Bezeichner bleiben bewusst `velvet*` und dürfen NICHT umbenannt werden (Nutzerdaten/Infrastruktur):
  - localStorage/sessionStorage-Keys: `velvet_event_v3`, `velvet_display`, `velvet_dashboard_tab`, `velvet_current_path`, `velvet_back_target`
  - Window-Events: `velvet-saved`, `velvet-tab-change`
  - Cloudflare Worker `velvet-file-service` + R2-Bucket `velvet-files` (`wrangler.toml`)
  - Vercel-Deployment `project-velvet.vercel.app` (Einladungstexte in `MitgliederClient.tsx`)
- Vollständige Rebranding-Inventur: `analysis/velvet-name-occurrences.md`

---

## UI Conventions

- **No emojis** — use Lucide React icons everywhere instead (already a dependency)
- Icons are the only decorative elements in UI; never use emoji as icons, bullets, or decorations

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Server + Client Components) |
| Auth / DB / Storage | Supabase (PostgreSQL, Auth, Realtime, Edge Functions, Storage) |
| File Storage | Cloudflare R2 (never public) + Cloudflare Worker (`workers/file-service/`) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Icons | Lucide React |

---

## User Roles (ENUM `user_role`)

| Role | Description |
|---|---|
| `veranstalter` | Event organizer — full admin over their events |
| `brautpaar` | Couple — curated subset of editing rights |
| `brautpaar_solo` | Standalone couple without organizer — `is_event_member()` maps it to veranstalter AND brautpaar (full RLS cascade, migrations 0086–0089) |
| `trauzeuge` | Best man/maid of honor — limited read + some edit |
| `dienstleister` | Vendor/service provider — permission-gated access |

### Solo-Brautpaar Flow (App ohne Veranstalter)

- **Signup:** `/signup/brautpaar` (public, no invite code) → `supabase.auth.signUp` with `user_metadata.signup_role='brautpaar_solo'` → RPC `create_event_as_brautpaar_solo()` creates exactly ONE event (idempotent — returns existing event if the user already has a brautpaar_solo membership). Helper: `lib/brautpaar-solo.ts` (`ensureSoloEvent`).
- **E-Mail-Confirmation fallback:** if no session after signUp, event creation happens later via login fallback (`app/login/page.tsx`) or the `/brautpaar` root page (both call `ensureSoloEvent` from user metadata).
- **Portal:** solo couples use the regular Brautpaar portal (`/brautpaar/[eventId]/`); layout/middleware/pages accept role `brautpaar_solo`.
- **Personen einladen (Allgemein → `SoloInviteSection`):** zeigt verbundene Personen (Partner, Veranstalter via `GET /api/members`) und generiert Codes via `POST /api/invite/create`. Partner-Invite (`targetRole:'brautpaar_solo'`) gibt vollen Admin-Zugriff. Veranstalter-Onboarding (`targetRole:'veranstalter'`): ein registrierter UND freigeschalteter Veranstalter löst den Code unter `/join` ein (`redeem_invite_code` verlangt `is_approved_organizer`, Migration 0089) und sieht das Event danach in seinem Dashboard. Das Solo-Paar kann den Veranstalter wieder entfernen (`DELETE /api/members/[memberId]` — der Letzter-Veranstalter-Schutz greift nicht, solange ein brautpaar_solo-Admin existiert).
- **Invite-Matrix** in `/api/invite/create`: veranstalter→brautpaar, brautpaar_solo→veranstalter, brautpaar_solo→brautpaar_solo.
- **Vendors:** brautpaar_solo darf Dienstleister einladen (`/api/invite/dienstleister`, `/api/vendor/invite`, `/api/vendor/signup-code`).
- **Dienstleister-Verwaltung (nur Solo):** `/brautpaar/[eventId]/dienstleister/` — Vendor-Liste + Einladung (`VendorInviteSection`) + Berechtigungs-Editor unter `[dienstleisterId]/` (re-used `BerechtigungenDLClient` mit `backHref`-Prop). Nav-Eintrag erscheint nur für brautpaar_solo (`BrautpaarShell isSolo`).
- **Sitzplan (Solo):** Solo-Paare können die Raumkonfiguration selbst bearbeiten (`RaumKonfigurator` in `/brautpaar/[eventId]/sitzplan`, RLS via 0090); normales Brautpaar bleibt read-only.
- **API-Parität:** brautpaar_solo ist zusätzlich erlaubt in: `PATCH /api/events/[eventId]`, `PATCH /api/files/[fileId]` (Sichtbarkeit), `/api/veranstalter/[eventId]/guests/{export,import,template}`.
- **Migration 0090** (`0090_brautpaar_solo_parity.sql`): event_room_configs-Write + dienstleister_permissions-Manage über `is_event_member()` (matcht solo), organizer_room_configs-Read inkl. brautpaar_solo, `create_event_as_brautpaar_solo()` v3 mit Advisory-Lock + feature_toggles-Defaults (Spiegel von `DEFAULT_FEATURE_TOGGLES` in `lib/store.ts` — bei Änderung dort nachziehen!) + Backfill für bestehende Solo-Events.
- `/join` (public route) — generic `invite_codes` redemption page for logged-in users; logged-out users are sent to login/signup with the code preserved.
- `/signup/veranstalter` (public) — Self-Service-Registrierung für Veranstalter (Footer-Link auf Landing Page); startet mit `is_approved_organizer=false` → `/veranstalter/pending` bis zur Freischaltung.

---

## Route Structure

```
/                          → Landing page (public)
/login, /signup            → Auth (public)
/signup/brautpaar          → Solo-Brautpaar signup, no code needed (public)
/join                      → Join event by code — invite_codes redemption for logged-in users (public)
/auth/callback             → Supabase OAuth callback (public)

/veranstalter/             → Organizer hub (requires is_approved_organizer)
  dashboard/               → Event list
  [eventId]/
    allgemein/             → Event settings (title, venue, dates, costs)
    gaesteliste/           → Guest list
    sitzplan/              → Seating plan
    catering/              → Catering
    getraenke/             → Getränkeplanung (Mengenplanung, Budget, Cocktails)
    ablaufplan/            → Timeline
    musik/                 → Music (incl. playlist embeds: Spotify/YouTube/Apple Music)
    patisserie/            → Patisserie / cake
    medien/                → Media / shots
    dateien/               → File management (R2-backed, all modules)
    chats/                 → Conversations
    dienstleister/         → Vendor list for event
    berechtigungen/[id]/   → Vendor permission editor
    budget/                → Budget tracker

/mitarbeiter/             → Staff portal (requires app_metadata.role='mitarbeiter')
  change-password/        → Forced password change on first login
  [eventId]/
    schichtplan/          → Mobile shift view: shifts by day, break warnings, swap requests, backup person

/brautpaar/[eventId]/     → Couple portal
  dateien/                → File management (R2-backed)
  getraenke/              → Getränkeplanung (same component as veranstalter, mode="brautpaar")
  notizen/                → Notizen (auto-save notes, text/checklist, categories)
  musik/                  → Musik (incl. playlist embeds)
⛔ /trauzeuge/            → Role exists in DB but no frontend portal implemented
/vendor/dashboard/[eventId]/ → Vendor portal — REDESIGNED (migration 0105): communication-first, only 2 nav items
  kommunikation/           → Chat (text + file attachments via R2) + "Geteilte Daten"-Box (data shares) + "Dateien"-Box (chat files)
  informationen/           → Standard event info (name, date, venue, guest count, couple/organizer contacts incl. phone)
                             + interne Notizen (privat pro Dienstleister-Firma, dienstleister_notes)
  ⛔ uebersicht, catering, chats, ablaufplan, gaesteliste, musik, medien, sitzplan, files, tabs/
                            → REMOVED. Module data is no longer browsed via tabs; the couple/organizer shares it
                              into the chat as a snapshot or live box (see "Vendor Data Sharing" below).
```

### Vendor Data Sharing (migration 0105) — replaces tab-gated vendor access
- Couple/Veranstalter share a module's data into a conversation via the chat composer ("Daten teilen"):
  **snapshot** (frozen `snapshot` JSONB) or **live** (rebuilt on each read). Each share posts a `data_share`
  message and a row in `dienstleister_data_shares` (keyed by `conversation_id`; RLS = conversation participants read,
  couple/organizer write). They can later **freeze** or **revoke** a share.
- Snapshots are built server-side by `lib/vendor/snapshot.ts` (`buildModuleSnapshot`, admin client, all 8 modules),
  rendered by `components/vendor/ShareBox.tsx`. APIs: `POST/GET /api/vendor/shares`, `GET/PATCH /api/vendor/shares/[shareId]`.
- Chat files: existing R2 pipeline with `file_metadata.module='chats'` (now accessible to any event member, see
  `lib/files/permissions.ts`). File messages carry `metadata.file_id`; the "Dateien"-Box lists them per conversation.
- `messages.message_type` ('text'|'file'|'data_share') + `messages.metadata` JSONB added in 0105.
- The legacy `dienstleister_permissions` tab system is **no longer used for the vendor dashboard** (kept in DB; the
  Berechtigungen editor UI is dead for the new flow).
- Invitations are enriched (event key-data + couple contact). `get_invitation_preview(code)` (SECURITY DEFINER,
  anon-callable) powers the `/vendor/join` preview; couple **phone** is withheld until the vendor accepts.

---

## Permission System (Vendor Tabs)

> **Hinweis (Stand 2026-07):** `VendorSidebarLayout.tsx` existierte für die alte,
> tab-basierte Vendor-Sidebar und wurde als toter Code entfernt (nie mehr importiert
> seit dem Vendor-Redesign in Migration 0105 — siehe „Vendor Data Sharing" oben).
> Beide unten beschriebenen Permission-Systeme sind für die aktuelle Vendor-Oberfläche
> **Legacy** (Tabelle bleibt in der DB, aber keine UI liest sie mehr für Tab-Sichtbarkeit).

### NEW system (DB RLS enforced since migration 0042) — Legacy seit Migration 0105
- Table: `dienstleister_permissions` (columns: `event_id`, `dienstleister_user_id`, `tab_key TEXT`, `item_id TEXT|NULL`, `access: none|read|write`)
- Tab keys: `uebersicht`, `catering`, `chats`, `ablaufplan`, `gaesteliste`, `musik`, `patisserie`, `medien`, `sitzplan`
- `allgemein` is **explicitly blocked** — migration 0043 added a CHECK constraint (`tab_key <> 'allgemein'`) and purged existing rows
- Written by: `BerechtigungenClient.tsx` (permission editor UI, dead für den neuen Flow)
- Enforced by: `dl_has_tab_access()` SECURITY DEFINER function in all table RLS policies

### OLD system (Legacy, nicht mehr für Tab-Sichtbarkeit maßgeblich)
- Table: `permissions` (columns: `event_id`, `user_id`, `permission TEXT`)
- Keys: `mod_chat`, `mod_timeline`, `mod_timeline_read`, `mod_seating`, `mod_seating_read`, `mod_catering`, `mod_catering_read`, `mod_music`, `mod_music_read`, `mod_patisserie`, `mod_patisserie_read`, `mod_media`, `mod_media_read`, `mod_location`, `mod_guests`
- Still referenced by: `lib/store.ts`

---

## Permission Helper Functions (SECURITY DEFINER)

```sql
is_event_member(event_id UUID, roles user_role[]) → boolean
is_event_frozen(event_id UUID) → boolean
dl_has_tab_access(event_id UUID, tab_key TEXT, min_access TEXT) → boolean
dl_get_access(event_id UUID, dienstleister_user_id UUID, tab_key TEXT, item_id TEXT) → text
has_permission(event_id UUID, mod_key TEXT) → boolean  -- OLD system
join_event_by_code(code TEXT) → json
redeem_invite_code(code TEXT) → json
```

---

---

## Middleware Auth

`middleware.ts` — guards `/veranstalter/*`.

> **Hinweis (Stand 2026-06):** Der früher hier dokumentierte Approval-Bug
> (`isApproved === false && isApproved !== undefined`, immer `false`) ist behoben.
> Die Middleware prüft jetzt **autoritativ über die `profiles`-Tabelle**
> (`is_approved_organizer`) und funktioniert damit unabhängig vom Custom Access
> Token Hook — siehe `middleware.ts` Layer 3. Nicht freigeschaltete Nutzer werden
> deterministisch auf ihr Portal bzw. `/veranstalter/pending` umgeleitet.

**Wichtig:** Alle `/api/`-Routen werden von der Middleware als *public* behandelt
(Layer 1) — API-Routen müssen Authentifizierung/Autorisierung daher **selbst**
durchführen (siehe `app/api/events/[eventId]/cover/route.ts` als Vorbild).

---

## Key Database Tables (Quick Reference)

See [docs/DATABASE.md](docs/DATABASE.md) for full schema.

| Table | Purpose |
|---|---|
| `events` | Core event record |
| `event_members` | User ↔ Event role assignments |
| `profiles` | Extended user profile (name, email, is_approved_organizer, avatar_r2_key TEXT — R2 key, added by 0077) |
| `guests` | Wedding guests |
| `begleitpersonen` | Guest companions |
| `hotels` / `hotel_rooms` | Hotel logistics |
| `timeline_entries` | Schedule items (has `day_index INT` for multi-day support) |
| `ablaufplan_days` | Per-event day config (day_index, name, start_hour, end_hour) |
| `seating_tables` / `seating_assignments` | Seating plan (v2 — supports guests, begleitpersonen, brautpaar slots) |
| `catering_plans` | Catering configuration |
| `music_songs` / `music_requirements` | Music tab |
| `musik_playlisten` | Playlist links with embedded player (platform: spotify/youtube/apple_music/other) |
| `media_shot_items` / `media_uploads` | Media tab |
| `guest_photos` | Post-event guest photo gallery (R2-backed; `r2_key`, `guest_token`, `status`) |
| `patisserie_config` | Cake/patisserie tab |
| `conversations` / `messages` | Chat system |
| `budget_items` | Budget tracking |
| `vendors` | Generic vendor contacts |
| `dienstleister_profiles` | Vendor self-profiles |
| `event_dienstleister` | Event ↔ vendor link |
| `permissions` | OLD mod_* permission strings |
| `dienstleister_permissions` | NEW tab-level permissions |
| `dienstleister_item_permissions` | OLD item-level can_view/can_edit |
| `invite_codes` | Guest RSVP invite links |
| `event_invitations` | Vendor invite links |
| `organizer_room_configs` | Global room polygon (per organizer) |
| `organizer_seating_concepts` | Global seating templates per organizer (name, points, elements, table_pool JSONB). Applied per-event via Sitzplan dropdown (replace or merge). Managed in Konfiguration → Sitzplan tab. |
| `event_room_configs` | Per-event room polygon |
| `organizer_todos` | Organizer task list |
| `organizer_staff` | Organizer's team members (auth_user_id, must_change_password for staff login) |
| `personalplanung_shift_swaps` | Shift swap requests: from_staff_id → to_staff_id, status (pending/accepted/approved/rejected/cancelled) |
| `shift_time_logs` | Actual check-in/out times per shift (shift_id, staff_id, event_id, actual_start, actual_end, notes). RLS: organizer reads all for their staff; staff reads own. Written via `/api/staff/checkin`. |
| `event_organizer_costs` | Organizer's own cost items |
| `feature_toggles` | Per-event feature flags — columns: `event_id`, `key`, `enabled`, `value TEXT` (optional text metadata, e.g. ISO date for `gaeste-fotos-unlock-at`) |
| `organizer_settings` | Per-organizer config (migration 0078). Currently: `staff_chat_enabled BOOLEAN DEFAULT FALSE`. RLS: organizer full access; staff read-only. |
| `brautpaar_notes` | Brautpaar notes (category, title, content, note_type text/checklist, checklist_items JSONB). |
| `getraenke_kategorien` | Drink categories per event (name, color, sort_order). |
| `getraenke_artikel` | Drink items (kategorie_id, name, unit, amount_per_person, total_planned, price_per_unit). |
| `getraenke_cocktails` | Cocktails (name, is_alcoholic, planned_count, ingredients JSONB [{name,amount,unit}]). |

---

## Legacy / Dead Code

- `lib/store.ts` — complete localStorage data model (`velvet_event_v3`). Parallel to Supabase. Contains `SEED_EVENT` mock data, `loadEvent()`/`saveEvent()`. Many frontend pages still import from this.
- `band_tech_requirements`, `band_set_list` tables — superseded by `music_requirements` + `music_songs`, still in DB with no UI.
- `fotograf_schedule`, `fotograf_deliverables` tables — DB only, no UI.
- `messages.read_at` column — defined, never populated.
- `timeline_entries.responsibilities TEXT` — redundant with `assigned_staff`/`assigned_vendors`/`assigned_members` JSONB columns (added in 0025).
- `dienstleister_item_permissions` table — old granular system, not cleanly migrated out.
- Proposals/Vorschläge system — fully removed (migration 0048 drops all tables + functions). No UI remains.
- Dekorations-System — **vollständig entfernt**. Historie: `decor_setup_items`/`deko_wishes` (0064), Free-Canvas `deko_*`-Tabellen (0108), letzte Permission-Spalten `brautpaar_permissions.dekorationen` + `trauzeuge_permissions.can_manage_deko` (0109). Keine Reiter/Routen/Components/Datenmodelle/Feature-Toggles mehr vorhanden.

---

---

## Landing Page

`app/page.tsx` — Full Forevr landing page (client component, not a redirect).
- CSS in `app/landing.css` (scoped to `.landing-root`, prefixed `lp-*`)
- Images in `public/landing/` (hero.jpg, cta.jpg, photo-*.jpg, logo.png)
- Google Fonts (Cormorant Garamond + DM Sans) loaded in `app/layout.tsx`
- CTA buttons call `getRedirectUrl()` — auth-aware, role-based routing:
  - Not logged in → `/login`
  - Veranstalter → `/veranstalter/events`
  - Brautpaar → `/brautpaar`
  - Dienstleister → `/vendor/dashboard/[eventId]/uebersicht`
  - Trauzeuge → `/trauzeuge/[eventId]` (portal not yet implemented)

---

## File Map (Critical Files)

```
app/
  page.tsx              Landing page (replaces old redirect-only page)
  landing.css           Landing page styles (scoped to .landing-root)

lib/
  store.ts              Legacy localStorage data model + event store
middleware.ts           Auth guard (has approval-check bug)

app/veranstalter/[eventId]/
  ablaufplan/AblaufplanClient.tsx      Orchestrator for calendar redesign. Manages days, entries, modal, drag callbacks.
                                       DaySettingsPopover: gear-icon popover per tab (name, start_hour, end_hour, delete).
                                       Passes role prop → DayCalendar readOnly for dienstleister.
  ablaufplan/page.tsx                  Server component — loads timeline_entries + ablaufplan_days
  allgemein/AllgemeinForm.tsx          Event settings form
  berechtigungen/[id]/BerechtigungenClient.tsx  Vendor permission editor (writes NEW system)
  sitzplan/page.tsx                    Seating plan — room config (3-step) + SitzplanEditor; "Konzept laden" button applies organizer_seating_concepts
  mitglieder/                          Route folder — UI label is "Beteiligte" (renamed from Mitglieder)

app/brautpaar/seating/page.tsx        Brautpaar seating — SitzplanEditor (reads room config from DB, no edit)

components/
  room/RaumKonfigurator.tsx            3-step room editor (1=Grundriss, 2=Raumdetails, 3=Tische)
                                       Exports: RaumPoint, RaumElement, RaumTablePool, RaumTableType, PlacedTablePreview
                                       table_pool.types[] = array of typed pools (multi-round + multi-rect supported)
                                       placedTables prop: toggleable seating_tables overlay on canvas
  sitzplan/SitzplanEditor.tsx          SVG seating editor: room polygon + filtered elements + tables with 0.5m chair buffer
                                       Table sizes fixed from pool type; only capacity + rotation editable in panel

app/vendor/dashboard/[eventId]/ — siehe „Route Structure" oben (kommunikation/, informationen/; alte
  Tab-Struktur inkl. VendorDashboardClient.tsx/VendorSidebarLayout.tsx wurde mit Migration 0105 entfernt)

app/veranstalter/[eventId]/
  SidebarLayout.tsx             Bottom icon bar: Profile avatar → /veranstalter/profil, Settings → /veranstalter/konfiguration, Logout.
                                Accepts userName + userAvatarUrl props (passed from layout.tsx; shows initials avatar if no picture).
  berechtigungen/[dienstleisterId]/BerechtigungenClient.tsx
                                Vendor permission editor — allgemein removed from tab list

components/ablaufplan/
  DayCalendar.tsx               Apple Calendar-style day view. HOUR_HEIGHT=80px/hr. Drag-to-create + drag-to-move.
                                CalendarEntry interface (shared). Overlap layout (greedy column assignment).
                                readOnly prop disables all interactions. NowLine shows current time.
  EventModal.tsx                Create/edit modal. Handles checklist (auto-save on toggle), assignments (auto-save).
                                Edit-mode toggle shows X buttons for checklist delete (Veranstalter/Brautpaar only).
                                Exports: TimelineEntry, AblaufplanDay, Member, StaffRow, VendorRow types.

supabase/migrations/
  setup.sql                     Base schema (all core tables)
  0040_unified_dienstleister_permissions.sql  NEW permission table
  0042_dienstleister_rls_write.sql           RLS using dl_has_tab_access
  0043_remove_allgemein_from_dienstleister.sql  Purges allgemein rows + CHECK constraint
  0044_seating_v2.sql           Replaces seating_tables/seating_assignments; adds table_pool to event_room_configs
  0045_seating_pool_type_id.sql Adds pool_type_id TEXT to seating_tables; updates table_pool default to {types:[]}
  0046_seating_dienstleister_rls.sql  Vendor SELECT on seating_tables, seating_assignments, room_configs via dl_has_tab_access sitzplan
  0047_seating_guest_names_rls.sql    Vendor with sitzplan access can read guests + begleitpersonen for name resolution
  0048_remove_proposals_system.sql    Drops all proposal/suggestion tables and their DB functions
  0049_secure_adjust_hotel_booking.sql  REVOKE anon/public on adjust_hotel_booking + auth guard
  0050_room_config_rls_brautpaar.sql    Brautpaar + trauzeuge SELECT on event_room_configs + organizer_room_configs
  0063_file_metadata.sql               R2 file_metadata table + file_access_log + RLS (SELECT only, writes via service role)
  0064_deko_system.sql                 (Historisch) Deko-System — vollständig wieder entfernt durch 0108.
  0065_conversation_read_state.sql     Read state for conversations
  0066_guest_photos_r2.sql             Extends guest_photos: adds r2_key, guest_token, status; refreshes RLS policies
  0067_feature_toggles_value.sql       Adds value TEXT column to feature_toggles (used for gaeste-fotos-unlock-at date)
  0069_file_visible_to_roles.sql       Adds visible_to_roles TEXT[] to file_metadata (NULL = all roles, set = restrict)
  0070_seating_concepts.sql            Creates organizer_seating_concepts (global room+pool templates per organizer)
  0071_mitarbeiter_auth.sql            Adds auth_user_id + must_change_password to organizer_staff;
                                       backup_staff_id to personalplanung_shifts;
                                       personalplanung_shift_swaps table; is_own_staff_member() SECURITY DEFINER;
                                       RLS for staff self-access on pp_days/assignments/shifts/swaps
  0073_shift_time_tracking.sql         Creates shift_time_logs (actual check-in/out per shift).
  0075_ablaufplan_multiday.sql         Adds ablaufplan_days (day_index, name, start_hour, end_hour) + day_index to timeline_entries; RLS for veranstalter/brautpaar/dl
                                       Extends conversations/messages RLS to allow organizer_staff users
                                       who are conversation participants (enables staff ↔ organizer 1:1 chat).
  0077_profile_avatar.sql              Adds avatar_r2_key TEXT to profiles (R2 object key, NOT a public URL).
                                       Display URL generated on-demand via Worker requestDownloadUrl (1h presigned GET).
  0078_staff_to_staff_chat.sql         Creates organizer_settings (staff_chat_enabled toggle). RLS: organizer all; staff read-only.
  0079_event_type.sql                  Adds event_type TEXT NOT NULL DEFAULT 'hochzeit' CHECK (IN 'hochzeit','firmenevent','intern') to events.
  0080_brautpaar_notes.sql             Creates brautpaar_notes (id, event_id, category, title, content, note_type text|checklist, checklist_items JSONB, sort_order).
                                       RLS: brautpaar + veranstalter via is_event_member.
  0081_musik_playlisten.sql            Creates musik_playlisten (id, event_id, title, url, platform spotify|youtube|apple_music|other, sort_order).
                                       Embedded players in MusikTabContent (Spotify/YouTube/Apple Music iframe detection).
  0082_getraenke.sql                   Creates getraenke_kategorien, getraenke_artikel (Mengenplanung), getraenke_cocktails (ingredients JSONB).
                                       RLS: veranstalter/brautpaar full access; dl needs dl_has_tab_access('getraenke','read').
  0086_brautpaar_solo_role.sql         Adds ENUM value 'brautpaar_solo' to user_role (separate transaction required before use).
  0087_brautpaar_solo_functions.sql    is_event_member() maps brautpaar_solo → veranstalter|brautpaar (full RLS cascade);
                                       can_manage_member() solo = admin; create_event_as_brautpaar_solo() (no approval needed).
  0088_brautpaar_solo_onboarding.sql   create_event_as_brautpaar_solo() v2: IDEMPOTENT (returns existing solo event),
                                       p_date nullable, p_couple_name param. Drops old 0087 signature (PostgREST overload).
  0089_redeem_invite_hardening.sql     redeem_invite_code() hardening: (1) veranstalter codes require
                                       profiles.is_approved_organizer (error NOT_APPROVED_ORGANIZER, code stays open);
                                       (2) existing admin members (veranstalter, brautpaar_solo) are never re-roled by
                                       redeeming a code — idempotent success with existing role, code stays open.
  0108_remove_deko_system.sql          Removes the deko free-canvas system: drops all deko_* tables + trigger,
                                       deletes 'deko'/'bp-dekoration' feature_toggles, redefines
                                       create_event_as_brautpaar_solo() without those toggles.
  0109_remove_deko_permission_columns.sql  Drops the last deko leftovers: brautpaar_permissions.dekorationen +
                                       trauzeuge_permissions.can_manage_deko.
  0110_vendor_questionnaires.sql       Dienstleister-Frageboegen + Auto-Angebote (Marktplatz). Tables:
                                       vendor_questionnaires (1 pro Firma: Preislogik base_price/per_guest_price/
                                       min_total/weekend_surcharge_pct/tax_mode), vendor_questionnaire_sections,
                                       vendor_questionnaire_questions (type text|single|multi|number|boolean|date,
                                       options/pricing JSONB), vendor_offers (1:1 zur marketplace_request:
                                       answers/standard_info/line_items JSONB, status draft|released|accepted|declined).
                                       RLS: Fragebogen NUR Eigentuemer (Preis-Leak-Schutz; Brautpaar erhaelt ihn
                                       preislos via Service-Role-API); Angebote = Vendor (alle) + Brautpaar (ab released).

# ── Vendor Frageboegen & Auto-Angebote (Migration 0110) ──────────────────────
# Marktplatz-Dienstleister bauen 1 Fragebogen (Abschnitte+Fragen+Preislogik) unter
# /vendor/fragebogen (FragebogenBuilderClient). Stellt ein Brautpaar eine Anfrage
# (AnbieterDetailClient -> components/marketplace/RequestFlow.tsx, mit Review-Schritt),
# erzeugt POST /api/marketplace/requests serverseitig ein Auto-Angebot (vendor_offers,
# draft) via lib/vendor/{load,pricing,standard-info}.ts. Der Dienstleister prueft/justiert
# es in VendorAnfragenClient (components/vendor/VendorOfferEditor.tsx) und gibt es frei
# (PATCH /api/vendor/offers/[requestId] action:release -> lib/marketplace/accept.ts oeffnet
# Chat). Brautpaar sieht/akzeptiert es (CoupleOfferPanel + /api/marketplace/offers/[requestId]).
# PDF beidseitig via @react-pdf/renderer (lib/vendor/offer-pdf.tsx, Dienstleister-Branding).
# Templates: lib/vendor/questionnaire-templates.ts. Nur Marktplatz-Anfragen, keine Versionierung.

  0120_vendor_pricing_engine.sql       Preis-Engine am Fragebogen (vendor_questionnaires):
                                       guest_tiers JSONB (Mengenstaffeln Pro-Gast-Preis),
                                       season_rules JSONB (Saison-/Datumsaufschlaege % oder Pauschale,
                                       zusaetzlich zum Wochenend-Aufschlag), travel_mode none|zones|km|both +
                                       travel_zones JSONB (PLZ-Praefix-Pauschalen) + travel_km_price/
                                       travel_free_radius_km/travel_base_postal_code.
                                       Pro-Frage-Staffeln liegen in questions.pricing.tiers (JSONB, keine Migration).
# ── Preis-Engine (Migration 0120) ────────────────────────────────────────────
# computeOffer (lib/vendor/pricing.ts) wendet an: guest_tiers (ersetzt per_guest_price in der
# passenden Stufe), pro-Frage tiers fuer number/per_unit, season_rules (inSeason() unterstuetzt
# YYYY-MM-DD und jaehrlich MM-DD inkl. Jahreswechsel), Anfahrt als optionale Position bei PLZ-Match
# (standardInfo.postalCode aus buildStandardInfo, best effort aus venue_address). UI: FragebogenBuilderClient
# (TiersEditor/SeasonEditor/TravelEditor). Alle Preisfelder sind durch
# stripPricing vor dem Brautpaar geschuetzt. Ein Auto-Angebot ist immer nur ein Entwurf (draft) als
# Input fuer den Dienstleister — er gibt es frei (release), passt es an, oder nimmt die Anfrage ohne
# Angebot an (VendorOfferEditor: "Ohne Angebot annehmen" -> action accept, oeffnet nur den Chat).

  0121_vendor_offer_variants.sql       OPTIONALE Angebots-Varianten (vendor_offer_variants):
                                       1 vendor_offers -> n Varianten (name, line_items/subtotal/tax_amount/
                                       total, sort_order, is_selected). Standard bleibt EIN Angebot ohne Varianten.
                                       RLS: Lesen wie Eltern-Angebot (Vendor immer, Brautpaar ab status<>'draft'),
                                       Schreiben via Service-Role.
# ── Angebots-Varianten (Migration 0121) ──────────────────────────────────────
# Vendor verwaltet Varianten in VendorOfferEditor (VariantsManager) ueber
# /api/vendor/offers/[requestId]/variants (+ /[variantId]). Pro Variante eigenes PDF
# via ?variantId= an beiden PDF-Routen (applyVariantToOffer in lib/vendor/variants.ts).
# Brautpaar (CoupleOfferPanel) sieht alle Varianten, waehlt eine; PATCH accept mit
# variantId kopiert die gewaehlte Variante ins Angebot + setzt is_selected. Hat ein
# Angebot Varianten, ist die Auswahl Pflicht. Manuell dupliziert ("Aus Angebot
# uebernehmen"), keine Auto-Generierung.

  0122_vendor_brand_color.sql          dienstleister_profiles.brand_color TEXT (Hex). Einheitliches
                                       Vendor-Branding: Akzentfarbe im Angebots-PDF (lib/vendor/offer-pdf.tsx:
                                       Cover-Balken/Tabellenkopf/Summenzeile) und in Vendor-Mails ans Brautpaar
                                       (lib/email/notify.ts emailLayout({brand}) -> Wortmarke+Akzent statt FOREVR;
                                       offer-notify.ts nutzt es). Profil-UI: Farbwaehler in VendorListingClient,
                                       Sofort-Feld in /api/vendor/marketplace/profile (Hex-validiert). Leer = Standard.

  0123_vendor_automations.sql          Konfigurierbare Vendor-Automatisierungen: vendor_automations
                                       (kind reminder|review_request|followup_offer|followup_lead, event_type,
                                       offset_days, label, enabled), vendor_automation_log (Idempotenz),
                                       review_invites (Token-Bewertung ohne Login). marketplace_reviews:
                                       author_user_id nullable + via_token.
  0124_cron_schedule.sql               pg_cron (taeglich 06:00 UTC) -> net.http_post auf /api/cron/tick.
                                       Betreiber setzt app.cron_url + app.cron_secret per ALTER DATABASE.
# ── Automatisierungen / Scheduler (Migration 0123/0124) ──────────────────────
# lib/vendor/automation-tick.ts (runAutomationTick) verarbeitet taeglich + idempotent:
#  - reminder: Kalender-Eintrag fuer den Vendor X Tage VOR gebuchtem Event (accepted offer)
#  - review_request: review_invites-Token + vendor-branded Mail X Tage NACH Event
#  - followup_offer: released, nicht angenommene Angebote X Tage nach Freigabe -> Mail + Vendor-To-do
#  - followup_lead: Leads ohne Aktivitaet X Tage -> crm_task
# Aufruf: POST/GET /api/cron/tick (Header x-cron-secret == CRON_SECRET env). Config-UI:
# /vendor/automatisierungen (AutomationsClient) ueber /api/vendor/automations (GET seedet Defaults).
# Manuelle Bewertungsanfrage: /api/vendor/reviews/request. Token-Review oeffentlich:
# /review/[token] + /api/reviews/[token] (kein Login). Nav-Eintrag "Automatik" in VendorSidebarShell.

  0125_vendor_data_requests.sql        Strukturierte Daten-Anfrage (A3): vendor_data_requests
                                       (event_id, dienstleister_id, conversation_id, fields JSONB [{key,label,value}],
                                       status open|answered). RLS aktiv ohne User-Policy (nur Service-Role-APIs).
# ── Strukturierte Daten-Anfrage (Migration 0125) ─────────────────────────────
# Vendor fordert im Chat (KommunikationClient -> DataRequestDialog, "Daten anfordern")
# gezielt Felder an: POST /api/vendor/data-requests legt Zeile an + postet eine Chat-
# Nachricht. Brautpaar beantwortet im Anbieter-Detail (CoupleDataRequests) via
# GET /api/marketplace/data-requests + PATCH /api/marketplace/data-requests/[id];
# die Antwort wird strukturiert gespeichert UND als Chat-Nachricht gepostet.

  0126_remove_consult_mode.sql         Entfernt vendor_questionnaires.consult_mode (Beratungs-Modus aus 0120).
                                       Ein Auto-Angebot ist ohnehin nur ein Entwurf/Input fuer den Dienstleister;
                                       Anfragen koennen jederzeit ohne Angebot angenommen werden (VendorOfferEditor:
                                       "Ohne Angebot annehmen"). Der separate Modus war damit redundant.

# ── Standalone-Angebot -> Event (event-offers action:accept) ──────────────────
# Eigenständige Angebote (vendor_offers.event_id IS NULL, erstellt in OfferEditorFull,
# Kundeninfo in standard_info.client_*) koennen vom Dienstleister angenommen werden:
# PATCH /api/vendor/event-offers/[offerId] action:'accept' (nur event_id NULL, Status
# draft|released) erzeugt ein events-Row (Titel/Kunde/Datum/Ort/Typ aus Angebot +
# optionalen Body-Feldern), verknuepft den Vendor via event_members(role dienstleister)
# + event_dienstleister(status akzeptiert), setzt vendor_offers.event_id + status accepted
# und reichert standard_info an. UI: AcceptDialog ("Annehmen & Event anlegen") in
# OfferEditorFull, danach Redirect ins event-gebundene Angebot.

app/veranstalter/profil/
  page.tsx                             Server component — loads user profile (name, email, avatar_url)
  ProfilClient.tsx                     Edit form: name, email, password, profile picture (Supabase Storage "avatars" bucket)

app/api/veranstalter/profile/
  route.ts                             PATCH — updates name/avatar_r2_key in profiles; email/password via supabase.auth.updateUser
  request-avatar-upload/route.ts       POST — returns presigned R2 PUT URL (via Worker) for key profiles/{userId}/avatar

workers/
  file-service/                 Cloudflare Worker — thin R2 presigned URL generator
    wrangler.toml               Worker config (nodejs_compat, R2 binding, jurisdiction = "eu")
    src/index.ts                POST /presign/upload, POST /presign/download, DELETE /object

lib/files/
  types.ts                      FileMetadata, FileModule, ALLOWED_MIME_TYPES, helpers
  worker-client.ts              Server-only: calls Worker for presigned URLs (uses FILE_WORKER_URL + FILE_WORKER_INTERNAL_SECRET)
  permissions.ts                canReadFiles(), canUploadFiles(), canDeleteFile(), getDlAccessibleModules()

hooks/
  useFileUpload.ts              Client hook: request URL → XHR upload to R2 → confirm (with progress)

components/files/
  FilesSection.tsx              Main file management UI (list + upload overlay, shows both R2 + legacy files)

app/api/files/
  request-upload/route.ts       POST — validate auth+permission, create pending DB row, return presigned PUT URL
  [fileId]/confirm/route.ts     PATCH — mark pending upload as active
  [fileId]/download-url/route.ts  GET — validate auth+permission, return fresh presigned GET URL (1h TTL)
  [fileId]/route.ts             DELETE — soft-delete DB + hard-delete R2

app/mitarbeiter/
  page.tsx                      Staff portal entry — finds events via assignments, redirects or shows picker
  change-password/page.tsx      Forced password change (calls supabase.auth.updateUser + /api/mitarbeiter/change-password)
  [eventId]/schichtplan/
    page.tsx                    Server component: loads staff record, all days, allShifts, myShifts, allStaff,
                                mySwaps, myTimeLogs, staffAuthUserId, organizerAuthUserId
    SchichtplanClient.tsx       Mobile-first 3-tab UI:
                                  Schicht: own shifts + Einstempeln/Ausstempeln CTA per shift + swap requests
                                  Team: all colleagues' shifts by day selector
                                  Chat: 1:1 realtime chat with organizer (via /api/staff/chat find-or-create)

app/api/staff/
  [staffId]/setup-auth/route.ts POST — creates/resets Supabase auth account for staff; sets app_metadata.role='mitarbeiter'
  swaps/route.ts                POST — creates swap request (shift must belong to requester)
  swaps/[swapId]/route.ts       PATCH — approve/reject (organizer) | accept (to_staff) | cancel (from_staff)

app/api/mitarbeiter/
  change-password/route.ts      POST — clears must_change_password flag on organizer_staff

app/api/staff/
  checkin/route.ts              POST {shiftId, action:'checkin'|'checkout'} — creates/updates shift_time_logs row
  chat/route.ts                 POST {eventId, staffId} — finds or creates 1:1 organizer↔staff conversation;
  direct-chat/route.ts          POST {eventId, targetStaffId} — finds or creates 1:1 staff↔staff conversation;
                                      checks organizer_settings.staff_chat_enabled; both staff must share organizer.
                                      returns conversationId. Uses admin client; accessible to organizer or own staff.
  [staffId]/setup-auth/route.ts POST — creates/resets Supabase auth account for staff
  swaps/route.ts                POST — creates swap request
  swaps/[swapId]/route.ts       PATCH — approve/reject (organizer) | accept/cancel (staff)

app/api/rsvp/[token]/photos/
  route.ts                      GET photos list (with presigned URLs) + POST request upload URL — service role, token-auth
  [photoId]/route.ts            PATCH confirm + DELETE own photo (validates guest_token column)

app/api/events/[eventId]/photos/
  route.ts                      GET list + POST request upload — requires event membership
  [photoId]/route.ts            PATCH confirm + DELETE (veranstalter/brautpaar only)

components/medien/
  GuestPhotosSection.tsx        Masonry gallery + upload for authenticated member portals (Medien tab)
                                Brautpaar-only: download all button, download per photo in lightbox, "Fotoalbum bestellen" placeholder

components/rsvp/
  RsvpPhotos.tsx                Mobile-first gallery + upload for RSVP page (token-auth, no login required)

Env vars (Vercel):
  FILE_WORKER_URL               https://velvet-file-service.leon-s-account.workers.dev
  FILE_WORKER_INTERNAL_SECRET   Shared secret (also set as Worker secret INTERNAL_SECRET)

Worker secrets (wrangler secret put):
  INTERNAL_SECRET   R2_ACCOUNT_ID   R2_ACCESS_KEY_ID   R2_SECRET_ACCESS_KEY   R2_BUCKET_NAME
```

---

## Veranstalter manuell per SQL anlegen

Beim manuellen Anlegen eines Veranstalters über den Supabase SQL Editor müssen folgende Punkte beachtet werden:

1. **Token-Felder dürfen nicht NULL sein** — Supabase's Go-Auth-Layer kann NULL-Strings nicht scannen → Login schlägt mit `500: Database error querying schema` fehl
2. **`auth.identities` muss manuell befüllt werden** — ohne Eintrag dort ist kein E-Mail-Login möglich
3. **`profiles` wird per Trigger automatisch angelegt** — kein manuelles INSERT nötig, sonst Duplicate-Key-Error
4. **E-Mail immer lowercase** — Supabase normalisiert E-Mails beim Login zu Kleinbuchstaben

```sql
DO $$
DECLARE
  new_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role,
    confirmation_token, recovery_token, email_change_token_new,
    email_change, email_change_token_current, reauthentication_token,
    created_at, updated_at
  ) VALUES (
    new_id,
    '00000000-0000-0000-0000-000000000000',
    'email@beispiel.de',                          -- lowercase!
    crypt('Passwort123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"],"is_approved_organizer":true}'::jsonb,
    '{"name":"Vorname Nachname"}'::jsonb,
    'authenticated', 'authenticated',
    '', '', '', '', '', '',                        -- Token-Felder: leer, nicht NULL
    now(), now()
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), new_id,
    'email@beispiel.de',                          -- provider_id = E-Mail
    jsonb_build_object('sub', new_id::text, 'email', 'email@beispiel.de'),
    'email', now(), now(), now()
  );

  -- profiles wird automatisch per Trigger erstellt;
  -- ON CONFLICT als Fallback falls Trigger den Namen nicht setzt:
  INSERT INTO public.profiles (id, name, email)
  VALUES (new_id, 'Vorname Nachname', 'email@beispiel.de')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;
END $$;

-- Danach: Veranstalter-Rechte in profiles setzen (PFLICHT, sonst kein Zugriff)
UPDATE public.profiles SET is_approved_organizer = true WHERE email = 'email@beispiel.de';
```

> **Wichtig:** Die eigentliche Zugriffskontrolle läuft über `profiles.is_approved_organizer` (boolean), **nicht** über `raw_app_meta_data`. Das Feld `is_approved_organizer` in `app_metadata` hat aktuell keine Wirkung (Middleware-Bug, siehe oben).
```

---

## ⚠️ Cloudflare R2 — EU-Jurisdiction (Kritisch)

Der Bucket `velvet-files` wurde mit **EU-Jurisdiction** (WEUR) erstellt. Das hat folgende Konsequenzen:

- **S3-Endpoint:** `https://<account_id>.eu.r2.cloudflarestorage.com` (nicht `.r2.cloudflarestorage.com`)
  → Presigned URLs müssen auf den EU-Endpoint zeigen, sonst CORS-Fehler 403
- **wrangler.toml:** R2-Binding braucht `jurisdiction = "eu"`, sonst schlägt `wrangler deploy` mit Error 10085 fehl
- **Wrangler deploy:** OAuth-Login (`wrangler login`) hat kein R2-Scope → Deploy nur mit `CLOUDFLARE_API_TOKEN` möglich
  Token mit Permissions: Workers Scripts Edit + Workers R2 Storage Edit
- **CORS:** Policy ist auf dem Bucket gesetzt (AllowedOrigins: *, Methods: GET/PUT/HEAD, Headers: *, MaxAge: 3600)
  → Prüfen/setzen via: `wrangler r2 bucket cors list velvet-files --jurisdiction eu`
