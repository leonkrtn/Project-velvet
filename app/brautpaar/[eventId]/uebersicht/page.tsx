import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requestDownloadUrl } from '@/lib/files/worker-client'
import BrautpaarUebersicht from './BrautpaarUebersicht'

interface Props {
  params: Promise<{ eventId: string }>
}

// Aktive Planungsphase — gleiche Logik wie in BrautpaarAufgaben
function getActivePhase(weddingDate: string | null): string | null {
  if (!weddingDate) return null
  const daysLeft = (new Date(weddingDate).getTime() - Date.now()) / 86400000
  if (daysLeft < 0) return 'after'
  if (daysLeft < 1) return 'day'
  if (daysLeft < 7) return '1w'
  const monthsLeft = daysLeft / 30
  if (monthsLeft < 3)  return '1m'
  if (monthsLeft < 6)  return '3m'
  if (monthsLeft < 12) return '6m'
  return '12m'
}

export default async function UebersichtPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [eventRes, guestsRes, begleitRes, budgetRes, tasksRes, seatingRes, songsRes, timelineRes, cateringRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, date, couple_name, venue, organizer_fee, organizer_fee_type, budget_total, cover_image_r2_key')
      .eq('id', eventId)
      .single(),
    supabase
      .from('guests')
      .select('id, status, invited_at, pending_approval')
      .eq('event_id', eventId),
    supabase
      .from('begleitpersonen')
      .select('guest_id')
      .eq('event_id', eventId),
    supabase
      .from('budget_items')
      .select('planned, actual, payment_status')
      .eq('event_id', eventId),
    supabase
      .from('brautpaar_tasks')
      .select('id, title, done, phase')
      .eq('event_id', eventId)
      .order('sort_order'),
    supabase
      .from('seating_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
    supabase
      .from('music_songs')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
    supabase
      .from('timeline_entries')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
    supabase
      .from('catering_plans')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
  ])

  const event = eventRes.data
  if (!event) redirect('/login')

  // pending_approval-Gäste (Sammel-Link, noch unbestätigt) zählen nicht mit
  const allGuests = guestsRes.data ?? []
  const guests = allGuests.filter(g => !g.pending_approval)
  const confirmedGuestIds = new Set(guests.filter(g => g.status === 'zugesagt').map(g => g.id))
  const confirmedBegleit = (begleitRes.data ?? []).filter(b => confirmedGuestIds.has(b.guest_id)).length
  const guestTotal = guests.length
  const guestConfirmed = confirmedGuestIds.size + confirmedBegleit
  const guestDeclined = guests.filter(g => g.status === 'abgesagt').length
  // "Ausstehend" = eingeladen aber noch ohne Antwort (inkl. vielleicht)
  const guestPending = guests.filter(g => ['angelegt', 'eingeladen', 'vielleicht'].includes(g.status as string)).length
  const guestNotInvited = guests.filter(g => g.status === 'angelegt' && !g.invited_at).length
  const guestApprovalPending = allGuests.length - guests.length

  const budgetItems = budgetRes.data ?? []
  // Karte zeigt: verplante Summe der Budgetpunkte vs. Gesamtbudget des Events
  const budgetPlanned = budgetItems.reduce((s, i) => s + (Number(i.planned) || 0), 0)
  const budgetLimit   = Number(event.budget_total) || 0
  const budgetItemCount = budgetItems.length
  // Catering gilt als „eingerichtet", sobald das Paar einen Plan gespeichert hat
  // (catering_plans wird nur bei aktiver Eingabe angelegt, nicht beim bloßen Öffnen).
  const cateringConfigured = (cateringRes.count ?? 0) > 0

  const tasks = tasksRes.data ?? []
  const tasksDone  = tasks.filter(t => t.done).length
  const tasksTotal = tasks.length

  // Top 3 offene Aufgaben: zuerst aus der aktiven Phase, dann restliche
  const activePhase = getActivePhase(event.date ?? null)
  const openTasks = tasks.filter(t => !t.done)
  const nextTasks = [
    ...openTasks.filter(t => t.phase === activePhase),
    ...openTasks.filter(t => t.phase !== activePhase),
  ].slice(0, 3).map(t => ({ id: t.id, title: t.title }))

  const daysLeft = event.date
    ? Math.ceil((new Date(event.date).getTime() - Date.now()) / 86400000)
    : null

  // Cover image: generate a fresh presigned GET URL (1h) if a key is stored.
  let coverImageUrl: string | null = null
  if (event.cover_image_r2_key) {
    try {
      coverImageUrl = await requestDownloadUrl(event.cover_image_r2_key)
    } catch {
      coverImageUrl = null
    }
  }

  // Monogramm aus den Anzeigeeinstellungen (für den Hero-Kicker)
  const { data: dsRow } = await supabase
    .from('event_display_settings').select('settings').eq('event_id', eventId).maybeSingle()
  const monogram = (dsRow?.settings && typeof (dsRow.settings as Record<string, unknown>).monogram === 'string')
    ? String((dsRow.settings as Record<string, unknown>).monogram) : ''

  return (
    <BrautpaarUebersicht
      eventId={eventId}
      coverImageUrl={coverImageUrl}
      monogram={monogram}
      eventTitle={event.title ?? ''}
      eventDate={event.date ?? null}
      coupleName={event.couple_name ?? ''}
      venueName={event.venue ?? ''}
      daysLeft={daysLeft}
      guestTotal={guestTotal}
      guestConfirmed={guestConfirmed}
      guestDeclined={guestDeclined}
      guestPending={guestPending}
      guestNotInvited={guestNotInvited}
      guestApprovalPending={guestApprovalPending}
      budgetPlanned={budgetPlanned}
      budgetLimit={budgetLimit}
      budgetItemCount={budgetItemCount}
      tasksDone={tasksDone}
      tasksTotal={tasksTotal}
      nextTasks={nextTasks}
      seatedCount={seatingRes.count ?? 0}
      songCount={songsRes.count ?? 0}
      timelineCount={timelineRes.count ?? 0}
      cateringConfigured={cateringConfigured}
    />
  )
}
