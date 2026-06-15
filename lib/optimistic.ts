'use client'
// Hilfen für optimistische UI-Updates.
//
// Idee: Lokale State-Änderung sofort anwenden, den Server-Call im Hintergrund
// ausführen und bei Fehler die Änderung zurückrollen + Fehler melden. So fühlt
// sich die Oberfläche bei zuverlässigen Endpunkten sofort an, bleibt aber
// korrekt, falls der Server doch ablehnt.
//
// NUR für idempotente, server-seitig nicht hart abgelehnte Aktionen verwenden
// (Listen-CRUD, Toggles, Sortierung). NICHT für Aktionen mit harter Validierung
// (Kapazität/Deadline/Freeze/Approval), Zahlungen, Datei-Uploads oder Auth.

// Temporäre Client-ID für optimistisch eingefügte Datensätze, bis die echte
// DB-ID vorliegt. Wird über isTempId(...) erkannt und nach Erfolg ersetzt.
export function tempId(): string {
  const rnd = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
  return `tmp_${rnd}`
}

export function isTempId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('tmp_')
}

type CommitResult = { error?: unknown } | null | void

export interface OptimisticOptions {
  apply: () => void              // lokale State-Änderung sofort anwenden
  rollback: () => void           // Änderung bei Fehler zurücknehmen
  commit: () => PromiseLike<CommitResult>  // Server-Call (Supabase-Builder oder fetch)
  onError?: (error: unknown) => void   // z. B. Toast anzeigen
}

/**
 * Wendet `apply` sofort an, führt `commit` aus und rollt bei Fehler via
 * `rollback` zurück. Funktioniert sowohl mit Supabase ({ error }) als auch mit
 * fetch (Throw oder { error }). Gibt true bei Erfolg zurück.
 */
export async function runOptimistic({ apply, rollback, commit, onError }: OptimisticOptions): Promise<boolean> {
  apply()
  try {
    const res = await commit()
    if (res && typeof res === 'object' && 'error' in res && res.error) {
      rollback()
      onError?.((res as { error: unknown }).error)
      return false
    }
    return true
  } catch (error) {
    rollback()
    onError?.(error)
    return false
  }
}

/**
 * Optimistisches Einfügen mit Abgleich: `apply` fügt einen Platzhalter (tempId)
 * ein, `commit` liefert den echten Datensatz, `reconcile` ersetzt den
 * Platzhalter. Bei Fehler entfernt `rollback` den Platzhalter wieder.
 * `commit` MUSS bei Fehlern werfen (Supabase: `if (error) throw error`).
 */
export async function runOptimisticInsert<T>({ apply, commit, reconcile, rollback, onError }: {
  apply: () => void
  commit: () => PromiseLike<T>
  reconcile: (result: T) => void
  rollback: () => void
  onError?: (error: unknown) => void
}): Promise<T | null> {
  apply()
  try {
    const result = await commit()
    reconcile(result)
    return result
  } catch (error) {
    rollback()
    onError?.(error)
    return null
  }
}
