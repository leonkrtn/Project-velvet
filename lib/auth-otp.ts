// Client-seitige Helfer für die Registrierungs-Verifizierung. Der eigentliche
// Code wird serverseitig erzeugt/geprüft (siehe app/api/auth/signup-*), damit
// die Länge frei wählbar ist (Supabase-OTP erzwingt min. 6 Stellen).

// Länge des E-Mail-Verifizierungscodes (muss zu SIGNUP_CODE_LENGTH im Server passen).
export const OTP_CODE_LENGTH = 4

export const EMAIL_TAKEN_MESSAGE =
  'Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich an oder nutze „Passwort vergessen".'

export class EmailTakenError extends Error {
  constructor() { super(EMAIL_TAKEN_MESSAGE) }
}

export interface StartSignupInput {
  email: string
  password: string
  metadata?: Record<string, unknown>
}

/**
 * Startet die Registrierung: legt den (unbestätigten) Account an und löst den
 * Code-Versand aus. Wirft `EmailTakenError`, wenn die Adresse bereits vergeben ist.
 */
export async function startSignup(input: StartSignupInput): Promise<void> {
  const res = await fetch('/api/auth/signup-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email.trim(),
      password: input.password,
      metadata: input.metadata ?? {},
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 409 || data.error === 'EMAIL_TAKEN') throw new EmailTakenError()
  if (!res.ok || data.error) throw new Error(data.message || 'Registrierung fehlgeschlagen.')
}

/** Prüft den eingegebenen Code. Wirft mit verständlicher Meldung bei Fehlern. */
export async function verifySignupCode(email: string, code: string): Promise<void> {
  const res = await fetch('/api/auth/signup-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), code: code.replace(/\s+/g, '') }),
  })
  const data = await res.json().catch(() => ({}))
  if (res.ok && data.ok) return
  switch (data.error) {
    case 'EXPIRED': throw new Error('Der Code ist abgelaufen. Fordere einen neuen an.')
    case 'TOO_MANY': throw new Error('Zu viele Versuche. Fordere einen neuen Code an.')
    default: {
      const attemptsLeft = typeof data.attemptsLeft === 'number' ? data.attemptsLeft : null
      const suffix = attemptsLeft != null ? ` Noch ${attemptsLeft} Versuch${attemptsLeft === 1 ? '' : 'e'}.` : ''
      throw new Error(`Der Code ist ungültig. Bitte prüfe deine Eingabe.${suffix}`)
    }
  }
}

/** Sendet den Code erneut (best effort). */
export async function resendSignupCode(email: string): Promise<void> {
  await fetch('/api/auth/signup-resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  }).catch(() => {})
}
