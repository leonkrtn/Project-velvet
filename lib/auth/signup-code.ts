// Server-only: eigenes E-Mail-Verifizierungssystem für die Registrierung.
// Wir generieren einen kurzen Code selbst (statt Supabase-OTP, das min. 6 Stellen
// erzwingt), verschicken ihn über Resend und bestätigen den Nutzer nach Prüfung
// per Admin-API. Der Code + Ablauf + Versuche liegen in app_metadata des noch
// unbestätigten Auth-Users (nur per Service-Role les-/schreibbar).
import 'server-only'
import crypto from 'crypto'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { sendEmail, emailLayout } from '@/lib/email/notify'

export const SIGNUP_CODE_LENGTH = 4
export const SIGNUP_CODE_TTL_MIN = 15
export const SIGNUP_MAX_ATTEMPTS = 6

export function generateSignupCode(): string {
  return String(crypto.randomInt(0, 10 ** SIGNUP_CODE_LENGTH)).padStart(SIGNUP_CODE_LENGTH, '0')
}

/** Findet den Auth-User zu einer E-Mail über die public.profiles-Tabelle. */
export async function findAuthUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const e = email.trim().toLowerCase()
  const { data: prof } = await admin.from('profiles').select('id').eq('email', e).maybeSingle()
  if (!prof?.id) return null
  const { data } = await admin.auth.admin.getUserById(prof.id as string)
  return data?.user ?? null
}

export interface SignupOtpMeta {
  signup_otp?: string | null
  signup_otp_exp?: string | null
  signup_otp_att?: number | null
}

export function buildOtpMeta(base: Record<string, unknown> | undefined, code: string): Record<string, unknown> {
  return {
    ...(base ?? {}),
    signup_otp: code,
    signup_otp_exp: new Date(Date.now() + SIGNUP_CODE_TTL_MIN * 60_000).toISOString(),
    signup_otp_att: 0,
  }
}

export function clearOtpMeta(base: Record<string, unknown> | undefined): Record<string, unknown> {
  return { ...(base ?? {}), signup_otp: null, signup_otp_exp: null, signup_otp_att: null }
}

/** Versendet den Registrierungs-Code als gebrandete Forevr-Mail über Resend. */
export async function sendSignupCodeEmail(email: string, code: string): Promise<void> {
  const body =
    `<tr><td style="padding:6px 0 4px;font-size:14px;line-height:1.6;color:#333">Gib diesen Code in Forevr ein, um deine Registrierung abzuschließen:</td></tr>` +
    `<tr><td style="padding:8px 0 14px"><div style="font-size:36px;font-weight:700;letter-spacing:0.42em;background:#f5f0e8;border:1px solid #ece3d0;border-radius:10px;padding:16px 0 16px 0.42em;text-align:center;color:#1c1c1c">${code}</div></td></tr>` +
    `<tr><td style="font-size:12px;color:#8a857c;line-height:1.5">Der Code ist ${SIGNUP_CODE_TTL_MIN} Minuten gültig. Wenn du das nicht angefordert hast, ignoriere diese E-Mail.</td></tr>`
  await sendEmail(null, {
    to: email,
    subject: 'Dein Forevr-Bestätigungscode',
    html: emailLayout({ heading: 'Bestätige deine E-Mail-Adresse', bodyHtml: body }),
  })
}
