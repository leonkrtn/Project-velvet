# Fehleranalyse Forevr — 2026-06-14

Tiefgründige Analyse über alle Fehlerklassen: statische Checks, Sicherheit,
Laufzeit-/Logikfehler, sowie Doku-Drift. Branch: `claude/error-analysis-thpe86`.

## Methodik

- `tsc --noEmit` (echter Typecheck nach `npm install`)
- `next build` (Compile + Typecheck + Prerender)
- `next lint` (ESLint)
- Manuelle Code-Review: Middleware, alle 53 API-Routen-Muster, Service-Role-Nutzung,
  Realtime-Cleanup, Permission-Systeme, gängige Bug-Muster (XSS, lose Vergleiche, Secret-Logs).

## Zusammenfassung

| Kategorie | Ergebnis |
|---|---|
| TypeScript `tsc --noEmit` | **0 Fehler** |
| `next build` Compile + Typecheck | **erfolgreich** |
| `next build` Prerender | scheitert nur env-bedingt (siehe #5) |
| ESLint | **nicht konfiguriert** (siehe #6) |
| XSS (`dangerouslySetInnerHTML`) | keine Fundstellen |
| Secret-Logging | keine Fundstellen |

---

## Befunde

### #1 — SSRF in OG-Preview-Endpoint · **Hoch**
`app/api/deko/og-preview/route.ts:8`

Der Endpoint fetcht eine beliebige, vom Client gelieferte URL (`?url=`) serverseitig,
ohne Schema- oder IP-Validierung. Da die Middleware **alle `/api/`-Routen als public
durchlässt** (`middleware.ts:63`), ist der Endpoint sogar unauthentifiziert erreichbar.

**Exploit:** `GET /api/deko/og-preview?url=http://169.254.169.254/latest/meta-data/`
oder `http://localhost:<port>/` → Probing interner Dienste / Cloud-Metadata aus dem
Vercel-/Server-Netzwerk. Geparste `<meta>`/`<title>`-Inhalte werden zurückgegeben.

**Fix:** URL-Schema auf `http(s)` beschränken, DNS auflösen und private/loopback/
link-local-IP-Bereiche (RFC1918, 127.0.0.0/8, 169.254.0.0/16, `::1`, fc00::/7) ablehnen;
Redirects nicht folgen oder pro Hop revalidieren; optional Auth verlangen.

### #2 — Unauthentifizierter Migrations-Endpoint · **Mittel**
`app/api/init-db/route.ts:11`

`POST /api/init-db` ruft ohne jegliche Authentifizierung `runMigrations()` auf (DDL
über `DATABASE_URL`, vermutlich privilegierte Rolle). Nur ein In-Memory-Flag
(`migrationRan`) bremst — pro neuer Server-Instanz/Lambda erneut auslösbar.

**Risiko:** Abuse/DoS gegen die DB, ungewollte Schema-Operationen durch beliebige Besucher.

**Fix:** Hinter `ADMIN_SECRET`-Bearer legen (wie `app/api/admin/approve-organizer/route.ts`
es korrekt macht) oder den Endpoint entfernen und Migrationen ausschließlich im Deploy fahren.

### #3 — Realtime-Channel-Leak im Personalplanung-Chat · **Mittel**
`app/veranstalter/[eventId]/personalplanung/page.tsx:621`

`openChat()` erstellt bei jedem Aufruf `supabase.channel(\`chat-${conversationId}\`).subscribe()`,
ohne den Channel je via `removeChannel` zu entfernen und ohne das Subscribe-Handle zu speichern.

**Folgen:** (a) Memory-/Connection-Leak — Channels akkumulieren über die Session;
(b) doppelte INSERT-Handler nach mehrfachem Chat-Öffnen → Nachrichten werden mehrfach
an `chatMessages` angehängt.

**Fix:** Channel-Referenz in einem Ref halten, beim erneuten Öffnen / im `useEffect`-Cleanup
`supabase.removeChannel(ref.current)` aufrufen. Andere Realtime-Stellen
(`ChatsClient`, `useDekoRealtime`, `SchichtplanClient`) räumen korrekt auf.

### #4 — Doku-Drift: CLAUDE.md beschreibt zwei bereits gefixte Bugs · **Niedrig (irreführend)**

CLAUDE.md führt zwei Bugs als „aktiv“:

1. **Middleware-Approval-Bug** (`isApproved === false && isApproved !== undefined`).
   Tatsächlich prüft `middleware.ts:98-109` jetzt autoritativ über die `profiles`-Tabelle
   (`is_approved_organizer`). Der beschriebene Bug existiert nicht mehr.
2. **Dual-Permission-System** (Vendor-Sidebar liest altes `permissions`-System).
   Tatsächlich liest `app/vendor/dashboard/[eventId]/VendorSidebarLayout.tsx:53` jetzt
   aus `dienstleister_permissions` (neues System) und filtert per `access !== 'none'`.

**Empfehlung:** CLAUDE.md aktualisieren, damit die Doku nicht zu Fehlannahmen führt.

### #5 — Prerender erzeugt Supabase-Client ohne Env-Guard · **Niedrig (latent)**
`app/veranstalter/voreinstellungen/page.tsx:48`

Die Seite ruft `createClient()` synchron im Render-Body. `lib/supabase/client.ts`
liest `NEXT_PUBLIC_SUPABASE_*!` ungeprüft. Trotz `dynamic = 'force-dynamic'` prerendert
Next die Seite einmal beim Build → ohne Env-Vars Build-Abbruch
(`Your project's URL and API key are required`). In Produktion mit gesetzten Env-Vars
baut es durch, daher niedrige Priorität — aber die Seite hat keinen graziösen Fallback.

**Fix:** Client lazy in `useEffect`/`useMemo` erzeugen, oder Env in `createClient()`
defensiv prüfen (wie es `middleware.ts:36` tut).

### #6 — Kein ESLint konfiguriert · **Niedrig**

`next lint` bricht interaktiv ab (keine ESLint-Config im Repo) und ist in Next 16
entfernt. Es läuft also faktisch kein Linting in CI.

**Fix:** ESLint-Flat-Config + `eslint-config-next` committen und auf die ESLint-CLI migrieren.

---

## Was sauber ist

- TypeScript strict: 0 Fehler; `next build` kompiliert + typed clean.
- API-Auth-Muster überwiegend korrekt: Service-Role-Routen prüfen vorher Membership/Rolle
  (vorbildlich: `app/api/events/[eventId]/cover/route.ts` `assertCoverAccess`).
- Admin-Routen via `ADMIN_SECRET`-Bearer geschützt.
- Kein `dangerouslySetInnerHTML`, keine Secret-Logs, keine `TODO/FIXME/HACK`-Marker.
