import type { SupabaseClient } from '@supabase/supabase-js'

// Länge des E-Mail-Verifizierungscodes. Muss mit der in Supabase konfigurierten
// OTP-Länge übereinstimmen (Dashboard → Authentication → Providers → Email →
// „Email OTP Length"). Standard-Supabase ist 6 — für Forevr auf 8 gesetzt.
export const OTP_CODE_LENGTH = 8

/**
 * Verifiziert den 8-stelligen Bestätigungscode, den Supabase nach `auth.signUp`
 * per E-Mail verschickt (E-Mail-Template „Confirm signup" muss `{{ .Token }}`
 * enthalten). Bei Erfolg wird eine Session gesetzt.
 *
 * Wir probieren zuerst `type: 'signup'` (frische Registrierung) und fallen auf
 * `type: 'email'` zurück, damit die Verifizierung unabhängig davon funktioniert,
 * wie der Token serverseitig ausgestellt wurde.
 */
export async function verifySignupOtp(
  supabase: SupabaseClient,
  email: string,
  token: string,
) {
  const cleanEmail = email.trim().toLowerCase()
  const cleanToken = token.replace(/\s+/g, '')

  const first = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: 'signup',
  })
  if (!first.error) return first

  // Fallback für generische E-Mail-OTPs
  const second = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: 'email',
  })
  return second
}

/**
 * Sendet den Bestätigungscode erneut an dieselbe E-Mail-Adresse.
 */
export async function resendSignupOtp(supabase: SupabaseClient, email: string) {
  return supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  })
}

/** Übersetzt technische Supabase-Fehler in verständliche deutsche Meldungen. */
export function otpErrorMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('expired')) return 'Der Code ist abgelaufen. Fordere einen neuen an.'
  if (m.includes('invalid') || m.includes('incorrect') || m.includes('token'))
    return 'Der Code ist ungültig. Bitte prüfe deine Eingabe.'
  return message
}
