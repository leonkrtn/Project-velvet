import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Solo-Brautpaar Onboarding-Metadaten, die beim Signup in
 * auth.users.raw_user_meta_data hinterlegt werden. Sie erlauben es,
 * das Event auch nachgelagert (z. B. nach E-Mail-Bestätigung beim ersten
 * Login) zu erstellen, falls direkt nach dem Signup keine Session vorlag.
 */
export interface SoloSignupMetadata {
  name?: string
  partner_name?: string
  wedding_date?: string // ISO date (YYYY-MM-DD)
  signup_role?: 'brautpaar_solo'
}

export function isSoloSignup(user: Pick<User, 'user_metadata'> | null | undefined): boolean {
  return user?.user_metadata?.signup_role === 'brautpaar_solo'
}

export function buildCoupleName(name?: string | null, partnerName?: string | null): string {
  const a = name?.trim()
  const b = partnerName?.trim()
  if (a && b) return `${a} & ${b}`
  return a || b || ''
}

/**
 * Erstellt (idempotent) das Event eines Solo-Brautpaars über die
 * SECURITY-DEFINER-Funktion create_event_as_brautpaar_solo().
 * Existiert bereits eine brautpaar_solo-Mitgliedschaft, gibt die DB-Funktion
 * deren Event-ID zurück — Doppel-Aufrufe sind unkritisch.
 *
 * Funktioniert mit Browser- und Server-Supabase-Client (benötigt Session).
 */
export async function ensureSoloEvent(
  supabase: SupabaseClient,
  meta: SoloSignupMetadata,
): Promise<string> {
  const coupleName = buildCoupleName(meta.name, meta.partner_name)
  const title = coupleName ? `Hochzeit von ${coupleName}` : 'Unsere Hochzeit'

  const { data, error } = await supabase.rpc('create_event_as_brautpaar_solo', {
    p_title:       title,
    p_date:        meta.wedding_date || null,
    p_couple_name: coupleName || null,
  })
  if (error) throw new Error(error.message)
  return data as string
}
