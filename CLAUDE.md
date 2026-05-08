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
    proposals/             → Proposal management (V2)
    vorschlaege/           → Proposals from vendor view (Veranstalter side)
    budget/                → Budget tracker

/brautpaar/[eventId]/...   → Couple portal (mirrors subset of veranstalter routes)
/trauzeuge/[eventId]/...   → Best-man portal (read-heavy)
/vendor/dashboard/[eventId]/ → Vendor portal (tab-gated by permissions)
/vendor/inbox/             → Vendor proposal inbox
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
- Tab keys: `uebersicht`, `allgemein`, `catering`, `chats`, `ablaufplan`, `gaesteliste`, `musik`, `patisserie`, `dekoration`, `medien`, `sitzplan`, `vorschlaege`
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

## Proposals System (V2)

Full async negotiation system between organizer and vendors. Migrations: `0031_proposals_v2.sql`.

```
proposals
  └─ proposal_recipients (one per invited vendor)
       └─ proposal_snapshots (current + proposed state per recipient)
            └─ proposal_fields (field-level values + status)
  └─ cases (conflict resolution threads)
       └─ case_messages
field_locks (optimistic locking, 30s TTL)
history_log (audit trail)
```

Segments (proposal types): `catering`, `ablaufplan`, `hotel`, `musik`, `dekoration`, `patisserie`, `vendor`, `sitzplan`

Client library: `lib/proposals.ts` — contains delta engine (`computeDeltas`, `diffEntities`), field locking (`acquireFieldLock`, `startLockHeartbeat`), merge logic (`finalizeMerge`, `executeMerge`), Realtime subscriptions.

**Missing RPCs (will fail at runtime):**
- `send_proposal_with_creator` — called in `lib/proposals.ts`, defined in no migration
- `get_module_master_state` — called in `lib/proposals.ts`, defined in no migration

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
| `seating_tables` / `seating_assignments` | Seating plan |
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
| `proposals` | V2 negotiation proposals |
| `proposal_recipients` | Per-vendor proposal state |
| `proposal_snapshots` | Before/after field snapshots |
| `cases` / `case_messages` | Conflict resolution |
| `field_locks` | Optimistic field locking |
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

## Realtime Subscriptions

Active Supabase Realtime channels (defined in `lib/proposals.ts`):
- `proposal:{proposalId}` — proposal_fields changes
- `case:{caseId}` — case_messages INSERT
- `event-proposals:{eventId}` — proposals INSERT/UPDATE for inbox

---

## File Map (Critical Files)

```
lib/
  store.ts              Legacy localStorage data model + event store
  proposals.ts          Proposals V2 client library (deltas, locking, merge, realtime)
  vendor-modules.ts     ALL_MODULES (old mod_* keys), ROLE_MODULE_DEFAULTS
middleware.ts           Auth guard (has approval-check bug)

app/veranstalter/[eventId]/
  allgemein/AllgemeinForm.tsx          Event settings form
  berechtigungen/[id]/BerechtigungenClient.tsx  Vendor permission editor (writes NEW system)

app/vendor/dashboard/[eventId]/
  VendorDashboardClient.tsx   Vendor portal (reads OLD system for tab visibility)

supabase/migrations/
  setup.sql                     Base schema (all core tables)
  0031_proposals_v2.sql         Proposals V2 full schema
  0040_unified_dienstleister_permissions.sql  NEW permission table
  0042_dienstleister_rls_write.sql           RLS using dl_has_tab_access
```
