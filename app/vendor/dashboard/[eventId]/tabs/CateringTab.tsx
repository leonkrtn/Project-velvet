'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CateringPlan {
  service_style: string; location_has_kitchen: boolean; midnight_snack: boolean
  midnight_snack_note: string; drinks_billing: string; drinks_selection: string[]
  champagne_finger_food: boolean; champagne_finger_food_note: string
  service_staff: boolean; equipment_needed: string[]; budget_per_person: number
  budget_includes_drinks: boolean; catering_notes: string
}

interface Guest { id: string; name: string; meal_choice: string | null; allergy_tags: string[]; allergy_custom: string | null }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 14 }}>{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export default function CateringTab({ eventId }: { eventId: string }) {
  const [plan, setPlan]     = useState<CateringPlan | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('catering_plans').select('*').eq('event_id', eventId).single(),
      supabase.from('guests').select('id, name, meal_choice, allergy_tags, allergy_custom').eq('event_id', eventId).eq('status', 'zugesagt').order('name'),
    ]).then(([{ data: p }, { data: g }]) => {
      setPlan(p ?? null); setGuests(g ?? []); setLoading(false)
    })
  }, [eventId])

  const mealCounts = guests.reduce<Record<string, number>>((acc, g) => {
    const k = g.meal_choice ?? 'Keine Angabe'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})

  const withAllergies = guests.filter(g => g.allergy_tags?.length || g.allergy_custom)

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 24 }}>Catering</h1>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
      ) : (
        <div style={{ maxWidth: 700 }}>
          {plan && (
            <>
              <Section title="Service">
                <Row label="Servicestil"         value={plan.service_style || '—'} />
                <Row label="Küche vor Ort"        value={plan.location_has_kitchen ? 'Ja' : 'Nein'} />
                <Row label="Mitternachtssnack"    value={plan.midnight_snack ? (plan.midnight_snack_note || 'Ja') : 'Nein'} />
                <Row label="Servicepersonal"      value={plan.service_staff ? 'Ja' : 'Nein'} />
                <Row label="Champagner-Empfang"   value={plan.champagne_finger_food ? (plan.champagne_finger_food_note || 'Ja') : 'Nein'} />
              </Section>

              <Section title="Getränke">
                <Row label="Abrechnung"   value={plan.drinks_billing || '—'} />
                <Row label="Auswahl"      value={(plan.drinks_selection ?? []).join(', ') || '—'} />
              </Section>

              {plan.equipment_needed?.length > 0 && (
                <Section title="Benötigte Ausstattung">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {plan.equipment_needed.map(e => (
                      <span key={e} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, background: '#F0F0F2', color: 'var(--text-secondary)' }}>{e}</span>
                    ))}
                  </div>
                </Section>
              )}

              {plan.catering_notes && (
                <Section title="Hinweise">
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{plan.catering_notes}</p>
                </Section>
              )}
            </>
          )}

          {/* Menü-Übersicht */}
          <Section title={`Menüwahl (${guests.length} zugesagte Gäste)`}>
            {Object.entries(mealCounts).length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Noch keine Angaben</p>
            ) : Object.entries(mealCounts).map(([meal, count]) => (
              <Row key={meal} label={meal} value={`${count}×`} />
            ))}
          </Section>

          {/* Allergieliste */}
          {withAllergies.length > 0 && (
            <Section title={`Allergien & Unverträglichkeiten (${withAllergies.length} Gäste)`}>
              {withAllergies.map(g => (
                <div key={g.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ fontWeight: 500, marginRight: 10 }}>{g.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {[...(g.allergy_tags ?? []), g.allergy_custom].filter(Boolean).join(', ')}
                  </span>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
