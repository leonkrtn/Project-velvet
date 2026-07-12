// Anzeige-Name des Brautpaars — nur die VORNAMEN (z. B. „Max & Alena").
//
// Der vollständige `couple_name` (inkl. Nachnamen, z. B. „Max Mustermann &
// Alena Muster") bleibt in der Datenbank erhalten und wird weiter für
// Vertrags-/Rechtsunterlagen genutzt. Im Dashboard und allen sichtbaren
// Oberflächen zeigen wir dagegen nur die Vornamen.
//
// Erkennt die üblichen Trenner zwischen den beiden Namen (&, +, ,, „und") und
// nimmt jeweils das erste Wort als Vornamen.
export function coupleDisplayName(coupleName: string | null | undefined): string {
  if (!coupleName) return ''
  const parts = coupleName
    .split(/\s*[&+,]\s*|\s+und\s+/i)
    .map(s => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return ''
  const firstNames = parts
    .map(p => p.split(/\s+/)[0])
    .filter(Boolean)
  return firstNames.join(' & ')
}
