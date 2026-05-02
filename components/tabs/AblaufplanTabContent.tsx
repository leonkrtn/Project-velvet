'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import TimelineTab from '@/app/vendor/dashboard/[eventId]/tabs/TimelineTab'

interface TabContentProps {
  eventId: string
  mode: 'veranstalter' | 'dienstleister'
  tabAccess?: 'read' | 'write'
  itemPermissions?: Record<string, 'none' | 'read' | 'write'>
}

type AblaufplanClientType = React.ComponentType<{
  eventId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialEntries: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  members: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  staff: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vendors: any[]
}>

// AblaufplanClient requires: eventId, initialEntries, members, staff, vendors
// We fetch these client-side and render AblaufplanClient for write access.
function AblaufplanClientWrapper({ eventId }: { eventId: string }) {
  const componentRef = useRef<AblaufplanClientType | null>(null)
  const [componentReady, setComponentReady] = useState(false)
  const [props, setProps] = useState<{
    initialEntries: unknown[]
    members: unknown[]
    vendors: unknown[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('@/app/veranstalter/[eventId]/ablaufplan/AblaufplanClient').then(m => {
      componentRef.current = m.default as AblaufplanClientType
      setComponentReady(true)
    })

    const supabase = createClient()
    Promise.all([
      supabase
        .from('timeline_entries')
        .select('*')
        .eq('event_id', eventId)
        .order('start_minutes', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true }),
      supabase
        .from('event_members')
        .select('id, user_id, role, profiles!user_id(id, name)')
        .eq('event_id', eventId),
      supabase.from('vendors').select('id, name, category').eq('event_id', eventId).order('name'),
    ]).then(([entriesRes, membersRes, vendorsRes]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const members = (membersRes.data ?? []).map((m: any) => ({
        ...m,
        profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
      }))

      setProps({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialEntries: (entriesRes.data ?? []).map((e: any) => ({
          ...e,
          assigned_staff: e.assigned_staff ?? [],
          assigned_vendors: e.assigned_vendors ?? [],
          assigned_members: e.assigned_members ?? [],
        })),
        members,
        vendors: vendorsRes.data ?? [],
      })
      setLoading(false)
    })
  }, [eventId])

  const AblaufplanClientComponent = componentRef.current

  if (loading || !componentReady || !AblaufplanClientComponent || !props) {
    return <div style={{ padding: '36px 40px', color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
  }

  return (
    <AblaufplanClientComponent
      eventId={eventId}
      initialEntries={props.initialEntries}
      members={props.members}
      staff={[]}
      vendors={props.vendors}
    />
  )
}

export default function AblaufplanTabContent({ eventId, mode, tabAccess }: TabContentProps) {
  if (mode === 'veranstalter' || tabAccess === 'write') {
    return <AblaufplanClientWrapper eventId={eventId} />
  }
  return <TimelineTab eventId={eventId} />
}
