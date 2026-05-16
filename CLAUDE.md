# Velvet – Claude Code Context

> Auto-loaded by Claude Code at session start. Keep up to date when schema or architecture changes.
> Detailed references: [DATABASE](docs/DATABASE.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [KNOWN_ISSUES](docs/KNOWN_ISSUES.md)

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
| `trauzeuge` | Best man/maid of honor — limited read + some edit |
| `dienstleister` | Vendor/service provider — permission-gated access |

---

## Route Structure

```
/                          → Landing page (public)
/login, /signup            → Auth (public)
/join                      → Join event by code (public)
/auth/callback             → Supabase OAuth callback (public)

/veranstalter/             → Organizer hub (requires is_approved_organizer)
  dashboard/               → Event list
  [eventId]/
    allgemein/             → Event settings (title, venue, dates, costs)
    gaesteliste/           → Guest list
    sitzplan/              → Seating plan
    catering/              → Catering
    ablaufplan/            → Timeline
    musik/                 → Music
    dekoration/            → Decor
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
⛔ /trauzeuge/            → Role exists in DB but no frontend portal implemented
/vendor/dashboard/[eventId]/ → Vendor portal (tab-gated by permissions)
  uebersicht/              → Overview: event details, contacts, permission-gated module shortcuts
  catering/                → Catering (if permitted)
  chats/                   → Chats (if permitted)
  ablaufplan/              → Timeline (if permitted)
  gaesteliste/             → Guest list (if permitted)
  musik/                   → Music (if permitted)
  patisserie/              → Patisserie (if permitted)
  dekoration/              → Decor (if permitted)
  medien/                  → Media (if permitted)
  sitzplan/                → Seating plan read-only (if permitted)
  files/                   → Files tab
  tabs/                    → Tab component directory (CateringTab, SeatingTab, etc.) — not a route
  ⛔ allgemein/            → REMOVED — vendors have no access; DB CHECK constraint blocks assignment
```

---

## ⚠️ CRITICAL: Dual Permission System (Active Bug)

The project has **two parallel permission systems** that are **not in sync**:

### OLD system (partially deprecated but still controlling frontend)
- Table: `permissions` (columns: `event_id`, `user_id`, `permission TEXT`)
- Keys: `mod_chat`, `mod_timeline`, `mod_timeline_read`, `mod_seating`, `mod_seating_read`, `mod_catering`, `mod_catering_read`, `mod_music`, `mod_music_read`, `mod_patisserie`, `mod_patisserie_read`, `mod_decor`, `mod_decor_read`, `mod_media`, `mod_media_read`, `mod_location`, `mod_guests`
- Still used by: `VendorDashboardClient.tsx` (tab visibility), `vendor-modules.ts` (`ALL_MODULES`), `lib/store.ts`

### NEW system (DB RLS enforced since migration 0042)
- Table: `dienstleister_permissions` (columns: `event_id`, `dienstleister_user_id`, `tab_key TEXT`, `item_id TEXT|NULL`, `access: none|read|write`)
- Tab keys: `uebersicht`, `catering`, `chats`, `ablaufplan`, `gaesteliste`, `musik`, `patisserie`, `dekoration`, `medien`, `sitzplan`
- `allgemein` is **explicitly blocked** — migration 0043 added a CHECK constraint (`tab_key <> 'allgemein'`) and purged existing rows
- Written by: `BerechtigungenClient.tsx` (permission editor UI)
- Enforced by: `dl_has_tab_access()` SECURITY DEFINER function in all table RLS policies

**Consequence:** Organizer configures permissions in the UI (writes to new system), but vendor portal reads from old system for tab visibility → vendor may see tabs they have no DB access to, or not see tabs they do have DB access to. The permission editor UI has no effect on what the vendor sees in the sidebar.

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

## Middleware Auth (Critical Nuance)

`middleware.ts` — guards `/veranstalter/*` by checking `app_metadata.is_approved_organizer`.

**Bug:** The check logic is:
```ts
if (isOrganizerRoute && isApproved === false && isApproved !== undefined)
```
This condition is always `false` (impossible to be both `=== false` AND `!== undefined` simultaneously). Without the Custom Access Token Hook setting `is_approved_organizer`, every user can access organizer routes.

---

## Key Database Tables (Quick Reference)

See [docs/DATABASE.md](docs/DATABASE.md) for full schema.

| Table | Purpose |
|---|---|
| `events` | Core event record |
| `event_members` | User ↔ Event role assignments |
| `profiles` | Extended user profile |
| `guests` | Wedding guests |
| `begleitpersonen` | Guest companions |
| `hotels` / `hotel_rooms` | Hotel logistics |
| `timeline_entries` | Schedule items (has `day_index INT` for multi-day support) |
| `ablaufplan_days` | Per-event day config (day_index, name, start_hour, end_hour) |
| `seating_tables` / `seating_assignments` | Seating plan (v2 — supports guests, begleitpersonen, brautpaar slots) |
| `catering_plans` | Catering configuration |
| `music_songs` / `music_requirements` | Music tab |
| `deko_areas` | Decor areas (per event, ordered) |
| `deko_canvases` | Canvases per area (main + variants + standalone moodboards) |
| `deko_items` | Free-canvas items (19 types, JSONB data, x/y/w/h) |
| `deko_catalog_items` | Event-wide article/fabric catalog |
| `deko_flat_rates` | Per-event flat-rate entries (linked to catalog) |
| `deko_comments` / `deko_comment_replies` | 2-level comment system (item/canvas/area targets) |
| `deko_votes` | Thumbs up/down on vote_card items |
| `deko_budget_links` | Links deko_items → budget_items (created on freeze, removed on unfreeze) |
| `deko_organizer_templates` | Global organizer templates (copy-on-apply) |
| `deko_organizer_flat_rates` | Flat rates attached to organizer templates |
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

---

## Legacy / Dead Code

- `lib/store.ts` — complete localStorage data model (`velvet_event_v3`). Parallel to Supabase. Contains `SEED_EVENT` mock data, `loadEvent()`/`saveEvent()`. Many frontend pages still import from this.
- `band_tech_requirements`, `band_set_list` tables — superseded by `music_requirements` + `music_songs`, still in DB with no UI.
- `fotograf_schedule`, `fotograf_deliverables` tables — DB only, no UI.
- `messages.read_at` column — defined, never populated.
- `timeline_entries.responsibilities TEXT` — redundant with `assigned_staff`/`assigned_vendors`/`assigned_members` JSONB columns (added in 0025).
- `dienstleister_item_permissions` table — old granular system, not cleanly migrated out.
- Proposals/Vorschläge system — fully removed (migration 0048 drops all tables + functions). No UI remains.
- `decor_setup_items` / `deko_wishes` tables — **dropped in migration 0064**. Replaced by the new free-canvas deko system.

---

---

## Landing Page

`app/page.tsx` — Full Velvet landing page (client component, not a redirect).
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
  vendor-modules.ts     ALL_MODULES (old mod_* keys), ROLE_MODULE_DEFAULTS
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

app/vendor/dashboard/[eventId]/
  VendorDashboardClient.tsx     Vendor portal (reads OLD system for tab visibility)
  VendorSidebarLayout.tsx       Sidebar nav — allgemein removed; filters by dienstleister_permissions
  uebersicht/page.tsx           Rebuilt overview: event details, veranstalter/brautpaar contacts,
                                permission-gated module shortcut cards
  sitzplan/page.tsx             Read-only seating view with table cards + guest names
  files/page.tsx                Files tab (R2-backed, permission-gated)
  tabs/FilesTab.tsx             Thin wrapper around FilesSection
  tabs/                         Tab components (CateringTab, SeatingTab, ChatTab, …) — shared, not routes

app/veranstalter/[eventId]/
  berechtigungen/[dienstleisterId]/BerechtigungenClient.tsx
                                Vendor permission editor — allgemein removed from tab list
  dekoration/page.tsx           Deko page (server component) — loads areas/canvases/catalog/items → DekoPageClient

app/brautpaar/[eventId]/
  dekoration/page.tsx           Deko page for Brautpaar — same data loading, role="brautpaar"

app/veranstalter/konfiguration/
  dekoration/page.tsx           Organizer global deko templates (create/rename/delete templates + flat rates per template)

components/ablaufplan/
  DayCalendar.tsx               Apple Calendar-style day view. HOUR_HEIGHT=80px/hr. Drag-to-create + drag-to-move.
                                CalendarEntry interface (shared). Overlap layout (greedy column assignment).
                                readOnly prop disables all interactions. NowLine shows current time.
  EventModal.tsx                Create/edit modal. Handles checklist (auto-save on toggle), assignments (auto-save).
                                Edit-mode toggle shows X buttons for checklist delete (Veranstalter/Brautpaar only).
                                Exports: TimelineEntry, AblaufplanDay, Member, StaffRow, VendorRow types.

components/deko/
  DekoPageClient.tsx            Orchestrator: areas, activeCanvas, pendingType, freeze state
  DekoCanvas.tsx                Free canvas — pan/zoom (Ctrl+scroll), item drag, presence cursors, dot grid
  DekoFloatingToolbar.tsx       Photoshop-style draggable toolbar, 19 item types in 6 groups
  DekoNavigationBar.tsx         Left sidebar: areas → main canvas, variants, moodboards; inline create
  DekoItemLightbox.tsx          Per-type modal editor; CatalogPicker for articles/fabrics; OG preview for links
  DekoCommentOverlay.tsx        Hover badge → panel with 2-level comments (realtime)
  DekoBudgetBar.tsx             Collapsible budget footer under canvas (line items + flat rates)
  DekoFreezeDialog.tsx          Brautpaar submit: 2-step confirm, must type ABSENDEN
  items/DekoItemRenderer.tsx    Switch on item.type → 19 self-contained renderers

lib/deko/
  types.ts                      All TS interfaces; DekoItemType (19); ITEM_DEFAULTS; calcItemPrice/calcCanvasBudget
                                CANVAS_W=3200, CANVAS_H=2264, CANVAS_DEFAULT_ZOOM=0.45
  hooks/useDekoCanvas.ts        Canvas state + mutations (addItem, drag, commit, delete, bringToFront)
  hooks/useDekoRealtime.ts      Supabase channel: postgres_changes for deko_items + Presence (cursors, 20fps throttle)

app/api/deko/
  freeze/route.ts               POST {eventId, action}: freeze all main canvases + create budget_items; unfreeze = reverse
  og-preview/route.ts           GET ?url= — server-side OG meta scraper (title/description/image/domain)

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
  0064_deko_system.sql                 Drops decor_setup_items + deko_wishes; creates full new deko system (13 tables,
                                       RLS for all roles, Realtime enabled on deko_items/canvases/comments/votes)
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

## Deko System — Free Canvas Architecture

Migration `0064_deko_system.sql` replaces the old `decor_setup_items`/`deko_wishes` tables with a full free-canvas decoration system.

**Hierarchy:** Event → `deko_areas` (named sections) → `deko_canvases` (one `main` + N `variant` per area, plus standalone `moodboard` canvases) → `deko_items` (free-positioned on A3 canvas 3200×2264px)

**19 item types:** `image_upload`, `image_url`, `color_palette`, `color_swatch`, `text_block`, `sticky_note`, `heading`, `article`, `flat_rate_article`, `fabric`, `frame`, `divider`, `area_label`, `vote_card`, `checklist`, `link_card`, `table_ref`, `room_info`, `guest_count`

**Permission model (on canvas):**
- `veranstalter`: full admin (create/edit/delete anything, unfreeze)
- `brautpaar`: full write (create areas/canvases/items, edit/delete all), can submit freeze
- `dienstleister` write: add items + edit/delete own items only, see all prices
- `dienstleister` read / `trauzeuge`: read-only + comment

**Freeze workflow:** Brautpaar submits → all `main` canvases set `is_frozen=true` → canvas becomes read-only for all roles → `budget_items` auto-created in category "Dekoration" with `deko_budget_links` → only Veranstalter can unfreeze (reverses budget items).

**Organizer templates:** Global templates under `/veranstalter/konfiguration/dekoration`. Copy-on-apply (no live sync). Stored in `deko_organizer_templates` + `deko_organizer_flat_rates`.

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
