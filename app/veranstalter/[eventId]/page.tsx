'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ImageIcon, Trash2, Plus } from 'lucide-react'
import { useEvent } from '@/lib/event-context'
import { saveEvent } from '@/lib/store'
import type {
  OrganizerVendorSuggestion,
  OrganizerHotelSuggestion,
  OrganizerCateringSuggestion,
  OrganizerSuggestionStatus,
  DekoSuggestion,
  FeatureKey,
  OrganizerSettings,
} from '@/lib/store'
import { DEFAULT_FEATURE_TOGGLES } from '@/lib/store'
import { v4 as uuid } from 'uuid'

// ── Helpers ────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9) }

function fmtMoney(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function getOrganizer(event: NonNullable<ReturnType<typeof useEvent>['event']>): OrganizerSettings {
  return event.organizer ?? {
    vendorSuggestions: [],
    hotelSuggestions: [],
    cateringSuggestions: [],
    dekoSuggestions: [],
    featureToggles: { ...DEFAULT_FEATURE_TOGGLES },
    locationImages: [],
  }
}

// ── Styles ─────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px',
  background: '#FFFFFF', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', fontSize: 14, color: 'var(--text)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 9, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.12em',
  color: 'var(--text-dim)', marginBottom: 6,
}

const VENDOR_CATEGORIES = [
  'Fotograf','Videograf','Catering','Floristik','Musik / Band',
  'DJ','Location','Hochzeitsplaner','Transport','Konditorei','Sonstiges',
] as const

const CATERING_STYLES = [
  { value: 'klassisch', label: 'Klassisch' },
  { value: 'buffet',    label: 'Buffet' },
  { value: 'family',   label: 'Family Style' },
  { value: 'foodtruck', label: 'Food Truck' },
  { value: 'live',      label: 'Live Cooking' },
] as const

const FEATURE_LABELS: Record<FeatureKey, string> = {
  budget:          'Budget',
  vendors:         'Dienstleister',
  tasks:           'Aufgaben',
  reminders:       'Erinnerungen',
  seating:         'Sitzplan',
  catering:        'Catering & Menü',
  'sub-events':    'Sub-Events',
  invite:          'Einladen',
  deko:            'Dekoration',
  'gaeste-fotos':  'Gäste-Fotos',
  messaging:       'Nachrichten',
}

const STATUS_COLORS: Record<OrganizerSuggestionStatus, string> = {
  vorschlag:  'var(--text-dim)',
  angenommen: 'var(--green)',
  abgelehnt:  'var(--red)',
}

const STATUS_LABELS: Record<OrganizerSuggestionStatus, string> = {
  vorschlag:  'Vorschlag',
  angenommen: 'Angenommen',
  abgelehnt:  'Abgelehnt',
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrganizerSuggestionStatus }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
      color: STATUS_COLORS[status], padding: '2px 8px',
      background: status === 'angenommen' ? 'rgba(61,122,86,0.1)' : status === 'abgelehnt' ? 'rgba(160,64,64,0.1)' : 'var(--bg)',
      borderRadius: 20,
    }}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, padding: 2,
        background: checked ? 'var(--gold)' : 'var(--border)',
        border: 'none', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.2s',
        position: 'relative',
      }}
    >
      <span style={{
        display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2,
        left: checked ? 22 : 2,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

// ── Vendor Suggestions Tab ─────────────────────────────────────────────────
function VendorTab() {
  const { event, updateEvent } = useEvent()
  const org = event ? getOrganizer(event) : null
  const suggestions = org?.vendorSuggestions ?? []

  const blank = (): Omit<OrganizerVendorSuggestion, 'id'> => ({
    name: '', category: 'Sonstiges', description: '',
    priceEstimate: 0, contactEmail: '', contactPhone: '', status: 'vorschlag',
  })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blank())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, OrganizerVendorSuggestion>>({})

  const save = () => {
    if (!event || !form.name.trim()) return
    const newItem: OrganizerVendorSuggestion = { ...form, id: uid() }
    const org = getOrganizer(event)
    const updated = { ...event, organizer: { ...org, vendorSuggestions: [...org.vendorSuggestions, newItem] } }
    updateEvent(updated); saveEvent(updated)
    setForm(blank()); setShowForm(false)
  }

  const remove = (id: string) => {
    if (!event) return
    const org = getOrganizer(event)
    const updated = { ...event, organizer: { ...org, vendorSuggestions: org.vendorSuggestions.filter(v => v.id !== id) } }
    updateEvent(updated); saveEvent(updated)
    if (expanded === id) setExpanded(null)
  }

  const saveEdit = (id: string) => {
    if (!event) return
    const draft = drafts[id]; if (!draft) return
    const org = getOrganizer(event)
    const updated = { ...event, organizer: { ...org, vendorSuggestions: org.vendorSuggestions.map(v => v.id === id ? draft : v) } }
    updateEvent(updated); saveEvent(updated)
    setEditId(null)
  }

  const patchDraft = (id: string, patch: Partial<OrganizerVendorSuggestion>) =>
    setDrafts(d => ({ ...d, [id]: { ...d[id], ...patch } }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{suggestions.length} Vorschläge</p>
        <button
          onClick={() => setShowForm(s => !s)}
          style={{
            background: 'var(--gold)', color: '#fff', border: 'none',
            borderRadius: 'var(--r-sm)', padding: '9px 16px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + Hinzufügen
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--gold-pale)', border: '1px solid var(--gold)', borderRadius: 'var(--r-md)', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Studio Lichtblick" />
              </div>
              <div>
                <label style={labelStyle}>Kategorie</label>
                <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))}>
                  {VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Geschätzte Kosten (€)</label>
                <input style={inputStyle} type="number" min={0} value={form.priceEstimate || ''} onChange={e => setForm(f => ({ ...f, priceEstimate: Number(e.target.value) }))} placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as OrganizerSuggestionStatus }))}>
                  <option value="vorschlag">Vorschlag</option>
                  <option value="angenommen">Angenommen</option>
                  <option value="abgelehnt">Abgelehnt</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Beschreibung</label>
              <textarea style={{ ...inputStyle, height: 72, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Kurze Beschreibung des Dienstleisters …" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>E-Mail</label>
                <input style={inputStyle} type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="kontakt@example.de" />
              </div>
              <div>
                <label style={labelStyle}>Telefon</label>
                <input style={inputStyle} value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="+49 …" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setForm(blank()) }} style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={save} style={{ padding: '8px 16px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestions.map(item => {
          const isOpen = expanded === item.id
          const isEdit = editId === item.id
          const draft = drafts[item.id] ?? item
          return (
            <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', overflow: 'hidden' }}>
              <button
                onClick={() => setExpanded(isOpen ? null : item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{item.category} · {fmtMoney(item.priceEstimate)}</div>
                </div>
                <StatusBadge status={item.status} />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth={2} style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isOpen && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                  {isEdit ? (
                    <div style={{ display: 'grid', gap: 10, paddingTop: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><label style={labelStyle}>Name</label><input style={inputStyle} value={draft.name} onChange={e => patchDraft(item.id, { name: e.target.value })} /></div>
                        <div><label style={labelStyle}>Kategorie</label><select style={inputStyle} value={draft.category} onChange={e => patchDraft(item.id, { category: e.target.value as any })}>{VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><label style={labelStyle}>Kosten (€)</label><input style={inputStyle} type="number" min={0} value={draft.priceEstimate || ''} onChange={e => patchDraft(item.id, { priceEstimate: Number(e.target.value) })} /></div>
                        <div><label style={labelStyle}>Status</label><select style={inputStyle} value={draft.status} onChange={e => patchDraft(item.id, { status: e.target.value as OrganizerSuggestionStatus })}><option value="vorschlag">Vorschlag</option><option value="angenommen">Angenommen</option><option value="abgelehnt">Abgelehnt</option></select></div>
                      </div>
                      <div><label style={labelStyle}>Beschreibung</label><textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={draft.description} onChange={e => patchDraft(item.id, { description: e.target.value })} /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><label style={labelStyle}>E-Mail</label><input style={inputStyle} value={draft.contactEmail ?? ''} onChange={e => patchDraft(item.id, { contactEmail: e.target.value })} /></div>
                        <div><label style={labelStyle}>Telefon</label><input style={inputStyle} value={draft.contactPhone ?? ''} onChange={e => patchDraft(item.id, { contactPhone: e.target.value })} /></div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditId(null)} style={{ padding: '7px 13px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Abbrechen</button>
                        <button onClick={() => saveEdit(item.id)} style={{ padding: '7px 14px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Speichern</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ paddingTop: 10 }}>
                      {item.description && <p style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 8 }}>{item.description}</p>}
                      {(item.contactEmail || item.contactPhone) && (
                        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
                          {item.contactEmail && <span>{item.contactEmail}</span>}
                          {item.contactEmail && item.contactPhone && ' · '}
                          {item.contactPhone && <span>{item.contactPhone}</span>}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setDrafts(d => ({ ...d, [item.id]: item })); setEditId(item.id) }} style={{ padding: '7px 13px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Bearbeiten</button>
                        <button onClick={() => remove(item.id)} style={{ padding: '7px 13px', border: '1px solid var(--red)', borderRadius: 8, background: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Löschen</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {suggestions.length === 0 && !showForm && (
          <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, padding: '32px 0' }}>Noch keine Dienstleister vorgeschlagen.</p>
        )}
      </div>
    </div>
  )
}

// ── Hotel Suggestions Tab ──────────────────────────────────────────────────
function HotelTab() {
  const { event, updateEvent } = useEvent()
  const org = event ? getOrganizer(event) : null
  const suggestions = org?.hotelSuggestions ?? []

  const blank = (): Omit<OrganizerHotelSuggestion, 'id'> => ({
    name: '', address: '', distanceKm: 0, pricePerNight: 0, totalRooms: 0, description: '', status: 'vorschlag',
  })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blank())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, OrganizerHotelSuggestion>>({})

  const save = () => {
    if (!event || !form.name.trim()) return
    const newItem: OrganizerHotelSuggestion = { ...form, id: uid() }
    const org = getOrganizer(event)
    const updated = { ...event, organizer: { ...org, hotelSuggestions: [...org.hotelSuggestions, newItem] } }
    updateEvent(updated); saveEvent(updated)
    setForm(blank()); setShowForm(false)
  }

  const remove = (id: string) => {
    if (!event) return
    const org = getOrganizer(event)
    const updated = { ...event, organizer: { ...org, hotelSuggestions: org.hotelSuggestions.filter(h => h.id !== id) } }
    updateEvent(updated); saveEvent(updated)
    if (expanded === id) setExpanded(null)
  }

  const saveEdit = (id: string) => {
    if (!event) return
    const draft = drafts[id]; if (!draft) return
    const org = getOrganizer(event)
    const updated = { ...event, organizer: { ...org, hotelSuggestions: org.hotelSuggestions.map(h => h.id === id ? draft : h) } }
    updateEvent(updated); saveEvent(updated)
    setEditId(null)
  }

  const patchDraft = (id: string, patch: Partial<OrganizerHotelSuggestion>) =>
    setDrafts(d => ({ ...d, [id]: { ...d[id], ...patch } }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{suggestions.length} Vorschläge</p>
        <button onClick={() => setShowForm(s => !s)} style={{ background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Hinzufügen</button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--gold-pale)', border: '1px solid var(--gold)', borderRadius: 'var(--r-md)', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={labelStyle}>Hotelname *</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Schlosshotel Neuhof" />
            </div>
            <div>
              <label style={labelStyle}>Adresse</label>
              <input style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Straße, PLZ Stadt" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Entfernung (km)</label>
                <input style={inputStyle} type="number" min={0} step={0.1} value={form.distanceKm || ''} onChange={e => setForm(f => ({ ...f, distanceKm: Number(e.target.value) }))} placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>Preis / Nacht (€)</label>
                <input style={inputStyle} type="number" min={0} value={form.pricePerNight || ''} onChange={e => setForm(f => ({ ...f, pricePerNight: Number(e.target.value) }))} placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>Zimmer verfügbar</label>
                <input style={inputStyle} type="number" min={0} value={form.totalRooms || ''} onChange={e => setForm(f => ({ ...f, totalRooms: Number(e.target.value) }))} placeholder="0" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Beschreibung</label>
              <textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as OrganizerSuggestionStatus }))}>
                <option value="vorschlag">Vorschlag</option><option value="angenommen">Angenommen</option><option value="abgelehnt">Abgelehnt</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setForm(blank()) }} style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={save} style={{ padding: '8px 16px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestions.map(item => {
          const isOpen = expanded === item.id
          const isEdit = editId === item.id
          const draft = drafts[item.id] ?? item
          return (
            <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', overflow: 'hidden' }}>
              <button onClick={() => setExpanded(isOpen ? null : item.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                    {fmtMoney(item.pricePerNight)}/Nacht · {item.distanceKm} km · {item.totalRooms} Zimmer
                  </div>
                </div>
                <StatusBadge status={item.status} />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth={2} style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {isOpen && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                  {isEdit ? (
                    <div style={{ display: 'grid', gap: 10, paddingTop: 12 }}>
                      <div><label style={labelStyle}>Name</label><input style={inputStyle} value={draft.name} onChange={e => patchDraft(item.id, { name: e.target.value })} /></div>
                      <div><label style={labelStyle}>Adresse</label><input style={inputStyle} value={draft.address} onChange={e => patchDraft(item.id, { address: e.target.value })} /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <div><label style={labelStyle}>Entfernung (km)</label><input style={inputStyle} type="number" min={0} step={0.1} value={draft.distanceKm || ''} onChange={e => patchDraft(item.id, { distanceKm: Number(e.target.value) })} /></div>
                        <div><label style={labelStyle}>Preis / Nacht</label><input style={inputStyle} type="number" min={0} value={draft.pricePerNight || ''} onChange={e => patchDraft(item.id, { pricePerNight: Number(e.target.value) })} /></div>
                        <div><label style={labelStyle}>Zimmer</label><input style={inputStyle} type="number" min={0} value={draft.totalRooms || ''} onChange={e => patchDraft(item.id, { totalRooms: Number(e.target.value) })} /></div>
                      </div>
                      <div><label style={labelStyle}>Beschreibung</label><textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={draft.description} onChange={e => patchDraft(item.id, { description: e.target.value })} /></div>
                      <div><label style={labelStyle}>Status</label><select style={inputStyle} value={draft.status} onChange={e => patchDraft(item.id, { status: e.target.value as OrganizerSuggestionStatus })}><option value="vorschlag">Vorschlag</option><option value="angenommen">Angenommen</option><option value="abgelehnt">Abgelehnt</option></select></div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditId(null)} style={{ padding: '7px 13px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Abbrechen</button>
                        <button onClick={() => saveEdit(item.id)} style={{ padding: '7px 14px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Speichern</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ paddingTop: 10 }}>
                      {item.address && <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>{item.address}</p>}
                      {item.description && <p style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 10 }}>{item.description}</p>}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setDrafts(d => ({ ...d, [item.id]: item })); setEditId(item.id) }} style={{ padding: '7px 13px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Bearbeiten</button>
                        <button onClick={() => remove(item.id)} style={{ padding: '7px 13px', border: '1px solid var(--red)', borderRadius: 8, background: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Löschen</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {suggestions.length === 0 && !showForm && (
          <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, padding: '32px 0' }}>Noch keine Hotels vorgeschlagen.</p>
        )}
      </div>
    </div>
  )
}

// ── Catering Suggestions Tab ───────────────────────────────────────────────
function CateringTab() {
  const { event, updateEvent } = useEvent()
  const org = event ? getOrganizer(event) : null
  const suggestions = org?.cateringSuggestions ?? []

  const blank = (): Omit<OrganizerCateringSuggestion, 'id'> => ({
    name: '', style: 'klassisch', pricePerPerson: 0, description: '', contactEmail: '', status: 'vorschlag',
  })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blank())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, OrganizerCateringSuggestion>>({})

  const save = () => {
    if (!event || !form.name.trim()) return
    const newItem: OrganizerCateringSuggestion = { ...form, id: uid() }
    const org = getOrganizer(event)
    const updated = { ...event, organizer: { ...org, cateringSuggestions: [...org.cateringSuggestions, newItem] } }
    updateEvent(updated); saveEvent(updated)
    setForm(blank()); setShowForm(false)
  }

  const remove = (id: string) => {
    if (!event) return
    const org = getOrganizer(event)
    const updated = { ...event, organizer: { ...org, cateringSuggestions: org.cateringSuggestions.filter(c => c.id !== id) } }
    updateEvent(updated); saveEvent(updated)
    if (expanded === id) setExpanded(null)
  }

  const saveEdit = (id: string) => {
    if (!event) return
    const draft = drafts[id]; if (!draft) return
    const org = getOrganizer(event)
    const updated = { ...event, organizer: { ...org, cateringSuggestions: org.cateringSuggestions.map(c => c.id === id ? draft : c) } }
    updateEvent(updated); saveEvent(updated)
    setEditId(null)
  }

  const patchDraft = (id: string, patch: Partial<OrganizerCateringSuggestion>) =>
    setDrafts(d => ({ ...d, [id]: { ...d[id], ...patch } }))

  const styleLabel = (v: string) => CATERING_STYLES.find(s => s.value === v)?.label ?? v

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{suggestions.length} Vorschläge</p>
        <button onClick={() => setShowForm(s => !s)} style={{ background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Hinzufügen</button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--gold-pale)', border: '1px solid var(--gold)', borderRadius: 'var(--r-md)', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Name *</label><input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Küche & Kunst GmbH" /></div>
              <div><label style={labelStyle}>Service-Stil</label>
                <select style={inputStyle} value={form.style} onChange={e => setForm(f => ({ ...f, style: e.target.value as any }))}>
                  {CATERING_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Preis / Person (€)</label><input style={inputStyle} type="number" min={0} value={form.pricePerPerson || ''} onChange={e => setForm(f => ({ ...f, pricePerPerson: Number(e.target.value) }))} placeholder="0" /></div>
              <div><label style={labelStyle}>Status</label>
                <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as OrganizerSuggestionStatus }))}>
                  <option value="vorschlag">Vorschlag</option><option value="angenommen">Angenommen</option><option value="abgelehnt">Abgelehnt</option>
                </select>
              </div>
            </div>
            <div><label style={labelStyle}>Beschreibung</label><textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><label style={labelStyle}>E-Mail</label><input style={inputStyle} type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="kontakt@caterer.de" /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setForm(blank()) }} style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={save} style={{ padding: '8px 16px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestions.map(item => {
          const isOpen = expanded === item.id
          const isEdit = editId === item.id
          const draft = drafts[item.id] ?? item
          return (
            <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', overflow: 'hidden' }}>
              <button onClick={() => setExpanded(isOpen ? null : item.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{styleLabel(item.style)} · {fmtMoney(item.pricePerPerson)}/Person</div>
                </div>
                <StatusBadge status={item.status} />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth={2} style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {isOpen && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                  {isEdit ? (
                    <div style={{ display: 'grid', gap: 10, paddingTop: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><label style={labelStyle}>Name</label><input style={inputStyle} value={draft.name} onChange={e => patchDraft(item.id, { name: e.target.value })} /></div>
                        <div><label style={labelStyle}>Stil</label><select style={inputStyle} value={draft.style} onChange={e => patchDraft(item.id, { style: e.target.value as any })}>{CATERING_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><label style={labelStyle}>Preis / Person</label><input style={inputStyle} type="number" min={0} value={draft.pricePerPerson || ''} onChange={e => patchDraft(item.id, { pricePerPerson: Number(e.target.value) })} /></div>
                        <div><label style={labelStyle}>Status</label><select style={inputStyle} value={draft.status} onChange={e => patchDraft(item.id, { status: e.target.value as OrganizerSuggestionStatus })}><option value="vorschlag">Vorschlag</option><option value="angenommen">Angenommen</option><option value="abgelehnt">Abgelehnt</option></select></div>
                      </div>
                      <div><label style={labelStyle}>Beschreibung</label><textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={draft.description} onChange={e => patchDraft(item.id, { description: e.target.value })} /></div>
                      <div><label style={labelStyle}>E-Mail</label><input style={inputStyle} value={draft.contactEmail ?? ''} onChange={e => patchDraft(item.id, { contactEmail: e.target.value })} /></div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditId(null)} style={{ padding: '7px 13px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Abbrechen</button>
                        <button onClick={() => saveEdit(item.id)} style={{ padding: '7px 14px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Speichern</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ paddingTop: 10 }}>
                      {item.description && <p style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 8 }}>{item.description}</p>}
                      {item.contactEmail && <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>{item.contactEmail}</p>}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setDrafts(d => ({ ...d, [item.id]: item })); setEditId(item.id) }} style={{ padding: '7px 13px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Bearbeiten</button>
                        <button onClick={() => remove(item.id)} style={{ padding: '7px 13px', border: '1px solid var(--red)', borderRadius: 8, background: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Löschen</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {suggestions.length === 0 && !showForm && (
          <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, padding: '32px 0' }}>Noch keine Catering-Optionen vorgeschlagen.</p>
        )}
      </div>
    </div>
  )
}

// ── Feature Toggles Tab ────────────────────────────────────────────────────
function FunktionenTab() {
  const { event, updateEvent } = useEvent()
  if (!event) return null
  const org = getOrganizer(event)
  const toggles = { ...DEFAULT_FEATURE_TOGGLES, ...org.featureToggles }

  const setToggle = (key: FeatureKey, val: boolean) => {
    const newToggles = { ...toggles, [key]: val }
    const updated = { ...event, organizer: { ...org, featureToggles: newToggles } }
    updateEvent(updated); saveEvent(updated)
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>
        Aktiviere oder deaktiviere Funktionen für das Brautpaar. Deaktivierte Funktionen werden im Navigationsmenü ausgeblendet.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map(key => (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', background: 'var(--surface)',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{FEATURE_LABELS[key]}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>/{key}</div>
            </div>
            <ToggleSwitch checked={toggles[key]} onChange={v => setToggle(key, v)} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Deko Suggestions Tab ───────────────────────────────────────────────────
function DekoTab() {
  const { event, updateEvent } = useEvent()
  const fileRef = useRef<HTMLInputElement>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', imageUrl: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DekoSuggestion>>({})

  if (!event) return null
  const org = getOrganizer(event)
  const suggestions: DekoSuggestion[] = org.dekoSuggestions ?? []

  const readFile = (file: File): Promise<string> =>
    new Promise(res => {
      const reader = new FileReader()
      reader.onload = e => res(e.target?.result as string)
      reader.readAsDataURL(file)
    })

  const handleFormImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const dataUrl = await readFile(file)
    setForm(f => ({ ...f, imageUrl: dataUrl }))
  }

  const save = () => {
    if (!form.title.trim()) return
    const newItem: DekoSuggestion = { id: uuid(), title: form.title.trim(), description: form.description.trim(), imageUrl: form.imageUrl || undefined, status: 'vorschlag' }
    const updated = { ...event, organizer: { ...org, dekoSuggestions: [...suggestions, newItem] } }
    updateEvent(updated); saveEvent(updated)
    setForm({ title: '', description: '', imageUrl: '' }); setShowForm(false)
  }

  const remove = (id: string) => {
    const updated = { ...event, organizer: { ...org, dekoSuggestions: suggestions.filter(s => s.id !== id) } }
    updateEvent(updated); saveEvent(updated)
  }

  const saveEdit = (id: string) => {
    const draft = drafts[id]; if (!draft) return
    const updated = { ...event, organizer: { ...org, dekoSuggestions: suggestions.map(s => s.id === id ? draft : s) } }
    updateEvent(updated); saveEvent(updated)
    setEditId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{suggestions.length} Vorschläge</p>
        <button onClick={() => setShowForm(s => !s)} style={{ background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Hinzufügen
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--gold-pale)', border: '1px solid var(--gold)', borderRadius: 'var(--r-md)', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={labelStyle}>Titel *</label>
              <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="z.B. Romantische Tischblumen" />
            </div>
            <div>
              <label style={labelStyle}>Beschreibung</label>
              <textarea style={{ ...inputStyle, height: 72, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Kurze Beschreibung …" />
            </div>
            <div>
              <label style={labelStyle}>Bild (optional)</label>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFormImage} />
              {form.imageUrl ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={form.imageUrl} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                  <button onClick={() => setForm(f => ({ ...f, imageUrl: '' }))} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} style={{ padding: '8px 14px', border: '1px dashed var(--border)', borderRadius: 'var(--r-sm)', background: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ImageIcon size={13} /> Bild hochladen
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setForm({ title: '', description: '', imageUrl: '' }) }} style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={save} style={{ padding: '8px 16px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {suggestions.map(item => {
          const isEdit = editId === item.id
          const draft = drafts[item.id] ?? item
          return (
            <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', overflow: 'hidden' }}>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.title} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ImageIcon size={24} style={{ color: 'var(--text-dim)', opacity: 0.3 }} />
                </div>
              )}
              <div style={{ padding: '10px 12px' }}>
                {isEdit ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <input style={{ ...inputStyle, fontSize: 13 }} value={draft.title} onChange={e => setDrafts(d => ({ ...d, [item.id]: { ...draft, title: e.target.value } }))} />
                    <textarea style={{ ...inputStyle, fontSize: 12, height: 56, resize: 'vertical' }} value={draft.description} onChange={e => setDrafts(d => ({ ...d, [item.id]: { ...draft, description: e.target.value } }))} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => saveEdit(item.id)} style={{ flex: 1, padding: '6px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Speichern</button>
                      <button onClick={() => setEditId(null)} style={{ flex: 1, padding: '6px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{item.title}</p>
                    {item.description && <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4, marginBottom: 6 }}>{item.description}</p>}
                    <StatusBadge status={item.status} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button onClick={() => { setEditId(item.id); setDrafts(d => ({ ...d, [item.id]: item })) }} style={{ flex: 1, padding: '5px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--text-dim)' }}>Bearbeiten</button>
                      <button onClick={() => remove(item.id)} style={{ padding: '5px 8px', border: 'none', borderRadius: 6, background: 'var(--red-pale)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={12} style={{ color: 'var(--red)' }} /></button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {suggestions.length === 0 && !showForm && (
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-dim)', padding: '32px 0' }}>Noch keine Deko-Vorschläge. Füge Bilder und Ideen hinzu.</p>
      )}
    </div>
  )
}

// ── Location Images Tab ────────────────────────────────────────────────────
function LocationTab() {
  const { event, updateEvent } = useEvent()
  const fileRef = useRef<HTMLInputElement>(null)
  if (!event) return null
  const org = getOrganizer(event)
  const images = org.locationImages

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const readers: Promise<string>[] = []
    Array.from(files).forEach(file => {
      readers.push(new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      }))
    })
    Promise.all(readers).then(newImages => {
      const updated = { ...event, organizer: { ...org, locationImages: [...images, ...newImages] } }
      updateEvent(updated); saveEvent(updated)
    })
  }

  const removeImage = (idx: number) => {
    const updated = { ...event, organizer: { ...org, locationImages: images.filter((_, i) => i !== idx) } }
    updateEvent(updated); saveEvent(updated)
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>
        Lade Bilder der Location hoch. Diese können später im Brautpaar-Bereich angezeigt werden.
      </p>

      <div
        onClick={() => fileRef.current?.click()}
        style={{
          border: '2px dashed var(--border)', borderRadius: 'var(--r-md)',
          padding: '28px 16px', textAlign: 'center', cursor: 'pointer',
          marginBottom: 20, transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: 0 }}>Bilder hochladen</p>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 0' }}>JPG, PNG, WebP</p>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      </div>

      {images.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {images.map((src, idx) => (
            <div key={idx} style={{ position: 'relative', borderRadius: 'var(--r-sm)', overflow: 'hidden', aspectRatio: '4/3', background: 'var(--bg)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Location ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <button
                onClick={() => removeImage(idx)}
                style={{
                  position: 'absolute', top: 6, right: 6,
                  background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
                  width: 26, height: 26, cursor: 'pointer', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, padding: '8px 0' }}>Noch keine Bilder hochgeladen.</p>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
type TabId = 'dienstleister' | 'hotels' | 'catering' | 'funktionen' | 'deko' | 'location'

const TABS: { id: TabId; label: string }[] = [
  { id: 'dienstleister', label: 'Dienstleister' },
  { id: 'hotels',        label: 'Hotels' },
  { id: 'catering',      label: 'Catering' },
  { id: 'funktionen',    label: 'Funktionen' },
  { id: 'deko',          label: 'Deko' },
  { id: 'location',      label: 'Location' },
]

export default function VeranstalterEventPage({ params }: { params: { eventId: string } }) {
  const [tab, setTab] = useState<TabId>('dienstleister')
  const router = useRouter()
  const { currentRole, event, switchEvent } = useEvent()

  // Switch to the event specified in the URL if it differs from the currently loaded event
  useEffect(() => {
    if (params.eventId && event?.id !== params.eventId) {
      switchEvent(params.eventId)
    }
  }, [params.eventId, event?.id, switchEvent])

  if (currentRole !== null && currentRole !== 'veranstalter') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24, textAlign: 'center' }}>
        <div>
          <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Kein Zugriff</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Dieser Bereich ist nur für Veranstalter zugänglich.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 48px' }}>
      {/* Back link */}
      <button
        onClick={() => router.push('/veranstalter')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0 0 20px', fontFamily: 'inherit',
          fontSize: 13, color: 'var(--text-dim)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
        Alle Events
      </button>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--heading-font)', fontSize: 26, fontWeight: 500, color: 'var(--text)', margin: '0 0 6px' }}>
          {event?.coupleName ?? 'Event verwalten'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
          Verwalte Vorschläge, Funktionen und Location-Materialien für das Brautpaar.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--gold)' : 'var(--text-dim)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--gold)' : 'transparent'}`,
              marginBottom: -1, whiteSpace: 'nowrap', transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dienstleister' && <VendorTab />}
      {tab === 'hotels'        && <HotelTab />}
      {tab === 'catering'      && <CateringTab />}
      {tab === 'funktionen'    && <FunktionenTab />}
      {tab === 'deko'          && <DekoTab />}
      {tab === 'location'      && <LocationTab />}
    </div>
  )
}
