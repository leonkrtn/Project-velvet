// Planungsphasen relativ zum Hochzeitsdatum — zentral gehalten, da dieselbe
// Logik vorher dupliziert war (uebersicht/page.tsx und BrautpaarAufgaben.tsx).
export type PhaseKey = '12m' | '6m' | '3m' | '1m' | '1w' | 'day' | 'after'

export function getActivePhase(weddingDate: string | null): PhaseKey | null {
  if (!weddingDate) return null
  const daysLeft = (new Date(weddingDate).getTime() - Date.now()) / 86400000
  if (daysLeft < 0) return 'after'
  if (daysLeft < 1) return 'day'
  if (daysLeft < 7) return '1w'
  const monthsLeft = daysLeft / 30
  if (monthsLeft < 3) return '1m'
  if (monthsLeft < 6) return '3m'
  if (monthsLeft < 12) return '6m'
  return '12m'
}
