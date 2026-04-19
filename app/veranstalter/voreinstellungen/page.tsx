'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Check } from 'lucide-react'

type Presets = {
  venue: string
  location_name: string
  location_street: string
  location_zip: string
  location_city: string
  location_website: string
  hotel_notes: string
  dienstleister_notes: string
  deko_notes: string
  dresscode: string
  children_allowed: boolean
  children_note: string
  max_begleitpersonen: number
  meal_options: string[]
}

const EMPTY: Presets = {
  venue: '',
  location_name: '',
  location_street: '',
  location_zip: '',
  location_city: '',
  location_website: '',
  hotel_notes: '',
  dienstleister_notes: '',
  deko_notes: '',
  dresscode: '',
  children_allowed: true,
  children_note: '',
  max_begleitpersonen: 2,
  meal_options: ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
}

const ALL_MEALS = ['fleisch', 'fisch', 'vegetarisch', 'vegan']

const MEAL_LABELS: Record<string, string> = {
  fleisch: 'Fleisch',
  fisch: 'Fisch',
  vegetarisch: 'Vegetarisch',
  vegan: 'Vegan',
}

export default function VoreinstellungenPage() {
  const router = useRouter()
  const supabase = createClient()

  const [data, setData] = useState<Presets>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 13px', fontSize: 14,
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    background: '#fff', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: 'var(--text)',
  }

  const ta: React.CSSProperties = {
    ...inp, resize: 'vertical', minHeight: 80, lineHeight: 1.5,
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: row } = await supabase
        .from('organizer_presets')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (row) {
        setData({
          venue:                row.venue                ?? '',
          location_name:        row.location_name        ?? '',
          location_street:      row.location_street      ?? '',
          location_zip:         row.location_zip         ?? '',
          location_city:        row.location_city        ?? '',
          location_website:     row.location_website     ?? '',
          hotel_notes:          row.hotel_notes          ?? '',
          dienstleister_notes:  row.dienstleister_notes  ?? '',
          deko_notes:           row.deko_notes           ?? '',
          dresscode:            row.dresscode            ?? '',
          children_allowed:     row.children_allowed     ?? true,
          children_note:        row.children_note        ?? '',
          max_begleitpersonen:  row.max_begleitpersonen  ?? 2,
          meal_options:         row.meal_options         ?? ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
        })
      }
    } finally {
      setLoading(false)
    }
  }

  function patch(p: Partial<Presets>) {
    setData(prev => ({ ...prev, ...p }))
  }

  function toggleMeal(meal: string) {
    setData(prev => ({
      ...prev,
      meal_options: prev.meal_options.includes(meal)
        ? prev.meal_options.filter(m => m !== meal)
        : [...prev.meal_options, meal],
    }))
  }

  async function save() {
    if (!userId) return
    setSaving(true)
    try {
      await supabase.from('organizer_presets').upsert({
        user_id:              userId,
        venue:                data.venue.trim()               || null,
        location_name:        data.location_name.trim()       || null,
        location_street:      data.location_street.trim()     || null,
        location_zip:         data.location_zip.trim()        || null,
        location_city:        data.location_city.trim()       || null,
        location_website:     data.location_website.trim()    || null,
        hotel_notes:          data.hotel_notes.trim()         || null,
        dienstleister_notes:  data.dienstleister_notes.trim() || null,
        deko_notes:           data.deko_notes.trim()          || null,
        dresscode:            data.dresscode.trim()           || null,
        children_allowed:     data.children_allowed,
        children_note:        data.children_note.trim()       || null,
        max_begleitpersonen:  data.max_begleitpersonen,
        meal_options:         data.meal_options,
        updated_at:           new Date().toISOString(),
      }, { onConflict: 'user_id' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--text-tertiary)', marginBottom: 6,
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: 13, fontWeight: 700, color: 'var(--text)',
    letterSpacing: '-0.1px', marginBottom: 16,
  }

  const card: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '20px 22px', marginBottom: 16,
  }

  const focusBorder = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.target.style.borderColor = 'var(--accent)' },
    onBlur:  (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.target.style.borderColor = 'var(--border)' },
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 16px' }}>
        <div style={{ height: 200, borderRadius: 'var(--radius)', background: 'var(--surface)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 16px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.push('/veranstalter/events')}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 13, color: 'var(--text-tertiary)', background: 'none',
            border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 16,
            fontFamily: 'inherit',
          }}
        >
          <ChevronLeft size={15} /> Meine Events
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>Voreinstellungen</h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
          Diese Werte werden automatisch bei jedem neuen Event vorausgefüllt.
        </p>
      </div>

      {/* Location & Adresse */}
      <div style={card}>
        <p style={sectionTitle}>Location & Adresse</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Location Name</label>
            <input
              value={data.venue}
              onChange={e => patch({ venue: e.target.value })}
              placeholder="Schloss Lichtenberg"
              style={inp}
              {...focusBorder}
            />
          </div>
          <div>
            <label style={labelStyle}>Bezeichnung / Saal</label>
            <input
              value={data.location_name}
              onChange={e => patch({ location_name: e.target.value })}
              placeholder="Festsaal West"
              style={inp}
              {...focusBorder}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Straße & Hausnummer</label>
              <input
                value={data.location_street}
                onChange={e => patch({ location_street: e.target.value })}
                placeholder="Musterstraße 1"
                style={inp}
                {...focusBorder}
              />
            </div>
            <div>
              <label style={labelStyle}>PLZ</label>
              <input
                value={data.location_zip}
                onChange={e => patch({ location_zip: e.target.value })}
                placeholder="12345"
                style={inp}
                {...focusBorder}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Stadt</label>
              <input
                value={data.location_city}
                onChange={e => patch({ location_city: e.target.value })}
                placeholder="Musterstadt"
                style={inp}
                {...focusBorder}
              />
            </div>
            <div>
              <label style={labelStyle}>Website</label>
              <input
                value={data.location_website}
                onChange={e => patch({ location_website: e.target.value })}
                placeholder="https://location.de"
                style={inp}
                {...focusBorder}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Raum — coming soon */}
      <div style={{ ...card, opacity: 0.55, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ ...sectionTitle, marginBottom: 0 }}>Raum</p>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--text-tertiary)',
            background: 'var(--border)', borderRadius: 6, padding: '3px 8px',
          }}>Bald verfügbar</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Länge (m)</label>
            <input disabled placeholder="12" style={inp} />
          </div>
          <div>
            <label style={labelStyle}>Breite (m)</label>
            <input disabled placeholder="8" style={inp} />
          </div>
        </div>
      </div>

      {/* Vorschläge */}
      <div style={card}>
        <p style={sectionTitle}>Vorschläge</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Hotel</label>
            <textarea
              value={data.hotel_notes}
              onChange={e => patch({ hotel_notes: e.target.value })}
              placeholder="z. B. Hotel Muster, 5 Zimmer reserviert, 10 min zur Location"
              style={ta}
              {...focusBorder}
            />
          </div>
          <div>
            <label style={labelStyle}>Dienstleister</label>
            <textarea
              value={data.dienstleister_notes}
              onChange={e => patch({ dienstleister_notes: e.target.value })}
              placeholder="z. B. DJ Max, Fotograf Anna Schmidt"
              style={ta}
              {...focusBorder}
            />
          </div>
          <div>
            <label style={labelStyle}>Deko</label>
            <textarea
              value={data.deko_notes}
              onChange={e => patch({ deko_notes: e.target.value })}
              placeholder="z. B. Weiße Tischdecken, Blumengestecke Rosen"
              style={ta}
              {...focusBorder}
            />
          </div>
        </div>
      </div>

      {/* Mitarbeiter — coming soon */}
      <div style={{ ...card, opacity: 0.55, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ ...sectionTitle, marginBottom: 0 }}>Mitarbeiter</p>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--text-tertiary)',
            background: 'var(--border)', borderRadius: 6, padding: '3px 8px',
          }}>Bald verfügbar</span>
        </div>
        <textarea disabled placeholder="Standard-Mitarbeiter für neue Events" style={{ ...ta, width: '100%' }} />
      </div>

      {/* Standard-Vorschläge (Menüoptionen) */}
      <div style={card}>
        <p style={sectionTitle}>Standard-Vorschläge</p>
        <label style={{ ...labelStyle, marginBottom: 12 }}>Menüoptionen, die standardmäßig zur Wahl stehen</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ALL_MEALS.map(meal => {
            const active = data.meal_options.includes(meal)
            return (
              <button
                key={meal}
                type="button"
                onClick={() => toggleMeal(meal)}
                style={{
                  padding: '8px 18px', borderRadius: 100,
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-light)' : 'none',
                  color: active ? 'var(--accent)' : 'var(--text-tertiary)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}
              >
                {MEAL_LABELS[meal]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Standard-Einstellungen */}
      <div style={card}>
        <p style={sectionTitle}>Standard-Einstellungen</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Dresscode</label>
            <input
              value={data.dresscode}
              onChange={e => patch({ dresscode: e.target.value })}
              placeholder="Festlich, Cocktailkleid etc."
              style={inp}
              {...focusBorder}
            />
          </div>
          <div>
            <label style={labelStyle}>Kinder willkommen?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([true, false] as const).map(val => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => patch({ children_allowed: val })}
                  style={{
                    padding: '8px 18px', borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${data.children_allowed === val ? 'var(--accent)' : 'var(--border)'}`,
                    background: data.children_allowed === val ? 'var(--accent-light)' : 'none',
                    color: data.children_allowed === val ? 'var(--accent)' : 'var(--text-tertiary)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  {val ? 'Ja' : 'Nein'}
                </button>
              ))}
            </div>
            {data.children_allowed && (
              <input
                value={data.children_note}
                onChange={e => patch({ children_note: e.target.value })}
                placeholder="Hinweis zu Kindern (optional)"
                style={{ ...inp, marginTop: 10 }}
                {...focusBorder}
              />
            )}
          </div>
          <div>
            <label style={labelStyle}>Max. Begleitpersonen pro Gast</label>
            <input
              type="number" min={0} max={10}
              value={data.max_begleitpersonen}
              onChange={e => patch({ max_begleitpersonen: Math.max(0, parseInt(e.target.value) || 0) })}
              style={{ ...inp, maxWidth: 100 }}
              {...focusBorder}
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '12px 28px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'var(--text)', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: saving ? 0.6 : 1, transition: 'opacity 0.15s',
          }}
        >
          {saving ? 'Speichern …' : 'Speichern'}
        </button>
        {saved && !saving && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--green)' }}>
            <Check size={14} /> Gespeichert
          </div>
        )}
      </div>
    </div>
  )
}
