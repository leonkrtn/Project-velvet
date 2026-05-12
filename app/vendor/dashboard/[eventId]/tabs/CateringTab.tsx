'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, Plus, X, TrendingUp } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface OrganizerCost {
  id: string
  category: string
  amount: number
  notes: string | null
}

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
  menu_courses: { id: string; name: string; descriptions: Record<string, string> }[]
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

const CATERING_COST_CATEGORIES = [
  'Menü / Speisen',
  'Getränkepauschale',
  'Servicepersonal',
  'Equipment-Miete',
  'Mitternachtssnack',
  'Sektempfang',
]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px',
  background: '#fff', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
}

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

type Access = 'none' | 'read' | 'write'

function vis(sectionPerms: Record<string, Access> | undefined, tabAccess: Access, key: string): boolean {
  return (sectionPerms?.[key] ?? tabAccess) !== 'none'
}

export default function CateringTab({ eventId, tabAccess = 'read', sectionPerms }: { eventId: string; tabAccess?: Access; sectionPerms?: Record<string, Access> }) {
  const [plan, setPlan]             = useState<CateringPlan | null>(null)
  const [event, setEvent]           = useState<EventInfo | null>(null)
  const [guests, setGuests]         = useState<Guest[]>([])
  const [costs, setCosts]           = useState<OrganizerCost[]>([])
  const [costAmounts, setCostAmounts] = useState<Record<string, string>>({})
  const [customCostLabel, setCustomCostLabel] = useState('')
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('catering_plans').select('*').eq('event_id', eventId).single(),
      supabase.from('events').select('menu_type, meal_options, children_allowed').eq('id', eventId).single(),
      supabase.from('guests').select('id, name, meal_choice, allergy_tags, allergy_custom')
        .eq('event_id', eventId).eq('status', 'zugesagt').order('name'),
      supabase.from('event_organizer_costs').select('id, category, amount, notes')
        .eq('event_id', eventId).eq('source', 'catering').order('created_at', { ascending: true }),
    ]).then(([{ data: p }, { data: e }, { data: g }, { data: c }]) => {
      setPlan(p ?? null)
      setEvent(e ?? null)
      setGuests(g ?? [])
      const loadedCosts = c ?? []
      setCosts(loadedCosts)
      setCostAmounts(Object.fromEntries(loadedCosts.map(x => [x.id, String(x.amount)])))
      setLoading(false)
    })
  }, [eventId])

  async function addCost(category: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('event_organizer_costs')
      .insert({ event_id: eventId, category, amount: 0, source: 'catering' })
      .select('id, category, amount, notes')
      .single()
    if (error || !data) return
    setCosts(prev => [...prev, data])
    setCostAmounts(prev => ({ ...prev, [data.id]: '0' }))
  }

  async function removeCost(id: string) {
    const supabase = createClient()
    await supabase.from('event_organizer_costs').delete().eq('id', id)
    setCosts(prev => prev.filter(c => c.id !== id))
    setCostAmounts(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  async function saveCostAmount(id: string) {
    const amount = parseFloat(costAmounts[id] ?? '0') || 0
    const supabase = createClient()
    await supabase.from('event_organizer_costs').update({ amount }).eq('id', id)
    setCosts(prev => prev.map(c => c.id === id ? { ...c, amount } : c))
  }

  async function addCustomCost() {
    const lbl = customCostLabel.trim()
    if (!lbl) return
    setCustomCostLabel('')
    await addCost(lbl)
  }

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
        {vis(sectionPerms, tabAccess, 'konzept') && event && (
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

        {/* ── Menügänge / Positionen ── */}
        {vis(sectionPerms, tabAccess, 'menuplaene') && (plan?.menu_courses ?? []).length > 0 && (event?.meal_options ?? []).length > 0 && (() => {
          const isMultiCourse = event?.menu_type === 'Mehrgängiges Menü'
          const title = isMultiCourse ? 'Menügänge je Essensoption' : 'Menüpositionen je Essensoption'
          const mealOpts = event!.meal_options!
          return (
            <Section title={title}>
              {plan!.menu_courses.map((c, i) => {
                const dishes = mealOpts.map(opt => ({ opt, dish: c.descriptions?.[opt] ?? '' })).filter(d => d.dish)
                return (
                  <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: dishes.length ? 6 : 0 }}>
                      <span style={{ color: 'var(--text-tertiary)', marginRight: 8 }}>{i + 1}.</span>
                      {c.name}
                    </div>
                    {dishes.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 24 }}>
                        {dishes.map(({ opt, dish }) => (
                          <div key={opt} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                              background: 'var(--accent-light)', borderRadius: 10,
                              padding: '1px 8px', whiteSpace: 'nowrap', alignSelf: 'center',
                            }}>{opt}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{dish}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </Section>
          )
        })()}

        {/* ── Service & Ablauf ── */}
        {vis(sectionPerms, tabAccess, 'service') && plan && (
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
        {vis(sectionPerms, tabAccess, 'getraenke') && plan && (
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
        {vis(sectionPerms, tabAccess, 'equipment') && (plan?.equipment_needed ?? []).length > 0 && (
          <Section title="Benötigtes Equipment">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {plan!.equipment_needed.map(e => (
                <Chip key={e} label={EQUIPMENT_LABELS[e] ?? e} />
              ))}
            </div>
          </Section>
        )}

        {/* ── Catering-Kosten ── */}
        {vis(sectionPerms, tabAccess, 'budget') && (() => {
          const totalCosts = costs.reduce((s, c) => s + (c.amount ?? 0), 0)
          const canWrite = tabAccess === 'write'
          return (
            <Section title="Catering-Kosten">
              {costs.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {costs.map(cost => {
                    const perPerson = effectiveCount > 0 && cost.amount > 0
                      ? ` (${(cost.amount / effectiveCount).toLocaleString('de-DE', { maximumFractionDigits: 2 })} €/P)`
                      : ''
                    return (
                      <div key={cost.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', marginBottom: 8,
                        background: '#F5F5F7', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{cost.category}</span>
                          {perPerson && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>{perPerson}</span>}
                        </div>
                        {canWrite ? (
                          <>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <span style={{ position: 'absolute', left: 9, fontSize: 13, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>€</span>
                              <input type="number" min={0} step="0.01"
                                value={costAmounts[cost.id] ?? '0'}
                                onChange={e => setCostAmounts(prev => ({ ...prev, [cost.id]: e.target.value }))}
                                onBlur={() => saveCostAmount(cost.id)}
                                style={{ ...inputStyle, width: 120, paddingLeft: 24 }} />
                            </div>
                            <button type="button" onClick={() => removeCost(cost.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: 14, fontWeight: 600 }}>
                            {cost.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {costs.length > 0 && (
                <div style={{ background: '#F5F5F7', borderRadius: 'var(--radius-sm)', padding: '9px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Basis: {effectiveCount} {plan?.plan_guest_count_enabled ? 'Planzahl-Gäste' : 'bestätigte Zusagen'}
                  </span>
                </div>
              )}

              {canWrite && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                      Kategorie hinzufügen
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {CATERING_COST_CATEGORIES.map(cat => (
                        <button key={cat} type="button" onClick={() => addCost(cat)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 20, padding: '5px 11px', fontSize: 12,
                            color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          <Plus size={11} /> {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...inputStyle, flex: 1 }} value={customCostLabel}
                      onChange={e => setCustomCostLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCustomCost()}
                      placeholder="Eigener Kostenpunkt…" />
                    <button type="button" onClick={addCustomCost}
                      style={{ padding: '8px 13px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                      <Plus size={13} /> Hinzufügen
                    </button>
                  </div>
                </>
              )}

              {costs.length === 0 && !canWrite && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Noch keine Kosten hinterlegt.</p>
              )}

              {costs.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>Summe</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>
                    {totalCosts.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>
              )}
            </Section>
          )
        })()}

        {/* ── Menüwahl + Allergien (statistik) ── */}
        {vis(sectionPerms, tabAccess, 'statistik') && (
          <>
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
          </>
        )}

        {/* ── Hinweise (part of konzept) ── */}
        {vis(sectionPerms, tabAccess, 'konzept') && plan?.catering_notes && (
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
