// Server-only: taeglicher Automatisierungs-Tick. Verarbeitet alle faelligen
// Regeln aus vendor_automations idempotent (vendor_automation_log verhindert
// Doppelausfuehrung). Aufgerufen von /api/cron/tick. Wirft nie — Fehler einzelner
// Items werden geloggt und uebersprungen.
import 'server-only'
import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, emailLayout } from '@/lib/email/notify'
import { formatMoney } from './questionnaire'
import { buildVendorEmail } from './email-config'

/* eslint-disable @typescript-eslint/no-explicit-any */

const COUPLE_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://project-velvet.vercel.app').replace(/\/$/, '')

function todayISO(): string { return new Date().toISOString().slice(0, 10) }
function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10)
}
function token(): string { return (randomUUID() + randomUUID()).replace(/-/g, '') }

interface Automation { id: string; dienstleister_id: string; kind: string; event_type: string; offset_days: number; label: string; enabled: boolean }

function matchesEventType(rule: Automation, evType: string | null): boolean {
  return rule.event_type === 'all' || !rule.event_type || rule.event_type === (evType ?? '')
}

async function alreadyFired(admin: SupabaseClient, dlId: string, kind: string, tType: string, tId: string, fireKey: string): Promise<boolean> {
  const { data } = await admin.from('vendor_automation_log')
    .select('id').eq('dienstleister_id', dlId).eq('kind', kind)
    .eq('target_type', tType).eq('target_id', tId).eq('fire_key', fireKey).maybeSingle()
  return !!data
}
async function markFired(admin: SupabaseClient, dlId: string, kind: string, tType: string, tId: string, fireKey: string): Promise<boolean> {
  const { error } = await admin.from('vendor_automation_log')
    .insert({ dienstleister_id: dlId, kind, target_type: tType, target_id: tId, fire_key: fireKey })
  return !error // false = Konflikt (anderer Lauf war schneller) -> nicht erneut feuern
}

async function vendorUserId(admin: SupabaseClient, dlId: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(dlId)) return cache.get(dlId)!
  const { data } = await admin.from('user_dienstleister').select('user_id').eq('dienstleister_id', dlId).limit(1).maybeSingle()
  const uid = (data?.user_id as string) || null
  cache.set(dlId, uid)
  return uid
}

async function vendorMeta(admin: SupabaseClient, dlId: string, cache: Map<string, any>): Promise<{ name: string; email: string | null; brandColor: string | null }> {
  if (cache.has(dlId)) return cache.get(dlId)
  const { data } = await admin.from('dienstleister_profiles').select('name, company_name, email, brand_color').eq('id', dlId).maybeSingle()
  const v = (data ?? {}) as any
  const meta = { name: v.company_name || v.name || 'Dienstleister', email: (v.email as string) || null, brandColor: (v.brand_color as string) || null }
  cache.set(dlId, meta)
  return meta
}

async function coupleEmails(admin: SupabaseClient, eventId: string): Promise<string[]> {
  const { data: members } = await admin.from('event_members').select('user_id, role').eq('event_id', eventId).in('role', COUPLE_ROLES)
  const ids = Array.from(new Set((members ?? []).map(m => m.user_id).filter(Boolean)))
  if (ids.length === 0) return []
  const { data: profiles } = await admin.from('profiles').select('email').in('id', ids)
  return (profiles ?? []).map(p => p.email as string).filter(Boolean)
}

export interface TickResult { reminders: number; reviewRequests: number; followupOffers: number; followupLeads: number; errors: number }

export async function runAutomationTick(admin: SupabaseClient): Promise<TickResult> {
  const today = todayISO()
  const res: TickResult = { reminders: 0, reviewRequests: 0, followupOffers: 0, followupLeads: 0, errors: 0 }

  const { data: rulesRaw } = await admin.from('vendor_automations').select('*').eq('enabled', true)
  const rules = (rulesRaw ?? []) as Automation[]
  if (rules.length === 0) return res

  const byKind = (k: string) => rules.filter(r => r.kind === k)
  const uidCache = new Map<string, string | null>()
  const metaCache = new Map<string, any>()

  // ── Reminder + Review-Request: basieren auf gebuchten Events (accepted offer) ──
  const eventKinds = [...byKind('reminder'), ...byKind('review_request')]
  if (eventKinds.length) {
    const dlIds = Array.from(new Set(eventKinds.map(r => r.dienstleister_id)))
    const { data: offers } = await admin.from('vendor_offers')
      .select('id, event_id, dienstleister_id, status')
      .in('dienstleister_id', dlIds).eq('status', 'accepted')
    const eventIds = Array.from(new Set((offers ?? []).map(o => o.event_id).filter(Boolean)))
    const eventsById = new Map<string, any>()
    if (eventIds.length) {
      const { data: evs } = await admin.from('events').select('id, date, event_type, couple_name, title').in('id', eventIds)
      for (const e of (evs ?? [])) eventsById.set(e.id, e)
    }

    for (const o of (offers ?? [])) {
      const ev = eventsById.get(o.event_id)
      if (!ev?.date) continue
      const dlRules = eventKinds.filter(r => r.dienstleister_id === o.dienstleister_id)

      // Reminder: offset Tage VOR dem Event
      for (const r of dlRules.filter(x => x.kind === 'reminder')) {
        if (!matchesEventType(r, ev.event_type)) continue
        if (addDaysISO(ev.date, -Math.abs(r.offset_days)) !== today) continue
        const fireKey = `${o.event_id}:${r.id}`
        try {
          if (await alreadyFired(admin, r.dienstleister_id, 'reminder', 'event', o.event_id, fireKey)) continue
          if (!await markFired(admin, r.dienstleister_id, 'reminder', 'event', o.event_id, fireKey)) continue
          const uid = await vendorUserId(admin, r.dienstleister_id, uidCache)
          if (uid) {
            await admin.from('vendor_calendar_entries').insert({
              user_id: uid,
              title: r.label || `Erinnerung: ${ev.couple_name || ev.title || 'Event'}`,
              description: `Automatische Erinnerung · Event am ${ev.date}`,
              start_at: `${today}T00:00:00.000Z`, all_day: true, color: '#D97706', entry_type: 'reminder',
            })
            const meta = await vendorMeta(admin, r.dienstleister_id, metaCache)
            if (meta.email) {
              await sendEmail(admin, {
                to: meta.email,
                subject: r.label || `Erinnerung: ${ev.couple_name || ev.title || 'Event'} steht bevor`,
                html: emailLayout({
                  heading: 'Bevorstehendes Event',
                  bodyHtml: `<tr><td style="padding:4px 0">Erinnerung: <strong>${ev.couple_name || ev.title || 'Euer Event'}</strong> findet am <strong>${ev.date}</strong> statt.</td></tr>`,
                  ctaLabel: 'Im Portal ansehen', ctaUrl: `${APP_URL}/vendor/ubersicht`,
                }),
              })
            }
            res.reminders++
          }
        } catch { res.errors++ }
      }

      // Review-Request: offset Tage NACH dem Event
      for (const r of dlRules.filter(x => x.kind === 'review_request')) {
        if (!matchesEventType(r, ev.event_type)) continue
        if (addDaysISO(ev.date, Math.abs(r.offset_days)) !== today) continue
        const fireKey = `${o.event_id}:${r.id}`
        try {
          if (await alreadyFired(admin, r.dienstleister_id, 'review_request', 'event', o.event_id, fireKey)) continue
          if (!await markFired(admin, r.dienstleister_id, 'review_request', 'event', o.event_id, fireKey)) continue
          await sendReviewInvite(admin, r.dienstleister_id, o.event_id, metaCache)
          res.reviewRequests++
        } catch { res.errors++ }
      }
    }
  }

  // ── Follow-up Angebote: released, nicht angenommen, offset Tage nach Freigabe ──
  for (const r of byKind('followup_offer')) {
    try {
      const { data: offers } = await admin.from('vendor_offers')
        .select('id, event_id, dienstleister_id, status, released_at, total, currency')
        .eq('dienstleister_id', r.dienstleister_id).eq('status', 'released')
      for (const o of (offers ?? [])) {
        if (!o.released_at) continue
        if (addDaysISO(String(o.released_at).slice(0, 10), Math.abs(r.offset_days)) !== today) continue
        const fireKey = `${o.id}:${r.id}`
        if (await alreadyFired(admin, r.dienstleister_id, 'followup_offer', 'offer', o.id, fireKey)) continue
        if (!await markFired(admin, r.dienstleister_id, 'followup_offer', 'offer', o.id, fireKey)) continue
        const meta = await vendorMeta(admin, r.dienstleister_id, metaCache)
        const emails = await coupleEmails(admin, o.event_id)
        if (emails.length) {
          // Anpassbare Vendor-Vorlage (Fallback = eingebauter Standardtext).
          const mail = await buildVendorEmail(admin, r.dienstleister_id, 'followup_offer', {
            eventId: o.event_id,
            values: { firma: meta.name, betrag: o.total ? formatMoney(Number(o.total), o.currency || 'EUR') : undefined },
            ctaUrl: `${APP_URL}/brautpaar/${o.event_id}/angebote`,
          })
          if (mail) await sendEmail(admin, { to: emails, replyTo: mail.replyTo ?? undefined, subject: mail.subject, html: mail.html })
        }
        // Vendor-To-do (Kalender)
        const uid = await vendorUserId(admin, r.dienstleister_id, uidCache)
        if (uid) {
          await admin.from('vendor_calendar_entries').insert({
            user_id: uid, title: 'Nachfassen: offenes Angebot', description: 'Automatischer Hinweis',
            start_at: `${today}T00:00:00.000Z`, all_day: true, color: '#2352C8', entry_type: 'reminder',
          })
        }
        res.followupOffers++
      }
    } catch { res.errors++ }
  }

  // ── Follow-up Leads: lange inaktive Leads als To-do ──
  for (const r of byKind('followup_lead')) {
    try {
      const cutoff = addDaysISO(today, -Math.abs(r.offset_days))
      const { data: leads } = await admin.from('crm_contacts')
        .select('id, name, updated_at')
        .eq('dienstleister_id', r.dienstleister_id).eq('lifecycle_stage', 'lead')
        .lte('updated_at', `${cutoff}T23:59:59.999Z`)
      for (const c of (leads ?? [])) {
        const fireKey = '' // einmalig pro Lead
        if (await alreadyFired(admin, r.dienstleister_id, 'followup_lead', 'contact', c.id, fireKey)) continue
        if (!await markFired(admin, r.dienstleister_id, 'followup_lead', 'contact', c.id, fireKey)) continue
        await admin.from('crm_tasks').insert({
          contact_id: c.id, dienstleister_id: r.dienstleister_id,
          title: `Lead nachfassen: ${c.name || 'Kontakt'}`,
          due_at: new Date().toISOString(),
        })
        const meta = await vendorMeta(admin, r.dienstleister_id, metaCache)
        if (meta.email) {
          await sendEmail(admin, {
            to: meta.email,
            subject: `Lead nachfassen: ${c.name || 'Kontakt'}`,
            html: emailLayout({
              heading: 'Inaktiver Lead',
              bodyHtml: `<tr><td style="padding:4px 0"><strong>${c.name || 'Ein Kontakt'}</strong> hat sich seit mehr als ${Math.abs(r.offset_days)} Tagen nicht mehr gemeldet. Ein kurzes Nachfassen könnte sich lohnen.</td></tr>`,
              ctaLabel: 'Im CRM ansehen', ctaUrl: `${APP_URL}/vendor/crm`,
            }),
          })
        }
        res.followupLeads++
      }
    } catch { res.errors++ }
  }

  return res
}

/** Erstellt eine Token-Bewertungseinladung + verschickt die Mail (vendor-branded). */
export async function sendReviewInvite(admin: SupabaseClient, dlId: string, eventId: string, metaCache?: Map<string, any>): Promise<boolean> {
  const meta = await vendorMeta(admin, dlId, metaCache ?? new Map())
  const emails = await coupleEmails(admin, eventId)
  const tk = token()
  const { error } = await admin.from('review_invites').insert({
    dienstleister_id: dlId, event_id: eventId, token: tk, email: emails[0] ?? '', status: 'sent',
  })
  if (error) return false
  if (emails.length) {
    // Anpassbare Vendor-Vorlage (Fallback = eingebauter Standardtext).
    const mail = await buildVendorEmail(admin, dlId, 'review_request', {
      eventId, values: { firma: meta.name }, ctaUrl: `${APP_URL}/review/${tk}`,
    })
    if (mail) await sendEmail(admin, { to: emails, replyTo: mail.replyTo ?? undefined, subject: mail.subject, html: mail.html })
  }
  return true
}
