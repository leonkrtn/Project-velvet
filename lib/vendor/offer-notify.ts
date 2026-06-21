// Server-only: Benachrichtigungen rund um Angebote — Chat-Nachricht + E-Mail.
// Badge im Portal entsteht implizit ueber die Status-Listen (kein eigener Code).
// Alle Funktionen sind Best-Effort und werfen nicht.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, emailLayout } from '@/lib/email/notify'
import { formatMoney } from './questionnaire'

/* eslint-disable @typescript-eslint/no-explicit-any */

const COUPLE_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://project-velvet.vercel.app').replace(/\/$/, '')

interface OfferLike {
  id: string
  event_id: string
  dienstleister_id: string
  conversation_id: string | null
  request_id: string | null
  title: string
  total: number
  currency: string
}

async function vendorMeta(admin: SupabaseClient, vendorId: string) {
  const { data } = await admin
    .from('dienstleister_profiles')
    .select('name, company_name, email')
    .eq('id', vendorId)
    .maybeSingle()
  const v = (data ?? {}) as any
  return { name: v.company_name || v.name || 'Dienstleister', email: (v.email as string) || null }
}

async function coupleContacts(admin: SupabaseClient, eventId: string) {
  const { data: members } = await admin
    .from('event_members')
    .select('user_id, role')
    .eq('event_id', eventId)
    .in('role', COUPLE_ROLES)
  const ids = Array.from(new Set((members ?? []).map(m => m.user_id).filter(Boolean)))
  if (ids.length === 0) return [] as { email: string | null; name: string | null }[]
  const { data: profiles } = await admin.from('profiles').select('id, name, email').in('id', ids)
  return (profiles ?? []).map(p => ({ email: (p.email as string) || null, name: (p.name as string) || null }))
}

/** Postet eine 'offer'-Chatkarte und benachrichtigt das Brautpaar per E-Mail. */
export async function notifyOfferReleased(admin: SupabaseClient, offer: OfferLike, vendorUserId: string): Promise<void> {
  const vendor = await vendorMeta(admin, offer.dienstleister_id)

  if (offer.conversation_id) {
    await admin.from('messages').insert({
      conversation_id: offer.conversation_id,
      event_id: offer.event_id,
      sender_id: vendorUserId,
      content: `Angebot: ${formatMoney(offer.total, offer.currency)}`,
      message_type: 'offer',
      metadata: {
        request_id: offer.request_id, offer_id: offer.id,
        total: offer.total, currency: offer.currency, vendor_name: vendor.name,
      },
    })
    await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', offer.conversation_id)
  }

  const contacts = await coupleContacts(admin, offer.event_id)
  const emails = contacts.map(c => c.email).filter((e): e is string => !!e)
  if (emails.length) {
    await sendEmail(admin, {
      to: emails,
      replyTo: vendor.email ?? undefined,
      subject: `Neues Angebot von ${vendor.name}`,
      html: emailLayout({
        heading: 'Ihr habt ein neues Angebot erhalten',
        bodyHtml: `
          <tr><td style="padding:4px 0">${vendor.name} hat euch das Angebot <strong>„${offer.title}"</strong> über <strong>${formatMoney(offer.total, offer.currency)}</strong> bereitgestellt.</td></tr>
          <tr><td style="padding:8px 0 12px;color:#666">Im Portal könnt ihr es prüfen, als PDF speichern und verbindlich annehmen.</td></tr>`,
        ctaLabel: 'Angebot ansehen',
        ctaUrl: `${APP_URL}/brautpaar/${offer.event_id}/angebote`,
      }),
    })
  }
}

/** Benachrichtigt den Dienstleister, dass das Brautpaar an-/abgelehnt hat. */
export async function notifyOfferDecision(
  admin: SupabaseClient,
  offer: OfferLike,
  decision: 'accepted' | 'declined',
  coupleUserId: string,
  acceptedByName?: string | null,
): Promise<void> {
  if (offer.conversation_id) {
    await admin.from('messages').insert({
      conversation_id: offer.conversation_id,
      event_id: offer.event_id,
      sender_id: coupleUserId,
      content: decision === 'accepted'
        ? `Das Angebot „${offer.title}" wurde verbindlich angenommen.`
        : `Das Angebot „${offer.title}" wurde abgelehnt.`,
      message_type: 'text',
    })
    await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', offer.conversation_id)
  }

  const vendor = await vendorMeta(admin, offer.dienstleister_id)
  if (vendor.email) {
    const accepted = decision === 'accepted'
    await sendEmail(admin, {
      to: vendor.email,
      subject: accepted ? `Angebot angenommen: ${offer.title}` : `Angebot abgelehnt: ${offer.title}`,
      html: emailLayout({
        heading: accepted ? 'Euer Angebot wurde angenommen' : 'Euer Angebot wurde abgelehnt',
        bodyHtml: accepted
          ? `<tr><td style="padding:4px 0">Das Brautpaar hat das Angebot <strong>„${offer.title}"</strong> über <strong>${formatMoney(offer.total, offer.currency)}</strong> verbindlich angenommen${acceptedByName ? ` (${acceptedByName})` : ''}.</td></tr>
             <tr><td style="padding:8px 0 12px;color:#666">Damit gilt der Auftrag als bestätigt.</td></tr>`
          : `<tr><td style="padding:4px 0">Das Brautpaar hat das Angebot <strong>„${offer.title}"</strong> leider abgelehnt.</td></tr>`,
        ctaLabel: 'Im Portal öffnen',
        ctaUrl: `${APP_URL}/vendor/dashboard/${offer.event_id}/angebote`,
      }),
    })
  }
}
