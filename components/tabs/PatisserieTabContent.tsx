'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Edit2, Thermometer, Clock, MapPin, Lightbulb, X, Plus } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface PatisserieConfig {
  cake_description: string
  layers: number
  flavors: string[]
  dietary_notes: string
  delivery_date: string
  delivery_time: string
  cooling_required: boolean
  cooling_notes: string
  setup_location: string
  cake_table_provided: boolean
  dessert_buffet: boolean
  dessert_items: string[]
  price: number
  vendor_notes: string
}

interface Props {
  eventId: string
  mode: 'veranstalter' | 'dienstleister'
  hasFullModuleAccess?: boolean
  onPropose?: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 5 }}>
      {children}
    </label>
  )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: 'var(--text-tertiary)' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

const FLAVORS = ['Vanille', 'Schokolade', 'Zitronen', 'Erdbeere', 'Himbeer', 'Karamell', 'Pistazie', 'Haselnuss']

// ── Edit Form ─────────────────────────────────────────────────────────────────

function PatisserieEditForm({ config, eventId, onSaved, onCancel }: {
  config: PatisserieConfig | null
  eventId: string
  onSaved: (c: PatisserieConfig) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<PatisserieConfig>(config ?? {
    cake_description: '', layers: 1, flavors: [], dietary_notes: '',
    delivery_date: '', delivery_time: '', cooling_required: false, cooling_notes: '',
    setup_location: '', cake_table_provided: false, dessert_buffet: false,
    dessert_items: [], price: 0, vendor_notes: '',
  })
  const [newFlavor, setNewFlavor]           = useState('')
  const [newDessertItem, setNewDessertItem] = useState('')
  const [saving, setSaving]                 = useState(false)

  function set<K extends keyof PatisserieConfig>(k: K, v: PatisserieConfig[K]) {
    setDraft(p => ({ ...p, [k]: v }))
  }

  function toggleFlavor(f: string) {
    setDraft(p => ({ ...p, flavors: p.flavors.includes(f) ? p.flavors.filter(x => x !== f) : [...p.flavors, f] }))
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('patisserie_config')
      .upsert({ event_id: eventId, ...draft }, { onConflict: 'event_id' })
      .select().single()
    setSaving(false)
    if (!error && data) onSaved(data as PatisserieConfig)
  }

  function inputStyle() {
    return { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 15, fontWeight: 600 }}>Patisserie bearbeiten</p>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
      </div>

      {/* Lieferung */}
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Lieferung</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div><Label>Lieferdatum</Label><input value={draft.delivery_date} onChange={e => set('delivery_date', e.target.value)} placeholder="z.B. 14.06.2025" style={inputStyle()} /></div>
        <div><Label>Uhrzeit</Label><input value={draft.delivery_time} onChange={e => set('delivery_time', e.target.value)} placeholder="z.B. 10:00" style={inputStyle()} /></div>
        <div><Label>Aufstellort</Label><input value={draft.setup_location} onChange={e => set('setup_location', e.target.value)} placeholder="z.B. Saal A" style={inputStyle()} /></div>
      </div>

      {/* Kühlung */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <input type="checkbox" id="cooling" checked={draft.cooling_required} onChange={e => set('cooling_required', e.target.checked)} />
        <label htmlFor="cooling" style={{ fontSize: 13, fontWeight: 500 }}>Kühlung erforderlich</label>
        {draft.cooling_required && (
          <input value={draft.cooling_notes} onChange={e => set('cooling_notes', e.target.value)} placeholder="Details zur Kühlung" style={{ flex: 1, ...inputStyle() }} />
        )}
      </div>

      {/* Torte */}
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Hochzeitstorte</p>
      <div style={{ marginBottom: 10 }}>
        <Label>Beschreibung</Label>
        <textarea value={draft.cake_description} onChange={e => set('cake_description', e.target.value)} rows={3} placeholder="Beschreibung der Torte…" style={{ ...inputStyle(), resize: 'vertical' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><Label>Etagen</Label><input type="number" min={1} max={10} value={draft.layers} onChange={e => set('layers', Number(e.target.value))} style={inputStyle()} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
          <input type="checkbox" id="cake_table" checked={draft.cake_table_provided} onChange={e => set('cake_table_provided', e.target.checked)} />
          <label htmlFor="cake_table" style={{ fontSize: 13 }}>Tortenständer wird gestellt</label>
        </div>
      </div>

      {/* Geschmacksrichtungen */}
      <Label>Geschmacksrichtungen</Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {FLAVORS.map(f => (
          <button key={f} onClick={() => toggleFlavor(f)} style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: draft.flavors.includes(f) ? 'var(--accent)' : 'var(--surface)', color: draft.flavors.includes(f) ? '#fff' : 'var(--text-secondary)' }}>
            {f}
          </button>
        ))}
        <div style={{ display: 'flex', gap: 4 }}>
          <input value={newFlavor} onChange={e => setNewFlavor(e.target.value)} placeholder="Anderer…" style={{ width: 100, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, fontFamily: 'inherit' }} />
          <button onClick={() => { if (newFlavor.trim()) { set('flavors', [...draft.flavors, newFlavor.trim()]); setNewFlavor('') } }} style={{ padding: '5px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}><Plus size={12} /></button>
        </div>
      </div>

      {/* Diäthinweise */}
      <div style={{ marginBottom: 16 }}>
        <Label>Diät- & Allergenhinweise</Label>
        <input value={draft.dietary_notes} onChange={e => set('dietary_notes', e.target.value)} placeholder="z.B. glutenfrei auf Anfrage" style={inputStyle()} />
      </div>

      {/* Dessert-Buffet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <input type="checkbox" id="dessert" checked={draft.dessert_buffet} onChange={e => set('dessert_buffet', e.target.checked)} />
        <label htmlFor="dessert" style={{ fontSize: 13, fontWeight: 500 }}>Dessert-Buffet</label>
      </div>
      {draft.dessert_buffet && (
        <div style={{ marginBottom: 16 }}>
          <Label>Dessert-Items</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
            {draft.dessert_items.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', borderRadius: 4, padding: '6px 10px', border: '1px solid var(--border)' }}>
                <span style={{ flex: 1, fontSize: 13 }}>{item}</span>
                <button onClick={() => set('dessert_items', draft.dessert_items.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30' }}><X size={12} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newDessertItem} onChange={e => setNewDessertItem(e.target.value)} placeholder="Dessert hinzufügen…" onKeyDown={e => { if (e.key === 'Enter' && newDessertItem.trim()) { set('dessert_items', [...draft.dessert_items, newDessertItem.trim()]); setNewDessertItem('') } }} style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={() => { if (newDessertItem.trim()) { set('dessert_items', [...draft.dessert_items, newDessertItem.trim()]); setNewDessertItem('') } }} style={{ padding: '7px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}><Plus size={14} /></button>
          </div>
        </div>
      )}

      {/* Preis + Notizen */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div>
          <Label>Preis (€)</Label>
          <input type="number" min={0} value={draft.price} onChange={e => set('price', Number(e.target.value))} style={inputStyle()} />
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <Label>Hinweise an Konditorei</Label>
        <textarea value={draft.vendor_notes} onChange={e => set('vendor_notes', e.target.value)} rows={3} placeholder="Weitere Informationen für den Dienstleister…" style={{ ...inputStyle(), resize: 'vertical' }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving} style={{ padding: '9px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
        <button onClick={onCancel} style={{ padding: '9px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer' }}>Abbrechen</button>
      </div>
    </div>
  )
}

// ── Read View ─────────────────────────────────────────────────────────────────

function PatisserieReadView({ config, canEdit, onEdit, mode, onPropose }: {
  config: PatisserieConfig | null
  canEdit: boolean
  onEdit: () => void
  mode: 'veranstalter' | 'dienstleister'
  onPropose?: () => void
}) {
  if (!config) {
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
        {canEdit ? (
          <button onClick={onEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 14, fontFamily: 'inherit' }}>
            + Patisserie-Informationen hinzufügen
          </button>
        ) : (
          'Noch keine Patisserie-Informationen hinterlegt.'
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Lieferung */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Lieferung</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {config.delivery_date && <InfoCard icon={<Clock size={13} />} label="Datum" value={config.delivery_date} />}
          {config.delivery_time && <InfoCard icon={<Clock size={13} />} label="Uhrzeit" value={config.delivery_time} />}
          {config.setup_location && <InfoCard icon={<MapPin size={13} />} label="Aufstellort" value={config.setup_location} />}
        </div>
      </div>

      {config.cooling_required && (
        <div style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.25)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Thermometer size={16} style={{ color: '#FF9500', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#FF9500', marginBottom: 2 }}>Kühlung erforderlich</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{config.cooling_notes || 'Bitte kühl lagern'}</p>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Hochzeitstorte</p>
        {config.cake_description && <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.6 }}>{config.cake_description}</p>}
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
          {config.layers > 0 && <span>{config.layers} Etagen</span>}
          {config.cake_table_provided && <span>Tortenständer wird gestellt</span>}
        </div>
        {config.flavors?.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {config.flavors.map(f => (
              <span key={f} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, background: '#F0F0F2', color: 'var(--text-secondary)' }}>{f}</span>
            ))}
          </div>
        )}
        {config.dietary_notes && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{config.dietary_notes}</p>}
      </div>

      {config.dessert_buffet && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Dessert-Buffet</p>
          {config.dessert_items?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {config.dessert_items.map(item => (
                <div key={item} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>{item}</div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Details folgen</p>
          )}
        </div>
      )}

      {config.vendor_notes && (
        <div style={{ background: '#F5F5F7', borderRadius: 'var(--radius)', padding: '16px 20px', border: '1px solid var(--border)', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Hinweise vom Veranstalter</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{config.vendor_notes}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {canEdit && (
          <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Edit2 size={13} /> Bearbeiten
          </button>
        )}
        {!canEdit && mode === 'dienstleister' && onPropose && (
          <button onClick={onPropose} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
            <Lightbulb size={13} /> Änderung vorschlagen
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PatisserieTabContent({ eventId, mode, hasFullModuleAccess = true, onPropose }: Props) {
  const [config, setConfig]   = useState<PatisserieConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('patisserie_config').select('*').eq('event_id', eventId).single()
      .then(({ data }) => { setConfig(data ?? null); setLoading(false) })
  }, [eventId])

  const canEdit = mode === 'veranstalter' || hasFullModuleAccess

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>Patisserie</h1>
        {mode === 'dienstleister' && onPropose && !canEdit && (
          <button onClick={onPropose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
            <Lightbulb size={14} /> Vorschlag erstellen
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
      ) : editing ? (
        <PatisserieEditForm config={config} eventId={eventId} onSaved={c => { setConfig(c); setEditing(false) }} onCancel={() => setEditing(false)} />
      ) : (
        <PatisserieReadView config={config} canEdit={canEdit} onEdit={() => setEditing(true)} mode={mode} onPropose={onPropose} />
      )}
    </div>
  )
}
