# Velvet — Hochzeitsplattform

Mobile-first Web App Prototyp · Next.js 14 + TypeScript

## Setup

```bash
# 1. Dependencies installieren
npm install

# 2. Dev-Server starten
npm run dev

# 3. Im Browser öffnen
# http://localhost:3000
```

## Auf dem iPhone testen (Safari)

1. Mac & iPhone im selben WLAN
2. `npm run dev` auf dem Mac starten
3. Mac-IP-Adresse finden: `ipconfig getifaddr en0`
4. In Safari auf dem iPhone öffnen: `http://[MAC-IP]:3000`
5. Als App hinzufügen: Teilen → "Zum Home-Bildschirm"

## Struktur

```
velvet/
├── app/
│   ├── layout.tsx          # Root Layout + PWA Meta
│   ├── page.tsx            # Redirect → /dashboard
│   ├── dashboard/
│   │   └── page.tsx        # Brautpaar Dashboard
│   └── rsvp/[token]/
│       └── page.tsx        # Gäste RSVP Formular
├── components/
│   └── ui/index.tsx        # Shared UI Components
├── lib/
│   └── store.ts            # Datenmodell + localStorage
├── styles/
│   └── globals.css         # Design System
└── public/
    └── manifest.json       # PWA Manifest
```

## Features

### Dashboard (Brautpaar)
- Live-Übersicht: Zusagen / Absagen / Ausstehend
- Menüauswertung mit Balken
- Allergien & Unverträglichkeiten
- Hotel-Kontingent-Belegung
- Ankunftsverteilung
- Gästeliste mit Löschen-Funktion
- Timeline-Ansicht
- Demodaten zurücksetzen

### RSVP-Formular (Gäste)
- Personalisierte Einladungsseite
- Schritt-für-Schritt Flow (4 Steps)
- Zu-/Absage + Begleitperson
- Menüwahl (Fleisch / Fisch / Vegetarisch / Vegan)
- Allergien-Picker (8 Tags)
- Ankunftsdatum, -zeit, Transport
- Hotelzimmer buchen (aus Kontingent)
- Nachricht ans Brautpaar
- Bestätigungsseite mit Zusammenfassung

### State
- localStorage-basiert (kein Backend nötig für Prototyp)
- 5 Fake-Gäste (3 zugesagt, 1 ausstehend, 1 abgesagt)
- Gäste können gelöscht werden
- RSVP-Änderungen werden live im Dashboard sichtbar

## RSVP Test-Links

| Gast | Token | Status |
|------|-------|--------|
| Marie Koch | tok-marie | Zugesagt |
| Bernd Huber | tok-bernd | Zugesagt |
| Lena Müller | tok-lena | Zugesagt |
| Anna Schulz | tok-anna | **Ausstehend** ← Am besten zum Testen |
| Frank Kaiser | tok-frank | Abgesagt |

→ `/rsvp/tok-anna` für unausgefülltes Formular

## Production Build

```bash
npm run build
npm run start
```

Für Deployment: Vercel empfohlen (`vercel deploy`)
