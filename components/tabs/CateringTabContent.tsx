'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import CateringTab from '@/app/vendor/dashboard/[eventId]/tabs/CateringTab'

interface TabContentProps {
  eventId: string
  mode: 'veranstalter' | 'dienstleister' | 'brautpaar'
  tabAccess?: 'read' | 'write'
  itemPermissions?: Record<string, 'none' | 'read' | 'write'>
  initialCosts?: unknown[]
}

type CateringFormType = React.ComponentType<{
  eventId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialEvent: any
  initialPlan: Record<string, unknown> | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialCosts: any[]
  confirmedGuestCount: number
  mealCounts: Record<string, number>
  allergyCounts: Record<string, number>
}>

// CateringForm requires initialEvent, initialPlan, initialCosts, confirmedGuestCount, mealCounts, allergyCounts
// We fetch these client-side and render CateringForm for write access.
function CateringFormWrapper({ eventId, initialCosts: preloadedCosts }: { eventId: string; initialCosts?: unknown[] }) {
  const componentRef = useRef<CateringFormType | null>(null)
  const [componentReady, setComponentReady] = useState(false)
  const [props, setProps] = useState<{
    initialEvent: Record<string, unknown>
    initialPlan: Record<string, unknown> | null
    initialCosts: unknown[]
    confirmedGuestCount: number
    mealCounts: Record<string, number>
    allergyCounts: Record<string, number>
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('@/app/veranstalter/[eventId]/catering/CateringForm').then(m => {
      componentRef.current = m.default as CateringFormType
      setComponentReady(true)
    })

    const supabase = createClient()
    Promise.all([
      supabase.from('events').select('id, meal_options, menu_type, collect_allergies, children_allowed, children_note').eq('id', eventId).single(),
      supabase.from('catering_plans').select('*').eq('event_id', eventId).single(),
      preloadedCosts
        ? Promise.resolve({ data: preloadedCosts })
        : supabase.from('event_organizer_costs').select('id, category, price_per_person, notes').eq('event_id', eventId).eq('source', 'catering').order('created_at', { ascending: true }),
      supabase.from('guests').select('id, meal_choice, allergy_tags, allergy_custom, status').eq('event_id', eventId).eq('status', 'zugesagt'),
    ]).then(([eventRes, planRes, costsRes, guestsRes]) => {
      const confirmedGuests = guestsRes.data ?? []
      const confirmedGuestCount = confirmedGuests.length

      const mealCounts: Record<string, number> = {}
      const allergyCounts: Record<string, number> = {}
      confirmedGuests.forEach((g: Record<string, unknown>) => {
        const meal = g.meal_choice as string | null
        if (meal) mealCounts[meal] = (mealCounts[meal] ?? 0) + 1
        const tags = g.allergy_tags as string[] | null
        if (tags) {
          tags.forEach((a: string) => {
            allergyCounts[a] = (allergyCounts[a] ?? 0) + 1
          })
        }
        const custom = g.allergy_custom as string | null
        if (custom) allergyCounts[custom] = (allergyCounts[custom] ?? 0) + 1
      })

      setProps({
        initialEvent: (eventRes.data ?? {}) as Record<string, unknown>,
        initialPlan: planRes.data as Record<string, unknown> | null,
        initialCosts: costsRes.data ?? [],
        confirmedGuestCount,
        mealCounts,
        allergyCounts,
      })
      setLoading(false)
    })
  }, [eventId])

  const CateringFormComponent = componentRef.current

  if (loading || !componentReady || !CateringFormComponent || !props) {
    return <div style={{ padding: '36px 40px', color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
  }

  return (
    <CateringFormComponent
      eventId={eventId}
      initialEvent={props.initialEvent}
      initialPlan={props.initialPlan}
      initialCosts={props.initialCosts}
      confirmedGuestCount={props.confirmedGuestCount}
      mealCounts={props.mealCounts}
      allergyCounts={props.allergyCounts}
    />
  )
}

export default function CateringTabContent({ eventId, mode, tabAccess, itemPermissions, initialCosts }: TabContentProps) {
  if (mode !== 'dienstleister' || tabAccess === 'write') {
    return <CateringFormWrapper eventId={eventId} initialCosts={initialCosts} />
  }
  return <CateringTab eventId={eventId} tabAccess={tabAccess} sectionPerms={itemPermissions} initialCosts={initialCosts} />
}
