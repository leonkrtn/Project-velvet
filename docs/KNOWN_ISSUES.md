# Velvet – Known Issues, Bugs & Technical Debt

Severity: 🔴 Critical (data loss / security) · 🟠 High (broken feature) · 🟡 Medium (inconsistency) · 🟢 Low (cleanup)

---

## 🔴 Critical

### 1. Dual permission system — frontend uses wrong table

**File:** `app/vendor/dashboard/[eventId]/VendorDashboardClient.tsx`

**Problem:** The vendor portal determines which tabs are visible in the sidebar by reading from the OLD `permissions` table (mod_* string keys via `ALL_MODULES` from `vendor-modules.ts`). Since migration 0040, the organizer's permission UI (`BerechtigungenClient.tsx`) writes exclusively to `dienstleister_permissions` (NEW system). The two tables are completely separate.

**Effect:**
- Organizer configures vendor access → writes to `dienstleister_permissions` → has NO effect on what vendor sees in the sidebar
- Vendor may see tabs they have no DB access to (gets empty data / RLS blocks)
- Vendor may not see tabs they do have DB access to

**Fix needed:** Replace the `permissions` table read in `VendorDashboardClient` with a read from `dienstleister_permissions` (tab_key → access mapping).

---

### 2. Middleware approval check is logically broken

**File:** `middleware.ts`

**Problem:**
```typescript
const isApproved = metadata?.is_approved_organizer
if (isOrganizerRoute && isApproved === false && isApproved !== undefined) {
  // This condition can NEVER be true
  // === false implies isApproved is false, but !== undefined is true when it's false
  // So the only way both hold is if false !== undefined, which is always true
  // BUT: the condition reads as "is false AND is not undefined" simultaneously
  // which resolves to: false is the value, and false !== undefined is always true
  // → the guard DOES fire when isApproved === false
  // ACTUALLY: re-reading — the bug is this:
  // if isApproved is undefined (no hook set up), condition is false → no redirect
  // This means without the Custom Access Token Hook, ALL users pass organizer routes
}
```

**Actual bug:** If `is_approved_organizer` is not set in JWT claims (Custom Access Token Hook not configured), `isApproved` is `undefined`, and `undefined === false` is `false` → guard never triggers → everyone accesses `/veranstalter/*`.

**Fix needed:** Check `!isApproved` instead of `isApproved === false && isApproved !== undefined`, OR enforce the Custom Access Token Hook in Supabase.

---

### 3. Missing RPCs — proposal sending will fail

**File:** `lib/proposals.ts`

**Problem:** Two RPCs are called that exist in no migration file:
- `send_proposal_with_creator` — called to send a proposal with creator context
- `get_module_master_state` — called to fetch current module state for snapshot

**Effect:** Any attempt to send a proposal will fail with a Supabase function-not-found error. The proposals system is non-functional for the send operation.

**Fix needed:** Write migration defining these two SECURITY DEFINER functions.

---

## 🟠 High (Broken Feature)

### 4. RLS on `location_details`, `media_briefing`, `event_files` uses old permission system

**Affected tables:** `location_details`, `media_briefing`, `event_files`

**Problem:** Their RLS policies reference `has_permission(event_id, 'mod_location')` and `has_permission(event_id, 'mod_media')`. Vendors configured only in the new `dienstleister_permissions` system can never access these tables.

**Fix needed:** Update RLS policies to use `dl_has_tab_access()` like the other tables in migration 0042.

---

### 5. `messages.read_at` never populated

**Table:** `messages`

**Problem:** `read_at TIMESTAMPTZ` column exists in schema but is never written anywhere in the codebase. Unread message indicators (if any exist) will always show as unread.

**Fix needed:** Add read receipt logic when user opens a conversation.

---

### 6. `dienstleister_item_permissions` not cleanly migrated out

**Tables:** `dienstleister_item_permissions`, `dl_can_edit_item()` function

**Problem:** The old item-level permission table and its helper function were not dropped when `dienstleister_permissions` (0040) was introduced. Some RLS policies from migration 0039 may still reference `dl_can_edit_item()`. The behavior when both old and new systems have conflicting entries is undefined.

**Fix needed:** Audit which 0039 policies are still active; drop `dienstleister_item_permissions` if fully superseded.

---

## 🟡 Medium (Inconsistency / Debt)

### 7. `localStorage` data model parallel to Supabase

**File:** `lib/store.ts`

**Problem:** Complete TypeScript event data model with `loadEvent()`/`saveEvent()` persisting to `localStorage` under key `velvet_event_v3`. Many pages still import from this. Any page using `loadEvent()` reads from localStorage, not the database.

**Pages affected:** Any that import `loadEvent`, `saveEvent`, `SEED_EVENT`, or the interfaces (`Guest`, `Hotel`, etc.) from `lib/store.ts` without also fetching from Supabase.

**Risk:** Data shown in UI may not reflect DB state; changes may not persist; data divergence between users on same event.

---

### 8. `timeline_entries.responsibilities` — redundant column

**Table:** `timeline_entries`

**Problem:** `responsibilities TEXT` was the original way to store who is responsible for a timeline item. Migration 0025 added structured `assigned_staff JSONB`, `assigned_vendors JSONB`, `assigned_members JSONB` columns. Both exist; unclear which the UI reads/writes.

**Fix needed:** Determine which field the UI uses, migrate data if needed, drop the other.

---

### 9. `band_tech_requirements` and `band_set_list` tables — orphaned

**Problem:** Created in migration 0002, superseded by `music_requirements` + `music_songs`. Never referenced in any frontend code. Still in DB.

**Fix needed:** Write migration to drop both tables (after confirming no data).

---

### 10. `fotograf_schedule` and `fotograf_deliverables` — DB only, no UI

**Problem:** Created in migration 0002. No frontend page or component references these tables. Data cannot be viewed or edited.

**Fix needed:** Either build UI for these or drop the tables.

---

### 11. `vendor-modules.ts` ALL_MODULES uses old keys

**File:** `lib/vendor-modules.ts`

**Problem:** `ALL_MODULES` array contains objects with old `mod_*` keys. When the old permission system is eventually removed, this will need to be updated to tab_key mapping.

---

### 12. `trauzeuge_permissions` and `brautpaar_permissions` — coverage unclear

**Tables:** `trauzeuge_permissions`, `brautpaar_permissions`

**Problem:** Both tables exist for fine-grained role customization. It's unclear whether the frontend consistently reads these permissions or sometimes hardcodes access. No permission editor UI for trauzeuge confirmed in analysis.

---

### 13. `dienstleister_profiles` vs `user_dienstleister` — potential redundancy

**Problem:** `dienstleister_profiles` (user_id UNIQUE FK) and `user_dienstleister` (user_id, dienstleister_id) may both serve to link a user to their vendor profile. The relationship between these two tables is unclear.

---

## 🟢 Low (Cleanup)

### 14. `SEED_EVENT` in `lib/store.ts`

**Problem:** Hard-coded mock wedding event data injected into localStorage on first load. Will pollute localStorage in production for new users.

### 15. `v_event_guest_counts` and `v_event_allergy_aggregate` views — usage unclear

**Problem:** Created in migration 0002. Not confirmed to be used in frontend. May be dead code.

### 16. `sub_events` table — no confirmed UI

**Problem:** `sub_events` table exists (e.g., pre-ceremony, afterparty). Not confirmed to have a dedicated editing UI.

### 17. `tasks` and `reminders` — overlap unclear

**Problem:** Both `tasks` (assigned_to, status) and `reminders` (is_done) exist. It's unclear if both have UIs or if one superseded the other.

### 18. `audit_log` — write path unclear

**Problem:** `audit_log` table exists but no trigger or explicit write path confirmed in migrations or frontend.

---

## Migration Order Reference

| Migration | Description |
|---|---|
| `setup.sql` | Base schema (all core tables, RLS, helper functions) |
| `0002` | Vendor-specific tables (catering_menu_items, fotograf_*, band_*, views) |
| `0003` | New dashboard schema (events columns, brautpaar_permissions, conversations) |
| `0008` | Vendor system (event_invitations, permissions OLD, RPCs, location_details, patisserie_config, media_*, music_*, decor_*, event_files) |
| `0016` | organizer_staff |
| `0019` | organizer_todos |
| `0020` | event_code + auto-generate trigger |
| `0021` | event_organizer_costs |
| `0022` | projektphase_enum + column |
| `0025` | assigned_staff/vendors/members JSONB on timeline_entries |
| `0026` | catering_plans extensions |
| `0028` | Proposals V1 (DROPPED by 0031) |
| `0031` | Proposals V2 (complete replacement) |
| `0038` | organizer_room_configs + event_room_configs |
| `0039` | dienstleister_item_permissions (OLD granular item system) |
| `0040` | dienstleister_permissions (NEW unified system) + data migration |
| `0042` | dl_has_tab_access() + updated RLS for all vendor-accessible tables |
