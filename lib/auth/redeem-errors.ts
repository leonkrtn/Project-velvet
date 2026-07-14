// Fehler-Codes aus redeem_invite_code() → verständliche deutsche Meldungen.
// Zentral gehalten, damit app/join/page.tsx und app/signup/page.tsx (Modus
// "code") dieselben Texte zeigen statt rohe Fehlercodes durchzureichen.
export const REDEEM_ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED:        'Bitte melde dich zuerst an.',
  CODE_NOT_FOUND_OR_LOCKED: 'Code nicht gefunden — bitte prüfe den Link.',
  CODE_ALREADY_USED:        'Dieser Code wurde bereits eingelöst.',
  CODE_EXPIRED:             'Dieser Code ist abgelaufen. Bitte lass dir einen neuen Link schicken.',
  EVENT_NOT_FOUND:          'Das zugehörige Event existiert nicht mehr.',
  NOT_APPROVED_ORGANIZER:   'Nur freigeschaltete Veranstalter-Konten können diese Einladung annehmen. Bitte registriere dich zuerst als Veranstalter und warte auf die Freischaltung.',
}

export function toRedeemErrorMessage(code: string | undefined | null, fallback = 'Code konnte nicht eingelöst werden.'): string {
  if (!code) return fallback
  return REDEEM_ERRORS[code] ?? fallback
}

// Rollen-Rechte-Hinweise: werden dem EINGELADENEN vor dem Beitritt gezeigt
// (der Einladende wird bereits an der Einladungs-Erstellung informiert, der
// Eingeladene bisher nicht — siehe UX-Audit B10).
export const ROLE_PERMISSION_HINTS: Record<string, string> = {
  veranstalter:   'Ihr erhaltet vollen Zugriff auf die Planung dieses Events (alle Module, Gäste, Budget, Dienstleister).',
  brautpaar:      'Ihr erhaltet vollen Zugriff auf die Planung dieses Events als Brautpaar.',
  brautpaar_solo: 'Ihr erhaltet vollen Zugriff auf die Planung dieses Events als Brautpaar.',
  trauzeuge:      'Ihr erhaltet eingeschränkten Lesezugriff auf ausgewählte Bereiche der Planung.',
  dienstleister:  'Ihr erhaltet Zugriff auf den Chat mit dem Brautpaar sowie auf mit euch geteilte Daten.',
}
