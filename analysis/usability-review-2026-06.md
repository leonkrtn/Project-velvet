# Forevr — Vollständige Usability- & Logik-Review (2026-06-18)

Branch: `claude/website-usability-review-6h3ghg`
Methodik: systematische Code-Durchsicht aller Rollen-Portale (Veranstalter, Brautpaar/Solo,
Dienstleister, Mitarbeiter, Admin) + Auth/Onboarding + RSVP + Landing Page.
Verifizierte Funde sind mit ✅ markiert; reine Agenten-Meldungen ohne Einzelprüfung mit •.
False Positives wurden entfernt (siehe Abschnitt 11).

---

## 1. Logik- & Routing-Fehler (höchste Priorität)

| # | Datei:Zeile | Problem | Fix |
|---|---|---|---|
| 1.1 ✅ | `app/signup/page.tsx:83,128` | Redirect nach Invite-Einlösung auf `/dashboard?event=…`. `/dashboard` → `/brautpaar`; der `event`-Param geht verloren. **Veranstalter-Invites landen so im Brautpaar-Portal.** | Rollenabhängig redirecten: Brautpaar → `/brautpaar/{eventId}/uebersicht`, Veranstalter → `/veranstalter/events`. |
| 1.2 ✅ | `app/brautpaar/[eventId]/dienstleister/page.tsx:107,147,178` | Solo-Verwaltungsliste zeigt **Personenname statt Firma** (`v.name ?? v.email`). Das ist der gemeldete Painpoint. | `company_name` ins `rows`-Mapping aufnehmen, `company || name || email` rendern (wie `AktiveDienstleisterClient`). |
| 1.3 ✅ | `app/{catering,gaeste,budget,team,tasks,reminders,protokoll,aenderungen,nachrichten,deko,einstellungen,sub-events}/page.tsx` | 12 Top-Level-Stubs leiten auf `/brautpaar/catering` usw. → „catering" wird als `[eventId]` interpretiert → Sackgasse. | Entfernen oder auf `/brautpaar` (Root-Resolver) umbiegen. |
| 1.4 ✅ | `app/rsvp/[token]/page.tsx:1305` | Plural-Bug: `Musikwunsch${n>1?'…e':''}` → rendert „2 Musikwunsch…e". | `Musikwunsch / Musikwünsche` ausschreiben. |

---

## 2. Tote / verwaiste Routen & Komponenten

| # | Ort | Status |
|---|---|---|
| 2.1 ✅ | `app/vendors/page.tsx` | Legacy localStorage-Seite (`lib/store`), `back="/dashboard"` (Route existiert nicht). |
| 2.2 ✅ | `components/dashboard/DashboardWidgets.tsx` | Nirgends importiert. Enthält einzigen Link auf das tote `/vendors`. |
| 2.3 ✅ | `components/AppHeader.tsx` | Nur in einem Kommentar in `ClientLayout.tsx` referenziert → rendert nicht. Enthält Glyph-Icons (✎ ❀ ⚿), Links auf tote `/brautpaar/einstellungen`, `/brautpaar/deko` und `href="#"`. |
| 2.4 • | `app/dashboard/page.tsx` | Reiner Redirect-Stub auf `/brautpaar`; Quelle der Redirect-Verwirrung aus 1.1. |

Empfehlung: 2.1–2.3 löschen (Altlasten, erhöhen Verwirrung & Wartungslast).

---

## 3. Rechtliche / Footer-Dead-Links (Landing Page) — wichtig

✅ `app/page.tsx`
- `:798` Logo-Link `href="#"` (sollte `/` sein).
- `:1188-1191` Footer: **Impressum, Datenschutz, AGB, Cookie-Einstellungen** alle `href="#"`.
- `:1197-1198` „Euer Veranstalter", „Hilfe & Support" `href="#"`.
- `:1205-1207` zweite Footer-Zeile: Impressum/Datenschutz/Cookies `href="#"`.
- Es existiert **keine** `/impressum`, `/datenschutz`, `/agb`-Route (`find` = leer).

→ Impressum/Datenschutz sind in DE Pflicht. Echte Seiten unter `app/(legal)/…` anlegen und verlinken.

---

## 4. Emoji-Verstöße (Projektregel: nur Lucide-Icons) — verifizierte Liste

✅ Alle bestätigt:
- `app/mitarbeiter/[eventId]/schichtplan/SchichtplanClient.tsx:399` `✓` · `:524` `👋` · `:653` `⚠`
- `app/rsvp/[token]/page.tsx:1248` `✓`
- `app/vendor/dashboard/[eventId]/kommunikation/KommunikationClient.tsx:49` `📎 Datei`
- `app/bewerbung/page.tsx:81` `✓`
- `app/admin/create-organizer/page.tsx:186` `✓`
- `app/admin/MarketplaceModerationSection.tsx:131` `✓ Verifiziert`
- `app/brautpaar/[eventId]/uebersicht/BrautpaarUebersicht.tsx:155` `♥` (Countdown-Tag = Hochzeitstag)
- `app/veranstalter/[eventId]/personalplanung/page.tsx:777` `👥` · `:783` `📅` · `:1382` `✨`
- (Dead code, niedrig) `components/AppHeader.tsx:97,100,112` `✎ ❀ ⚿`

→ Durch Lucide ersetzen: Check, Hand/Wave-Alternative weglassen, AlertTriangle, Paperclip, BadgeCheck, Heart, Users, Calendar, Sparkles.

---

## 5. Destruktive Aktionen mit nativem `confirm()`/`alert()`

✅ Bestätigt:
- `app/veranstalter/[eventId]/gaesteliste/GaestelisteClient.tsx:186,215`
- `app/brautpaar/[eventId]/gaeste/BrautpaarGaeste.tsx:411,481`
- `app/veranstalter/konfiguration/KonfigurationClient.tsx:454`
- `app/brautpaar/[eventId]/allgemein/SoloInviteSection.tsx:105`
- `app/admin/PromoCodesSection.tsx:140` · `app/admin/MarketplaceVendorsSection.tsx:62,74 (alert)`
- `components/medien/GuestPhotosSection.tsx:90`

→ Durch einheitlichen In-App-Bestätigungsdialog ersetzen (Muster existiert: `MeineAnfragen.tsx` `EndDialog`).

---

## 6. Fehlendes Speicher-/Fehler-Feedback (Silent Failures)

- ✅ Veranstalter-Module nutzen durchweg optimistische Auto-Saves **ohne** Toast/Erfolg/Fehler-Hinweis (kein `Toast` in `app/veranstalter/[eventId]/**`). Fehler nur `console.error`, z. B. `uebersicht/OrganizerTodoList.tsx:44`.
- ✅ `components/medien/GuestPhotosSection.tsx:108` `catch { /* silent */ }` — Foto-Download-Fehler komplett verschluckt; „Alle herunterladen" meldet keine Teil-Fehler.
- • `app/brautpaar/[eventId]/budget/BrautpaarBudget.tsx:369-378` Löschen ohne Fehler-Feedback.
- • `app/brautpaar/[eventId]/notizen/page.tsx:95-107` Checklist-Toggle ohne Fehler-Toast.
- • `app/veranstalter/[eventId]/personalplanung/page.tsx:410` Lade-Fehler nur `console.error` → graue Seite ohne Meldung.
- • `app/admin/PromoCodesSection.tsx:101-146` Create/Delete/Toggle ohne Erfolg-Feedback.

→ Dezentes globales Toast-/Save-Indicator-System einführen (z. B. „Gespeichert" / „Konnte nicht gespeichert werden").

---

## 7. Onboarding & Auth — Feedback und Sackgassen

- ✅ `app/signup/page.tsx:301-306` Versteckter 8×8px-Admin-Link (`opacity:0.15`, fixed bottom-right) auf öffentlicher Signup-Seite → Security-by-obscurity, entfernen.
- • E-Mail-Confirmation-Texte unklar über Reihenfolge der nächsten Schritte: `app/signup/brautpaar/page.tsx:78`, `app/signup/veranstalter/page.tsx:75`, `app/signup/dienstleister/page.tsx:69` → klare 1-2-3-Sequenz anzeigen.
- • Pro-Gating ohne Upgrade-Link: `app/api/invite/dienstleister/route.ts:61` Fehlertext „…Teil von Forevr Pro" ohne klickbaren Weg zum Abo (Frontend-Seite sollte CTA zeigen).
- • `app/onboarding/page.tsx:152` Validierungs-Toast „Bitte alle Pflichtfelder ausfüllen" nennt nicht, welches Feld/welcher Schritt fehlt.
- • Onboarding ohne Entwurf-/Auto-Save: Seitenschluss nach Step 3 verliert alles (`app/onboarding/page.tsx`).
- • Button-Label-Inkonsistenz: `app/login/page.tsx:173` „Wird geladen …" (besser „Wird angemeldet …"); `app/join/page.tsx:161` „Trete bei …" (besser „Beitreten …").

---

## 8. Anzeige-/Label-Klarheit

- ✅ `app/brautpaar/[eventId]/dienstleister/entdecken/MarktplatzClient.tsx:168-172` Bewertung ist Fake-Platzhalter: immer 5 **leere** Sterne + „Neu" → liest sich wie 0-Sterne-Rating. Entweder echtes Rating oder Sterne entfernen, nur „Neu"-Badge.
- ✅ `components/medien/GuestPhotosSection.tsx:283-294` „Fotoalbum bestellen — Bald verfügbar" toter Platzhalter-Button.
- • `app/vendor/join/JoinClient.tsx` Label „Brautpaar" hartkodiert — bei Event-Typ Firmenevent/intern unpassend (es gibt `event_type` + `EVENT_TYPE_LABELS`).
- • `components/chat/ConversationChat.tsx:111` Empty-State „Schreibt dem Dienstleister" — im Staff↔Organizer-Chat falsche Richtung.
- • `app/admin/MarketplaceModerationSection.tsx:84,129` Firma/Person ohne klare Trennung im Moderations-Kontext.

---

## 9. Validierung & Eingaben

- • RSVP: leere Begleitpersonen-Namen werden gespeichert (`app/rsvp/[token]/page.tsx:412-422,846`) → namenlose Gäste in Catering/Liste; `detailsOk` sollte `companions.every(c=>c.name.trim())` prüfen.
- • Foto-Upload ohne Client-seitige Größenprüfung vor Upload (`components/rsvp/RsvpPhotos.tsx`, `components/medien/GuestPhotosSection.tsx`).
- • Signup: Passwort-/Pflichtfeld-Validierung erst bei Submit, kein Live-Feedback (`app/signup/page.tsx:93`).
- • `app/veranstalter/[eventId]/gaesteliste/GaestelisteClient.tsx` Zimmeranzahl `type=number` ohne `min`.

---

## 10. Kleinere Konsistenz-/Polish-Punkte

- ✅ `app/page.tsx:803/805, 824/826, 1177/1179` Doppelter Nav-Eintrag „Funktionen" (zeigt auf `#lp-features` UND `#lp-funktionen`, beide gleich beschriftet). Umbenennen (z. B. „Funktionen" vs „So funktioniert's").
- • Inkonsistente Debounce-Zeiten (Catering 800 ms vs Getränke 600 ms).
- • „Wird gespeichert …" vs „Speichert …" uneinheitlich.
- • Icon-Buttons ohne `aria-label` (z. B. `CateringForm.tsx`).
- • `app/veranstalter/[eventId]/mitglieder/MitgliederClient.tsx:566,624` zeigt Endnutzern `project-velvet.vercel.app/{join,signup}` — laut CLAUDE.md aktuell **erlaubt**, aber für Außenwirkung besser durch Produktionsdomain (`app.forevr.de`) ersetzen.

---

## 11. Geprüfte False Positives (NICHT umsetzen)

- „Beteiligte" statt „Mitglieder" in `SidebarLayout.tsx:29` — **bewusst** so benannt (CLAUDE.md).
- 💍-Emoji in `app/veranstalter/events/page.tsx:483` — existiert nicht (Fehlmeldung).
- „vervel"-Tippfehler in `MitgliederClient.tsx` — existiert nicht, Text liest korrekt `vercel`.
- „2 Gratismonate" `PromoCodesSection.tsx:160` — grammatikalisch korrekt.

---

## Priorisierte Umsetzungs-Reihenfolge (Vorschlag)

1. **Logik/Routing:** 1.1 (falsches Portal), 1.2 (Firmenname), 1.3 (tote Stubs), 1.4.
2. **Recht:** Abschnitt 3 (Impressum/Datenschutz/AGB).
3. **Feedback:** Abschnitt 6 (Toast-System) + 5 (Confirm-Dialoge).
4. **Emojis:** Abschnitt 4 (Lucide-Ersatz).
5. **Onboarding/Auth:** 7 (versteckter Admin-Link zuerst).
6. **Polish:** 8–10.
