'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type EventSummary = {
  id: string
  title: string
  date: string | null
  venue: string | null
}

type WizardData = {
  title: string
  date: string
  ceremonyStart: string
  venue: string
  venueAddress: string
  dresscode: string
  childrenAllowed: boolean
  childrenNote: string
  maxBegleitpersonen: number
  mealOptions: string[]
}

const DEFAULT_WIZARD: WizardData = {
  title: '', date: '', ceremonyStart: '', venue: '',
  venueAddress: '', dresscode: '',
  childrenAllowed: true, childrenNote: '',
  maxBegleitpersonen: 2,
  mealOptions: ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
}

const ALL_MEALS = ['fleisch', 'fisch', 'vegetarisch', 'vegan']

function fmtDate(iso: string | null): string {
  if (!iso) return 'Kein Datum'
  try { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return iso }
}

export default function VeranstalterEventsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardData, setWizardData] = useState<WizardData>(DEFAULT_WIZARD)
  const [wizardError, setWizardError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', fontSize: 14,
    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    background: '#fff', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: 'var(--text)',
  }

  useEffect(() => {
    loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadEvents() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data, error } = await supabase
        .from('event_members')
        .select('event_id, events(id, title, date, venue)')
        .eq('user_id', user.id)
        .eq('role', 'veranstalter')

      if (error) throw error

      type RawRow = {
        event_id: string
        events: { id: string; title: string; date: string | null; venue: string | null } | null
      }
      const list: EventSummary[] = ((data ?? []) as unknown as RawRow[]).map(row => ({
        id: row.events?.id ?? row.event_id,
        title: row.events?.title ?? '—',
        date: row.events?.date ?? null,
        venue: row.events?.venue ?? null,
      }))
      setEvents(list)
    } catch (err) {
      console.error('[VeranstalterEvents] load failed:', err)
    } finally {
      setLoading(false)
    }
  }

  function openWizard() {
    setWizardData(DEFAULT_WIZARD)
    setWizardStep(1)
    setWizardError('')
    setShowWizard(true)
  }

  function closeWizard() {
    setShowWizard(false)
    setWizardError('')
  }

  function updateWizard(patch: Partial<WizardData>) {
    setWizardData(prev => ({ ...prev, ...patch }))
  }

  function validateStep(): string | null {
    if (wizardStep === 1) {
      if (!wizardData.title.trim()) return 'Eventname ist erforderlich.'
      if (!wizardData.date) return 'Datum ist erforderlich.'
    }
    if (wizardStep === 3) {
      if (wizardData.mealOptions.length === 0) return 'Mindestens eine Menüoption muss ausgewählt sein.'
    }
    return null
  }

  function handleNext() {
    const err = validateStep()
    if (err) { setWizardError(err); return }
    setWizardError('')
    setWizardStep(s => s + 1)
  }

  function handleBack() {
    setWizardError('')
    setWizardStep(s => s - 1)
  }

  async function handleSubmit() {
    const err = validateStep()
    if (err) { setWizardError(err); return }
    setSubmitting(true); setWizardError('')
    try {
      const { data, error } = await supabase.rpc('create_event_with_organizer', {
        p_title:               wizardData.title.trim(),
        p_date:                wizardData.date,
        p_venue:               wizardData.venue.trim() || null,
        p_venue_address:       wizardData.venueAddress.trim() || null,
        p_dresscode:           wizardData.dresscode.trim() || null,
        p_children_allowed:    wizardData.childrenAllowed,
        p_children_note:       wizardData.childrenNote.trim() || null,
        p_meal_options:        wizardData.mealOptions,
        p_max_begleitpersonen: wizardData.maxBegleitpersonen,
        p_ceremony_start:      wizardData.ceremonyStart
          ? `${wizardData.date}T${wizardData.ceremonyStart}:00`
          : null,
      })
      if (error) throw error
      const newId = data as string
      const newEvent: EventSummary = {
        id: newId, title: wizardData.title.trim(),
        date: wizardData.date, venue: wizardData.venue.trim() || null,
      }
      setEvents(prev => [newEvent, ...prev])
      closeWizard()
      router.push(`/veranstalter/dashboard?event=${newId}`)
    } catch (err: unknown) {
      setWizardError(err instanceof Error ? err.message : 'Event konnte nicht erstellt werden.')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleMeal(meal: string) {
    setWizardData(prev => ({
      ...prev,
      mealOptions: prev.mealOptions.includes(meal)
        ? prev.mealOptions.filter(m => m !== meal)
        : [...prev.mealOptions, meal],
    }))
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 16px 64px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--heading-font)', fontSize: 26, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>
            Meine Events
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
            Verwalte deine Hochzeits-Events oder erstelle ein neues.
          </p>
        </div>
        {!showWizard && (
          <button
            onClick={openWizard}
            style={{
              flexShrink: 0,
              background: 'var(--gold)', color: '#fff', border: 'none',
              borderRadius: 'var(--r-sm)', padding: '10px 18px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            + Neues Event
          </button>
        )}
      </div>

      {/* Wizard */}
      {showWizard && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--gold)',
          borderRadius: 'var(--r-md)', padding: 28, marginBottom: 28,
        }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: s <= wizardStep ? 'var(--gold)' : 'var(--border)',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 16 }}>
            Schritt {wizardStep} von 4
          </p>

          {/* Step 1 */}
          {wizardStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Event-Grunddaten</h2>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
                  Eventname <span style={{ color: 'var(--gold)' }}>*</span>
                </label>
                <input
                  required value={wizardData.title}
                  onChange={e => updateWizard({ title: e.target.value })}
                  placeholder="Hochzeit Max & Anna"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
                  Datum <span style={{ color: 'var(--gold)' }}>*</span>
                </label>
                <input
                  type="date" required value={wizardData.date}
                  onChange={e => updateWizard({ date: e.target.value })}
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Uhrzeit Zeremonie (optional)</label>
                <input
                  type="time" value={wizardData.ceremonyStart}
                  onChange={e => updateWizard({ ceremonyStart: e.target.value })}
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Location (optional)</label>
                <input
                  value={wizardData.venue}
                  onChange={e => updateWizard({ venue: e.target.value })}
                  placeholder="Schloss Lichtenberg"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
            </div>
          )}

          {/* Step 2 */}
          {wizardStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Details</h2>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Adresse (optional)</label>
                <input
                  value={wizardData.venueAddress}
                  onChange={e => updateWizard({ venueAddress: e.target.value })}
                  placeholder="Musterstraße 1, 12345 Musterstadt"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Dresscode (optional)</label>
                <input
                  value={wizardData.dresscode}
                  onChange={e => updateWizard({ dresscode: e.target.value })}
                  placeholder="Festlich, Cocktailkleid etc."
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 10 }}>Kinder willkommen?</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[true, false].map(val => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => updateWizard({ childrenAllowed: val })}
                      style={{
                        padding: '9px 18px', borderRadius: 'var(--r-sm)',
                        border: `1.5px solid ${wizardData.childrenAllowed === val ? 'var(--gold)' : 'var(--border)'}`,
                        background: wizardData.childrenAllowed === val ? 'var(--gold-pale)' : 'none',
                        color: wizardData.childrenAllowed === val ? 'var(--gold)' : 'var(--text-dim)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.15s',
                      }}
                    >
                      {val ? 'Ja' : 'Nein'}
                    </button>
                  ))}
                </div>
                {wizardData.childrenAllowed && (
                  <input
                    value={wizardData.childrenNote}
                    onChange={e => updateWizard({ childrenNote: e.target.value })}
                    placeholder="Hinweis zu Kindern (optional)"
                    style={{ ...inputStyle, marginTop: 10 }}
                    onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                  />
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Max. Begleitpersonen pro Gast</label>
                <input
                  type="number" min={0} max={10}
                  value={wizardData.maxBegleitpersonen}
                  onChange={e => updateWizard({ maxBegleitpersonen: Math.max(0, parseInt(e.target.value) || 0) })}
                  style={{ ...inputStyle, maxWidth: 100 }}
                  onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
            </div>
          )}

          {/* Step 3 */}
          {wizardStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Menüoptionen</h2>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>Welche Menüoptionen stehen zur Wahl?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {ALL_MEALS.map(meal => {
                  const active = wizardData.mealOptions.includes(meal)
                  return (
                    <button
                      key={meal}
                      type="button"
                      onClick={() => toggleMeal(meal)}
                      style={{
                        padding: '9px 18px', borderRadius: 100,
                        border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                        background: active ? 'var(--gold-pale)' : 'none',
                        color: active ? 'var(--gold)' : 'var(--text-dim)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        textTransform: 'capitalize', transition: 'all 0.15s',
                      }}
                    >
                      {meal}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 4 — Summary */}
          {wizardStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Zusammenfassung</h2>
              {[
                ['Eventname', wizardData.title],
                ['Datum', fmtDate(wizardData.date)],
                ['Uhrzeit', wizardData.ceremonyStart || '—'],
                ['Location', wizardData.venue || '—'],
                ['Adresse', wizardData.venueAddress || '—'],
                ['Dresscode', wizardData.dresscode || '—'],
                ['Kinder', wizardData.childrenAllowed ? `Ja${wizardData.childrenNote ? ` — ${wizardData.childrenNote}` : ''}` : 'Nein'],
                ['Max. Begleitpersonen', String(wizardData.maxBegleitpersonen)],
                ['Menüoptionen', wizardData.mealOptions.join(', ') || '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 12, fontSize: 14 }}>
                  <span style={{ minWidth: 160, color: 'var(--text-dim)', flexShrink: 0 }}>{label}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Wizard error */}
          {wizardError && (
            <p style={{ fontSize: 13, color: 'var(--red)', background: 'rgba(160,64,64,0.08)', padding: '10px 14px', borderRadius: 8, marginTop: 16 }}>
              {wizardError}
            </p>
          )}

          {/* Wizard nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 12 }}>
            <button
              type="button"
              onClick={wizardStep === 1 ? closeWizard : handleBack}
              style={{
                padding: '11px 20px', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)', background: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text-dim)',
              }}
            >
              {wizardStep === 1 ? 'Abbrechen' : '← Zurück'}
            </button>
            {wizardStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  padding: '11px 24px', borderRadius: 'var(--r-sm)',
                  border: 'none', background: 'var(--text)', color: '#fff',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                }}
              >
                Weiter →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: '11px 24px', borderRadius: 'var(--r-sm)',
                  border: 'none', background: 'var(--gold)', color: '#fff',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? 'Wird erstellt …' : 'Event erstellen'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Event list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2].map(i => (
            <div key={i} style={{
              height: 80, borderRadius: 'var(--r-md)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </div>
      ) : events.length === 0 && !showWizard ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          border: '2px dashed var(--border)', borderRadius: 'var(--r-md)',
          background: 'var(--surface)',
        }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>💍</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Noch kein Event angelegt</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 20 }}>
            Erstelle dein erstes Event und starte mit der Planung.
          </p>
          <button
            onClick={openWizard}
            style={{
              background: 'var(--gold)', color: '#fff', border: 'none',
              borderRadius: 'var(--r-sm)', padding: '12px 24px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Erstes Event erstellen
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map(ev => (
            <div
              key={ev.id}
              style={{
                border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                background: 'var(--surface)', padding: '16px 18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 3px' }}>{ev.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>{fmtDate(ev.date)}</p>
                  {ev.venue && <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>{ev.venue}</p>}
                </div>
                <button
                  onClick={() => router.push(`/veranstalter/dashboard?event=${ev.id}`)}
                  style={{
                    flexShrink: 0, padding: '8px 16px',
                    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                    background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 13, color: 'var(--text)', transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}
                >
                  Verwalten
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
