'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AllgemeinForm from '@/app/veranstalter/[eventId]/allgemein/AllgemeinForm'

interface TabContentProps {
  eventId: string
  mode: 'veranstalter' | 'dienstleister' | 'brautpaar'
  tabAccess?: 'read' | 'write'
  itemPermissions?: Record<string, 'none' | 'read' | 'write'>
}

interface EventSummary {
  title: string | null
  couple_name: string | null
  date: string | null
  ceremony_start: string | null
  description: string | null
  dresscode: string | null
  venue: string | null
  location_name: string | null
  location_street: string | null
  location_zip: string | null
  location_city: string | null
  location_website: string | null
  max_begleitpersonen: number | null
  children_allowed: boolean | null
  children_note: string | null
}

function Field({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  const display = typeof value === 'boolean' ? (value ? 'Ja' : 'Nein') : String(value)
  return (
    <div style={{ marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 3 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{display}</span>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && <div style={{ padding: '0 20px 20px' }}>{children}</div>}
    </div>
  )
}

type Access = 'none' | 'read' | 'write'

function secVis(sectionPerms: Record<string, Access> | undefined, tabAccess: Access, key: string): boolean {
  return (sectionPerms?.[key] ?? tabAccess) !== 'none'
}

function ReadOnlyView({ eventId, tabAccess = 'read', sectionPerms }: { eventId: string; tabAccess?: Access; sectionPerms?: Record<string, Access> }) {
  const [data, setData] = useState<EventSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('events')
      .select('title, couple_name, date, ceremony_start, description, dresscode, venue, location_name, location_street, location_zip, location_city, location_website, max_begleitpersonen, children_allowed, children_note')
      .eq('id', eventId)
      .single()
      .then(({ data: row }) => {
        setData(row as EventSummary | null)
        setLoading(false)
      })
  }, [eventId])

  if (loading) return <div style={{ padding: '36px 40px', color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
  if (!data) return <div style={{ padding: '36px 40px', color: 'var(--text-secondary)', fontSize: 14 }}>Keine Daten verfügbar.</div>

  const locationParts = [data.location_street, `${data.location_zip ?? ''} ${data.location_city ?? ''}`.trim()].filter(Boolean).join(', ')

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 24 }}>Allgemein</h1>
      <div style={{ maxWidth: 680 }}>
        {secVis(sectionPerms, tabAccess, 'eventdetails') && (
          <Card title="Event-Details">
            <Field label="Titel" value={data.title} />
            <Field label="Brautpaar" value={data.couple_name} />
            <Field label="Datum" value={data.date} />
            <Field label="Zeremonie-Beginn" value={data.ceremony_start} />
            <Field label="Beschreibung" value={data.description} />
            <Field label="Dresscode" value={data.dresscode} />
          </Card>
        )}

        {secVis(sectionPerms, tabAccess, 'location') && (
          <Card title="Location">
            <Field label="Location-Name" value={data.location_name} />
            <Field label="Venue" value={data.venue} />
            <Field label="Adresse" value={locationParts} />
            {data.location_website && (
              <div style={{ marginBottom: 12 }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 3 }}>Website</span>
                <a href={data.location_website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none' }}>{data.location_website}</a>
              </div>
            )}
          </Card>
        )}

        {secVis(sectionPerms, tabAccess, 'gaeste') && (
          <Card title="Gäste">
            <Field label="Max. Begleitpersonen" value={data.max_begleitpersonen} />
            <Field label="Kinder erlaubt" value={data.children_allowed} />
            <Field label="Kinder-Hinweis" value={data.children_note} />
          </Card>
        )}
      </div>
    </div>
  )
}

// AllgemeinForm requires initialData, bpMembers, initialCosts, cateringCosts — all fetched server-side.
// For write access from dienstleister context, we render the same form via a data-fetching wrapper.
function AllgemeinFormWrapper({ eventId }: { eventId: string }) {
  const [loaded, setLoaded] = useState(false)
  const [formProps, setFormProps] = useState<{
    initialData: Record<string, unknown>
    bpMembers: unknown[]
    initialCosts: unknown[]
    cateringCosts: unknown[]
    initialToggles: Record<string, boolean>
    initialGalleryUnlockAt: string | null
  } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('events').select('id, title, couple_name, date, ceremony_start, description, venue, venue_address, location_name, location_street, location_zip, location_city, location_website, max_begleitpersonen, children_allowed, children_note, meal_options, menu_type, collect_allergies, budget_total, organizer_fee, organizer_fee_type, internal_notes, dresscode, projektphase').eq('id', eventId).single(),
      supabase.from('event_members').select('id, user_id, profiles!user_id(id, name, email)').eq('event_id', eventId).eq('role', 'brautpaar'),
      supabase.from('event_organizer_costs').select('id, category, amount, notes').eq('event_id', eventId).neq('source', 'catering').order('created_at', { ascending: true }),
      supabase.from('event_organizer_costs').select('id, category, amount, notes').eq('event_id', eventId).eq('source', 'catering').order('created_at', { ascending: true }),
      supabase.from('feature_toggles').select('key, enabled, value').eq('event_id', eventId),
    ]).then(([eventRes, membersRes, costsRes, cateringCostsRes, togglesRes]) => {
      if (!eventRes.data) return
      const initialToggles: Record<string, boolean> = {
        'gaeste-fotos': true, 'messaging': false,
        'bp-gaeste': true, 'bp-sitzplan': true, 'bp-ablaufplan': true,
        'bp-catering': true, 'bp-dekoration': true, 'bp-musik': true,
        'bp-patisserie': true, 'bp-medien': true, 'bp-budget': true,
        'bp-aufgaben': true, 'bp-nachrichten': true, 'bp-dateien': true,
        'rsvp-musikwunsch': true, 'rsvp-geschenke': true, 'rsvp-hotel': true,
        'rsvp-begleitpersonen': true, 'rsvp-menu': true,
      }
      let initialGalleryUnlockAt: string | null = null
      for (const row of togglesRes.data ?? []) {
        if (row.key === 'gaeste-fotos-unlock-at') {
          initialGalleryUnlockAt = (row as any).value ?? null
        } else {
          initialToggles[row.key] = row.enabled
        }
      }
      setFormProps({
        initialData: eventRes.data as Record<string, unknown>,
        bpMembers: membersRes.data ?? [],
        initialCosts: costsRes.data ?? [],
        cateringCosts: cateringCostsRes.data ?? [],
        initialToggles,
        initialGalleryUnlockAt,
      })
      setLoaded(true)
    })
  }, [eventId])

  if (!loaded || !formProps) return <div style={{ padding: '36px 40px', color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>

  return (
    <AllgemeinForm
      eventId={eventId}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialData={formProps.initialData as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bpMembers={formProps.bpMembers as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialCosts={formProps.initialCosts as any}
      initialToggles={formProps.initialToggles}
      initialGalleryUnlockAt={formProps.initialGalleryUnlockAt}
    />
  )
}

export default function AllgemeinTabContent({ eventId, mode, tabAccess, itemPermissions }: TabContentProps) {
  if (mode === 'veranstalter' || tabAccess === 'write') {
    return <AllgemeinFormWrapper eventId={eventId} />
  }
  return <ReadOnlyView eventId={eventId} tabAccess={tabAccess} sectionPerms={itemPermissions} />
}
