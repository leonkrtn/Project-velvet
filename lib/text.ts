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
