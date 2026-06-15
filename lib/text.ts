// Namens-/Options-Normalisierung bei der Eingabe.
// "leon kirsten" → "Leon Kirsten", "anna-lena" → "Anna-Lena".
// Bewahrt vorhandene Großbuchstaben (aus "McDonald" wird nicht "Mcdonald"):
// es wird nur der erste Buchstabe jedes Wortes/Segments großgeschrieben.
export function titleCaseName(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word =>
      word
        .split('-')
        .map(seg => (seg.length > 0 ? seg.charAt(0).toUpperCase() + seg.slice(1) : seg))
        .join('-')
    )
    .join(' ')
}

// Erste Stelle groß — für Anzeige von Werten wie "fisch" → "Fisch"
export function capitalizeFirst(input: string): string {
  if (!input) return input
  return input.charAt(0).toUpperCase() + input.slice(1)
}

// Anzeige-Labels für vordefinierte Allergie-/Diät-Tags — mit korrekten Umlauten.
// Greift bei nicht-Freitext-Tags (z. B. importiert/seed als "nuesse" → "Nüsse").
// Unbekannte Werte (oft echte Nutzereingaben) werden nur kapitalisiert.
const ALLERGY_LABELS: Record<string, string> = {
  gluten: 'Gluten', glutenfrei: 'Glutenfrei', weizen: 'Weizen',
  laktose: 'Laktose', laktosefrei: 'Laktosefrei',
  nuesse: 'Nüsse', 'nüsse': 'Nüsse', nuss: 'Nüsse', nussallergie: 'Nussallergie',
  erdnuesse: 'Erdnüsse', 'erdnüsse': 'Erdnüsse',
  fisch: 'Fisch', meeresfruechte: 'Meeresfrüchte', 'meeresfrüchte': 'Meeresfrüchte', krebstiere: 'Krebstiere',
  soja: 'Soja', ei: 'Ei', eier: 'Eier', sellerie: 'Sellerie', senf: 'Senf', sesam: 'Sesam',
  halal: 'Halal', kosher: 'Koscher', koscher: 'Koscher',
  vegan: 'Vegan', vegetarisch: 'Vegetarisch',
  sonstige: 'Sonstige', sonstiges: 'Sonstiges',
  // englische Legacy-Keys
  lactose: 'Laktose', nuts: 'Nüsse', egg: 'Eier', fish: 'Fisch',
  shellfish: 'Schalentiere', soy: 'Soja', vegetarian: 'Vegetarisch',
}
export function allergyLabel(tag: string): string {
  if (!tag) return tag
  return ALLERGY_LABELS[tag.trim().toLowerCase()] ?? capitalizeFirst(tag)
}
