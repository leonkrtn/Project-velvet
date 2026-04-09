'use client'
import React, { useState, useEffect } from 'react'
import { getStats, CateringPlan, Event } from '@/lib/store'
import { useEvent } from '@/lib/event-context'

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

function Toggle({
  value, onChange, label, sublabel,
}: { value: boolean; onChange: (v: boolean) => void; label: string; sublabel?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{label}</p>
        {sublabel && <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{sublabel}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none',
          background: value ? 'var(--gold)' : 'var(--border)',
          position: 'relative', cursor: 'pointer', flexShrink: 0,
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
  )
}

function CheckGroup({
  options, selected, onChange,
}: { options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(x => x !== val) : [...selected, val])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {options.map(o => {
        const active = selected.includes(o.value)
        return (
          <button
            key={o.value}
            onClick={() => toggle(o.value)}
            style={{
              padding: '7px 14px', borderRadius: 20, border: '1px solid',
              borderColor: active ? 'var(--gold)' : 'var(--border)',
              background: active ? 'rgba(201,168,76,0.08)' : 'var(--surface)',
              color: active ? 'var(--gold)' : 'var(--text)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >{o.label}</button>
        )
      })}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CateringPage() {
  const { event, updateEvent } = useEvent()
  const [form, setForm]     = useState<CateringPlan>(DEFAULT_CATERING)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    if (event) setForm(event.catering ?? DEFAULT_CATERING)
  }, [event === null])  // only on initial load

  if (!event) return null

  const stats = getStats(event)

  // derive times from timeline
  const sektEntry  = event.timeline.find(t => t.title.toLowerCase().includes('sekt'))
  const menuEntry  = event.timeline.find(t => t.title.toLowerCase().includes('menü') || t.title.toLowerCase().includes('dinner') || t.title.toLowerCase().includes('essen'))

  const allergyList = Object.entries(stats.allergyCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, n]) => `${tag} (${n}×)`)
    .join(' · ')

  const update = (patch: Partial<CateringPlan>) =>
    setForm(f => ({ ...f, ...patch }))

  const handleSave = () => {
    updateEvent({ ...event, catering: form })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const mealLabels: Record<string, string> = {
    fleisch: 'Fleisch', fisch: 'Fisch', vegetarisch: 'Vegetarisch', vegan: 'Vegan',
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 120px' }}>

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
        <SectionHeading>Art der Verpflegung</SectionHeading>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '6px 16px 4px' }}>
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>Servicestil</p>
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
                  onClick={() => update({ serviceStyle: o.value })}
                  style={{
                    padding: '7px 14px', borderRadius: 20, border: '1px solid',
                    borderColor: form.serviceStyle === o.value ? 'var(--gold)' : 'var(--border)',
                    background: form.serviceStyle === o.value ? 'rgba(201,168,76,0.08)' : 'var(--surface)',
                    color: form.serviceStyle === o.value ? 'var(--gold)' : 'var(--text)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
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
          />

          <Toggle
            value={form.midnightSnack}
            onChange={v => update({ midnightSnack: v })}
            label="Mitternachtssnack"
            sublabel="z. B. Currywurst, Käseplatte, Pizza"
          />
          {form.midnightSnack && (
            <div style={{ paddingBottom: 12 }}>
              <input
                value={form.midnightSnackNote}
                onChange={e => update({ midnightSnackNote: e.target.value })}
                placeholder="Was soll es geben?"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  fontSize: 14, fontFamily: 'inherit', color: 'var(--text)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>

        {/* ── Sektion 2: Getränke ── */}
        <SectionHeading>Getränke-Management</SectionHeading>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '6px 16px 4px' }}>
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>Abrechnung</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { value: 'pauschale', label: 'Getränkepauschale' },
                { value: 'einzeln',  label: 'Einzelabrechnung' },
              ] as const).map(o => (
                <button
                  key={o.value}
                  onClick={() => update({ drinksBilling: o.value })}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 'var(--r-sm)', border: '1px solid',
                    borderColor: form.drinksBilling === o.value ? 'var(--gold)' : 'var(--border)',
                    background: form.drinksBilling === o.value ? 'rgba(201,168,76,0.08)' : 'var(--surface)',
                    color: form.drinksBilling === o.value ? 'var(--gold)' : 'var(--text)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >{o.label}</button>
              ))}
            </div>
          </div>

          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Sortiment</p>
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
            />
            <div style={{ height: 10 }} />
          </div>

          <Toggle
            value={form.champagneFingerFood}
            onChange={v => update({ champagneFingerFood: v })}
            label="Häppchen zum Sektempfang"
            sublabel="Fingerfood direkt nach der Trauung"
          />
          {form.champagneFingerFood && (
            <div style={{ paddingBottom: 12 }}>
              <input
                value={form.champagneFingerFoodNote}
                onChange={e => update({ champagneFingerFoodNote: e.target.value })}
                placeholder="Welche Häppchen? (optional)"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  fontSize: 14, fontFamily: 'inherit', color: 'var(--text)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>

        {/* ── Sektion 3: Personal & Equipment ── */}
        <SectionHeading>Personal & Equipment</SectionHeading>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '6px 16px 4px' }}>
          <Toggle
            value={form.serviceStaff}
            onChange={v => update({ serviceStaff: v })}
            label="Servicepersonal benötigt"
            sublabel="Für Servieren und Abräumen"
          />

          <div style={{ padding: '14px 0' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Equipment vom Caterer</p>
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
            />
            <div style={{ height: 4 }} />
          </div>
        </div>

        {/* ── Sektion 4: Budget ── */}
        <SectionHeading>Budget</SectionHeading>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '6px 16px 4px' }}>
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>Budget pro Person (€)</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min={0}
                value={form.budgetPerPerson || ''}
                onChange={e => update({ budgetPerPerson: Number(e.target.value) })}
                placeholder="z. B. 120"
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  fontSize: 14, fontFamily: 'inherit', color: 'var(--text)',
                  outline: 'none',
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
