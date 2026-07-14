// app/api/admin/stats/route.ts
// Aggregierte Kennzahlen für das Admin-Insights-Dashboard. Fokus: Website-Nutzung
// (aktive Nutzer, genutzte Bereiche, Aktivität), Aktivierung/Einladungen,
// Marktplatz-Potenzial (Reichweite→Buchung, offene Pipeline) und Angebot/Nachfrage,
// zusätzlich zu Nutzer-, Event- und Anbieter-Bestandszahlen.
// Zugriff nur für Accounts mit profiles.is_admin (requireAdmin). Service-Role,
// JS-Aggregation (kleine Datenmengen). Zeitfenster via ?days= (7|30|90|365|all).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

// ── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const WD_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function normCity(v: string | null | undefined): string | null {
  if (!v) return null
  const s = String(v).trim()
  return s ? s : null
}

function topN<T extends { label: string; value: number }>(items: T[], n: number): T[] {
  return items.slice().sort((a, b) => b.value - a.value).slice(0, n)
}

function ts(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return isNaN(t) ? null : t
}

// Wochentag Mo=0 … So=6
function weekdayMon(d: Date): number { return (d.getDay() + 6) % 7 }

interface Bucket { key: string; label: string }
type Granularity = 'day' | 'week' | 'month'

/** Baut Zeit-Buckets für das gewählte Fenster + einen Schlüssel-Mapper. */
function makeBuckets(days: number | 'all'): { buckets: Bucket[]; keyOf: (t: number) => string | null; since: number; granularity: Granularity } {
  const now = new Date()
  let granularity: Granularity
  let span: number
  if (days === 'all') { granularity = 'month'; span = 12 }
  else if (days <= 31) { granularity = 'day'; span = days }
  else if (days <= 120) { granularity = 'week'; span = Math.ceil(days / 7) }
  else { granularity = 'month'; span = 12 }

  const buckets: Bucket[] = []
  const index = new Map<string, number>()

  if (granularity === 'day') {
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      index.set(key, buckets.length)
      buckets.push({ key, label: `${d.getDate()}.${d.getMonth() + 1}.` })
    }
    const keyOf = (t: number) => new Date(t).toISOString().slice(0, 10)
    const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (span - 1)).getTime()
    return { buckets, keyOf: (t) => (index.has(keyOf(t)) ? keyOf(t) : null), since, granularity }
  }

  if (granularity === 'week') {
    // Wochenbeginn (Montag) als Schlüssel
    const monday = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - weekdayMon(x)); x.setHours(0, 0, 0, 0); return x }
    for (let i = span - 1; i >= 0; i--) {
      const d = monday(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7))
      const key = d.toISOString().slice(0, 10)
      if (!index.has(key)) { index.set(key, buckets.length); buckets.push({ key, label: `${d.getDate()}.${d.getMonth() + 1}.` }) }
    }
    const keyOf = (t: number) => { const m = monday(new Date(t)); return m.toISOString().slice(0, 10) }
    const since = buckets.length ? new Date(buckets[0].key).getTime() : 0
    return { buckets, keyOf: (t) => (index.has(keyOf(t)) ? keyOf(t) : null), since, granularity }
  }

  // month
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    index.set(key, buckets.length)
    buckets.push({ key, label: MONTHS_SHORT[d.getMonth()] })
  }
  const keyOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
  const since = new Date(now.getFullYear(), now.getMonth() - (span - 1), 1).getTime()
  return { buckets, keyOf: (t) => (index.has(keyOf(t)) ? keyOf(t) : null), since, granularity }
}

// ── Route ───────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  const url = new URL(request.url)
  const daysParam = url.searchParams.get('days')
  const days: number | 'all' = daysParam === 'all' ? 'all' : [7, 30, 90, 365].includes(Number(daysParam)) ? Number(daysParam) : 30
  const { buckets, keyOf, since } = makeBuckets(days)
  const bucketIndex = new Map(buckets.map((b, i) => [b.key, i]))
  const windowLabel = days === 'all' ? 'gesamt' : days === 365 ? '12 Monate' : `${days} Tage`

  try {
    const eid = (t: string) => admin.from(t).select('event_id')

    const [
      profilesRes, membersRes, eventsRes, guestsRes,
      requestsRes, offersRes, vendorsRes, reviewsRes, favoritesRes,
      auditRes, messagesRes, fileLogRes, mvEventsRes,
      inviteCodesRes, eventInvitesRes, tourRes,
      seatingRes, cateringRes, musicRes, playlistRes, timelineRes,
      budgetRes, getraenkeRes, notesRes, mediaRes, photosRes, giftsRes, hotelsRes,
    ] = await Promise.all([
      admin.from('profiles').select('id, created_at, city, is_approved_organizer, is_admin, deleted_at'),
      admin.from('event_members').select('user_id, role, event_id, invite_status, onboarding_completed_at, joined_at'),
      admin.from('events').select('id, date, event_type, projektphase, onboarding_complete, budget_total, location_city, venue, created_at, created_by'),
      admin.from('guests').select('event_id'),
      admin.from('marketplace_requests').select('id, dienstleister_id, status, budget, created_at, responded_at'),
      admin.from('vendor_offers').select('status, total, released_at, accepted_at, created_at'),
      admin.from('dienstleister_profiles').select('id, category, moderation_status, is_marketplace, city, service_cities'),
      admin.from('marketplace_reviews').select('rating, status'),
      admin.from('marketplace_favorites').select('id, created_at'),
      admin.from('audit_log').select('actor_id, actor_role, created_at').limit(100000),
      admin.from('messages').select('sender_id, created_at').limit(100000),
      admin.from('file_access_log').select('user_id, action, accessed_at').limit(100000),
      admin.from('marketplace_vendor_events').select('event_type, created_at').limit(100000),
      admin.from('invite_codes').select('status, used_at, created_at'),
      admin.from('event_invitations').select('status, accepted_at, created_at'),
      admin.from('user_tour_state').select('user_id, completed_at'),
      eid('seating_tables'), eid('catering_plans'), eid('music_songs'), eid('musik_playlisten'),
      eid('timeline_entries'), eid('budget_items'), eid('getraenke_kategorien'), eid('brautpaar_notes'),
      eid('media_shot_items'), eid('guest_photos'), eid('geschenk_wuensche'),
      eid('hotels'),
    ]) as any[]

    const giftsData = giftsRes?.data ?? []

    const profiles = profilesRes.data ?? []
    const members = membersRes.data ?? []
    const events = eventsRes.data ?? []
    const guests = guestsRes.data ?? []
    const requests = requestsRes.data ?? []
    const offers = offersRes.data ?? []
    const vendors = vendorsRes.data ?? []
    const reviews = reviewsRes.data ?? []
    const favorites = favoritesRes.data ?? []
    const audit = auditRes.data ?? []
    const messages = messagesRes.data ?? []
    const fileLog = fileLogRes.data ?? []
    const mvEvents = mvEventsRes.data ?? []
    const inviteCodes = inviteCodesRes.data ?? []
    const eventInvites = eventInvitesRes.data ?? []
    const tours = tourRes.data ?? []

    // Für „Gesamt" zählen KPIs/Funnel all-time; die Zeitreihen-Buckets bleiben 12 Monate.
    const winSince = days === 'all' ? 0 : since
    const inWindow = (t: number | null) => t != null && t >= winSince

    // ── Rollen-Auflösung (für Aktivität je Rolle) ───────────────────────────
    const usersByRole = new Map<string, Set<string>>()
    for (const m of members) {
      if (!m.role || !m.user_id) continue
      if (!usersByRole.has(m.role)) usersByRole.set(m.role, new Set())
      usersByRole.get(m.role)!.add(m.user_id)
    }
    const roleCount = (r: string) => usersByRole.get(r)?.size ?? 0
    const adminIds = new Set(profiles.filter((p: any) => p.is_admin).map((p: any) => p.id))
    const has = (r: string, uid: string) => usersByRole.get(r)?.has(uid) ?? false
    const roleOf = (uid: string | null): string => {
      if (!uid) return 'Unbekannt'
      if (adminIds.has(uid)) return 'Admin'
      if (has('veranstalter', uid)) return 'Veranstalter'
      if (has('brautpaar', uid) || has('brautpaar_solo', uid)) return 'Brautpaar'
      if (has('trauzeuge', uid)) return 'Trauzeuge'
      if (has('dienstleister', uid)) return 'Dienstleister'
      return 'Sonstige'
    }

    // ── Einheitlicher Aktivitäts-Stream (mehrere Quellen) ───────────────────
    interface Act { uid: string | null; t: number; area: string }
    const acts: Act[] = []
    for (const r of audit) { const t = ts(r.created_at); if (t != null) acts.push({ uid: r.actor_id ?? null, t, area: 'Gästeliste' }) }
    for (const r of messages) { const t = ts(r.created_at); if (t != null) acts.push({ uid: r.sender_id ?? null, t, area: 'Nachrichten' }) }
    for (const r of fileLog) { const t = ts(r.accessed_at); if (t != null) acts.push({ uid: r.user_id ?? null, t, area: 'Dateien' }) }
    for (const r of requests) { const t = ts(r.created_at); if (t != null) acts.push({ uid: r.requested_by ?? null, t, area: 'Marktplatz' }) }
    for (const r of offers) { const t = ts(r.created_at); if (t != null) acts.push({ uid: null, t, area: 'Angebote' }) }

    // ── A · Nutzer & Wachstum ───────────────────────────────────────────────
    const liveProfiles = profiles.filter((p: any) => !p.deleted_at)
    const approvedOrganizers = liveProfiles.filter((p: any) => p.is_approved_organizer)
    const soloCouples = roleCount('brautpaar_solo')
    const organizedCouples = roleCount('brautpaar')
    const coupleUsers = new Set<string>()
    usersByRole.get('brautpaar')?.forEach(u => coupleUsers.add(u))
    usersByRole.get('brautpaar_solo')?.forEach(u => coupleUsers.add(u))
    const totalCouples = coupleUsers.size

    const roleDistribution = [
      { label: 'Veranstalter', value: roleCount('veranstalter') },
      { label: 'Brautpaar (mit Veranstalter)', value: organizedCouples },
      { label: 'Brautpaar (Solo)', value: soloCouples },
      { label: 'Trauzeuge', value: roleCount('trauzeuge') },
      { label: 'Dienstleister', value: roleCount('dienstleister') },
    ].filter(r => r.value > 0)

    const signupsSeries = buckets.map(b => ({ label: b.label, value: 0 }))
    for (const p of liveProfiles) {
      const t = ts(p.created_at)
      if (t == null) continue
      const k = keyOf(t)
      if (k != null && bucketIndex.has(k)) signupsSeries[bucketIndex.get(k)!].value++
    }

    const organizersWithEvent = new Set<string>()
    for (const e of events) if (e.created_by) organizersWithEvent.add(e.created_by)
    for (const m of members) if (m.role === 'veranstalter' && m.user_id) organizersWithEvent.add(m.user_id)
    const approvedOrgIds = new Set(approvedOrganizers.map((p: any) => p.id))
    const activeOrganizers = Array.from(organizersWithEvent).filter(id => approvedOrgIds.has(id)).length

    // ── B · Events (Bestand — zeitfenster-unabhängig) ───────────────────────
    const today = new Date(); today.setHours(0, 0, 0, 0)
    let upcoming = 0, past = 0, onboardingDone = 0, budgetSum = 0, budgetCount = 0
    const eventTypeMap = new Map<string, number>()
    const phaseMap = new Map<string, number>()
    const eventsByMonthBuckets = makeBuckets('all')
    const eventsByMonthIdx = new Map(eventsByMonthBuckets.buckets.map((b, i) => [b.key, i]))
    const eventsByMonth = eventsByMonthBuckets.buckets.map(b => ({ label: b.label, value: 0 }))
    const cityMap = new Map<string, number>()

    for (const e of events) {
      const t = ts(e.date)
      if (t != null) {
        if (t >= today.getTime()) upcoming++; else past++
        const k = eventsByMonthBuckets.keyOf(t)
        if (k != null && eventsByMonthIdx.has(k)) eventsByMonth[eventsByMonthIdx.get(k)!].value++
      }
      if (e.onboarding_complete) onboardingDone++
      const bt = Number(e.budget_total)
      if (!isNaN(bt) && bt > 0) { budgetSum += bt; budgetCount++ }
      eventTypeMap.set(e.event_type || 'hochzeit', (eventTypeMap.get(e.event_type || 'hochzeit') ?? 0) + 1)
      phaseMap.set(e.projektphase || 'Planung', (phaseMap.get(e.projektphase || 'Planung') ?? 0) + 1)
      const city = normCity(e.location_city)
      if (city) cityMap.set(city, (cityMap.get(city) ?? 0) + 1)
    }

    const EVENT_TYPE_LABELS: Record<string, string> = { hochzeit: 'Hochzeit', firmenevent: 'Firmenevent', intern: 'Intern' }
    const eventTypes = Array.from(eventTypeMap.entries()).map(([k, v]) => ({ label: EVENT_TYPE_LABELS[k] ?? k, value: v })).sort((a, b) => b.value - a.value)
    const PHASE_ORDER = ['Planung', 'Finalisierung', 'Durchführung', 'Nachbereitung']
    const phases = PHASE_ORDER.map(p => ({ label: p, value: phaseMap.get(p) ?? 0 })).filter(p => p.value > 0)

    const guestsByEvent = new Map<string, number>()
    for (const g of guests) if (g.event_id) guestsByEvent.set(g.event_id, (guestsByEvent.get(g.event_id) ?? 0) + 1)
    const avgGuests = guestsByEvent.size > 0 ? Math.round(Array.from(guestsByEvent.values()).reduce((a, b) => a + b, 0) / guestsByEvent.size) : 0

    // ── C · Website-Nutzung (zeitfenster-abhängig) ──────────────────────────
    const actsWin = acts.filter(a => a.t >= winSince)
    // Aktive Nutzer je Bucket (eindeutig)
    const activeByBucket = buckets.map(() => new Set<string>())
    const areaMap = new Map<string, number>()
    const roleActMap = new Map<string, number>()
    const heat = new Map<string, number>() // "wd-h" → count
    const activeAll = new Set<string>()
    for (const a of actsWin) {
      if (a.uid) {
        const k = keyOf(a.t)
        if (k != null && bucketIndex.has(k)) activeByBucket[bucketIndex.get(k)!].add(a.uid)
        activeAll.add(a.uid)
        const role = roleOf(a.uid)
        roleActMap.set(role, (roleActMap.get(role) ?? 0) + 1)
      }
      areaMap.set(a.area, (areaMap.get(a.area) ?? 0) + 1)
      const d = new Date(a.t)
      const hk = `${weekdayMon(d)}-${d.getHours()}`
      heat.set(hk, (heat.get(hk) ?? 0) + 1)
    }
    const activeUsersSeries = buckets.map((b, i) => ({ label: b.label, value: activeByBucket[i].size }))
    const actionsByArea = topN(Array.from(areaMap.entries()).map(([label, value]) => ({ label, value })), 8)
    const actionsByRole = Array.from(roleActMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
    const heatmap: { d: number; h: number; v: number }[] = []
    let heatMax = 0
    heat.forEach((v, k) => { const [d, h] = k.split('-').map(Number); heatmap.push({ d, h, v }); if (v > heatMax) heatMax = v })
    const totalActions = actsWin.length

    // ── D · Aktivierung & Einladungen ───────────────────────────────────────
    const onboardedUsers = new Set<string>()
    for (const m of members) if (m.onboarding_completed_at && m.user_id) onboardedUsers.add(m.user_id)
    const active30 = new Set<string>()
    const since30 = Date.now() - 30 * 86400000
    for (const a of acts) if (a.uid && a.t >= since30) active30.add(a.uid)
    const activationFunnel = [
      { label: 'Registriert', value: liveProfiles.length },
      { label: 'Onboarding abgeschlossen', value: onboardedUsers.size },
      { label: 'Aktiv (30 Tage)', value: active30.size },
    ]
    // Einladungen: Gäste/Rollen-Codes + Dienstleister-Einladungen
    const codeUsed = inviteCodes.filter((c: any) => c.used_at || c.status === 'used' || c.status === 'accepted').length
    const invUsed = eventInvites.filter((c: any) => c.accepted_at || c.status === 'accepted').length
    const invites = [
      { label: 'Rollen/Gäste-Codes', sent: inviteCodes.length, accepted: codeUsed },
      { label: 'Dienstleister-Einladungen', sent: eventInvites.length, accepted: invUsed },
    ]
    const tourCompleted = tours.filter((t: any) => t.completed_at).length
    const tour = { started: tours.length, completed: tourCompleted }

    // ── E · Marktplatz-Potenzial ────────────────────────────────────────────
    const mvWin = mvEvents.filter((r: any) => inWindow(ts(r.created_at)))
    const views = mvWin.filter((r: any) => r.event_type === 'profile_view').length
    const contacts = mvWin.filter((r: any) => r.event_type === 'contact_email' || r.event_type === 'contact_phone').length
    const reqWin = requests.filter((r: any) => inWindow(ts(r.created_at)))
    const offersReleasedWin = offers.filter((o: any) => inWindow(ts(o.released_at)))
    const offersAcceptedWin = offers.filter((o: any) => o.status === 'accepted' && inWindow(ts(o.accepted_at)))
    const potentialFunnel = [
      { label: 'Profilaufrufe', value: views },
      { label: 'Kontaktklicks', value: contacts },
      { label: 'Anfragen', value: reqWin.length },
      { label: 'Angebote', value: offersReleasedWin.length },
      { label: 'Buchungen', value: offersAcceptedWin.length },
    ]
    // Offene Pipeline (versendet, noch nicht gebucht/abgelehnt) = potenzieller Umsatz
    const openOffers = offers.filter((o: any) => o.released_at && o.status !== 'accepted' && o.status !== 'declined')
    const pipelineValue = openOffers.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0)
    const bookedRevenue = offers.filter((o: any) => o.status === 'accepted').reduce((s: number, o: any) => s + (Number(o.total) || 0), 0)
    const releasedVals = offers.filter((o: any) => o.released_at && Number(o.total) > 0).map((o: any) => Number(o.total))
    const avgOfferValue = releasedVals.length ? Math.round(releasedVals.reduce((a: number, b: number) => a + b, 0) / releasedVals.length) : 0
    const favWin = favorites.filter((f: any) => inWindow(ts(f.created_at))).length
    // Reichweiten-Serie (Profilaufrufe je Bucket)
    const reachSeries = buckets.map(b => ({ label: b.label, value: 0 }))
    for (const r of mvWin) {
      if (r.event_type !== 'profile_view') continue
      const t = ts(r.created_at); if (t == null) continue
      const k = keyOf(t); if (k != null && bucketIndex.has(k)) reachSeries[bucketIndex.get(k)!].value++
    }
    // Reaktionszeit
    const respH: number[] = []
    for (const r of requests) { const a = ts(r.created_at), b = ts(r.responded_at); if (a != null && b != null && b >= a) respH.push((b - a) / 3.6e6) }
    const avgResponseHours = respH.length ? Math.round(respH.reduce((a, b) => a + b, 0) / respH.length) : null
    const conversionRate = reqWin.length > 0 ? Math.round((offersAcceptedWin.length / reqWin.length) * 100) : 0

    // Anfragen & Anbieter nach Kategorie
    const CATEGORY_LABELS: Record<string, string> = {
      fotograf: 'Fotograf', videograf: 'Videograf', dj: 'DJ', band: 'Band', catering: 'Catering',
      location: 'Location', floristik: 'Floristik', konditor: 'Konditor', deko: 'Dekoration',
      beauty: 'Beauty & Styling', planung: 'Hochzeitsplanung', sonstige: 'Sonstige',
    }
    const catLabel = (k: string | null | undefined) => (k ? (CATEGORY_LABELS[k] ?? k) : 'Sonstige')
    const vendorCategoryById = new Map(vendors.map((v: any) => [v.id, v.category]))
    const reqCatMap = new Map<string, number>()
    for (const r of requests) { const c = catLabel(vendorCategoryById.get(r.dienstleister_id) as string); reqCatMap.set(c, (reqCatMap.get(c) ?? 0) + 1) }
    const requestsByCategory = topN(Array.from(reqCatMap.entries()).map(([label, value]) => ({ label, value })), 8)

    // ── F · Orte & Angebot/Nachfrage ────────────────────────────────────────
    const orgCityMap = new Map<string, number>()
    for (const p of approvedOrganizers) { const c = normCity(p.city); if (c) orgCityMap.set(c, (orgCityMap.get(c) ?? 0) + 1) }
    const eventsByCity = topN(Array.from(cityMap.entries()).map(([label, value]) => ({ label, value })), 8)
    const organizersByCity = topN(Array.from(orgCityMap.entries()).map(([label, value]) => ({ label, value })), 8)

    // Dienstleister je Stadt (Heimatstadt)
    const marketVendors = vendors.filter((v: any) => v.is_marketplace)
    const vendorCityMap = new Map<string, number>()
    for (const v of marketVendors) { const c = normCity(v.city); if (c) vendorCityMap.set(c, (vendorCityMap.get(c) ?? 0) + 1) }
    const vendorsByCity = topN(Array.from(vendorCityMap.entries()).map(([label, value]) => ({ label, value })), 8)

    // Angebot/Nachfrage-Lücke je Stadt: Nachfrage = Events, Angebot = Anbieter (Heimatstadt ODER service_cities)
    const supplyCityMap = new Map<string, number>()
    for (const v of marketVendors) {
      const seen = new Set<string>()
      const home = normCity(v.city); if (home) seen.add(home.toLowerCase())
      for (const sc of (v.service_cities ?? [])) { const c = normCity(sc); if (c) seen.add(c.toLowerCase()) }
      seen.forEach(cl => supplyCityMap.set(cl, (supplyCityMap.get(cl) ?? 0) + 1))
    }
    const demandCityLower = new Map<string, { name: string; demand: number }>()
    cityMap.forEach((v, name) => { demandCityLower.set(name.toLowerCase(), { name, demand: v }) })
    const gapCityKeys = new Set<string>()
    demandCityLower.forEach((_, k) => gapCityKeys.add(k))
    supplyCityMap.forEach((_, k) => gapCityKeys.add(k))
    const gapByCity = Array.from(gapCityKeys).map(k => {
      const d = demandCityLower.get(k)
      return { label: d?.name ?? (k.charAt(0).toUpperCase() + k.slice(1)), demand: d?.demand ?? 0, supply: supplyCityMap.get(k) ?? 0 }
    }).sort((a, b) => (b.demand + b.supply) - (a.demand + a.supply)).slice(0, 8)

    // Angebot/Nachfrage je Kategorie: Nachfrage = Anfragen, Angebot = Anbieter
    const vendorCatMap = new Map<string, number>()
    for (const v of marketVendors) { const c = catLabel(v.category); vendorCatMap.set(c, (vendorCatMap.get(c) ?? 0) + 1) }
    const vendorsByCategory = topN(Array.from(vendorCatMap.entries()).map(([label, value]) => ({ label, value })), 8)
    const gapCatKeys = new Set<string>()
    reqCatMap.forEach((_, k) => gapCatKeys.add(k))
    vendorCatMap.forEach((_, k) => gapCatKeys.add(k))
    const gapByCategory = Array.from(gapCatKeys).map(k => ({ label: k, demand: reqCatMap.get(k) ?? 0, supply: vendorCatMap.get(k) ?? 0 }))
      .sort((a, b) => (b.demand + b.supply) - (a.demand + a.supply)).slice(0, 8)

    // Moderationsstatus + Bewertungen
    const modMap = new Map<string, number>()
    for (const v of vendors) modMap.set(v.moderation_status || 'pending', (modMap.get(v.moderation_status || 'pending') ?? 0) + 1)
    const MOD_LABELS: Record<string, string> = { approved: 'Freigegeben', pending: 'In Prüfung', rejected: 'Abgelehnt', draft: 'Entwurf' }
    const moderation = Array.from(modMap.entries()).map(([k, v]) => ({ label: MOD_LABELS[k] ?? k, value: v })).sort((a, b) => b.value - a.value)
    const pubReviews = reviews.filter((r: any) => r.status === 'published' && r.rating != null)
    const avgRating = pubReviews.length ? Math.round((pubReviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / pubReviews.length) * 10) / 10 : null

    // ── G · Modulnutzung ────────────────────────────────────────────────────
    const eventSet = (res: any) => { const s = new Set<string>(); for (const row of res?.data ?? []) if (row.event_id) s.add(row.event_id); return s }
    const musicSet = eventSet(musicRes); eventSet(playlistRes).forEach(id => musicSet.add(id))
    const mediaSet = eventSet(mediaRes); eventSet(photosRes).forEach(id => mediaSet.add(id))
    const adoptionRaw = [
      { label: 'Gästeliste', count: guestsByEvent.size },
      { label: 'Sitzplan', count: eventSet(seatingRes).size },
      { label: 'Ablaufplan', count: eventSet(timelineRes).size },
      { label: 'Budget', count: eventSet(budgetRes).size },
      { label: 'Catering', count: eventSet(cateringRes).size },
      { label: 'Getränke', count: eventSet(getraenkeRes).size },
      { label: 'Musik', count: musicSet.size },
      { label: 'Notizen', count: eventSet(notesRes).size },
      { label: 'Medien / Fotos', count: mediaSet.size },
      { label: 'Geschenke', count: new Set((giftsData ?? []).map((r: any) => r.event_id).filter(Boolean)).size },
      { label: 'Hotels', count: eventSet(hotelsRes).size },
    ]
    const totalEvents = events.length || 1
    const adoption = adoptionRaw.map(a => ({ label: a.label, value: a.count, pct: Math.round((a.count / totalEvents) * 100) })).sort((a, b) => b.value - a.value)

    return NextResponse.json({
      window: { days, label: windowLabel },
      users: {
        approvedOrganizers: approvedOrganizers.length, totalCouples, soloCouples, organizedCouples,
        vendors: marketVendors.length, activeOrganizers,
        activationRate: approvedOrganizers.length > 0 ? Math.round((activeOrganizers / approvedOrganizers.length) * 100) : 0,
        roleDistribution, signupsSeries,
      },
      usage: {
        activeTotal: activeAll.size, totalActions, activeUsersSeries,
        actionsByArea, actionsByRole, heatmap, heatMax, weekdays: WD_SHORT,
      },
      activation: { funnel: activationFunnel, invites, tour },
      events: {
        total: events.length, upcoming, past, avgGuests,
        avgBudget: budgetCount > 0 ? Math.round(budgetSum / budgetCount) : 0,
        onboardingRate: events.length > 0 ? Math.round((onboardingDone / events.length) * 100) : 0,
        eventTypes, phases, eventsByMonth,
      },
      potential: {
        funnel: potentialFunnel, conversionRate, pipelineValue, openCount: openOffers.length,
        bookedRevenue, avgOfferValue, avgResponseHours, favorites: favWin, reachSeries, requestsByCategory,
      },
      geo: { eventsByCity, organizersByCity, vendorsByCity, gapByCity, gapByCategory, vendorsByCategory },
      supply: { moderation, avgRating, reviewCount: pubReviews.length },
      adoption: { totalEvents: events.length, modules: adoption },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Statistik konnte nicht geladen werden' }, { status: 500 })
  }
}
