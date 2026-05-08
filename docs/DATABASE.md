# Velvet – Database Schema Reference

Source of truth: `/supabase/migrations/` (applied in order) + `/supabase/setup.sql`.
All tables have RLS enabled unless noted. SECURITY DEFINER functions bypass RLS.

---

## ENUM Types

```sql
user_role:         veranstalter | brautpaar | trauzeuge | dienstleister
projektphase_enum: planung | organisation | finalplanung | event | abschluss
```

---

## Core Tables

### `profiles`
Extended user profile, linked 1:1 to `auth.users`.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | = auth.users.id |
| email | TEXT | |
| full_name | TEXT | |
| avatar_url | TEXT | |
| is_approved_organizer | BOOLEAN | Controls access to /veranstalter |
| created_at | TIMESTAMPTZ | |

### `events`
Central event record.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| title | TEXT | |
| couple_name | TEXT | Names on invite |
| date | DATE | Wedding date |
| ceremony_start | TIME | |
| description | TEXT | |
| location_name | TEXT | |
| location_address | TEXT | |
| location_maps_url | TEXT | |
| max_begleitpersonen | INTEGER | Max companions per guest |
| children_allowed | BOOLEAN | |
| children_max_age | INTEGER | |
| budget_total | NUMERIC | |
| organizer_fee | NUMERIC | |
| organizer_fee_type | TEXT | 'fixed' \| 'percent' |
| internal_notes | TEXT | |
| dresscode | TEXT | |
| menu_type | TEXT | |
| collect_allergies | BOOLEAN | |
| projektphase | projektphase_enum | |
| event_code | TEXT UNIQUE | 6-char join code |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `event_members`
Links users to events with a role.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK → events | |
| user_id | UUID FK → profiles | |
| role | user_role | |
| joined_at | TIMESTAMPTZ | |
| UNIQUE | (event_id, user_id) | |

### `invite_codes`
RSVP invite links for guests.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| code | TEXT UNIQUE | |
| guest_id | UUID FK → guests | nullable |
| used_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### `event_invitations`
Vendor invite links.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| code | TEXT UNIQUE | |
| vendor_category | TEXT | |
| used_at | TIMESTAMPTZ | |
| used_by | UUID FK → profiles | |
| created_at | TIMESTAMPTZ | |

---

## Guest Management

### `guests`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| name | TEXT | |
| email | TEXT | |
| phone | TEXT | |
| dietary_restrictions | TEXT | |
| allergies | TEXT | |
| rsvp_status | TEXT | 'pending'\|'confirmed'\|'declined' |
| seat_preference | TEXT | |
| notes | TEXT | |
| group_name | TEXT | |
| table_number | INTEGER | |
| invite_code | TEXT | |
| created_at | TIMESTAMPTZ | |

### `begleitpersonen`
Companions linked to a guest.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| guest_id | UUID FK → guests | |
| event_id | UUID FK | |
| name | TEXT | |
| dietary_restrictions | TEXT | |
| allergies | TEXT | |
| age | INTEGER | |

---

## Seating

### `seating_tables`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| name | TEXT | |
| capacity | INTEGER | |
| shape | TEXT | 'round'\|'rectangular' |
| position_x | NUMERIC | |
| position_y | NUMERIC | |

### `seating_assignments`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| table_id | UUID FK → seating_tables | |
| guest_id | UUID FK → guests | nullable |
| seat_number | INTEGER | |

---

## Timeline / Schedule

### `timeline_entries`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| title | TEXT | |
| description | TEXT | |
| start_time | TIME | legacy |
| start_minutes | INTEGER | minutes from midnight |
| duration_minutes | INTEGER | |
| category | TEXT | |
| checklist | JSONB | [{text, done}] |
| responsibilities | TEXT | **REDUNDANT** — see assigned_* |
| assigned_staff | JSONB | [{id, name}] |
| assigned_vendors | JSONB | [{id, name}] |
| assigned_members | JSONB | [{id, name}] |
| sort_order | INTEGER | |

---

## Catering

### `catering_plans`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| name | TEXT | |
| menu_courses | JSONB | Array of course objects |
| sektempfang | JSONB | Welcome drink config |
| weinbegleitung | JSONB | Wine pairing config |
| kinder_meal_options | JSONB | Children's options |
| plan_guest_count_enabled | BOOLEAN | |
| plan_guest_count | INTEGER | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

### `catering_menu_items`
Legacy catering items (from 0002).
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| name | TEXT | |
| description | TEXT | |
| category | TEXT | |
| dietary_info | TEXT | |
| price | NUMERIC | |

---

## Music

### `music_songs`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| title | TEXT | |
| artist | TEXT | |
| section | TEXT | 'ceremony'\|'reception'\|'party' etc |
| status | TEXT | 'suggested'\|'approved'\|'rejected' |
| notes | TEXT | |
| suggested_by | UUID FK → profiles | |

### `music_requirements`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| category | TEXT | |
| description | TEXT | |
| is_fulfilled | BOOLEAN | |

### `band_tech_requirements` *(DEAD — no UI)*
Legacy table from 0002. Superseded by `music_requirements`.

### `band_set_list` *(DEAD — no UI)*
Legacy table from 0002. Superseded by `music_songs`.

---

## Decor

### `decor_setup_items`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| name | TEXT | |
| category | TEXT | |
| quantity | INTEGER | |
| status | TEXT | |
| notes | TEXT | |
| assigned_to | UUID FK → profiles | |

### `deko_wishes`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| description | TEXT | |
| reference_image_url | TEXT | |
| status | TEXT | |
| notes | TEXT | |

---

## Media

### `media_shot_items`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| title | TEXT | |
| description | TEXT | |
| category | TEXT | |
| priority | TEXT | |
| is_must_have | BOOLEAN | |
| status | TEXT | |

### `media_uploads`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| shot_item_id | UUID FK → media_shot_items | nullable |
| storage_path | TEXT | Supabase Storage path |
| file_name | TEXT | |
| uploaded_by | UUID FK → profiles | |
| created_at | TIMESTAMPTZ | |

### `media_briefing`
Full media briefing document per event.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK UNIQUE | |
| content | JSONB | Free-form briefing data |
| updated_at | TIMESTAMPTZ | |

Note: RLS still references old `has_permission(event_id, 'mod_media')`.

### `fotograf_schedule` *(DEAD — no UI)*
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| time | TIME | |
| description | TEXT | |

### `fotograf_deliverables` *(DEAD — no UI)*
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| description | TEXT | |
| deadline | DATE | |
| is_delivered | BOOLEAN | |

---

## Patisserie

### `patisserie_config`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK UNIQUE | |
| cake_type | TEXT | |
| tiers | INTEGER | |
| flavor | TEXT | |
| decoration_style | TEXT | |
| dietary_requirements | TEXT | |
| serving_count | INTEGER | |
| notes | TEXT | |
| custom_fields | JSONB | |
| updated_at | TIMESTAMPTZ | |

---

## Hotels

### `hotels`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| name | TEXT | |
| address | TEXT | |
| contact_name | TEXT | |
| contact_email | TEXT | |
| contact_phone | TEXT | |
| check_in_date | DATE | |
| check_out_date | DATE | |
| notes | TEXT | |
| total_rooms | INTEGER | |
| booked_rooms | INTEGER | |

### `hotel_rooms`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| hotel_id | UUID FK → hotels | |
| event_id | UUID FK | |
| room_type | TEXT | |
| guest_id | UUID FK → guests | nullable |
| is_reserved | BOOLEAN | |
| notes | TEXT | |

---

## Budget

### `budget_items`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| category | TEXT | |
| description | TEXT | |
| estimated_cost | NUMERIC | |
| actual_cost | NUMERIC | |
| is_paid | BOOLEAN | |
| vendor_id | UUID FK → vendors | nullable |
| notes | TEXT | |

### `event_organizer_costs`
Organizer's own line items (separate from budget_items).
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| label | TEXT | |
| amount | NUMERIC | |
| source | TEXT | 'manual'\|'catering' etc |
| notes | TEXT | |

---

## Vendors / Dienstleister

### `vendors`
Generic vendor contact book.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| name | TEXT | |
| category | TEXT | |
| contact_name | TEXT | |
| email | TEXT | |
| phone | TEXT | |
| website | TEXT | |
| notes | TEXT | |
| price | NUMERIC | |
| is_booked | BOOLEAN | |

### `dienstleister_profiles`
Self-managed profile for vendor users.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → profiles UNIQUE | |
| company_name | TEXT | |
| category | TEXT | |
| description | TEXT | |
| logo_url | TEXT | |
| website | TEXT | |
| phone | TEXT | |
| created_at | TIMESTAMPTZ | |

### `user_dienstleister`
Links auth users to their dienstleister_profile (may be redundant with above).
| Column | Type | Notes |
|---|---|---|
| user_id | UUID | |
| dienstleister_id | UUID | |

### `event_dienstleister`
Links events to vendor users.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| dienstleister_user_id | UUID FK → profiles | |
| category | TEXT | |
| added_at | TIMESTAMPTZ | |

---

## Permission Tables

### `permissions` *(OLD system — partially deprecated)*
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| user_id | UUID FK → profiles | |
| permission | TEXT | 'mod_chat', 'mod_timeline', 'mod_timeline_read', 'mod_seating', 'mod_seating_read', 'mod_catering', 'mod_catering_read', 'mod_music', 'mod_music_read', 'mod_patisserie', 'mod_patisserie_read', 'mod_decor', 'mod_decor_read', 'mod_media', 'mod_media_read', 'mod_location', 'mod_guests' |
| UNIQUE | (event_id, user_id, permission) | |

### `dienstleister_permissions` *(NEW system — written by UI, enforced by RLS)*
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| dienstleister_user_id | UUID FK → profiles | |
| tab_key | TEXT | See tab keys below |
| item_id | TEXT | NULL = tab level; non-null = item override |
| access | TEXT | 'none'\|'read'\|'write' |
| UNIQUE NULLS NOT DISTINCT | (event_id, dienstleister_user_id, tab_key, item_id) | |

Valid tab_key values: `uebersicht`, `allgemein`, `catering`, `chats`, `ablaufplan`, `gaesteliste`, `musik`, `patisserie`, `dekoration`, `medien`, `sitzplan`, `vorschlaege`

### `dienstleister_item_permissions` *(OLD granular system — mostly superseded)*
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| dienstleister_user_id | UUID FK | |
| module | TEXT | Old module name |
| item_id | TEXT | |
| can_view | BOOLEAN | |
| can_edit | BOOLEAN | |

---

## Chat / Conversations

### `conversations`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| title | TEXT | |
| created_by | UUID FK → profiles | |
| created_at | TIMESTAMPTZ | |

### `conversation_participants`
| Column | Type | Notes |
|---|---|---|
| conversation_id | UUID FK | |
| user_id | UUID FK | |
| joined_at | TIMESTAMPTZ | |

### `messages`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| conversation_id | UUID FK | |
| sender_id | UUID FK → profiles | |
| content | TEXT | |
| read_at | TIMESTAMPTZ | **NEVER POPULATED** |
| created_at | TIMESTAMPTZ | |

---

## Proposals V2

### `proposals`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| segment | TEXT | 'catering'\|'ablaufplan'\|'hotel'\|'musik'\|'dekoration'\|'patisserie'\|'vendor'\|'sitzplan' |
| created_by | UUID FK → profiles | |
| title | TEXT | |
| status | TEXT | 'draft'\|'sent'\|'resolved'\|'cancelled' |
| deadline | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### `proposal_recipients`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| proposal_id | UUID FK | |
| user_id | UUID FK → profiles | |
| status | TEXT | 'pending'\|'accepted'\|'declined'\|'counter' |
| responded_at | TIMESTAMPTZ | |

### `proposal_snapshots`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| proposal_id | UUID FK | |
| recipient_id | UUID FK → proposal_recipients | |
| type | TEXT | 'current'\|'proposed' |
| data | JSONB | Full segment state |
| created_at | TIMESTAMPTZ | |

### `proposal_fields`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| proposal_id | UUID FK | |
| recipient_id | UUID FK | |
| field_key | TEXT | |
| current_value | JSONB | |
| proposed_value | JSONB | |
| status | TEXT | 'pending'\|'accepted'\|'rejected'\|'modified' |
| locked_by | UUID FK → profiles | nullable |
| locked_at | TIMESTAMPTZ | nullable |

### `cases`
Conflict resolution threads.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| proposal_id | UUID FK | |
| field_key | TEXT | |
| opened_by | UUID FK | |
| status | TEXT | 'open'\|'resolved' |
| resolution | TEXT | nullable |
| created_at | TIMESTAMPTZ | |

### `case_messages`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| case_id | UUID FK | |
| sender_id | UUID FK | |
| content | TEXT | |
| created_at | TIMESTAMPTZ | |

### `field_locks`
Optimistic concurrent editing, 30s TTL.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| proposal_id | UUID FK | |
| field_key | TEXT | |
| locked_by | UUID FK | |
| expires_at | TIMESTAMPTZ | now() + 30s |
| created_at | TIMESTAMPTZ | |

### `history_log`
Audit trail for proposal actions.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| proposal_id | UUID FK | |
| actor_id | UUID FK | |
| action | TEXT | |
| payload | JSONB | |
| created_at | TIMESTAMPTZ | |

---

## Organizer Tools

### `organizer_todos`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → profiles | |
| event_id | UUID FK | nullable |
| title | TEXT | |
| is_done | BOOLEAN | |
| due_date | DATE | |
| created_at | TIMESTAMPTZ | |

### `organizer_staff`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| organizer_id | UUID FK → profiles | |
| name | TEXT | |
| role | TEXT | |
| email | TEXT | |
| phone | TEXT | |

### `organizer_room_configs`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK UNIQUE | One config per organizer |
| points | JSONB | Polygon corner [{x,y}] in metres |
| elements | JSONB | Placed elements [{id,type,x,y}] |
| updated_at | TIMESTAMPTZ | |

### `event_room_configs`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK UNIQUE | One config per event |
| user_id | UUID FK | Veranstalter who set it |
| points | JSONB | |
| elements | JSONB | |
| updated_at | TIMESTAMPTZ | |

### `feature_toggles`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| feature | TEXT | |
| enabled | BOOLEAN | |

---

## Other

### `audit_log`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| user_id | UUID FK | |
| action | TEXT | |
| table_name | TEXT | |
| record_id | UUID | |
| old_data | JSONB | |
| new_data | JSONB | |
| created_at | TIMESTAMPTZ | |

### `location_details`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK UNIQUE | |
| floor_plan_url | TEXT | |
| capacity_notes | TEXT | |
| parking_info | TEXT | |
| accessibility_info | TEXT | |
| custom_fields | JSONB | |

Note: RLS uses `has_permission(event_id, 'mod_location')` — old system.

### `location_images`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| storage_path | TEXT | |
| description | TEXT | |
| sort_order | INTEGER | |

### `guest_photos`
RSVP photo uploads.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| guest_id | UUID FK | |
| event_id | UUID FK | |
| storage_path | TEXT | |
| created_at | TIMESTAMPTZ | |

### `event_files`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| name | TEXT | |
| storage_path | TEXT | |
| uploaded_by | UUID FK | |
| created_at | TIMESTAMPTZ | |

Note: RLS uses old `has_permission(event_id, 'mod_location')`.

### `sub_events`
Sub-ceremonies or additional events.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| name | TEXT | |
| date | DATE | |
| time | TIME | |
| location | TEXT | |
| notes | TEXT | |

### `reminders`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| title | TEXT | |
| due_date | DATE | |
| is_done | BOOLEAN | |

### `tasks`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| title | TEXT | |
| assigned_to | UUID FK → profiles | |
| due_date | DATE | |
| status | TEXT | |
| notes | TEXT | |

### `trauzeuge_permissions`
Per-event permissions for trauzeuge role.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| user_id | UUID FK | |
| can_see_guests | BOOLEAN | |
| can_see_budget | BOOLEAN | |
| can_see_vendors | BOOLEAN | |

### `brautpaar_permissions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID FK | |
| user_id | UUID FK | |
| can_edit_timeline | BOOLEAN | |
| can_edit_seating | BOOLEAN | |
| can_edit_music | BOOLEAN | |

---

## Views

```sql
v_event_guest_counts      -- guest count + begleitpersonen per event
v_event_allergy_aggregate -- allergy aggregation per event
```

---

## Key RPCs (SECURITY DEFINER)

| Function | Purpose |
|---|---|
| `is_event_member(event_id, roles[])` | Check user role membership |
| `is_event_frozen(event_id)` | Check freeze status |
| `has_permission(event_id, mod_key)` | OLD permission check |
| `dl_has_tab_access(event_id, tab_key, min_access)` | NEW RLS helper |
| `dl_get_access(event_id, user_id, tab_key, item_id)` | NEW: get exact access level |
| `dl_can_edit_item(event_id, mod_key, module, item_id)` | OLD item-level edit check |
| `join_event_by_code(code)` | Join event by 6-char code |
| `redeem_invite_code(code)` | Redeem RSVP invite |
| `preview_invitation_code(code)` | Preview invite without redeeming |
| `adjust_hotel_booking(...)` | Hotel room adjustment |
| `acquire_field_lock(proposal_id, field_key)` | Lock field for editing |
| `release_field_lock(proposal_id, field_key)` | Release lock |
| `heartbeat_field_lock(proposal_id, field_key)` | Extend lock TTL |
| `check_proposal_consensus(proposal_id)` | Check if all recipients agreed |
| `open_case_for_proposal(proposal_id, field_key)` | Open conflict case |
| `validate_merge_proposal(proposal_id)` | Pre-merge validation |
| `finalize_merge(proposal_id)` | Complete the merge |
| `write_proposal_history(...)` | Write audit log entry |
| `cleanup_expired_locks()` | Cleanup stale field locks |
| **`send_proposal_with_creator`** | **MISSING — not in any migration** |
| **`get_module_master_state`** | **MISSING — not in any migration** |
