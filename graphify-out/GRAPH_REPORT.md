# Graph Report - .  (2026-04-13)

## Corpus Check
- Corpus is ~35,472 words - fits in a single context window. You may not need a graph.

## Summary
- 158 nodes · 174 edges · 29 communities detected
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Decor & Venue Pages|Decor & Venue Pages]]
- [[_COMMUNITY_Guest Management|Guest Management]]
- [[_COMMUNITY_Project Documentation|Project Documentation]]
- [[_COMMUNITY_Catering & Vendors|Catering & Vendors]]
- [[_COMMUNITY_Event Planning Tools|Event Planning Tools]]
- [[_COMMUNITY_App Header Navigation|App Header Navigation]]
- [[_COMMUNITY_Settings & Onboarding|Settings & Onboarding]]
- [[_COMMUNITY_Dashboard Widgets|Dashboard Widgets]]
- [[_COMMUNITY_Event State Store|Event State Store]]
- [[_COMMUNITY_Seating Chart|Seating Chart]]
- [[_COMMUNITY_Bottom Navigation|Bottom Navigation]]
- [[_COMMUNITY_Hotel Accommodation Tab|Hotel Accommodation Tab]]
- [[_COMMUNITY_Sortable Widget|Sortable Widget]]
- [[_COMMUNITY_Event Context Provider|Event Context Provider]]
- [[_COMMUNITY_Auth Middleware|Auth Middleware]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_Home Page|Home Page]]
- [[_COMMUNITY_Auth Callback|Auth Callback]]
- [[_COMMUNITY_Signup Flow|Signup Flow]]
- [[_COMMUNITY_Login Flow|Login Flow]]
- [[_COMMUNITY_Feature Gating|Feature Gating]]
- [[_COMMUNITY_Client Layout|Client Layout]]
- [[_COMMUNITY_Shared UI Components|Shared UI Components]]
- [[_COMMUNITY_Catering Dashboard Section|Catering Dashboard Section]]
- [[_COMMUNITY_Supabase Client|Supabase Client]]
- [[_COMMUNITY_Supabase Server|Supabase Server]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_TypeScript Env Types|TypeScript Env Types]]
- [[_COMMUNITY_Guest Dashboard Tab|Guest Dashboard Tab]]

## God Nodes (most connected - your core abstractions)
1. `uid()` - 13 edges
2. `Velvet — Hochzeitsplattform` - 8 edges
3. `readFile()` - 6 edges
4. `save()` - 5 edges
5. `fmtMoney()` - 4 edges
6. `rsvpUrl()` - 4 edges
7. `remove()` - 4 edges
8. `getOrganizer()` - 4 edges
9. `Progressive Web App (PWA)` - 4 edges
10. `Datenmodell + localStorage (store.ts)` - 4 edges

## Surprising Connections (you probably didn't know these)
- `addVendor()` --calls--> `uid()`  [EXTRACTED]
  app/vendors/page.tsx → app/budget/page.tsx
- `addTask()` --calls--> `uid()`  [EXTRACTED]
  app/tasks/page.tsx → app/budget/page.tsx
- `save()` --calls--> `uid()`  [EXTRACTED]
  app/veranstalter/page.tsx → app/budget/page.tsx
- `handleImage()` --calls--> `readFile()`  [EXTRACTED]
  app/deko/page.tsx → app/gaeste-fotos/page.tsx
- `handleFormImage()` --calls--> `readFile()`  [EXTRACTED]
  app/veranstalter/page.tsx → app/gaeste-fotos/page.tsx

## Hyperedges (group relationships)
- **PWA Implementation: Layout + Manifest + Mobile-first** — readme_root_layout, readme_manifest, readme_mobile_first, readme_pwa [INFERRED 0.82]
- **Prototype State: localStorage + Fake Data + No Backend** — readme_localstorage_state, readme_fake_guests, readme_no_backend_rationale [EXTRACTED 0.90]
- **Guest Data Flow: RSVP Form → Store → Dashboard** — readme_rsvp_form, readme_store, readme_dashboard [INFERRED 0.88]

## Communities

### Community 0 - "Decor & Venue Pages"
Cohesion: 0.16
Nodes (13): blank(), fmtMoney(), formatDate(), getOrganizer(), handleFormImage(), handleImage(), handleUpload(), readFile() (+5 more)

### Community 1 - "Guest Management"
Cohesion: 0.16
Nodes (9): addGuest(), copy(), deleteGuest(), handleKey(), letterHtml(), mailText(), markInvited(), printLetters() (+1 more)

### Community 2 - "Project Documentation"
Cohesion: 0.16
Nodes (16): Dashboard (Brautpaar), Fake Guest Seed Data (5 Gäste), Design System (globals.css), localStorage-basierter State, PWA Manifest (manifest.json), Mobile-first Design, Next.js 14, Rationale: No Backend for Prototype (+8 more)

### Community 3 - "Catering & Vendors"
Cohesion: 0.17
Nodes (4): accept(), addVendor(), dismiss(), patchDraft()

### Community 4 - "Event Planning Tools"
Cohesion: 0.18
Nodes (3): addItem(), addTask(), uid()

### Community 5 - "App Header Navigation"
Cohesion: 0.24
Nodes (4): applyAccentVars(), applyFontVar(), handleAccent(), handleFont()

### Community 6 - "Settings & Onboarding"
Cohesion: 0.36
Nodes (5): blurBorder(), canNext(), finish(), focusGold(), next()

### Community 7 - "Dashboard Widgets"
Cohesion: 0.29
Nodes (0): 

### Community 8 - "Event State Store"
Cohesion: 0.33
Nodes (2): loadEvent(), saveEvent()

### Community 9 - "Seating Chart"
Cohesion: 0.33
Nodes (1): update()

### Community 10 - "Bottom Navigation"
Cohesion: 0.5
Nodes (0): 

### Community 11 - "Hotel Accommodation Tab"
Cohesion: 0.67
Nodes (0): 

### Community 12 - "Sortable Widget"
Cohesion: 0.67
Nodes (0): 

### Community 13 - "Event Context Provider"
Cohesion: 0.67
Nodes (0): 

### Community 14 - "Auth Middleware"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Root Layout"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Home Page"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Auth Callback"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Signup Flow"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Login Flow"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Feature Gating"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Client Layout"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Shared UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Catering Dashboard Section"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Supabase Client"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Supabase Server"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Next.js Config"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "TypeScript Env Types"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Guest Dashboard Tab"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **8 isolated node(s):** `Next.js 14`, `TypeScript`, `Root Layout + PWA Meta (layout.tsx)`, `PWA Manifest (manifest.json)`, `Design System (globals.css)` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Auth Middleware`** (2 nodes): `middleware()`, `middleware.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root Layout`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Home Page`** (2 nodes): `page.tsx`, `Home()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Callback`** (2 nodes): `route.ts`, `GET()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Signup Flow`** (2 nodes): `page.tsx`, `handleSignup()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login Flow`** (2 nodes): `page.tsx`, `handleLogin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Feature Gating`** (2 nodes): `FeatureGate.tsx`, `useFeatureEnabled()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Client Layout`** (2 nodes): `ClientLayout()`, `ClientLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shared UI Components`** (2 nodes): `index.tsx`, `toggle()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Catering Dashboard Section`** (2 nodes): `toggleArr()`, `CateringSection.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase Client`** (2 nodes): `createClient()`, `client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase Server`** (2 nodes): `server.ts`, `createServerSupabaseClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Config`** (1 nodes): `next.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TypeScript Env Types`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Guest Dashboard Tab`** (1 nodes): `GuestTab.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `uid()` connect `Event Planning Tools` to `Decor & Venue Pages`, `Seating Chart`, `Catering & Vendors`, `Settings & Onboarding`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `save()` connect `Decor & Venue Pages` to `Event Planning Tools`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `Next.js 14`, `TypeScript`, `Root Layout + PWA Meta (layout.tsx)` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._