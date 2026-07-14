// Kurze Onboarding-Tour (max. 10 Schritte, 1 pro Kachel).
//
// Wird einmalig automatisch nach dem Onboarding-Wizard gestartet (localStorage-
// gesteuert in VendorTour via autoStartOnceKey) und kann NICHT über den Hilfe-
// Button ausgelöst werden — dieser startet die ausführliche Tour.
//
// Bewusst nur zentrierte Karten (kein `target`): so entfällt das Warten auf
// data-tour-Anker, jeder Schritt erscheint sofort nach dem Seitenwechsel.

import type { VendorTourStep } from '@/lib/tour/vendor-tour-steps'

export const VENDOR_QUICK_TOUR_START_EVENT = 'fv-vendor-quicktour-start'
export const VENDOR_QUICK_TOUR_DONE_KEY = 'fv-vendor-quicktour'

export const VENDOR_QUICK_TOUR_STEPS: VendorTourStep[] = [
  {
    module: 'ubersicht', area: 'ubersicht',
    title: 'Willkommen — ein kurzer Rundgang',
    body: 'In 9 kurzen Schritten zeigen wir dir dein Portal. Die Übersicht ist dein Startpunkt: Anfragen, Angebote, Events und der Wert deiner Pipeline auf einen Blick.',
  },
  {
    module: 'anfragen', area: 'anfragen',
    title: 'Anfragen',
    body: 'Hier landen alle Anfragen von Brautpaaren aus dem Marktplatz. Zu jeder Anfrage erstellt Forevr automatisch einen Angebotsentwurf, den du nur noch prüfst und freigibst.',
  },
  {
    module: 'angebote', area: 'angebote',
    title: 'Angebote',
    body: 'Alle deine Angebote über sämtliche Events hinweg — nach Status gruppiert (Entwurf, Versendet, Angenommen). Bearbeiten, freigeben oder als PDF herunterladen mit einem Klick.',
  },
  {
    module: 'events', area: 'events',
    title: 'Events',
    body: 'Alle Hochzeiten und Events, bei denen du dabei bist. Im Event-Portal findest du Kommunikation mit dem Brautpaar, Informationen und deine Angebote.',
  },
  {
    module: 'report', area: 'berichte',
    title: 'Berichte',
    body: 'Deine Zahlen auf einen Blick: Umsatz, Annahmequote und Antwortzeiten. So siehst du, wie dein Geschäft läuft.',
  },
  {
    module: 'crm', area: 'crm',
    title: 'CRM',
    body: 'Alle Kontakte und Leads an einem Ort — mit Anfragen, Angeboten, Notizen und Aufgaben je Brautpaar. Damit keine Nachfrage liegen bleibt.',
  },
  {
    module: 'automatik', area: 'automatik',
    title: 'Automatik',
    body: 'Erinnerungen, Bewertungs-Anfragen und Follow-ups laufen automatisch. Einmal einstellen — dann arbeitet das Portal für dich.',
  },
  {
    module: 'listing', area: 'listing',
    title: 'Dein Anbieter-Profil',
    body: 'Hier pflegst du deinen Marktplatz-Auftritt: Fotos, Pakete, FAQs — mit Live-Vorschau rechts. Vervollständige dein Profil und reiche es zur Prüfung ein.',
  },
  {
    module: 'anfrage-formular', area: 'anfrage-formular',
    title: 'Dein Anfrageformular',
    body: 'Die Fragen, die Brautpaare vor einer Anfrage beantworten — Grundlage für dein automatisches Angebot. Lade eine Vorlage für deine Kategorie und passe sie an.',
  },
  {
    module: 'listing', area: 'listing',
    title: 'Fertig! Brauchst du Hilfe?',
    body: 'Das war der Schnellstart. Für eine ausführliche Erklärung jedes Bereichs klicke jederzeit auf „Hilfe & Erklärungen" in deinem Profil.',
  },
]
