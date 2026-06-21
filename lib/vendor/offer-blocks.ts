// Event-typische Angebots-Bausteine je Gewerk. Client-safe (kein server-only).
// Der Dienstleister fuegt sie im Angebots-Editor per Klick als Position ein und
// passt sie danach an. Ergaenzt durch die eigene, in der DB gepflegte
// Bausteinbibliothek (vendor_offer_blocks).

import type { LineItem, LineItemType } from './pricing'

export interface BlockTemplate {
  label: string
  type: LineItemType
  qty?: number
  unitPrice?: number
}

/** Wandelt einen Baustein in eine fertige Angebotsposition. */
export function blockToLineItem(b: BlockTemplate): LineItem {
  const type = b.type
  const qty = b.qty ?? 1
  const unitPrice = b.unitPrice ?? 0
  const li: LineItem = { label: b.label, qty, unitPrice, total: 0, type }
  if (type === 'optional') li.selected = true
  return li
}

// Pro Kategorie ein kuratiertes Set branchentypischer Positionen. Preise sind
// bewusst runde Startwerte; der Dienstleister passt sie an.
const fotograf: BlockTemplate[] = [
  { label: 'Reportage Trauung & Feier (Ganztag)', type: 'flat', unitPrice: 1400 },
  { label: 'Standesamtliche Trauung (bis 3 Std.)', type: 'flat', unitPrice: 600 },
  { label: 'Zweiter Fotograf', type: 'flat', unitPrice: 500 },
  { label: 'Paar-/Verlobungsshooting vorab', type: 'flat', unitPrice: 350 },
  { label: 'Zusatzstunde', type: 'qty', qty: 1, unitPrice: 180 },
  { label: 'Gedrucktes Fotoalbum', type: 'optional', unitPrice: 280 },
  { label: 'Drohnenaufnahmen', type: 'optional', unitPrice: 250 },
  { label: 'Anfahrt', type: 'flat', unitPrice: 0 },
]

const catering: BlockTemplate[] = [
  { label: 'Menue pro Person', type: 'qty', qty: 80, unitPrice: 65 },
  { label: 'Sektempfang pro Person', type: 'qty', qty: 80, unitPrice: 12 },
  { label: 'Mitternachtssnack pro Person', type: 'optional', qty: 80, unitPrice: 9 },
  { label: 'Servicepersonal (pro Kraft)', type: 'qty', qty: 4, unitPrice: 220 },
  { label: 'Geschirr & Besteck (Pauschale)', type: 'flat', unitPrice: 350 },
  { label: 'Getraenkepauschale pro Person', type: 'qty', qty: 80, unitPrice: 28 },
  { label: 'Anfahrt & Aufbau', type: 'flat', unitPrice: 250 },
]

const dj_musik: BlockTemplate[] = [
  { label: 'DJ-Paket (bis 6 Std.)', type: 'flat', unitPrice: 1100 },
  { label: 'Zusatzstunde', type: 'qty', qty: 1, unitPrice: 120 },
  { label: 'Licht- & Tontechnik', type: 'flat', unitPrice: 400 },
  { label: 'Funkmikrofone fuer Reden', type: 'optional', unitPrice: 90 },
  { label: 'Sektempfang-Beschallung', type: 'optional', unitPrice: 200 },
  { label: 'Anfahrt', type: 'flat', unitPrice: 0 },
]

const floristik: BlockTemplate[] = [
  { label: 'Brautstrauss', type: 'flat', unitPrice: 150 },
  { label: 'Anstecker', type: 'qty', qty: 6, unitPrice: 12 },
  { label: 'Tischgesteck', type: 'qty', qty: 8, unitPrice: 45 },
  { label: 'Trau-/Altarschmuck', type: 'flat', unitPrice: 350 },
  { label: 'Blumenbogen', type: 'optional', unitPrice: 280 },
  { label: 'Auf- & Abbau', type: 'flat', unitPrice: 150 },
]

const location: BlockTemplate[] = [
  { label: 'Raummiete (Tagespauschale)', type: 'flat', unitPrice: 2500 },
  { label: 'Reinigung', type: 'flat', unitPrice: 350 },
  { label: 'Bestuhlung pro Person', type: 'qty', qty: 80, unitPrice: 4 },
  { label: 'Uebernachtung Brautsuite', type: 'optional', unitPrice: 220 },
  { label: 'Kaution', type: 'flat', unitPrice: 0 },
]

const konditorei: BlockTemplate[] = [
  { label: 'Hochzeitstorte pro Stueck', type: 'qty', qty: 80, unitPrice: 7.5 },
  { label: 'Etagere-/Leihgebuehr', type: 'flat', unitPrice: 40 },
  { label: 'Candy-Bar / Dessertbuffet pro Person', type: 'optional', qty: 80, unitPrice: 9 },
  { label: 'Lieferung & Aufbau', type: 'flat', unitPrice: 80 },
]

const hair_makeup: BlockTemplate[] = [
  { label: 'Braut-Styling (Probe + Tag)', type: 'flat', unitPrice: 450 },
  { label: 'Styling Begleitperson', type: 'qty', qty: 2, unitPrice: 120 },
  { label: 'Vor-Ort-Service', type: 'flat', unitPrice: 100 },
  { label: 'Touch-up am Nachmittag', type: 'optional', unitPrice: 150 },
]

const planer: BlockTemplate[] = [
  { label: 'Full-Planning (Pauschale)', type: 'flat', unitPrice: 4500 },
  { label: 'Teilplanung', type: 'flat', unitPrice: 2200 },
  { label: 'Tageskoordination (Day-of)', type: 'flat', unitPrice: 1200 },
  { label: 'Zusaetzliche Planungsstunde', type: 'qty', qty: 1, unitPrice: 95 },
]

// Generische Basis fuer Kategorien ohne eigenes Set.
const generic: BlockTemplate[] = [
  { label: 'Grundleistung (Pauschale)', type: 'flat', unitPrice: 0 },
  { label: 'Leistung pro Person', type: 'qty', qty: 80, unitPrice: 0 },
  { label: 'Zusatzstunde', type: 'qty', qty: 1, unitPrice: 0 },
  { label: 'Optionale Zusatzleistung', type: 'optional', unitPrice: 0 },
  { label: 'Rabatt', type: 'discount', unitPrice: 0 },
  { label: 'Anfahrt', type: 'flat', unitPrice: 0 },
]

const BLOCKS_BY_CATEGORY: Record<string, BlockTemplate[]> = {
  fotograf,
  videograf: fotograf,
  catering,
  dj_musik,
  band: dj_musik,
  floristik,
  deko: floristik,
  location,
  konditorei,
  hair_makeup,
  planer,
  sonstiges: generic,
}

export function blocksForCategory(category: string | null | undefined): BlockTemplate[] {
  if (category && BLOCKS_BY_CATEGORY[category]) return BLOCKS_BY_CATEGORY[category]
  return generic
}
