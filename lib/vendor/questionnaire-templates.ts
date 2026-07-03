// Kategorie-Startvorlagen für den Anfrageformular-Builder. Client-safe (kein
// server-only). Der Dienstleister übernimmt eine Vorlage als Startpunkt und
// passt sie anschließend an; gespeichert wird erst beim Speichern im Builder.
// Alle Preise sind bewusst marktübliche Richtwerte — der Dienstleister soll
// sie durch seine eigenen ersetzen.

import type { QuestionType, QuestionPricing, QuestionnaireSettings } from './questionnaire'

export interface TemplateOption { label: string; price?: number; perGuest?: boolean }
export interface TemplateQuestion {
  type: QuestionType
  label: string
  help_text?: string
  required?: boolean
  options?: TemplateOption[]
  pricing?: QuestionPricing
}
export interface TemplateSection {
  title: string
  description?: string
  questions: TemplateQuestion[]
}
export interface QuestionnaireTemplate {
  settings: Partial<QuestionnaireSettings>
  sections: TemplateSection[]
}

const fotograf: QuestionnaireTemplate = {
  settings: { title: 'Fotografie — Angebotsanfrage', base_price: 1200, min_total: 900, valid_days: 21 },
  sections: [
    {
      title: 'Umfang',
      description: 'Wie viel Begleitung wünscht ihr euch?',
      questions: [
        { type: 'single', label: 'Gewünschtes Paket', required: true, options: [
          { label: 'Standesamt (bis 3 Std.)', price: 0 },
          { label: 'Halber Tag (bis 6 Std.)', price: 600 },
          { label: 'Ganzer Tag (bis 12 Std.)', price: 1400 },
        ] },
        { type: 'number', label: 'Zusätzliche Stunden', help_text: 'Über das gewählte Paket hinaus', pricing: { mode: 'per_unit', unitPrice: 180, unitLabel: 'Std.', min: 0, step: 1, optional: true } },
        { type: 'boolean', label: 'Getting Ready begleiten', help_text: 'Vorbereitungen von Braut und/oder Bräutigam', pricing: { mode: 'fixed', price: 250, optional: true } },
        { type: 'boolean', label: 'Zweiter Fotograf', pricing: { mode: 'fixed', price: 500, optional: true } },
      ],
    },
    {
      title: 'Leistungen & Extras',
      questions: [
        { type: 'boolean', label: 'Verlobungs- / Paarshooting vorab', pricing: { mode: 'fixed', price: 350, optional: true } },
        { type: 'boolean', label: 'Gedrucktes Fotoalbum', pricing: { mode: 'fixed', price: 280, optional: true } },
        { type: 'multi', label: 'Zusatzoptionen', options: [
          { label: 'Drohnenaufnahmen', price: 250 },
          { label: 'Same-Day-Edit (erste Bilder am Abend)', price: 400 },
          { label: 'Express-Lieferung (1 Woche)', price: 200 },
          { label: 'Alle Bilder in Schwarz-Weiß zusätzlich', price: 100 },
        ] },
      ],
    },
    {
      title: 'Eure Wünsche',
      questions: [
        { type: 'text', label: 'Besondere Wünsche / Momente', help_text: 'z. B. First Look, bestimmte Gruppenfotos, wichtige Personen' },
      ],
    },
  ],
}

const videograf: QuestionnaireTemplate = {
  settings: { title: 'Hochzeitsfilm — Angebotsanfrage', base_price: 1500, min_total: 1200, valid_days: 21 },
  sections: [
    {
      title: 'Film & Umfang',
      description: 'Welchen Film wünscht ihr euch von eurem Tag?',
      questions: [
        { type: 'single', label: 'Gewünschtes Filmpaket', required: true, options: [
          { label: 'Highlight-Film (3–5 Min.)', price: 0 },
          { label: 'Highlight-Film + Langversion (20–40 Min.)', price: 700 },
          { label: 'Dokumentarische Komplett-Begleitung', price: 1400 },
        ] },
        { type: 'number', label: 'Zusätzliche Drehstunden', help_text: 'Über das gewählte Paket hinaus', pricing: { mode: 'per_unit', unitPrice: 190, unitLabel: 'Std.', min: 0, step: 1, optional: true } },
        { type: 'boolean', label: 'Zweite Kamera / Second Shooter', help_text: 'Empfohlen für Trauung und Reden', pricing: { mode: 'fixed', price: 550, optional: true } },
      ],
    },
    {
      title: 'Extras',
      questions: [
        { type: 'multi', label: 'Zusatzoptionen', options: [
          { label: 'Drohnenaufnahmen', price: 300 },
          { label: 'Same-Day-Edit (Film am Abend zeigen)', price: 600 },
          { label: 'Rohmaterial-Übergabe', price: 250 },
          { label: 'Social-Media-Teaser (Hochformat, 60 Sek.)', price: 180 },
        ] },
        { type: 'boolean', label: 'Ton der Trauung / Reden aufzeichnen', help_text: 'Ansteckmikrofone und separate Tonspur', pricing: { mode: 'fixed', price: 200, optional: true } },
      ],
    },
    {
      title: 'Eure Wünsche',
      questions: [
        { type: 'text', label: 'Stil & Musikrichtung', help_text: 'z. B. emotional, cineastisch, dokumentarisch — gern mit Beispielfilmen' },
        { type: 'text', label: 'Besondere Momente, die im Film nicht fehlen dürfen' },
      ],
    },
  ],
}

const catering: QuestionnaireTemplate = {
  settings: { title: 'Catering — Angebotsanfrage', per_guest_price: 75, min_total: 1500, valid_days: 21 },
  sections: [
    {
      title: 'Verpflegung',
      questions: [
        { type: 'single', label: 'Art des Essens', required: true, options: [
          { label: 'Flying Buffet', price: 0 },
          { label: 'Buffet', price: 0 },
          { label: '3-Gang-Menü (mit Service)', price: 8, perGuest: true },
          { label: '4-Gang-Menü (mit Service)', price: 15, perGuest: true },
        ] },
        { type: 'number', label: 'Davon Kinder (ermäßigt)', help_text: 'Kinder bis 12 Jahre', pricing: { mode: 'per_unit', unitPrice: -35, unitLabel: 'Kinder', min: 0, step: 1 } },
        { type: 'multi', label: 'Besondere Ernährungsformen', help_text: 'Ohne Aufpreis — hilft uns bei der Menüplanung', options: [
          { label: 'Vegetarisch', price: 0 },
          { label: 'Vegan', price: 0 },
          { label: 'Glutenfrei', price: 0 },
          { label: 'Halal', price: 0 },
        ] },
        { type: 'boolean', label: 'Mitternachtssnack', pricing: { mode: 'fixed', price: 6, perGuest: true, optional: true } },
      ],
    },
    {
      title: 'Getränke & Service',
      questions: [
        { type: 'single', label: 'Getränkepauschale', options: [
          { label: 'Keine — Getränke stellt die Location / ihr selbst', price: 0 },
          { label: 'Standard (Softdrinks, Bier, Wein, Sekt)', price: 29, perGuest: true },
          { label: 'Premium (zusätzlich Longdrinks & Cocktails)', price: 42, perGuest: true },
        ] },
        { type: 'boolean', label: 'Servicepersonal stellen', pricing: { mode: 'fixed', price: 600, optional: true } },
        { type: 'boolean', label: 'Geschirr, Besteck & Gläser inklusive', pricing: { mode: 'fixed', price: 350, optional: true } },
      ],
    },
    {
      title: 'Details',
      questions: [
        { type: 'text', label: 'Allergien / besondere Wünsche', help_text: 'z. B. Nussallergie, Lieblingsgericht, regionale Küche' },
      ],
    },
  ],
}

const dj_musik: QuestionnaireTemplate = {
  settings: { title: 'DJ — Angebotsanfrage', base_price: 900, min_total: 700, valid_days: 21 },
  sections: [
    {
      title: 'Einsatz',
      description: 'Im Grundpreis enthalten: bis 6 Stunden Spielzeit inkl. Ton-Anlage.',
      questions: [
        { type: 'number', label: 'Spielstunden über 6 Std. hinaus', help_text: 'Jede weitere Stunde nach den inkludierten 6 Stunden', pricing: { mode: 'per_unit', unitPrice: 120, unitLabel: 'Std.', min: 0, step: 1, optional: true } },
        { type: 'boolean', label: 'Sektempfang beschallen', help_text: 'Hintergrundmusik + Mikrofon für Reden', pricing: { mode: 'fixed', price: 200, optional: true } },
        { type: 'boolean', label: 'Freie Trauung beschallen', help_text: 'Separate Technik + Funkmikrofone am Trauort', pricing: { mode: 'fixed', price: 350, optional: true } },
      ],
    },
    {
      title: 'Licht & Technik',
      questions: [
        { type: 'single', label: 'Lichtpaket', options: [
          { label: 'Standard (Tanzflächen-Licht)', price: 0 },
          { label: 'Erweitert (Movingheads)', price: 300 },
          { label: 'Premium (inkl. Ambiente-Uplights im Saal)', price: 600 },
        ] },
        { type: 'boolean', label: 'Nebelmaschine / Hazer', help_text: 'Bitte vorher mit der Location klären (Rauchmelder!)', pricing: { mode: 'fixed', price: 80, optional: true } },
      ],
    },
    {
      title: 'Eure Musik',
      questions: [
        { type: 'text', label: 'Lieblings-Genres / Must-Plays', help_text: 'z. B. Eröffnungstanz, Lieder mit besonderer Bedeutung' },
        { type: 'text', label: 'No-Gos', help_text: 'Was auf keinen Fall laufen soll' },
      ],
    },
  ],
}

const band: QuestionnaireTemplate = {
  settings: { title: 'Live-Band — Angebotsanfrage', base_price: 2400, min_total: 1800, valid_days: 21 },
  sections: [
    {
      title: 'Besetzung & Umfang',
      description: 'Im Grundpreis enthalten: 3 Sets à 45 Minuten am Abend.',
      questions: [
        { type: 'single', label: 'Besetzung', required: true, options: [
          { label: 'Duo (Gesang + Gitarre/Piano)', price: -1200 },
          { label: 'Trio', price: -600 },
          { label: 'Volle Band (4–5 Musiker)', price: 0 },
        ] },
        { type: 'number', label: 'Zusätzliche Sets (45 Min.)', pricing: { mode: 'per_unit', unitPrice: 350, unitLabel: 'Sets', min: 0, step: 1, optional: true } },
        { type: 'boolean', label: 'Akustik-Set zur Trauung', pricing: { mode: 'fixed', price: 400, optional: true } },
        { type: 'boolean', label: 'Akustik-Set zum Sektempfang', pricing: { mode: 'fixed', price: 300, optional: true } },
      ],
    },
    {
      title: 'Technik & Pausen',
      questions: [
        { type: 'boolean', label: 'Ton- & Lichttechnik durch die Band stellen', help_text: 'Falls die Location keine eigene Anlage hat', pricing: { mode: 'fixed', price: 450, optional: true } },
        { type: 'single', label: 'Musik in den Band-Pausen', options: [
          { label: 'Eigene Playlist (ihr kümmert euch)', price: 0 },
          { label: 'DJ-Service durch die Band', price: 350 },
        ] },
      ],
    },
    {
      title: 'Eure Musik',
      questions: [
        { type: 'text', label: 'Wunschlieder', help_text: 'z. B. Eröffnungstanz — wir prüfen, was wir live umsetzen können' },
        { type: 'text', label: 'Musikrichtung / Stimmung', help_text: 'z. B. Soul & Pop, Rock-lastig, eher ruhig beim Dinner' },
      ],
    },
  ],
}

const floristik: QuestionnaireTemplate = {
  settings: { title: 'Floristik — Angebotsanfrage', min_total: 500, valid_days: 21 },
  sections: [
    {
      title: 'Braut & Trauung',
      questions: [
        { type: 'boolean', label: 'Brautstrauß', pricing: { mode: 'fixed', price: 120 } },
        { type: 'boolean', label: 'Wurfstrauß (kleinere Zweitversion)', pricing: { mode: 'fixed', price: 45, optional: true } },
        { type: 'number', label: 'Ansteckblumen (Bräutigam, Trauzeugen …)', pricing: { mode: 'per_unit', unitPrice: 12, unitLabel: 'Stück', min: 0, step: 1, optional: true } },
        { type: 'boolean', label: 'Traubogen / Altar-Schmuck', pricing: { mode: 'fixed', price: 350, optional: true } },
      ],
    },
    {
      title: 'Tische & Location',
      questions: [
        { type: 'number', label: 'Anzahl Tischgestecke', pricing: { mode: 'per_unit', unitPrice: 45, unitLabel: 'Stück', min: 0, step: 1 } },
        { type: 'boolean', label: 'Kirchen- / Trauort-Schmuck (Bänke, Eingang)', pricing: { mode: 'fixed', price: 180, optional: true } },
        { type: 'boolean', label: 'Autoschmuck', pricing: { mode: 'fixed', price: 60, optional: true } },
      ],
    },
    {
      title: 'Stil',
      questions: [
        { type: 'single', label: 'Stilrichtung', options: [
          { label: 'Klassisch-romantisch', price: 0 },
          { label: 'Boho / Wildblumen', price: 0 },
          { label: 'Modern / minimalistisch', price: 0 },
        ] },
        { type: 'text', label: 'Wunschfarben & Lieblingsblumen', help_text: 'z. B. Creme & Eukalyptus, keine Lilien' },
      ],
    },
  ],
}

const deko: QuestionnaireTemplate = {
  settings: { title: 'Dekoration — Angebotsanfrage', base_price: 350, min_total: 400, valid_days: 21 },
  sections: [
    {
      title: 'Konzept',
      description: 'Im Grundpreis enthalten: Konzeptberatung und Planung eurer Deko.',
      questions: [
        { type: 'single', label: 'Stilrichtung', required: true, options: [
          { label: 'Klassisch-elegant', price: 0 },
          { label: 'Boho / Vintage', price: 0 },
          { label: 'Modern / minimalistisch', price: 0 },
          { label: 'Noch unentschlossen — beratet uns', price: 0 },
        ] },
        { type: 'text', label: 'Farbwelt & Inspiration', help_text: 'z. B. Pinterest-Board, Mottos, Farbcodes' },
      ],
    },
    {
      title: 'Elemente',
      questions: [
        { type: 'number', label: 'Anzahl Gästetische (Tischdeko)', help_text: 'Läufer, Kerzen, Vasen — ohne frische Blumen', pricing: { mode: 'per_unit', unitPrice: 35, unitLabel: 'Tische', min: 0, step: 1 } },
        { type: 'multi', label: 'Zusätzliche Elemente', options: [
          { label: 'Traubogen / Zeremonie-Hintergrund', price: 280 },
          { label: 'Fotoecke / Backdrop', price: 220 },
          { label: 'Sweet-Table-Deko', price: 150 },
          { label: 'Stuhlschleifen / -hussen', price: 4, perGuest: true },
          { label: 'Willkommensschild & Sitzplan-Tafel', price: 120 },
        ] },
      ],
    },
    {
      title: 'Auf- & Abbau',
      questions: [
        { type: 'boolean', label: 'Aufbau & Abbau durch uns', help_text: 'Inklusive Abholung der Mietartikel nach der Feier', pricing: { mode: 'fixed', price: 300, optional: true } },
        { type: 'text', label: 'Besonderheiten der Location', help_text: 'z. B. Zugang, Zeitfenster für den Aufbau' },
      ],
    },
  ],
}

const location: QuestionnaireTemplate = {
  settings: { title: 'Location — Angebotsanfrage', base_price: 2500, min_total: 2000, valid_days: 30 },
  sections: [
    {
      title: 'Nutzung',
      description: 'Im Grundpreis enthalten: Raummiete am Veranstaltungstag.',
      questions: [
        { type: 'multi', label: 'Gewünschte Bereiche', options: [
          { label: 'Festsaal', price: 0 },
          { label: 'Außenbereich / Garten', price: 300 },
          { label: 'Separater Raum für freie Trauung', price: 400 },
        ] },
        { type: 'boolean', label: 'Aufbau bereits am Vortag', pricing: { mode: 'fixed', price: 350, optional: true } },
        { type: 'boolean', label: 'Feier bis in die frühen Morgenstunden (nach 2 Uhr)', pricing: { mode: 'fixed', price: 400, optional: true } },
      ],
    },
    {
      title: 'Ausstattung & Service',
      questions: [
        { type: 'boolean', label: 'Bestuhlung & Tische inklusive nutzen', pricing: { mode: 'fixed', price: 0 } },
        { type: 'boolean', label: 'Endreinigung durch uns', pricing: { mode: 'fixed', price: 250, optional: true } },
        { type: 'single', label: 'Catering', options: [
          { label: 'Hauseigenes Catering gewünscht', price: 0 },
          { label: 'Externes Catering (Fremdcatering-Pauschale)', price: 500 },
        ] },
      ],
    },
    {
      title: 'Eure Feier',
      questions: [
        { type: 'boolean', label: 'Übernachtungsmöglichkeiten benötigt', help_text: 'Falls vorhanden — Details klären wir persönlich' },
        { type: 'text', label: 'Fragen & besondere Wünsche', help_text: 'z. B. Feuerwerk, Haustiere, Kinderbetreuung' },
      ],
    },
  ],
}

const konditorei: QuestionnaireTemplate = {
  settings: { title: 'Hochzeitstorte — Angebotsanfrage', min_total: 250, valid_days: 21 },
  sections: [
    {
      title: 'Torte',
      questions: [
        { type: 'number', label: 'Anzahl Portionen', required: true, help_text: 'Faustregel: eine Portion pro Gast', pricing: { mode: 'per_unit', unitPrice: 5, unitLabel: 'Portionen', min: 10, step: 5 } },
        { type: 'single', label: 'Stil', options: [
          { label: 'Klassisch mit Fondant', price: 0 },
          { label: 'Semi-Naked / Naked Cake', price: 0 },
          { label: 'Buttercreme, modern glatt', price: 0 },
        ] },
        { type: 'multi', label: 'Extras', options: [
          { label: 'Frische Blumen (in Absprache mit Floristik)', price: 40 },
          { label: 'Cake-Topper', price: 25 },
          { label: 'Echtgold / Blattgold-Details', price: 60 },
        ] },
      ],
    },
    {
      title: 'Sweet Table',
      questions: [
        { type: 'boolean', label: 'Sweet Table / Candy Bar', help_text: 'Cupcakes, Macarons, Cakepops — pro Gast kalkuliert', pricing: { mode: 'fixed', price: 7, perGuest: true, optional: true } },
      ],
    },
    {
      title: 'Geschmack & Logistik',
      questions: [
        { type: 'text', label: 'Geschmackswünsche', help_text: 'z. B. Vanille-Himbeer, Schokolade — Probetermin möglich' },
        { type: 'text', label: 'Allergien / Unverträglichkeiten', help_text: 'z. B. Nüsse, Gluten, laktosefrei' },
        { type: 'boolean', label: 'Lieferung & Aufbau vor Ort', pricing: { mode: 'fixed', price: 80, optional: true } },
      ],
    },
  ],
}

const hair_makeup: QuestionnaireTemplate = {
  settings: { title: 'Hair & Make-up — Angebotsanfrage', base_price: 280, min_total: 250, valid_days: 21 },
  sections: [
    {
      title: 'Braut-Styling',
      description: 'Im Grundpreis enthalten: Brautfrisur + Make-up am Hochzeitstag.',
      questions: [
        { type: 'boolean', label: 'Probetermin vorab', help_text: 'Sehr empfohlen — wir testen Frisur und Make-up in Ruhe', pricing: { mode: 'fixed', price: 90, optional: true } },
        { type: 'multi', label: 'Extras', options: [
          { label: 'Wimpern (Einzel- oder Bandwimpern)', price: 20 },
          { label: 'Haarteil / Extensions einarbeiten', price: 40 },
          { label: 'Nachstyling / Begleitung bis zur Party', price: 150 },
        ] },
      ],
    },
    {
      title: 'Weitere Personen',
      questions: [
        { type: 'number', label: 'Styling für weitere Personen', help_text: 'z. B. Trauzeugin, Mütter — Frisur + Make-up', pricing: { mode: 'per_unit', unitPrice: 95, unitLabel: 'Personen', min: 0, step: 1, optional: true } },
      ],
    },
    {
      title: 'Ort & Wünsche',
      questions: [
        { type: 'single', label: 'Wo soll gestylt werden?', options: [
          { label: 'Bei euch vor Ort (Getting-Ready-Location)', price: 0 },
          { label: 'In unserem Studio', price: 0 },
        ] },
        { type: 'text', label: 'Stilwünsche', help_text: 'z. B. natürlicher Look, offene Wellen, Inspirationsbilder' },
      ],
    },
  ],
}

const planer: QuestionnaireTemplate = {
  settings: { title: 'Hochzeitsplanung — Angebotsanfrage', base_price: 0, min_total: 900, valid_days: 30 },
  sections: [
    {
      title: 'Leistungsumfang',
      questions: [
        { type: 'single', label: 'Welche Unterstützung wünscht ihr euch?', required: true, options: [
          { label: 'Komplettplanung (von Anfang bis Ende)', price: 4500 },
          { label: 'Teilplanung (einzelne Gewerke & Koordination)', price: 2200 },
          { label: 'Nur Zeremonien- & Tagesbegleitung', price: 900 },
        ] },
        { type: 'boolean', label: 'Locationsuche inklusive', pricing: { mode: 'fixed', price: 400, optional: true } },
        { type: 'boolean', label: 'Begleitung beim Probetermin / Menüverkostung', pricing: { mode: 'fixed', price: 150, optional: true } },
      ],
    },
    {
      title: 'Eure Hochzeit',
      questions: [
        { type: 'text', label: 'Wie weit seid ihr mit der Planung?', help_text: 'z. B. Location steht schon, sonst noch nichts' },
        { type: 'text', label: 'Ungefährer Budgetrahmen der Hochzeit', help_text: 'Hilft uns, passende Dienstleister vorzuschlagen' },
        { type: 'text', label: 'Eure Vision', help_text: 'Stil, Stimmung, was euch besonders wichtig ist' },
      ],
    },
  ],
}

const generic: QuestionnaireTemplate = {
  settings: { title: 'Angebotsanfrage', valid_days: 14 },
  sections: [
    {
      title: 'Euer Bedarf',
      questions: [
        { type: 'text', label: 'Was dürfen wir für euch tun?', required: true, help_text: 'Beschreibt kurz, welche Leistung ihr euch wünscht' },
        { type: 'number', label: 'Ungefährer Umfang in Stunden', pricing: { mode: 'per_unit', unitPrice: 0, unitLabel: 'Std.', min: 0, step: 1 } },
      ],
    },
    {
      title: 'Details',
      questions: [
        { type: 'text', label: 'Besondere Wünsche oder offene Fragen' },
      ],
    },
  ],
}

export const QUESTIONNAIRE_TEMPLATES: Record<string, QuestionnaireTemplate> = {
  fotograf,
  videograf,
  catering,
  dj_musik,
  band,
  floristik,
  location,
  konditorei,
  deko,
  hair_makeup,
  planer,
  sonstiges: generic,
}

export function templateForCategory(category: string | null | undefined): QuestionnaireTemplate {
  if (category && QUESTIONNAIRE_TEMPLATES[category]) return QUESTIONNAIRE_TEMPLATES[category]
  return generic
}
