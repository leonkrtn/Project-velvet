'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Check, Plus, Trash2, ChevronDown, ChevronUp, ImageIcon } from 'lucide-react'

// ── Preset item types (same shape as the real suggestion tables, without event_id/status/created_at) ──

interface PresetVendor {
  id: string
  name: string | null
  category: string | null
  description: string | null
  price_estimate: number
  contact_email: string | null
  contact_phone: string | null
}

interface PresetHotel {
  id: string
  name: string | null
  address: string | null
  distance_km: number
  price_per_night: number
  total_rooms: number
  description: string | null
}

interface PresetDeko {
  id: string
  title: string | null
  description: string | null
  image_url: string | null
}

// ── Base settings (non-suggestion fields) ──

type Settings = {
  venue: string
  location_name: string
  location_street: string
  location_zip: string
  location_city: string
  location_website: string
  dresscode: string
  children_allowed: boolean
  children_note: string
  max_begleitpersonen: number
  meal_options: string[]
}

const EMPTY_SETTINGS: Settings = {
  venue: '', location_name: '', location_street: '', location_zip: '',
  location_city: '', location_website: '', dresscode: '',
  children_allowed: true, children_note: '', max_begleitpersonen: 2,
  meal_options: ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
}

const ALL_MEALS = ['fleisch', 'fisch', 'vegetarisch', 'vegan']
const MEAL_LABELS: Record<string, string> = { fleisch: 'Fleisch', fisch: 'Fisch', vegetarisch: 'Vegetarisch', vegan: 'Vegan' }

type VTab = 'dienstleister' | 'hotels' | 'dekoration'

// ── Shared styles (identical to VorschlaegeClient) ──

const inputSt: React.CSSProperties = {
  width: '100%', padding: '10px 13px', background: '#fff',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: 'var(--text)',
}
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 5,
}

function fmtMoney(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })
}

function ModalGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>
}
function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={labelSt}>{label}</label>{children}</div>
}

// ─────────────────────────────────────────────────────────────────────────────

export default function VoreinstellungenPage() {
  const router = useRouter()
  const supabase = createClient()

  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [userId, setUserId]     = useState<string | null>(null)

  // Vorschläge state
  const [vtab, setVtab]               = useState<VTab>('dienstleister')
  const [presetVendors, setPresetVendors] = useState<PresetVendor[]>([])
  const [presetHotels, setPresetHotels]   = useState<PresetHotel[]>([])
  const [presetDeko, setPresetDeko]       = useState<PresetDeko[]>([])
  const [modal, setModal]               = useState<VTab | null>(null)
  const [expanded, setExpanded]         = useState<Set<string>>(new Set())

  // Add forms (identical shape to VorschlaegeClient)
  const [vForm, setVForm] = useState({ name: '', category: '', description: '', price_estimate: '', contact_email: '', contact_phone: '' })
  const [hForm, setHForm] = useState({ name: '', address: '', distance_km: '', price_per_night: '', total_rooms: '', description: '' })
  const [dForm, setDForm] = useState({ title: '', description: '', image_url: '' })

  const inp: React.CSSProperties = { ...inputSt }

  const focusBorder = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = 'var(--accent)' },
    onBlur:  (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = 'var(--border)' },
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: row } = await supabase.from('organizer_presets').select('*').eq('user_id', user.id).single()
      if (row) {
        setSettings({
          venue:                row.venue                ?? '',
          location_name:        row.location_name        ?? '',
          location_street:      row.location_street      ?? '',
          location_zip:         row.location_zip         ?? '',
          location_city:        row.location_city        ?? '',
          location_website:     row.location_website     ?? '',
          dresscode:            row.dresscode            ?? '',
          children_allowed:     row.children_allowed     ?? true,
          children_note:        row.children_note        ?? '',
          max_begleitpersonen:  row.max_begleitpersonen  ?? 2,
          meal_options:         row.meal_options         ?? ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
        })
        setPresetVendors(row.preset_vendors ?? [])
        setPresetHotels(row.preset_hotels  ?? [])
        setPresetDeko(row.preset_deko      ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  function patchSettings(p: Partial<Settings>) { setSettings(prev => ({ ...prev, ...p })) }

  function toggleMeal(meal: string) {
    setSettings(prev => ({
      ...prev,
      meal_options: prev.meal_options.includes(meal)
        ? prev.meal_options.filter(m => m !== meal)
        : [...prev.meal_options, meal],
    }))
  }

  // ── Local add/delete (persist on global Save) ──

  function addVendor() {
    setPresetVendors(v => [{
      id: crypto.randomUUID(),
      name:           vForm.name           || null,
      category:       vForm.category       || null,
      description:    vForm.description    || null,
      price_estimate: parseFloat(vForm.price_estimate) || 0,
      contact_email:  vForm.contact_email  || null,
      contact_phone:  vForm.contact_phone  || null,
    }, ...v])
    setVForm({ name: '', category: '', description: '', price_estimate: '', contact_email: '', contact_phone: '' })
    setModal(null)
  }

  function addHotel() {
    setPresetHotels(h => [{
      id: crypto.randomUUID(),
      name:           hForm.name           || null,
      address:        hForm.address        || null,
      distance_km:    parseFloat(hForm.distance_km)    || 0,
      price_per_night:parseFloat(hForm.price_per_night)|| 0,
      total_rooms:    parseInt(hForm.total_rooms)       || 0,
      description:    hForm.description   || null,
    }, ...h])
    setHForm({ name: '', address: '', distance_km: '', price_per_night: '', total_rooms: '', description: '' })
    setModal(null)
  }

  function addDeko() {
    setPresetDeko(d => [{
      id: crypto.randomUUID(),
      title:       dForm.title       || null,
      description: dForm.description || null,
      image_url:   dForm.image_url   || null,
    }, ...d])
    setDForm({ title: '', description: '', image_url: '' })
    setModal(null)
  }

  function toggleExpand(id: string) {
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function save() {
    if (!userId) return
    setSaving(true)
    try {
      await supabase.from('organizer_presets').upsert({
        user_id:              userId,
        venue:                settings.venue.trim()               || null,
        location_name:        settings.location_name.trim()       || null,
        location_street:      settings.location_street.trim()     || null,
        location_zip:         settings.location_zip.trim()        || null,
        location_city:        settings.location_city.trim()       || null,
        location_website:     settings.location_website.trim()    || null,
        dresscode:            settings.dresscode.trim()           || null,
        children_allowed:     settings.children_allowed,
        children_note:        settings.children_note.trim()       || null,
        max_begleitpersonen:  settings.max_begleitpersonen,
        meal_options:         settings.meal_options,
        preset_vendors:       presetVendors,
        preset_hotels:        presetHotels,
        preset_deko:          presetDeko,
        updated_at:           new Date().toISOString(),
      }, { onConflict: 'user_id' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  // ── Shared card / label styles ──

  const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.1px', marginBottom: 16 }
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 22px', marginBottom: 16 }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }

  const VTABS: { key: VTab; label: string; count: number }[] = [
    { key: 'dienstleister', label: 'Dienstleister', count: presetVendors.length },
    { key: 'hotels',        label: 'Hotels',        count: presetHotels.length },
    { key: 'dekoration',    label: 'Dekoration',    count: presetDeko.length },
  ]

  if (loading) return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 16px' }}>
      <div style={{ height: 200, borderRadius: 'var(--radius)', background: 'var(--surface)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  )

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 16px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => router.push('/veranstalter/events')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 16, fontFamily: 'inherit' }}>
          <ChevronLeft size={15} /> Meine Events
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 500, color: 'var(--text)', margin: '0 0 4px' }}>Voreinstellungen</h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>Diese Werte werden automatisch bei jedem neuen Event vorausgefüllt.</p>
      </div>

      {/* Location & Adresse */}
      <div style={card}>
        <p style={sectionTitle}>Location & Adresse</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Location Name</label>
            <input value={settings.venue} onChange={e => patchSettings({ venue: e.target.value })} placeholder="Schloss Lichtenberg" style={inp} {...focusBorder} />
          </div>
          <div>
            <label style={labelStyle}>Bezeichnung / Saal</label>
            <input value={settings.location_name} onChange={e => patchSettings({ location_name: e.target.value })} placeholder="Festsaal West" style={inp} {...focusBorder} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Straße & Hausnummer</label>
              <input value={settings.location_street} onChange={e => patchSettings({ location_street: e.target.value })} placeholder="Musterstraße 1" style={inp} {...focusBorder} />
            </div>
            <div>
              <label style={labelStyle}>PLZ</label>
              <input value={settings.location_zip} onChange={e => patchSettings({ location_zip: e.target.value })} placeholder="12345" style={inp} {...focusBorder} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Stadt</label>
              <input value={settings.location_city} onChange={e => patchSettings({ location_city: e.target.value })} placeholder="Musterstadt" style={inp} {...focusBorder} />
            </div>
            <div>
              <label style={labelStyle}>Website</label>
              <input value={settings.location_website} onChange={e => patchSettings({ location_website: e.target.value })} placeholder="https://location.de" style={inp} {...focusBorder} />
            </div>
          </div>
        </div>
      </div>

      {/* Raum — coming soon */}
      <div style={{ ...card, opacity: 0.55, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ ...sectionTitle, marginBottom: 0 }}>Raum</p>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', background: 'var(--border)', borderRadius: 6, padding: '3px 8px' }}>Bald verfügbar</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={labelStyle}>Länge (m)</label><input disabled placeholder="12" style={inp} /></div>
          <div><label style={labelStyle}>Breite (m)</label><input disabled placeholder="8" style={inp} /></div>
        </div>
      </div>

      {/* ── Vorschläge (identical UI to VorschlaegeClient, without status) ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <p style={{ ...sectionTitle, marginBottom: 0 }}>Vorschläge</p>
          <button
            onClick={() => setModal(vtab)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}
          >
            <Plus size={14} /> Hinzufügen
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'inline-flex', background: '#EBEBEC', borderRadius: 10, padding: 3, marginBottom: 20, gap: 2 }}>
          {VTABS.map(t => (
            <button key={t.key} onClick={() => setVtab(t.key)} style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, borderRadius: 8, transition: 'all 0.15s', background: vtab === t.key ? 'var(--surface)' : 'transparent', color: vtab === t.key ? 'var(--text)' : 'var(--text-tertiary)', boxShadow: vtab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', fontFamily: 'inherit' }}>
              {t.label} <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 3 }}>({t.count})</span>
            </button>
          ))}
        </div>

        {/* Dienstleister */}
        {vtab === 'dienstleister' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {presetVendors.length === 0 && <p style={{ gridColumn: '1/-1', fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '24px 0', textAlign: 'center' }}>Noch keine Dienstleister-Vorschläge</p>}
            {presetVendors.map(v => (
              <div key={v.id} style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{v.name ?? 'Unbenannt'}</div>
                    {v.category && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{v.category}</div>}
                  </div>
                  <button onClick={() => setPresetVendors(p => p.filter(x => x.id !== v.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}><Trash2 size={13} /></button>
                </div>
                {v.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{v.description}</p>}
                <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtMoney(v.price_estimate)}</div>
                {(v.contact_email || v.contact_phone) && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {v.contact_email && <div>{v.contact_email}</div>}
                    {v.contact_phone && <div>{v.contact_phone}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hotels */}
        {vtab === 'hotels' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {presetHotels.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '24px 0', textAlign: 'center' }}>Noch keine Hotel-Vorschläge</p>}
            {presetHotels.map(h => {
              const isOpen = expanded.has(h.id)
              return (
                <div key={h.id} style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer' }} onClick={() => toggleExpand(h.id)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.name ?? 'Unbenannt'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {h.address ?? '—'} · {h.distance_km} km · {h.total_rooms} Zimmer · {fmtMoney(h.price_per_night)}/Nacht
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={e => { e.stopPropagation(); setPresetHotels(p => p.filter(x => x.id !== h.id)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}><Trash2 size={13} /></button>
                      {isOpen ? <ChevronUp size={15} color="var(--text-tertiary)" /> : <ChevronDown size={15} color="var(--text-tertiary)" />}
                    </div>
                  </div>
                  {isOpen && h.description && (
                    <div style={{ padding: '0 18px 14px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{h.description}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Dekoration */}
        {vtab === 'dekoration' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {presetDeko.length === 0 && <p style={{ gridColumn: '1/-1', fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '24px 0', textAlign: 'center' }}>Noch keine Deko-Vorschläge</p>}
            {presetDeko.map(d => (
              <div key={d.id} style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ height: 140, background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {d.image_url ? <img src={d.image_url} alt={d.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={28} color="var(--text-tertiary)" />}
                  <button onClick={() => setPresetDeko(p => p.filter(x => x.id !== d.id))} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, display: 'flex', color: '#fff' }}><Trash2 size={12} /></button>
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{d.title ?? 'Unbenannt'}</div>
                  {d.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Standard-Vorschläge (Menüoptionen) */}
      <div style={card}>
        <p style={sectionTitle}>Standard-Vorschläge</p>
        <label style={{ ...labelStyle, marginBottom: 12 }}>Menüoptionen, die standardmäßig zur Wahl stehen</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ALL_MEALS.map(meal => {
            const active = settings.meal_options.includes(meal)
            return (
              <button key={meal} type="button" onClick={() => toggleMeal(meal)} style={{ padding: '8px 18px', borderRadius: 100, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-light)' : 'none', color: active ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
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
            <input value={settings.dresscode} onChange={e => patchSettings({ dresscode: e.target.value })} placeholder="Festlich, Cocktailkleid etc." style={inp} {...focusBorder} />
          </div>
          <div>
            <label style={labelStyle}>Kinder willkommen?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([true, false] as const).map(val => (
                <button key={String(val)} type="button" onClick={() => patchSettings({ children_allowed: val })} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: `1.5px solid ${settings.children_allowed === val ? 'var(--accent)' : 'var(--border)'}`, background: settings.children_allowed === val ? 'var(--accent-light)' : 'none', color: settings.children_allowed === val ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  {val ? 'Ja' : 'Nein'}
                </button>
              ))}
            </div>
            {settings.children_allowed && (
              <input value={settings.children_note} onChange={e => patchSettings({ children_note: e.target.value })} placeholder="Hinweis zu Kindern (optional)" style={{ ...inp, marginTop: 10 }} {...focusBorder} />
            )}
          </div>
          <div>
            <label style={labelStyle}>Max. Begleitpersonen pro Gast</label>
            <input type="number" min={0} max={10} value={settings.max_begleitpersonen} onChange={e => patchSettings({ max_begleitpersonen: Math.max(0, parseInt(e.target.value) || 0) })} style={{ ...inp, maxWidth: 100 }} {...focusBorder} />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ padding: '12px 28px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Speichern …' : 'Speichern'}
        </button>
        {saved && !saving && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--green)' }}>
            <Check size={14} /> Gespeichert
          </div>
        )}
      </div>

      {/* ── Modals (identical to VorschlaegeClient) ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setModal(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>

            {modal === 'dienstleister' && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 20 }}>Dienstleister hinzufügen</h3>
                <ModalGrid>
                  <ModalField label="Name"><input style={inputSt} value={vForm.name} onChange={e => setVForm(f => ({ ...f, name: e.target.value }))} /></ModalField>
                  <ModalField label="Kategorie"><input style={inputSt} value={vForm.category} onChange={e => setVForm(f => ({ ...f, category: e.target.value }))} placeholder="z. B. Fotograf" /></ModalField>
                </ModalGrid>
                <ModalField label="Beschreibung"><textarea style={{ ...inputSt, minHeight: 70, resize: 'vertical' }} value={vForm.description} onChange={e => setVForm(f => ({ ...f, description: e.target.value }))} /></ModalField>
                <ModalGrid>
                  <ModalField label="Kostenvoranschlag (€)"><input type="number" style={inputSt} value={vForm.price_estimate} onChange={e => setVForm(f => ({ ...f, price_estimate: e.target.value }))} /></ModalField>
                  <ModalField label="Telefon"><input style={inputSt} value={vForm.contact_phone} onChange={e => setVForm(f => ({ ...f, contact_phone: e.target.value }))} /></ModalField>
                </ModalGrid>
                <ModalField label="E-Mail"><input type="email" style={inputSt} value={vForm.contact_email} onChange={e => setVForm(f => ({ ...f, contact_email: e.target.value }))} /></ModalField>
              </>
            )}

            {modal === 'hotels' && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 20 }}>Hotel hinzufügen</h3>
                <ModalGrid>
                  <ModalField label="Name"><input style={inputSt} value={hForm.name} onChange={e => setHForm(f => ({ ...f, name: e.target.value }))} /></ModalField>
                  <ModalField label="Entfernung (km)"><input type="number" style={inputSt} value={hForm.distance_km} onChange={e => setHForm(f => ({ ...f, distance_km: e.target.value }))} /></ModalField>
                </ModalGrid>
                <ModalField label="Adresse"><input style={inputSt} value={hForm.address} onChange={e => setHForm(f => ({ ...f, address: e.target.value }))} /></ModalField>
                <ModalGrid>
                  <ModalField label="Preis/Nacht (€)"><input type="number" style={inputSt} value={hForm.price_per_night} onChange={e => setHForm(f => ({ ...f, price_per_night: e.target.value }))} /></ModalField>
                  <ModalField label="Zimmer gesamt"><input type="number" style={inputSt} value={hForm.total_rooms} onChange={e => setHForm(f => ({ ...f, total_rooms: e.target.value }))} /></ModalField>
                </ModalGrid>
                <ModalField label="Beschreibung"><textarea style={{ ...inputSt, minHeight: 70, resize: 'vertical' }} value={hForm.description} onChange={e => setHForm(f => ({ ...f, description: e.target.value }))} /></ModalField>
              </>
            )}

            {modal === 'dekoration' && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 20 }}>Deko-Vorschlag hinzufügen</h3>
                <ModalField label="Titel"><input style={inputSt} value={dForm.title} onChange={e => setDForm(f => ({ ...f, title: e.target.value }))} /></ModalField>
                <ModalField label="Beschreibung"><textarea style={{ ...inputSt, minHeight: 80, resize: 'vertical' }} value={dForm.description} onChange={e => setDForm(f => ({ ...f, description: e.target.value }))} /></ModalField>
                <ModalField label="Bild-URL"><input type="url" style={inputSt} value={dForm.image_url} onChange={e => setDForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://…" /></ModalField>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(null)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Abbrechen</button>
              <button
                onClick={modal === 'dienstleister' ? addVendor : modal === 'hotels' ? addHotel : addDeko}
                style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
