'use client'
import React, { useState, useEffect } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { getStats, CateringPlan, saveEvent } from '@/lib/store'
import type { OrganizerCateringSuggestion, OrganizerSuggestionStatus } from '@/lib/store'
import { useEvent } from '@/lib/event-context'
import { useFeatureEnabled, FeatureDisabledScreen } from '@/components/FeatureGate'

// ── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_CATERING: CateringPlan = {
  serviceStyle:            '',
  locationHasKitchen:      false,
  midnightSnack:           false,
  midnightSnackNote:       '',
  drinksBilling:           'pauschale',
  drinksSelection:         [],
  champagneFingerFood:     false,
  champagneFingerFoodNote: '',
  serviceStaff:            false,
  equipmentNeeded:         [],
  budgetPerPerson:         0,
  budgetIncludesDrinks:    false,
  cateringNotes:           '',
}

type LockedFields = Partial<Record<keyof CateringPlan, boolean>>

function formatDate(iso: string) {
  if (!iso) return '–'
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.12em', color: 'var(--text-dim)',
      marginBottom: 12, marginTop: 28,
    }}>{children}</p>
  )
}

// Lock indicator — shown next to section headings when that section has locked fields
function LockBadge({ locked }: { locked: boolean }) {
  if (!locked) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, color: 'var(--gold)', fontWeight: 600,
      background: 'var(--gold-pale)', borderRadius: 100,
      padding: '2px 8px', marginLeft: 8,
    }}>
      <Lock size={10} />
      Vom Veranstalter gesperrt
    </span>
  )
}

function Toggle({
  value, onChange, label, sublabel, locked,
}: { value: boolean; onChange: (v: boolean) => void; label: string; sublabel?: string; locked?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: '1px solid var(--border)',
      opacity: locked ? 0.6 : 1,
    }}>
      <div>
        <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{label}</p>
        {sublabel && <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{sublabel}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {locked && <Lock size={13} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
        <button
          onClick={() => !locked && onChange(!value)}
          disabled={locked}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none',
            background: value ? 'var(--gold)' : 'var(--border)',
            position: 'relative', cursor: locked ? 'not-allowed' : 'pointer', flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: value ? 23 : 3,
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--surface)', transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }} />
        </button>
      </div>
    </div>
  )
}

function CheckGroup({
  options, selected, onChange, locked,
}: { options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void; locked?: boolean }) {
  const toggle = (val: string) => {
    if (locked) return
    onChange(selected.includes(val) ? selected.filter(x => x !== val) : [...selected, val])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, opacity: locked ? 0.6 : 1 }}>
      {options.map(o => {
        const active = selected.includes(o.value)
        return (
          <button
            key={o.value}
            onClick={() => toggle(o.value)}
            disabled={locked}
            data-sel={active ? '' : undefined}
            style={{
              padding: '7px 14px', borderRadius: 20, border: '1px solid',
              borderColor: active ? 'var(--gold)' : 'var(--border)',
              background: active ? 'rgba(201,168,76,0.08)' : 'var(--surface)',
              color: active ? 'var(--gold)' : 'var(--text)',
              fontSize: 13, cursor: locked ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >{o.label}</button>
        )
      })}
    </div>
  )
}

// ── Catering Suggestions ───────────────────────────────────────────────────

function CateringSuggestions({ onAccept }: { onAccept: (s: OrganizerCateringSuggestion) => void }) {
  const { event, updateEvent } = useEvent()
  if (!event) return null
  const suggestions = event.organizer?.cateringSuggestions ?? []
  const pending = suggestions.filter(s => s.status === 'vorschlag')
  if (pending.length === 0) return null

  const STYLE_LABELS: Record<string, string> = {
    klassisch: 'Klassisches Menü', buffet: 'Buffet', family: 'Family Style', foodtruck: 'Food Truck', live: 'Live-Cooking',
  }

  const accept = (s: OrganizerCateringSuggestion) => {
    const updatedSuggestions = (event.organizer?.cateringSuggestions ?? []).map(c =>
      c.id === s.id ? { ...c, status: 'angenommen' as OrganizerSuggestionStatus } : c
    )
    const updated = {
      ...event,
      organizer: { ...event.organizer!, cateringSuggestions: updatedSuggestions },
    }
    updateEvent(updated); saveEvent(updated)
    onAccept(s)
  }

  const dismiss = (s: OrganizerCateringSuggestion) => {
    const updatedSuggestions = (event.organizer?.cateringSuggestions ?? []).map(c =>
      c.id === s.id ? { ...c, status: 'abgelehnt' as OrganizerSuggestionStatus } : c
    )
    const updated = { ...event, organizer: { ...event.organizer!, cateringSuggestions: updatedSuggestions } }
    updateEvent(updated); saveEvent(updated)
  }

  return (
    <div style={{ marginBottom: 28, padding: '0 0 24px', borderBottom: '1px solid var(--border)' }}>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--gold)', marginBottom: 12 }}>
        Vorschläge vom Veranstalter
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pending.map(s => (
          <div key={s.id} style={{ background: 'var(--gold-pale)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{s.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: s.description ? 6 : 0 }}>
              {STYLE_LABELS[s.style] ?? s.style} · {new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(s.pricePerPerson)}/Person
            </p>
            {s.description && <p style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 4 }}>{s.description}</p>}
            {s.contactEmail && <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.contactEmail}</p>}
            {s.lockedFields && Object.values(s.lockedFields).some(Boolean) && (
              <p style={{ fontSize: 11, color: 'var(--gold)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Lock size={10} /> Einige Felder werden nach Übernahme gesperrt
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => accept(s)} style={{ padding: '7px 14px', borderRadius: 100, border: 'none', background: 'var(--gold)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Übernehmen</button>
              <button onClick={() => dismiss(s)} style={{ padding: '7px 14px', borderRadius: 100, border: '1px solid var(--border)', background: 'none', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit' }}>Ablehnen</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CateringPage() {
  const enabled = useFeatureEnabled('catering')
  const { event, updateEvent } = useEvent()
  const [form, setForm]               = useState<CateringPlan>(DEFAULT_CATERING)
  const [lockedFields, setLockedFields] = useState<LockedFields>({})
  const [saved, setSaved]             = useState(false)

  useEffect(() => {
    if (event) {
      setForm(event.catering ?? DEFAULT_CATERING)
      setLockedFields(event.cateringLockedFields ?? {})
    }
  }, [event === null])  // only on initial load

  if (!event) return null
  if (!enabled) return <FeatureDisabledScreen />

  const stats = getStats(event)

  // derive times from timeline
  const sektEntry  = event.timeline.find(t => t.title.toLowerCase().includes('sekt'))
  const menuEntry  = event.timeline.find(t => t.title.toLowerCase().includes('menü') || t.title.toLowerCase().includes('dinner') || t.title.toLowerCase().includes('essen'))

  const allergyList = Object.entries(stats.allergyCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, n]) => `${tag} (${n}×)`)
    .join(' · ')

  const update = (patch: Partial<CateringPlan>) => setForm(f => ({ ...f, ...patch }))

  const handleAccept = (s: OrganizerCateringSuggestion) => {
    // Pre-fill form fields from suggestion
    setForm(f => ({
      ...f,
      ...(s.style            ? { serviceStyle: s.style }                : {}),
      ...(s.pricePerPerson   ? { budgetPerPerson: s.pricePerPerson }    : {}),
    }))
    // Apply locks from suggestion
    setLockedFields(s.lockedFields ?? {})
  }

  const handleSave = () => {
    updateEvent({ ...event, catering: form, cateringLockedFields: lockedFields })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const mealLabels: Record<string, string> = {
    fleisch: 'Fleisch', fisch: 'Fisch', vegetarisch: 'Vegetarisch', vegan: 'Vegan',
  }

  const isLocked = (field: keyof CateringPlan) => !!lockedFields[field]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 120px' }}>

        <CateringSuggestions onAccept={handleAccept} />

        {/* ── Auto-pull Info Cards ── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--gold)',
          borderRadius: 'var(--r-md)', padding: '16px 18px', marginBottom: 8,
        }}>
          <p style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--gold)', marginBottom: 12,
          }}>Aus deinen Hochzeitsdaten</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
            <InfoItem label="Datum" value={formatDate(event.date)} />
            <InfoItem label="Location" value={event.venue || '–'} />
            {sektEntry  && <InfoItem label="Sektempfang" value={sektEntry.time + ' Uhr'}  />}
            {menuEntry  && <InfoItem label="Dinner"      value={menuEntry.time  + ' Uhr'}  />}
            <InfoItem label="Bestätigte Gäste" value={`${stats.totalAttending} Personen`} />
            {event.childrenAllowed && (
              <InfoItem label="Kinder" value={event.childrenNote || 'Ja'} />
            )}
          </div>

          {/* Meal breakdown */}
          {stats.totalAttending > 0 && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0 10px' }} />
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Speisenwahl (bestätigt)</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(Object.entries(stats.meals) as [string, number][])
                  .filter(([, n]) => n > 0)
                  .map(([key, n]) => (
                    <span key={key} style={{
                      padding: '4px 10px', borderRadius: 20,
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      fontSize: 12, color: 'var(--text)',
                    }}>{mealLabels[key] ?? key} · {n}×</span>
                  ))
                }
              </div>
            </>
          )}

          {/* Allergies */}
          {allergyList && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0 10px' }} />
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Allergien & Unverträglichkeiten</p>
              <p style={{ fontSize: 13, color: 'var(--text)' }}>{allergyList}</p>
            </>
          )}
        </div>

        {/* ── Sektion 1: Art der Verpflegung ── */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 28, marginBottom: 12 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)' }}>Art der Verpflegung</p>
          <LockBadge locked={isLocked('serviceStyle')} />
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '6px 16px 4px' }}>
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)', opacity: isLocked('serviceStyle') ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Servicestil</p>
              {isLocked('serviceStyle') && <Lock size={13} style={{ color: 'var(--gold)' }} />}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {([
                { value: 'klassisch', label: 'Klassisches Menü' },
                { value: 'buffet',    label: 'Buffet' },
                { value: 'family',    label: 'Family Style' },
                { value: 'foodtruck', label: 'Food Trucks' },
                { value: 'live',      label: 'Live-Cooking' },
              ] as const).map(o => (
                <button
                  key={o.value}
                  onClick={() => !isLocked('serviceStyle') && update({ serviceStyle: o.value })}
                  disabled={isLocked('serviceStyle')}
                  style={{
                    padding: '7px 14px', borderRadius: 20, border: '1px solid',
                    borderColor: form.serviceStyle === o.value ? 'var(--gold)' : 'var(--border)',
                    background: form.serviceStyle === o.value ? 'rgba(201,168,76,0.08)' : 'var(--surface)',
                    color: form.serviceStyle === o.value ? 'var(--gold)' : 'var(--text)',
                    fontSize: 13, cursor: isLocked('serviceStyle') ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >{o.label}</button>
              ))}
            </div>
          </div>

          <Toggle
            value={form.locationHasKitchen}
            onChange={v => update({ locationHasKitchen: v })}
            label="Location hat eigene Küche"
            sublabel="Oder muss der Caterer alles mitbringen?"
            locked={isLocked('locationHasKitchen')}
          />

          <Toggle
            value={form.midnightSnack}
            onChange={v => update({ midnightSnack: v })}
            label="Mitternachtssnack"
            sublabel="z. B. Currywurst, Käseplatte, Pizza"
            locked={isLocked('midnightSnack')}
          />
          {form.midnightSnack && (
            <div style={{ paddingBottom: 12 }}>
              <input
                value={form.midnightSnackNote}
                onChange={e => !isLocked('midnightSnackNote') && update({ midnightSnackNote: e.target.value })}
                disabled={isLocked('midnightSnackNote')}
                placeholder="Was soll es geben?"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)', background: isLocked('midnightSnackNote') ? 'var(--bg)' : 'var(--bg)',
                  fontSize: 14, fontFamily: 'inherit', color: 'var(--text)',
                  outline: 'none', boxSizing: 'border-box',
                  opacity: isLocked('midnightSnackNote') ? 0.6 : 1,
                  cursor: isLocked('midnightSnackNote') ? 'not-allowed' : 'text',
                }}
              />
            </div>
          )}
        </div>

        {/* ── Sektion 2: Getränke ── */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 28, marginBottom: 12 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)' }}>Getränke-Management</p>
          <LockBadge locked={isLocked('drinksBilling') || isLocked('drinksSelection')} />
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '6px 16px 4px' }}>
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)', opacity: isLocked('drinksBilling') ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Abrechnung</p>
              {isLocked('drinksBilling') && <Lock size={13} style={{ color: 'var(--gold)' }} />}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { value: 'pauschale', label: 'Getränkepauschale' },
                { value: 'einzeln',  label: 'Einzelabrechnung' },
              ] as const).map(o => (
                <button
                  key={o.value}
                  onClick={() => !isLocked('drinksBilling') && update({ drinksBilling: o.value })}
                  disabled={isLocked('drinksBilling')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 'var(--r-sm)', border: '1px solid',
                    borderColor: form.drinksBilling === o.value ? 'var(--gold)' : 'var(--border)',
                    background: form.drinksBilling === o.value ? 'rgba(201,168,76,0.08)' : 'var(--surface)',
                    color: form.drinksBilling === o.value ? 'var(--gold)' : 'var(--text)',
                    fontSize: 13, cursor: isLocked('drinksBilling') ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >{o.label}</button>
              ))}
            </div>
          </div>

          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Sortiment</p>
              {isLocked('drinksSelection') && <Lock size={13} style={{ color: 'var(--gold)' }} />}
            </div>
            <CheckGroup
              options={[
                { value: 'wein',      label: 'Wein' },
                { value: 'bier',      label: 'Bier' },
                { value: 'softdrinks',label: 'Softdrinks' },
                { value: 'cocktails', label: 'Cocktailbar' },
                { value: 'longdrinks',label: 'Longdrinks' },
              ]}
              selected={form.drinksSelection}
              onChange={v => update({ drinksSelection: v })}
              locked={isLocked('drinksSelection')}
            />
            <div style={{ height: 10 }} />
          </div>

          <Toggle
            value={form.champagneFingerFood}
            onChange={v => update({ champagneFingerFood: v })}
            label="Häppchen zum Sektempfang"
            sublabel="Fingerfood direkt nach der Trauung"
            locked={isLocked('champagneFingerFood')}
          />
          {form.champagneFingerFood && (
            <div style={{ paddingBottom: 12 }}>
              <input
                value={form.champagneFingerFoodNote}
                onChange={e => !isLocked('champagneFingerFoodNote') && update({ champagneFingerFoodNote: e.target.value })}
                disabled={isLocked('champagneFingerFoodNote')}
                placeholder="Welche Häppchen? (optional)"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  fontSize: 14, fontFamily: 'inherit', color: 'var(--text)',
                  outline: 'none', boxSizing: 'border-box',
                  opacity: isLocked('champagneFingerFoodNote') ? 0.6 : 1,
                  cursor: isLocked('champagneFingerFoodNote') ? 'not-allowed' : 'text',
                }}
              />
            </div>
          )}
        </div>

        {/* ── Sektion 3: Personal & Equipment ── */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 28, marginBottom: 12 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)' }}>Personal & Equipment</p>
          <LockBadge locked={isLocked('serviceStaff') || isLocked('equipmentNeeded')} />
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '6px 16px 4px' }}>
          <Toggle
            value={form.serviceStaff}
            onChange={v => update({ serviceStaff: v })}
            label="Servicepersonal benötigt"
            sublabel="Für Servieren und Abräumen"
            locked={isLocked('serviceStaff')}
          />

          <div style={{ padding: '14px 0', opacity: isLocked('equipmentNeeded') ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Equipment vom Caterer</p>
              {isLocked('equipmentNeeded') && <Lock size={13} style={{ color: 'var(--gold)' }} />}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, marginBottom: 0 }}>Was muss mitgebracht werden?</p>
            <CheckGroup
              options={[
                { value: 'geschirr',     label: 'Geschirr & Besteck' },
                { value: 'glaeser',      label: 'Gläser' },
                { value: 'tischdecken',  label: 'Tischdecken & Servietten' },
                { value: 'buffettische', label: 'Buffet-Tische' },
                { value: 'deko',         label: 'Dekoration' },
              ]}
              selected={form.equipmentNeeded}
              onChange={v => update({ equipmentNeeded: v })}
              locked={isLocked('equipmentNeeded')}
            />
            <div style={{ height: 4 }} />
          </div>
        </div>

        {/* ── Sektion 4: Budget ── */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 28, marginBottom: 12 }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)' }}>Budget</p>
          <LockBadge locked={isLocked('budgetPerPerson') || isLocked('budgetIncludesDrinks')} />
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '6px 16px 4px' }}>
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)', opacity: isLocked('budgetPerPerson') ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Budget pro Person (€)</p>
              {isLocked('budgetPerPerson') && <Lock size={13} style={{ color: 'var(--gold)' }} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min={0}
                value={form.budgetPerPerson || ''}
                onChange={e => !isLocked('budgetPerPerson') && update({ budgetPerPerson: Number(e.target.value) })}
                disabled={isLocked('budgetPerPerson')}
                placeholder="z. B. 120"
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  fontSize: 14, fontFamily: 'inherit', color: 'var(--text)',
                  outline: 'none',
                  cursor: isLocked('budgetPerPerson') ? 'not-allowed' : 'text',
                }}
              />
              <span style={{ fontSize: 14, color: 'var(--text-dim)', flexShrink: 0 }}>€ / Person</span>
            </div>
            {form.budgetPerPerson > 0 && stats.totalAttending > 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                ≈ {(form.budgetPerPerson * stats.totalAttending).toLocaleString('de-DE')} € gesamt ({stats.totalAttending} Personen)
              </p>
            )}
          </div>

          <Toggle
            value={form.budgetIncludesDrinks}
            onChange={v => update({ budgetIncludesDrinks: v })}
            label="Getränke inklusive"
            sublabel="Sind Getränke im Budget pro Kopf enthalten?"
            locked={isLocked('budgetIncludesDrinks')}
          />

          <div style={{ padding: '14px 0' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>Notizen für den Caterer</p>
            <textarea
              value={form.cateringNotes}
              onChange={e => update({ cateringNotes: e.target.value })}
              placeholder="Besondere Wünsche, Anmerkungen, offene Fragen …"
              rows={4}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)', background: 'var(--bg)',
                fontSize: 14, fontFamily: 'inherit', color: 'var(--text)',
                outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* ── Speichern ── */}
        <div style={{ marginTop: 32 }}>
          <button
            onClick={handleSave}
            style={{
              width: '100%', padding: '16px',
              background: saved ? 'var(--gold)' : 'var(--text)',
              color: saved ? 'var(--text)' : 'var(--surface)',
              border: 'none', borderRadius: 'var(--r-md)',
              fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer', transition: 'background 0.2s, color 0.2s',
              letterSpacing: '0.03em',
            }}
          >
            {saved ? '✓ Gespeichert' : 'Speichern'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Small helper ───────────────────────────────────────────────────────────
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gold)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, color: 'var(--text)' }}>{value}</p>
    </div>
  )
}
