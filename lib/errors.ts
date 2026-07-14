// Zentrale Übersetzung technischer Postgres/Supabase-Fehler in verständliche
// deutsche Nutzermeldungen. Ersetzt das im Audit dokumentierte Muster, rohe
// error.message-Werte direkt an API-Antworten durchzureichen.

interface PostgresLikeError {
  code?: string
  message?: string
  details?: string
}

const CODE_MESSAGES: Record<string, string> = {
  '23505': 'Dieser Eintrag existiert bereits.',
  '23503': 'Diese Aktion ist nicht möglich, da noch verknüpfte Daten bestehen.',
  '23502': 'Bitte füllt alle Pflichtfelder aus.',
  PGRST116: 'Der angeforderte Eintrag wurde nicht gefunden.',
  '42501': 'Ihr habt keine Berechtigung für diese Aktion.',
}

/**
 * Wandelt einen Supabase/Postgres-Fehler (oder unbekannten Fehler) in eine
 * für Nutzer verständliche deutsche Meldung um. Fällt auf einen generischen
 * Text zurück, wenn kein bekanntes Muster erkannt wird.
 */
export function toUserMessage(error: unknown, fallback = 'Etwas ist schiefgelaufen, bitte versucht es erneut.'): string {
  if (!error) return fallback
  const err = error as PostgresLikeError
  if (err.code && CODE_MESSAGES[err.code]) return CODE_MESSAGES[err.code]
  if (typeof err.message === 'string' && /row-level security|RLS/i.test(err.message)) {
    return 'Ihr habt keine Berechtigung für diese Aktion.'
  }
  return fallback
}
