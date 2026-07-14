// app/api/admin/stats/route.ts
// Aggregierte Kennzahlen für das Admin-Übersichts-Dashboard (Nutzer, Events,
// Marktplatz-Conversion, Geografie, Brautpaar-Modulnutzung, Dienstleister-Angebot).
// Zugriff nur für Accounts mit profiles.is_admin (requireAdmin). Alle Daten werden
// serverseitig per Service-Role geladen und in JS aggregiert (kleine Datenmengen).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

// ── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/** Liefert die letzten `n` Monate als Buckets (ältester zuerst). */
function lastMonths(n: number) {
  const now = new Date()
  const out: { key: string; label: string; year: number; month: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTHS_SHORT[d.getMonth()],
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    })
  }
  return out
}

function monthKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function normCity(v: string | null | undefined): string | null {
  if (!v) return null
  const s = String(v).trim()
  return s ? s : null
}

function topN<T extends { label: string; value: number }>(items: T[], n: number): T[] {
  return [...items].sort((a, b) => b.value - a.value).slice(0, n)
}

// ── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  try {
    const eid = (t: string) => admin.from(t).select('event_id')

    const [
      profilesRes, membersRes, eventsRes, guestsRes,
      requestsRes, offersRes, vendorsRes, reviewsRes,
      seatingRes, cateringRes, musicRes, playlistRes, timelineRes,
      budgetRes, getraenkeRes, notesRes, mediaRes, photosRes, giftsRes, hotelsRes,
    ] = await Promise.all([
      admin.from('profiles').select('id, created_at, city, is_approved_organizer, is_admin, deleted_at'),
      admin.from('event_members').select('user_id, role, event_id'),
      admin.from('events').select('id, date, event_type, projektphase, onboarding_complete, budget_total, location_city, venue, created_at, created_by'),
      admin.from('guests').select('event_id'),
      admin.from('marketplace_requests').select('id, dienstleister_id, status, budget, created_at, responded_at'),
      admin.from('vendor_offers').select('status, total, released_at, accepted_at, created_at'),
      admin.from('dienstleister_profiles').select('id, category, moderation_status, is_marketplace, city'),
      admin.from('marketplace_reviews').select('rating, status'),
      eid('seating_tables'), eid('catering_plans'), eid('music_songs'), eid('musik_playlisten'),
      eid('timeline_entries'), eid('budget_items'), eid('getraenke_kategorien'), eid('brautpaar_notes'),
      eid('media_shot_items'), eid('guest_photos'), eid('geschenk_wuensche'), eid('hotels'),
    ])

    const profiles = profilesRes.data ?? []
    const members = membersRes.data ?? []
    const events = eventsRes.data ?? []
    const guests = guestsRes.data ?? []
    const requests = requestsRes.data ?? []
    const offers = offersRes.data ?? []
    const vendors = vendorsRes.data ?? []
    const reviews = reviewsRes.data ?? []

    const months = lastMonths(12)
    const monthIndex = new Map(months.map((m, i) => [m.key, i]))

    // ── A · Nutzer & Wachstum ──────────────────────────────────────────────
    const liveProfiles = profiles.filter(p => !p.deleted_at)
    const approvedOrganizers = liveProfiles.filter(p => p.is_approved_organizer)

    // Rollen aus event_members (ein Nutzer kann mehrere Rollen haben → distinct je Rolle)
    const usersByRole = new Map<string, Set<string>>()
    for (const m of members) {
      if (!m.role || !m.user_id) continue
      if (!usersByRole.has(m.role)) usersByRole.set(m.role, new Set())
      usersByRole.get(m.role)!.add(m.user_id)
    }
    const roleCount = (r: string) => usersByRole.get(r)?.size ?? 0

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

    // Neuanmeldungen pro Monat (profiles.created_at)
    const signupsSeries = months.map(m => ({ label: m.label, value: 0 }))
    for (const p of liveProfiles) {
      const k = monthKey(p.created_at)
      if (k != null && monthIndex.has(k)) signupsSeries[monthIndex.get(k)!].value++
    }

    // Aktivierung: Veranstalter mit >= 1 eigenem Event
    const organizersWithEvent = new Set<string>()
    for (const e of events) if (e.created_by) organizersWithEvent.add(e.created_by)
    for (const m of members) if (m.role === 'veranstalter' && m.user_id) organizersWithEvent.add(m.user_id)
    const approvedOrgIds = new Set(approvedOrganizers.map(p => p.id))
    const activeOrganizers = Array.from(organizersWithEvent).filter(id => approvedOrgIds.has(id)).length

    // ── B · Events ─────────────────────────────────────────────────────────
    const today = new Date(); today.setHours(0, 0, 0, 0)
    let upcoming = 0, past = 0, onboardingDone = 0
    let budgetSum = 0, budgetCount = 0
    const eventTypeMap = new Map<string, number>()
    const phaseMap = new Map<string, number>()
    const eventsByMonth = months.map(m => ({ label: m.label, value: 0 }))
    const cityMap = new Map<string, number>()

    for (const e of events) {
      const d = e.date ? new Date(e.date) : null
      if (d && !isNaN(d.getTime())) {
        if (d >= today) upcoming++; else past++
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (monthIndex.has(k)) eventsByMonth[monthIndex.get(k)!].value++
      }
      if (e.onboarding_complete) onboardingDone++
      const bt = Number(e.budget_total)
      if (!isNaN(bt) && bt > 0) { budgetSum += bt; budgetCount++ }
      const et = e.event_type || 'hochzeit'
      eventTypeMap.set(et, (eventTypeMap.get(et) ?? 0) + 1)
      const ph = e.projektphase || 'Planung'
      phaseMap.set(ph, (phaseMap.get(ph) ?? 0) + 1)
      const city = normCity(e.location_city)
      if (city) cityMap.set(city, (cityMap.get(city) ?? 0) + 1)
    }

    const EVENT_TYPE_LABELS: Record<string, string> = { hochzeit: 'Hochzeit', firmenevent: 'Firmenevent', intern: 'Intern' }
    const eventTypes = Array.from(eventTypeMap.entries())
      .map(([k, v]) => ({ label: EVENT_TYPE_LABELS[k] ?? k, value: v }))
      .sort((a, b) => b.value - a.value)

    const PHASE_ORDER = ['Planung', 'Finalisierung', 'Durchführung', 'Nachbereitung']
    const phases = PHASE_ORDER
      .map(p => ({ label: p, value: phaseMap.get(p) ?? 0 }))
      .filter(p => p.value > 0)

    // Gäste je Event
    const guestsByEvent = new Map<string, number>()
    for (const g of guests) if (g.event_id) guestsByEvent.set(g.event_id, (guestsByEvent.get(g.event_id) ?? 0) + 1)
    const avgGuests = guestsByEvent.size > 0
      ? Math.round(Array.from(guestsByEvent.values()).reduce((a, b) => a + b, 0) / guestsByEvent.size)
      : 0

    // ── C · Marktplatz-Conversion ──────────────────────────────────────────
    const reqTotal = requests.length
    const reqResponded = requests.filter(r => r.responded_at).length
    const reqAccepted = requests.filter(r => r.status === 'accepted').length
    const reqDeclined = requests.filter(r => r.status === 'declined').length

    const offersReleased = offers.filter(o => o.released_at).length
    const offersAccepted = offers.filter(o => o.status === 'accepted').length
    const bookedRevenue = offers
      .filter(o => o.status === 'accepted')
      .reduce((s, o) => s + (Number(o.total) || 0), 0)
    const releasedValues = offers.filter(o => o.released_at && Number(o.total) > 0).map(o => Number(o.total))
    const avgOfferValue = releasedValues.length > 0
      ? Math.round(releasedValues.reduce((a, b) => a + b, 0) / releasedValues.length)
      : 0

    // Ø Reaktionszeit (Stunden) — created_at → responded_at
    const responseHours: number[] = []
    for (const r of requests) {
      if (r.created_at && r.responded_at) {
        const h = (new Date(r.responded_at).getTime() - new Date(r.created_at).getTime()) / 3.6e6
        if (h >= 0) responseHours.push(h)
      }
    }
    const avgResponseHours = responseHours.length > 0
      ? Math.round(responseHours.reduce((a, b) => a + b, 0) / responseHours.length)
      : null

    const funnel = [
      { label: 'Anfragen gestellt', value: reqTotal },
      { label: 'Angebot versendet', value: offersReleased },
      { label: 'Angenommen', value: offersAccepted },
    ]
    const conversionRate = reqTotal > 0 ? Math.round((offersAccepted / reqTotal) * 100) : 0

    // Anfragen nach Gewerk/Kategorie (via dienstleister_profiles.category)
    const vendorCategoryById = new Map(vendors.map(v => [v.id, v.category]))
    const CATEGORY_LABELS: Record<string, string> = {
      fotograf: 'Fotograf', videograf: 'Videograf', dj: 'DJ', band: 'Band', catering: 'Catering',
      location: 'Location', floristik: 'Floristik', konditor: 'Konditor', deko: 'Dekoration',
      beauty: 'Beauty & Styling', planung: 'Hochzeitsplanung', sonstige: 'Sonstige',
    }
    const catLabel = (k: string | null | undefined) => (k ? (CATEGORY_LABELS[k] ?? k) : 'Sonstige')
    const reqCatMap = new Map<string, number>()
    for (const r of requests) {
      const cat = catLabel(vendorCategoryById.get(r.dienstleister_id) as string | undefined)
      reqCatMap.set(cat, (reqCatMap.get(cat) ?? 0) + 1)
    }
    const requestsByCategory = topN(Array.from(reqCatMap.entries()).map(([label, value]) => ({ label, value })), 8)

    // ── D · Geografie ──────────────────────────────────────────────────────
    const orgCityMap = new Map<string, number>()
    for (const p of approvedOrganizers) {
      const c = normCity(p.city)
      if (c) orgCityMap.set(c, (orgCityMap.get(c) ?? 0) + 1)
    }
    const eventsByCity = topN(Array.from(cityMap.entries()).map(([label, value]) => ({ label, value })), 8)
    const organizersByCity = topN(Array.from(orgCityMap.entries()).map(([label, value]) => ({ label, value })), 8)

    // ── E · Brautpaar-Modulnutzung (Adoption) ──────────────────────────────
    const totalEvents = events.length || 1
    const eventSet = (res: { data: { event_id: string | null }[] | null }) => {
      const s = new Set<string>()
      for (const row of res.data ?? []) if (row.event_id) s.add(row.event_id)
      return s
    }
    const guestSet = new Set(guestsByEvent.keys())
    const musicSet = eventSet(musicRes)
    eventSet(playlistRes).forEach(id => musicSet.add(id))
    const mediaSet = eventSet(mediaRes)
    eventSet(photosRes).forEach(id => mediaSet.add(id))

    const adoptionRaw: { label: string; count: number }[] = [
      { label: 'Gästeliste', count: guestSet.size },
      { label: 'Sitzplan', count: eventSet(seatingRes).size },
      { label: 'Ablaufplan', count: eventSet(timelineRes).size },
      { label: 'Budget', count: eventSet(budgetRes).size },
      { label: 'Catering', count: eventSet(cateringRes).size },
      { label: 'Getränke', count: eventSet(getraenkeRes).size },
      { label: 'Musik', count: musicSet.size },
      { label: 'Notizen', count: eventSet(notesRes).size },
      { label: 'Medien / Fotos', count: mediaSet.size },
      { label: 'Geschenke', count: eventSet(giftsRes).size },
      { label: 'Hotels', count: eventSet(hotelsRes).size },
    ]
    const adoption = adoptionRaw
      .map(a => ({ label: a.label, value: a.count, pct: Math.round((a.count / totalEvents) * 100) }))
      .sort((a, b) => b.value - a.value)

    // ── F · Dienstleister-Angebot ──────────────────────────────────────────
    const marketVendors = vendors.filter(v => v.is_marketplace)
    const vendorCatMap = new Map<string, number>()
    for (const v of marketVendors) {
      const c = catLabel(v.category)
      vendorCatMap.set(c, (vendorCatMap.get(c) ?? 0) + 1)
    }
    const vendorsByCategory = topN(Array.from(vendorCatMap.entries()).map(([label, value]) => ({ label, value })), 8)

    const modMap = new Map<string, number>()
    for (const v of vendors) {
      const s = v.moderation_status || 'pending'
      modMap.set(s, (modMap.get(s) ?? 0) + 1)
    }
    const MOD_LABELS: Record<string, string> = { approved: 'Freigegeben', pending: 'In Prüfung', rejected: 'Abgelehnt', draft: 'Entwurf' }
    const moderation = Array.from(modMap.entries())
      .map(([k, v]) => ({ label: MOD_LABELS[k] ?? k, value: v }))
      .sort((a, b) => b.value - a.value)

    const publishedReviews = reviews.filter(r => r.status === 'published' && r.rating != null)
    const avgRating = publishedReviews.length > 0
      ? Math.round((publishedReviews.reduce((s, r) => s + (r.rating || 0), 0) / publishedReviews.length) * 10) / 10
      : null

    return NextResponse.json({
      users: {
        approvedOrganizers: approvedOrganizers.length,
        totalCouples,
        soloCouples,
        organizedCouples,
        vendors: marketVendors.length,
        activeOrganizers,
        activationRate: approvedOrganizers.length > 0 ? Math.round((activeOrganizers / approvedOrganizers.length) * 100) : 0,
        roleDistribution,
        signupsSeries,
      },
      events: {
        total: events.length,
        upcoming,
        past,
        avgGuests,
        avgBudget: budgetCount > 0 ? Math.round(budgetSum / budgetCount) : 0,
        onboardingRate: events.length > 0 ? Math.round((onboardingDone / events.length) * 100) : 0,
        eventTypes,
        phases,
        eventsByMonth,
      },
      conversion: {
        funnel,
        conversionRate,
        reqTotal, reqResponded, reqAccepted, reqDeclined,
        offersReleased, offersAccepted,
        bookedRevenue,
        avgOfferValue,
        avgResponseHours,
        requestsByCategory,
      },
      geo: { eventsByCity, organizersByCity },
      adoption: { totalEvents: events.length, modules: adoption },
      supply: { vendorsByCategory, moderation, avgRating, reviewCount: publishedReviews.length },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Statistik konnte nicht geladen werden' }, { status: 500 })
  }
}
