// Zentrale Datum-/Währungsformatierung (de-DE), um die im Audit
// dokumentierte Fragmentierung (90+ individuelle toLocaleDateString-Aufrufe,
// 4 verschiedene Währungs-Muster) schrittweise abzulösen.

export type DateFormatVariant = 'long' | 'short' | 'numeric' | 'weekday'

const DATE_FORMAT_OPTIONS: Record<DateFormatVariant, Intl.DateTimeFormatOptions> = {
  long: { day: '2-digit', month: 'long', year: 'numeric' },
  short: { day: '2-digit', month: 'short' },
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
  weekday: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' },
}

/**
 * Formatiert ein Datum konsistent im de-DE-Format.
 * `date` darf ein ISO-String, Date-Objekt oder null/undefined sein.
 */
export function formatDate(
  date: string | Date | null | undefined,
  variant: DateFormatVariant = 'long'
): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('de-DE', DATE_FORMAT_OPTIONS[variant])
}

/**
 * Formatiert einen Betrag als EUR-Währung im de-DE-Format (Komma als
 * Dezimaltrennzeichen, korrektes Tausendertrennzeichen).
 */
export function formatCurrency(amount: number | null | undefined): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}
