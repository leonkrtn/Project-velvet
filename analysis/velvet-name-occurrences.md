# Analyse: Alle "Velvet"-Vorkommen im Projekt

> Erstellt: 2026-06-12  
> Zweck: Vollständige Inventur aller Stellen, die den Namen "Velvet" enthalten — als Grundlage für ein späteres Rebranding.

> **STATUS: Rebranding zu "Forevr" am 2026-06-12 durchgeführt.**
> Wordmarks/Logo erscheinen als FOREVR (Cormorant Garamond, Letterspacing), Fließtext als "Forevr", Tarife als "Forevr" / "Forevr Pro".
> Bewusst NICHT umbenannt (siehe Abschnitte 2–4): localStorage/sessionStorage-Keys (`velvet_*`), Window-Events (`velvet-saved`, `velvet-tab-change`), Cloudflare-Worker (`velvet-file-service`), R2-Bucket (`velvet-files`), Vercel-URL (`project-velvet.vercel.app`) — Code zeigt weiterhin auf die bestehende Infrastruktur.
> Umbenannte Dateien: `VelvetPdfDocument.tsx` → `ForevrPdfDocument.tsx`, `velvet-overview.html` → `forevr-overview.html`. Das Landing-Page-Logo (`logo.png`) wurde durch ein Text-Wordmark ersetzt.

---

## 1. Package- & Config-Dateien

| Datei | Zeile | Inhalt |
|---|---|---|
| `package.json` | 2 | `"name": "velvet"` |
| `package-lock.json` | 2, 8 | `"name": "velvet"` |
| `workers/file-service/package.json` | 2 | `"name": "velvet-file-service"` |
| `workers/file-service/package-lock.json` | 2, 8 | `"name": "velvet-file-service"` |
| `workers/file-service/wrangler.toml` | 1 | `name = "velvet-file-service"` |
| `workers/file-service/wrangler.toml` | 10 | `bucket_name = "velvet-files"` |
| `workers/file-service/wrangler.toml` | 18 | `# R2_BUCKET_NAME=velvet-files` (Kommentar) |

---

## 2. Umgebungsvariablen / Env-Dateien

| Datei | Zeile | Inhalt |
|---|---|---|
| `.env.local.example` | 13 | Kommentar: `https://velvet-file-service.ACCOUNT.workers.dev` |
| `.env.local.example` | 15 | `FILE_WORKER_URL=https://velvet-file-service.ACCOUNT.workers.dev` |
| `.env.local.example` | 28 | Kommentar: `R2_BUCKET_NAME → velvet-files` |
| `.env.local.example` | 32 | Kommentar: `Name: velvet-files` |

---

## 3. localStorage / sessionStorage Keys & Custom Events

| Datei | Zeile | Key |
|---|---|---|
| `lib/store.ts` | 330 | `'velvet_event_v3'` (localStorage) |
| `components/AppHeader.tsx` | 136 | `'velvet_current_path'` (sessionStorage) |
| `components/AppHeader.tsx` | 138–139 | `'velvet_back_target'`, `'velvet_current_path'` |
| `components/AppHeader.tsx` | 149, 161, 167 | `'velvet_display'` (localStorage) |
| `components/AppHeader.tsx` | 174 | `'velvet_back_target'` |
| `components/AppHeader.tsx` | 184 | `'velvet_event_v3'` (localStorage.removeItem) |
| `components/BottomNav.tsx` | 10 | `'velvet_dashboard_tab'` (localStorage) |
| `components/BottomNav.tsx` | 42–43, 56 | `'velvet-tab-change'` (window event) |
| `lib/event-context.tsx` | 203, 207 | `'velvet-saved'` (window event) |
| `velvet-overview.html` | 1604, 1612 | `'velvet-theme'` (localStorage) |

---

## 4. Vercel / externe URLs im Quellcode

| Datei | Zeile | URL |
|---|---|---|
| `app/veranstalter/[eventId]/mitglieder/MitgliederClient.tsx` | 566 | `project-velvet.vercel.app/join` |
| `app/veranstalter/[eventId]/mitglieder/MitgliederClient.tsx` | 624 | `project-velvet.vercel.app/signup` |
| `app/page.tsx` | 506 | `app.velvet.de` (Demo-URL in Landing Page) |

---

## 5. Dateinamen (müssen umbenannt werden)

| Pfad | Typ |
|---|---|
| `velvet-overview.html` | Standalone-HTML-Datei |
| `components/pdf/VelvetPdfDocument.tsx` | Komponentendatei |

---

## 6. TypeScript/TSX — Komponentennamen & Imports

| Datei | Zeile | Inhalt |
|---|---|---|
| `components/pdf/VelvetPdfDocument.tsx` | 34 | `function VelvetPdfDocument(...)` |
| `components/pdf/VelvetPdfDocument.tsx` | 37 | `'${data.event.title} – Velvet'` |
| `components/pdf/VelvetPdfDocument.tsx` | 59, 61 | `author="Velvet"`, `creator="Velvet Event Management"` |
| `components/pdf/PdfBlobProvider.tsx` | 3, 9, 14, 28 | Import + Verwendung von `VelvetPdfDocument` |
| `components/pdf/PdfCoverPage.tsx` | 112 | `Velvet Event Management` (JSX-Text) |

---

## 7. TypeScript/TSX — Console-Logs, Fehlermeldungen, Kommentare

| Datei | Zeile | Inhalt |
|---|---|---|
| `lib/event-context.tsx` | 236, 246, 258, 266, 270 | `[Velvet]` Präfix in console.log/error |
| `lib/supabase/admin.ts` | 7 | `'[Velvet] SUPABASE_SERVICE_ROLE_KEY not set...'` |
| `lib/store.ts` | 1 | Kommentar: `// lib/store.ts — Velvet complete data model` |
| `components/ui/index.tsx` | 1 | Kommentar: `// Velvet · Black/White/Gold` |
| `components/deko/DekoFloatingToolbar.tsx` | 63 | Kommentar: `220px Velvet sidebar` |
| `app/admin/AdminClient.tsx` | 31 | Kommentar: `kein Velvet-Branding` |
| `app/veranstalter/[eventId]/pdf-export/PdfExportClient.tsx` | 13 | Kommentar: `VelvetPdfDocument + ...` |
| `app/api/deko/og-preview/route.ts` | 9 | User-Agent: `'Mozilla/5.0 (compatible; Velvet/1.0)'` |

---

## 8. TypeScript/TSX — Download-Dateinamen

| Datei | Zeile | Inhalt |
|---|---|---|
| `components/medien/GuestPhotosSection.tsx` | 115 | `velvet-foto-${...}.jpg` |
| `app/veranstalter/[eventId]/pdf-export/PdfExportClient.tsx` | 169 | `velvet-export-${...}.pdf` |

---

## 9. Abo-/Plan-Namen (Produktname im UI)

| Datei | Zeile | Inhalt |
|---|---|---|
| `lib/subscription.ts` | 12 | `basis: 'Velvet'`, `pro: 'Velvet Pro'` |
| `app/admin/SubscriptionsSection.tsx` | 24 | `'Velvet (25 €)'`, `'Velvet Pro (55 €)'` |
| `app/admin/SubscriptionsSection.tsx` | 157–158 | `Auf Velvet setzen`, `Auf Velvet Pro setzen` |
| `app/brautpaar/[eventId]/abo/AboClient.tsx` | 25–26, 56, 59, 70, 102, 110, 353, 467 | `'Velvet'`, `'Velvet Pro'` (diverse UI-Texte) |
| `app/page.tsx` | 913, 928, 933, 943, 988–992 | Preisseite + FAQ: `Velvet`, `Velvet Pro` |

---

## 10. UI-Text (öffentliche Seiten, Wordmarks)

| Datei | Zeilen | Inhalt |
|---|---|---|
| `app/layout.tsx` | 7, 13 | `'Velvet — Hochzeitsplattform'`, `'Velvet'` (Page-Title) |
| `public/manifest.json` | 2, 3 | `"name": "Velvet — Hochzeitsplattform"`, `"short_name": "Velvet"` |
| `app/page.tsx` | 666, 1032 | `alt="Velvet"` (Logo) |
| `app/page.tsx` | 478, 736, 751, 777, 1064 | UI-Texte auf Landing Page |
| `components/AppHeader.tsx` | 231, 393, 413, 435, 534, 536 | `Velvet.` Wordmark im Header |
| `app/join/page.tsx` | 105 | `Velvet.` Wordmark |
| `app/login/page.tsx` | 111 | `Velvet.` Wordmark |
| `app/signup/page.tsx` | 147, 160 | `Velvet.` Wordmark |
| `app/signup/brautpaar/page.tsx` | 73, 90 | `Velvet.` Wordmark |
| `app/signup/veranstalter/page.tsx` | 72, 89 | `Velvet.` Wordmark |
| `app/password-reset/page.tsx` | 40, 58 | `Velvet.` Wordmark |
| `app/password-reset/update/page.tsx` | 43 | `Velvet.` Wordmark |
| `app/einladung/[token]/page.tsx` | 60 | `Velvet.` Wordmark |
| `app/onboarding/page.tsx` | 162, 178 | `Velvet.`, `Willkommen bei Velvet` |
| `app/vendor/dashboard/page.tsx` | 27 | `Velvet.` Wordmark |
| `app/vendor/join/JoinClient.tsx` | 87 | `Velvet` |
| `app/veranstalter/pending/page.tsx` | 53 | `Velvet.` Wordmark |
| `app/brautpaar/[eventId]/BrautpaarShell.tsx` | 126 | `Willkommen bei Velvet` |
| `app/rsvp/[token]/page.tsx` | 313 | `Velvet.` Wordmark |
| `app/bewerbung/page.tsx` | 111 | `Events auf Velvet zu erstellen` |

---

## 11. Pro-Feature Upsell-Texte

| Datei | Zeilen | Inhalt |
|---|---|---|
| `app/brautpaar/[eventId]/dienstleister/page.tsx` | 64, 67, 81, 101 | `Velvet Pro` Upsell |
| `app/brautpaar/[eventId]/nachrichten/page.tsx` | 80 | `Velvet Pro` Upsell |
| `app/brautpaar/[eventId]/allgemein/SoloInviteSection.tsx` | 169, 251 | `Velvet Pro`, `Velvet-Konto` |
| `app/api/invite/create/route.ts` | 61 | `Velvet Pro` in Fehlermeldung |
| `app/api/invite/dienstleister/route.ts` | 58 | `Velvet Pro` in Fehlermeldung |
| `app/api/vendor/invite/route.ts` | 37 | `Velvet Pro` in Fehlermeldung |
| `app/api/vendor/signup-code/route.ts` | 36 | `Velvet Pro` in Fehlermeldung |

---

## 12. CSS-Dateien (Kommentare)

| Datei | Zeile | Inhalt |
|---|---|---|
| `app/globals.css` | 1 | `/* styles/globals.css — Velvet · Apple-style monochrome */` |
| `app/landing.css` | 1 | `/* Velvet Landing Page — scoped to .landing-root */` |
| `app/brautpaar/brautpaar.css` | 2 | `Velvet — Brautpaar Design System` |

---

## 13. Datenbank-Migrations-Kommentare (SQL)

| Datei | Zeile | Inhalt |
|---|---|---|
| `supabase/setup.sql` | 2 | `-- Velvet Wedding Platform — Production-Ready...` |
| `supabase/migrations/0002_*.sql` | 2 | `-- Velvet Migration 0002 —` |
| `supabase/migrations/0003_*.sql` | 2 | `-- Velvet Migration 0003 —` |
| `supabase/migrations/0004_*.sql` | 2 | `-- Velvet Migration 0004 —` |
| `supabase/migrations/0008_*.sql` | 2 | `-- Velvet Migration 0008 —` |
| `supabase/migrations/0009_*.sql` | 2 | `-- Velvet Migration 0009 —` |
| `supabase/migrations/0024_*.sql` | 2 | `-- Velvet Migration 0024 —` |

---

## 14. Dokumentation / Markdown

| Datei | Zeile | Inhalt |
|---|---|---|
| `README.md` | 1, 29 | `# Velvet — Hochzeitsplattform`, Verzeichnisstruktur |
| `CLAUDE.md` | 1, 220, 235, 455, 543, 551 | Diverse Verweise |
| `docs/DATABASE.md` | 1 | `# Velvet – Database Schema Reference` |
| `docs/ARCHITECTURE.md` | 1, 284 | `# Velvet – Architecture Reference` |
| `docs/KNOWN_ISSUES.md` | 1, 102 | `# Velvet – Known Issues...` |

---

## 15. Standalone HTML

| Datei | Zeilen | Inhalt |
|---|---|---|
| `velvet-overview.html` | 6, 629, 1496 | Page-Title, H1, `velvet-files` Referenz |

---

## Hinweise für das Rebranding

1. **Datei umbenennen:** `components/pdf/VelvetPdfDocument.tsx` — alle Imports in `PdfBlobProvider.tsx` und `PdfExportClient.tsx` mitanpassen
2. **Datei umbenennen (optional):** `velvet-overview.html`
3. **Cloudflare R2 Bucket** (`velvet-files`) und **Worker** (`velvet-file-service`) müssen **außerhalb des Repos** manuell in Cloudflare umbenannt werden — Codeänderung allein reicht dort nicht
4. **Vercel URL** (`project-velvet.vercel.app`) muss im Vercel-Dashboard umbenannt werden
5. **localStorage-Keys** (`velvet_event_v3` etc.) sollten mit einer Migration/Fallback versehen werden, damit bestehende Browser-Daten von Nutzern nicht verloren gehen
