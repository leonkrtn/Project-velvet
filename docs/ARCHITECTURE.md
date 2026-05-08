# Velvet – Architecture Reference

---

## Auth Flow

```
User visits protected route
  → middleware.ts checks session cookie
  → No session → redirect /login
  → Has session + /veranstalter/* route
      → check app_metadata.is_approved_organizer
      → ⚠️ BUG: approval check never triggers (see KNOWN_ISSUES)
  → Route rendered
      → Supabase server client (cookies) used in Server Components
      → Supabase browser client used in Client Components
```

### Supabase Auth Setup
- Email/password signup
- OAuth (Google, etc.)
- `auth/callback/route.ts` handles OAuth redirect + code exchange
- `profiles` table mirrors `auth.users` (trigger on insert)
- Custom Access Token Hook (optional): embeds `is_approved_organizer` into JWT claims

---

## Role Dashboard Architecture

### Veranstalter (`/veranstalter/[eventId]/...`)
- Full admin over their events
- All tabs accessible
- Can invite vendors, configure permissions, manage guests, run proposals
- Server Components fetch initial data; Client Components handle mutations
- Pattern: `PageServerComponent` (fetches) → `ClientForm` (renders + mutates)

### Brautpaar (`/brautpaar/[eventId]/...`)
- Subset of organizer tabs
- `brautpaar_permissions` table controls which editing rights are granted
- Read access to all data; write access conditional

### Trauzeuge (`/trauzeuge/[eventId]/...`)
- Read-heavy portal
- `trauzeuge_permissions` table controls visibility of guests/budget/vendors
- Cannot edit most things

### Dienstleister / Vendor (`/vendor/dashboard/[eventId]/`)
- Single-page tab-based portal (`VendorDashboardClient.tsx`)
- Tab visibility: controlled by OLD `permissions` table (mod_* keys) ← **BUG**
- Data access: controlled by NEW `dienstleister_permissions` + RLS ← **CORRECT**
- Proposal inbox: `VendorInboxView` component, proposals from organizer

---

## Vendor Dashboard Tab Registry

```typescript
// In VendorDashboardClient.tsx
const LEGACY_TAB_REGISTRY = {
  chat:      ChatTab,
  timeline:  TimelineTab,
  location:  LocationTab,
  guests:    GuestsTab,
  seating:   SeatingTab,
  catering:  CateringTab,
  files:     FilesTab,
}

// These use shared components:
const SHARED_TAB_MODULES = ['musik', 'patisserie', 'dekoration', 'medien']
// → MusikTabContent, PatisserieTabContent, DekoTabContent, MediaTabContent
```

Tab filtering logic (WRONG — uses old system):
```typescript
const visibleModules = ALL_MODULES.filter(m => permissions.includes(m.key))
// permissions = string[] of mod_* keys from old `permissions` table
```

---

## Permission System: Complete Picture

### Who writes what

| Action | Writes to |
|---|---|
| Organizer configures vendor tab access | `dienstleister_permissions` (NEW) |
| Old vendor invite flow | `permissions` (OLD) |
| Vendor joins via invite code | `event_members` (role=dienstleister) |

### Who reads what

| Consumer | Reads from | Effect |
|---|---|---|
| `VendorDashboardClient` tab visibility | `permissions` (OLD) | What tabs vendor SEES |
| Database RLS on all tables | `dienstleister_permissions` (NEW) | What data vendor CAN ACCESS |
| `BerechtigungenClient` | `dienstleister_permissions` (NEW) | What organizer CONFIGURES |

### Gap

If vendor was invited via old flow: has `permissions` rows (OLD), no `dienstleister_permissions` rows (NEW).
→ Sees tabs in sidebar, but all DB queries return empty (RLS blocks).

If organizer configured via new BerechtigungenClient: has `dienstleister_permissions` rows (NEW), no `permissions` rows (OLD).
→ Cannot see any tabs in sidebar, but DB would allow access if tabs were shown.

### Fix required
`VendorDashboardClient` needs to read from `dienstleister_permissions` instead of `permissions` for tab visibility.

---

## Proposals V2 Data Flow

```
Organizer creates proposal (segment + recipients)
  → proposal row created (status: draft)
  → proposal_recipients rows created
  → proposal_snapshots created (current state snapshot)
  → Status → sent

Vendor receives notification (Realtime or inbox count)
  → Opens VendorInboxView → ProposalLightbox
  → Sees current_value vs proposed_value per field
  → Can accept/reject/modify fields
  → Field locking prevents concurrent edits (30s TTL, heartbeat)

Both parties iterate until consensus
  → check_proposal_consensus() RPC
  → If conflict → open_case_for_proposal() → case_messages thread

Merge
  → validate_merge_proposal() → checks all fields accepted
  → finalize_merge() → writes actual changes to live tables
  → history_log entry created
```

### Delta Engine (`lib/proposals.ts`)

`computeDeltas(snapshot: ProposalSnapshot)` returns per-field diff:
- `diffTopLevel(current, proposed)` — scalar field comparison
- `diffEntities(currentArr, proposedArr)` — array diff by entity ID
  - Returns: `added[]`, `removed[]`, `modified[]`, `unchanged[]`

### Field Lock Lifecycle
```
acquireFieldLock(proposalId, fieldKey) → 30s lock or throws if locked
startLockHeartbeat(proposalId, fieldKey) → setInterval(25s, heartbeat)
releaseFieldLock(proposalId, fieldKey) → release immediately
cleanup_expired_locks() → server-side cleanup RPC
```

---

## Realtime Subscriptions

All defined in `lib/proposals.ts`:

```typescript
subscribeToProposal(proposalId, onFieldChange)
  // Channel: proposal:{proposalId}
  // Listens: proposal_fields UPDATE

subscribeToCaseMessages(caseId, onMessage)
  // Channel: case:{caseId}
  // Listens: case_messages INSERT

subscribeToEventProposals(eventId, onProposal)
  // Channel: event-proposals:{eventId}
  // Listens: proposals INSERT + UPDATE (for inbox badge)
```

---

## Data Flow: Guest RSVP

```
Organizer creates invite_code for guest
  → invite_codes row (code, guest_id, event_id)
  → sends link: /join?code=XXXXXX

Guest visits /join?code=XXXXXX
  → preview_invitation_code(code) RPC → returns event info
  → Guest fills RSVP form
  → redeem_invite_code(code) RPC
     → sets invite_codes.used_at
     → creates/updates guests row with rsvp_status='confirmed'
     → creates event_members row (role determined by invite type)
```

---

## Data Flow: Vendor Onboarding

```
Organizer creates event_invitation (category, code)
  → Sends link to vendor: /join?code=XXXXXX

Vendor visits link
  → Authenticates (login/signup)
  → join_event_by_code(code) RPC
     → Creates event_members row (role='dienstleister')
     → Marks event_invitations.used_at, used_by
     → Returns event_id for redirect to /vendor/dashboard/[eventId]

Organizer configures permissions
  → /veranstalter/[eventId]/berechtigungen/[dienstleisterId]
  → BerechtigungenClient writes to dienstleister_permissions

⚠️ Vendor will NOT see configured tabs until VendorDashboardClient
   is updated to read from dienstleister_permissions
```

---

## Data Flow: Organizer Sets Up Event

```
Organizer creates event
  → /veranstalter/dashboard → "New Event"
  → events row created
  → event_members row (role='veranstalter', user_id=organizer)
  → event_code auto-generated (trigger: auto_generate_event_code)

Organizer fills event details
  → AllgemeinForm.tsx → updates events table
  → event_organizer_costs CRUD inline

Organizer adds content
  → Timeline: timeline_entries CRUD
  → Guests: guests CRUD + invite_codes
  → Seating: seating_tables + seating_assignments
  → Catering: catering_plans CRUD
  → Music: music_songs + music_requirements
  → Decor: decor_setup_items + deko_wishes
  → Media: media_shot_items + media_briefing
  → Patisserie: patisserie_config (upsert)
```

---

## Key Component Patterns

### Server Component (data fetch)
```typescript
// app/veranstalter/[eventId]/catering/page.tsx
export default async function CateringPage({ params }) {
  const supabase = createServerClient(cookies())
  const { data } = await supabase.from('catering_plans').select('*').eq('event_id', params.eventId)
  return <CateringClient initialData={data} eventId={params.eventId} />
}
```

### Client Component (optimistic update)
```typescript
'use client'
// Supabase browser client
// Immediate UI update, then supabase.from(...).upsert(...)
// Error handling: revert optimistic state on failure
```

### Sticky Save Pattern (`AllgemeinForm.tsx`)
```
User edits field → isDirty = true → sticky save bar appears
User clicks Save → upsert to Supabase → success toast → isDirty = false
```

---

## Storage Buckets

Referenced in code but bucket names not all confirmed from migrations:
- `media-uploads` — for media_uploads table
- `location-images` — for location_images table
- `guest-photos` — for guest RSVP photos
- `event-files` — for event_files table

---

## Legacy: `lib/store.ts`

Complete TypeScript data model that predates Supabase integration.

**Still active:** Many pages import types from `store.ts`. `loadEvent()`/`saveEvent()` persist to `localStorage` under key `velvet_event_v3`.

**Interfaces:** `Guest`, `Hotel`, `SubEvent`, `SeatingTable`, `BudgetItem`, `Vendor`, `Task`, `Reminder`, `CateringPlan`, `OrganizerSettings`, `Event` (the local one, not DB events).

**`SEED_EVENT`:** Hard-coded mock data injected into localStorage on first load.

**Impact:** Any page using `loadEvent()` reads from localStorage, not Supabase. These two data sources are not synced. If a page mixes both (e.g., reads guests from Supabase but reads vendors from localStorage), data can diverge.
