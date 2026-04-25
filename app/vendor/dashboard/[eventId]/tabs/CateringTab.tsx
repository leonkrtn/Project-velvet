'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface CateringPlan {
  service_style: string
  location_has_kitchen: boolean
  midnight_snack: boolean
  midnight_snack_note: string
  drinks_billing: string
  drinks_selection: string[]
  champagne_finger_food: boolean
  champagne_finger_food_note: string
  service_staff: boolean
  equipment_needed: string[]
  budget_per_person: number
  budget_includes_drinks: boolean
  catering_notes: string
  sektempfang: boolean
  sektempfang_note: string
  weinbegleitung: boolean
  weinbegleitung_note: string
  kinder_meal_options: string[]
  menu_courses: { id: string; name: string; description: string }[]
  plan_guest_count_enabled: boolean
  plan_guest_count: number
}

interface EventInfo {
  menu_type: string | null
  meal_options: string[] | null
  children_allowed: boolean
}

interface Guest {
  id: string
  name: string
  meal_choice: string | null
  allergy_tags: string[]
  allergy_custom: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  klassisch: 'Klassisches Menü', buffet: 'Buffet',
  family: 'Family Style', foodtruck: 'Food Trucks', live: 'Live-Cooking',
}

const DRINKS_LABELS: Record<string, string> = {
  wein: 'Wein', bier: 'Bier', softdrinks: 'Softdrinks',
  cocktails: 'Cocktailbar', longdrinks: 'Longdrinks', alkoholfrei: 'Alkoholfrei-Sortiment',
}

const EQUIPMENT_LABELS: Record<string, string> = {
  geschirr: 'Geschirr & Besteck', glaeser: 'Gläser',
  tischdecken: 'Tischdecken & Servietten', buffettische: 'Buffet-Tische', deko: 'Dekoration',
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius)',
      border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 16,
    }}>
      <p style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 14,
      }}>{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 12, justifyContent: 'space-between',
      padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
    }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

function Chip({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span style={{
      fontSize: 12, padding: '4px 10px', borderRadius: 20,
      background: accent ? 'var(--accent-light, #EEF2FF)' : '#F0F0F2',
      color: accent ? 'var(--accent, #4F46E5)' : 'var(--text-secondary)',
      border: '1px solid',
      borderColor: accent ? 'rgba(79,70,229,0.2)' : 'var(--border)',
    }}>{label}</span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CateringTab({ eventId }: { eventId: string }) {
  const [plan, setPlan]       = useState<CateringPlan | null>(null)
  const [event, setEvent]     = useState<EventInfo | null>(null)
  const [guests, setGuests]   = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('catering_plans').select('*').eq('event_id', eventId).single(),
      supabase.from('events').select('menu_type, meal_options, children_allowed').eq('id', eventId).single(),
      supabase.from('guests').select('id, name, meal_choice, allergy_tags, allergy_custom')
        .eq('event_id', eventId).eq('attending', 'ja').order('name'),
    ]).then(([{ data: p }, { data: e }, { data: g }]) => {
      setPlan(p ?? null)
      setEvent(e ?? null)
      setGuests(g ?? [])
      setLoading(false)
    })
  }, [eventId])

  const mealCounts = guests.reduce<Record<string, number>>((acc, g) => {
    const k = g.meal_choice ?? 'Keine Angabe'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})

  const withAllergies  = guests.filter(g => g.allergy_tags?.length || g.allergy_custom)
  const allergyCounts  = guests.flatMap(g => g.allergy_tags ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t] = (acc[t] ?? 0) + 1; return acc
  }, {})

  const effectiveCount = plan?.plan_guest_count_enabled && plan.plan_guest_count > 0
    ? plan.plan_guest_count
    : guests.length

  if (loading) return <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 24 }}>Catering</h1>

      <div style={{ maxWidth: 700 }}>

        {/* ── Menükonzept ── */}
        {event && (
          <Section title="Menükonzept">
            {event.menu_type && <Row label="Menü-Art" value={event.menu_type} />}
            {(event.meal_options ?? []).length > 0 && (
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Essensoptionen</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(event.meal_options ?? []).map(o => <Chip key={o} label={o} accent />)}
                </div>
              </div>
            )}
            {event.children_allowed && (plan?.kinder_meal_options ?? []).length > 0 && (
              <div style={{ padding: '8px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Kindermenü</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {plan!.kinder_meal_options.map(o => <Chip key={o} label={o} />)}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── Menügänge ── */}
        {event?.menu_type === 'Mehrgängiges Menü' && (plan?.menu_courses ?? []).length > 0 && (
          <Section title="Menügänge">
            {plan!.menu_courses.map((c, i) => (
              <div key={c.id} style={{
                display: 'flex', gap: 12, alignItems: 'baseline',
                padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
              }}>
                <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', minWidth: 18 }}>{i + 1}.</span>
                <span style={{ fontWeight: 500 }}>{c.name}</span>
                {c.description && (
                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{c.description}</span>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* ── Service & Ablauf ── */}
        {plan && (
          <Section title="Service & Ablauf">
            {plan.service_style && (
              <Row label="Servicestil" value={SERVICE_LABELS[plan.service_style] ?? plan.service_style} />
            )}
            <Row label="Küche vor Ort"     value={plan.location_has_kitchen ? 'Ja' : 'Nein'} />
            <Row label="Servicepersonal"   value={plan.service_staff ? 'Ja' : 'Nein'} />
            <Row
              label="Sektempfang / Aperitif"
              value={plan.sektempfang ? (plan.sektempfang_note || 'Ja') : 'Nein'}
            />
            <Row
              label="Mitternachtssnack"
              value={plan.midnight_snack ? (plan.midnight_snack_note || 'Ja') : 'Nein'}
            />
          </Section>
        )}

        {/* ── Getränke ── */}
        {plan && (
          <Section title="Getränke">
            <Row
              label="Abrechnung"
              value={plan.drinks_billing === 'pauschale' ? 'Getränkepauschale' : 'Einzelabrechnung'}
            />
            {(plan.drinks_selection ?? []).length > 0 && (
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Sortiment</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {plan.drinks_selection.map(d => <Chip key={d} label={DRINKS_LABELS[d] ?? d} />)}
                </div>
              </div>
            )}
            {plan.champagne_finger_food && (
              <Row
                label="Häppchen zum Sektempfang"
                value={plan.champagne_finger_food_note || 'Ja'}
              />
            )}
            {plan.weinbegleitung && (
              <Row
                label="Weinbegleitung"
                value={plan.weinbegleitung_note || 'Ja'}
              />
            )}
          </Section>
        )}

        {/* ── Equipment ── */}
        {(plan?.equipment_needed ?? []).length > 0 && (
          <Section title="Benötigtes Equipment">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {plan!.equipment_needed.map(e => (
                <Chip key={e} label={EQUIPMENT_LABELS[e] ?? e} />
              ))}
            </div>
          </Section>
        )}

        {/* ── Budget ── */}
        {plan && plan.budget_per_person > 0 && (
          <Section title="Budget">
            <Row
              label="Budget pro Person"
              value={`${plan.budget_per_person.toLocaleString('de-DE')} €${plan.budget_includes_drinks ? ' inkl. Getränke' : ''}`}
            />
            <Row
              label={plan.plan_guest_count_enabled ? 'Kalkulationsbasis (Planzahl)' : 'Kalkulationsbasis (Zusagen)'}
              value={`${effectiveCount} Personen`}
            />
            <Row
              label="Kalkuliertes Gesamtbudget"
              value={`${(plan.budget_per_person * effectiveCount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}
            />
          </Section>
        )}

        {/* ── Menüwahl-Übersicht ── */}
        <Section title={`Menüwahl (${guests.length} bestätigte Gäste)`}>
          {Object.entries(mealCounts).length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Noch keine Angaben</p>
          ) : (
            <>
              {Object.entries(mealCounts).map(([meal, count]) => (
                <div key={meal} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{meal}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 80, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        background: 'var(--accent, #4F46E5)',
                        width: `${Math.round((count / guests.length) * 100)}%`,
                      }} />
                    </div>
                    <span style={{ fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{count}×</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 11, minWidth: 36 }}>
                      {Math.round((count / guests.length) * 100)} %
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </Section>

        {/* ── Allergien-Übersicht ── */}
        {Object.keys(allergyCounts).length > 0 && (
          <Section title={`Allergien & Unverträglichkeiten (${withAllergies.length} Gäste)`}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {Object.entries(allergyCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([tag, n]) => (
                  <span key={tag} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.2)',
                    borderRadius: 20, padding: '4px 10px', fontSize: 12, color: '#DC2626',
                  }}>
                    <AlertTriangle size={11} />
                    {tag} · {n}×
                  </span>
                ))}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                Gästeliste
              </p>
              {withAllergies.map(g => (
                <div key={g.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ fontWeight: 500, marginRight: 10 }}>{g.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {[...(g.allergy_tags ?? []), g.allergy_custom].filter(Boolean).join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Hinweise ── */}
        {plan?.catering_notes && (
          <Section title="Hinweise für den Caterer">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {plan.catering_notes}
            </p>
          </Section>
        )}

      </div>
    </div>
  )
}
