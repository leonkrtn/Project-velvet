# Velvet – Claude Code Context

> Auto-loaded by Claude Code at session start. Keep up to date when schema or architecture changes.
> Detailed references: [DATABASE](docs/DATABASE.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [KNOWN_ISSUES](docs/KNOWN_ISSUES.md)

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Server + Client Components) |
| Auth / DB / Storage | Supabase (PostgreSQL, Auth, Realtime, Edge Functions, Storage) |
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
    chats/                 → Conversations
    dienstleister/         → Vendor list for event
    berechtigungen/[id]/   → Vendor permission editor
    budget/                → Budget tracker

/brautpaar/[eventId]/...   → Couple portal (mirrors subset of veranstalter routes)
/trauzeuge/[eventId]/...   → Best-man portal (read-heavy)
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
  sitzplan/                → Seating plan (if permitted)
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
| `timeline_entries` | Schedule items |
| `seating_tables` / `seating_assignments` | Seating plan (v2 — supports guests, begleitpersonen, brautpaar slots) |
| `catering_plans` | Catering configuration |
| `music_songs` / `music_requirements` | Music tab |
| `decor_setup_items` / `deko_wishes` | Decor tab |
| `media_shot_items` / `media_uploads` | Media tab |
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
| `event_room_configs` | Per-event room polygon |
| `organizer_todos` | Organizer task list |
| `organizer_staff` | Organizer's team members |
| `event_organizer_costs` | Organizer's own cost items |
| `feature_toggles` | Per-event feature flags |

---

## Legacy / Dead Code

- `lib/store.ts` — complete localStorage data model (`velvet_event_v3`). Parallel to Supabase. Contains `SEED_EVENT` mock data, `loadEvent()`/`saveEvent()`. Many frontend pages still import from this.
- `band_tech_requirements`, `band_set_list` tables — superseded by `music_requirements` + `music_songs`, still in DB with no UI.
- `fotograf_schedule`, `fotograf_deliverables` tables — DB only, no UI.
- `messages.read_at` column — defined, never populated.
- `timeline_entries.responsibilities TEXT` — redundant with `assigned_staff`/`assigned_vendors`/`assigned_members` JSONB columns (added in 0025).
- `dienstleister_item_permissions` table — old granular system, not cleanly migrated out.

---

---

## File Map (Critical Files)

```
lib/
  store.ts              Legacy localStorage data model + event store
  vendor-modules.ts     ALL_MODULES (old mod_* keys), ROLE_MODULE_DEFAULTS
middleware.ts           Auth guard (has approval-check bug)

app/veranstalter/[eventId]/
  allgemein/AllgemeinForm.tsx          Event settings form
  berechtigungen/[id]/BerechtigungenClient.tsx  Vendor permission editor (writes NEW system)
  sitzplan/page.tsx                    Seating plan — room config (3-step) + SitzplanEditor

app/brautpaar/seating/page.tsx        Brautpaar seating — SitzplanEditor (no room config)

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

app/veranstalter/[eventId]/
  berechtigungen/[dienstleisterId]/BerechtigungenClient.tsx
                                Vendor permission editor — allgemein removed from tab list

supabase/migrations/
  setup.sql                     Base schema (all core tables)
  0040_unified_dienstleister_permissions.sql  NEW permission table
  0042_dienstleister_rls_write.sql           RLS using dl_has_tab_access
  0043_remove_allgemein_from_dienstleister.sql  Purges allgemein rows + CHECK constraint
  0044_seating_v2.sql           Replaces seating_tables/seating_assignments; adds table_pool to event_room_configs
  0045_seating_pool_type_id.sql Adds pool_type_id TEXT to seating_tables; updates table_pool default to {types:[]}
  0048_remove_proposals_system.sql  Drops all proposal/suggestion tables and their DB functions
```
