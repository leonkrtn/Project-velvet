'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Hotel, Mail, Settings, Plus, Copy, Check, Trash2, Link as LinkIcon, RefreshCw } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Guest {
  id: string
  name: string
  attending: string
  side: string | null
  meal_choice: string | null
  allergy_tags: string[] | null
  allergy_custom: string | null
  email: string | null
  phone: string | null
  hotel_room_id: string | null
  plus_one_allowed: boolean
  notes: string | null
  invite_code_id: string | null
}

interface HotelRoom {
  id: string
  room_type: string | null
  room_number: string | null
  max_occupancy: number
}

interface Hotel {
  id: string
  name: string
  hotel_rooms: HotelRoom[]
}

interface InviteCode {
  id: string
  code: string
  role: string
  expires_at: string | null
  max_uses: number | null
  use_count: number
  created_at: string
}

interface RsvpSettings {
  id: string
  event_id: string
  invitation_text: string
  rsvp_deadline: string | null
  show_meal_choice: boolean
  show_plus_one: boolean
}

interface Props {
  eventId: string
  userId: string
  initialGuests: Guest[]
  mealOptions: string[]
  childrenAllowed: boolean
  hotels: Hotel[]
  inviteCodes: InviteCode[]
  rsvpSettings: RsvpSettings | null
}

// ── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'gaesteliste' | 'hotel' | 'rsvp' | 'einstellungen'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'gaesteliste', label: 'Gästeliste', icon: <Users size={15} /> },
  { key: 'hotel',       label: 'Hotel',      icon: <Hotel size={15} /> },
  { key: 'rsvp',        label: 'RSVP-Einladungen', icon: <Mail size={15} /> },
  { key: 'einstellungen', label: 'Gäste-Einstellungen', icon: <Settings size={15} /> },
]

// ── Guest badge ──────────────────────────────────────────────────────────────

function AttendingBadge({ status }: { status: string }) {
  if (status === 'ja') return <span className="bp-badge bp-badge-green">Zugesagt</span>
  if (status === 'nein') return <span className="bp-badge bp-badge-red">Abgesagt</span>
  return <span className="bp-badge bp-badge-neutral">Ausstehend</span>
}

// ── Gästeliste tab ───────────────────────────────────────────────────────────

function GaestelisteTab({ guests, eventId, mealOptions, onUpdate }: {
  guests: Guest[]
  eventId: string
  mealOptions: string[]
  onUpdate: (g: Guest) => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'ja' | 'nein' | 'ausstehend'>('all')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSide, setNewSide] = useState('')
  const [saving, setSaving]   = useState(false)

  const filtered = guests.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' ? true : g.attending === filter
    return matchSearch && matchFilter
  })

  async function addGuest() {
    if (!newName.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('guests')
      .insert({ event_id: eventId, name: newName.trim(), side: newSide || null, attending: 'ausstehend' })
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      onUpdate(data as Guest)
      setNewName(''); setNewSide(''); setAdding(false)
    }
  }

  const ja = guests.filter(g => g.attending === 'ja').length
  const nein = guests.filter(g => g.attending === 'nein').length
  const ausstehend = guests.filter(g => g.attending === 'ausstehend').length

  return (
    <div>
      {/* Stats strip */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Gesamt', value: guests.length, color: 'var(--bp-ink)' },
          { label: 'Zugesagt', value: ja, color: '#15803D' },
          { label: 'Abgesagt', value: nein, color: '#B91C1C' },
          { label: 'Ausstehend', value: ausstehend, color: 'var(--bp-ink-3)' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          className="bp-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Name suchen…"
          style={{ flex: 1, minWidth: 200 }}
        />
        <select className="bp-select" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} style={{ width: 'auto' }}>
          <option value="all">Alle</option>
          <option value="ja">Zugesagt</option>
          <option value="nein">Abgesagt</option>
          <option value="ausstehend">Ausstehend</option>
        </select>
        <button className="bp-btn bp-btn-primary" onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} /> Gast hinzufügen
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bp-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div className="bp-grid-2" style={{ marginBottom: '0.75rem' }}>
            <div className="bp-field">
              <label className="bp-label-text">Name *</label>
              <input className="bp-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Vorname Nachname" autoFocus onKeyDown={e => e.key === 'Enter' && addGuest()} />
            </div>
            <div className="bp-field">
              <label className="bp-label-text">Seite</label>
              <select className="bp-select" value={newSide} onChange={e => setNewSide(e.target.value)}>
                <option value="">Nicht zugeordnet</option>
                <option value="Braut">Brautseite</option>
                <option value="Bräutigam">Bräutigam-Seite</option>
                <option value="Gemeinsam">Gemeinsam</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="bp-btn bp-btn-ghost bp-btn-sm" onClick={() => { setAdding(false); setNewName(''); setNewSide('') }}>Abbrechen</button>
            <button className="bp-btn bp-btn-primary bp-btn-sm" onClick={addGuest} disabled={saving || !newName.trim()}>{saving ? '…' : 'Hinzufügen'}</button>
          </div>
        </div>
      )}

      {/* Guest list */}
      <div className="bp-card" style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="bp-empty">
            <div className="bp-empty-title">Keine Gäste gefunden</div>
            <div className="bp-empty-body">Passt eure Suche oder den Filter an.</div>
          </div>
        ) : (
          <table className="bp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Seite</th>
                <th>Menü</th>
                <th>Allergien</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => (
                <tr key={g.id}>
                  <td style={{ fontWeight: 500, color: 'var(--bp-ink)' }}>{g.name}</td>
                  <td><AttendingBadge status={g.attending} /></td>
                  <td style={{ color: 'var(--bp-ink-3)' }}>{g.side ?? '—'}</td>
                  <td style={{ color: 'var(--bp-ink-3)' }}>{g.meal_choice ?? '—'}</td>
                  <td>
                    {g.allergy_tags && g.allergy_tags.length > 0
                      ? g.allergy_tags.map(t => <span key={t} className="bp-badge bp-badge-neutral" style={{ marginRight: 4 }}>{t}</span>)
                      : '—'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Hotel tab ────────────────────────────────────────────────────────────────

function HotelTab({ hotels, guests }: { hotels: Hotel[]; guests: Guest[] }) {
  if (hotels.length === 0) {
    return (
      <div className="bp-empty">
        <div className="bp-empty-icon"><Hotel size={48} /></div>
        <div className="bp-empty-title">Keine Hotels hinterlegt</div>
        <div className="bp-empty-body">Hotels werden vom Veranstalter im Ablauf eingetragen.</div>
      </div>
    )
  }

  return (
    <div>
      {hotels.map(hotel => {
        const rooms = hotel.hotel_rooms ?? []
        const assignedGuests = guests.filter(g => rooms.some(r => r.id === g.hotel_room_id))
        return (
          <div key={hotel.id} className="bp-card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
            <div className="bp-card-header">
              <h3 className="bp-section-title" style={{ margin: 0 }}>{hotel.name}</h3>
              <span className="bp-badge bp-badge-neutral">{rooms.length} Zimmer</span>
            </div>
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Zimmernr.</th>
                  <th>Typ</th>
                  <th>Max. Belegung</th>
                  <th>Zugewiesene Gäste</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => {
                  const roomGuests = guests.filter(g => g.hotel_room_id === room.id)
                  return (
                    <tr key={room.id}>
                      <td>{room.room_number ?? '—'}</td>
                      <td>{room.room_type ?? '—'}</td>
                      <td>{room.max_occupancy}</td>
                      <td>{roomGuests.length > 0 ? roomGuests.map(g => g.name).join(', ') : <span style={{ color: 'var(--bp-ink-3)' }}>Nicht belegt</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {assignedGuests.length === 0 && (
              <div style={{ padding: '1rem', color: 'var(--bp-ink-3)', fontSize: '0.875rem', textAlign: 'center' }}>
                Noch keine Gäste diesem Hotel zugewiesen.
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── RSVP tab ─────────────────────────────────────────────────────────────────

function RsvpTab({ eventId, inviteCodes }: { eventId: string; inviteCodes: InviteCode[] }) {
  const [codes, setCodes]   = useState(inviteCodes)
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function createCode() {
    setCreating(true)
    const res = await fetch('/api/invite/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, role: 'guest', maxUses: 1 }),
    })
    setCreating(false)
    if (res.ok) {
      const { code, id, expiresAt } = await res.json()
      const newCode: InviteCode = {
        id: id ?? crypto.randomUUID(),
        code,
        role: 'guest',
        expires_at: expiresAt ?? null,
        max_uses: 1,
        use_count: 0,
        created_at: new Date().toISOString(),
      }
      setCodes(prev => [newCode, ...prev])
    }
  }

  async function deleteCode(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('invite_codes').delete().eq('id', id)
    if (!error) setCodes(prev => prev.filter(c => c.id !== id))
  }

  function copyLink(code: string, id: string) {
    const url = `${window.location.origin}/rsvp/${code}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function getRsvpUrl(code: string) {
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/rsvp/${code}`
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 className="bp-section-title" style={{ margin: 0 }}>RSVP-Links</h3>
          <p className="bp-caption" style={{ marginTop: '0.25rem' }}>Generiert personalisierte Links, die ihr per Nachricht versendet.</p>
        </div>
        <button
          className="bp-btn bp-btn-primary"
          onClick={createCode}
          disabled={creating}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {creating ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
          {creating ? 'Erstellt…' : 'Link erstellen'}
        </button>
      </div>

      {codes.length === 0 ? (
        <div className="bp-empty">
          <div className="bp-empty-icon"><LinkIcon size={48} /></div>
          <div className="bp-empty-title">Noch keine RSVP-Links</div>
          <div className="bp-empty-body">Erstellt den ersten Link und versendet ihn an eure Gäste.</div>
        </div>
      ) : (
        <div className="bp-card" style={{ overflow: 'hidden' }}>
          <table className="bp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Verwendet</th>
                <th>Erstellt am</th>
                <th>Läuft ab</th>
                <th style={{ textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {codes.map(code => (
                <tr key={code.id}>
                  <td>
                    <code style={{ fontSize: '0.8125rem', background: 'var(--bp-ivory-2)', padding: '0.25rem 0.5rem', borderRadius: 'var(--bp-r-xs)', color: 'var(--bp-ink)' }}>
                      {code.code}
                    </code>
                  </td>
                  <td style={{ color: 'var(--bp-ink-3)' }}>{code.use_count}/{code.max_uses ?? '∞'}</td>
                  <td style={{ color: 'var(--bp-ink-3)' }}>
                    {new Date(code.created_at).toLocaleDateString('de-DE')}
                  </td>
                  <td style={{ color: 'var(--bp-ink-3)' }}>
                    {code.expires_at ? new Date(code.expires_at).toLocaleDateString('de-DE') : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                      <button
                        className="bp-btn bp-btn-secondary bp-btn-sm"
                        onClick={() => copyLink(code.code, code.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                      >
                        {copiedId === code.id ? <Check size={13} /> : <Copy size={13} />}
                        {copiedId === code.id ? 'Kopiert' : 'Link kopieren'}
                      </button>
                      <button className="bp-btn bp-btn-danger bp-btn-sm bp-btn-icon" onClick={() => deleteCode(code.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── RSVP-Einstellungen tab ───────────────────────────────────────────────────

function EinstellungenTab({ eventId, rsvpSettings: initialSettings, childrenAllowed }: {
  eventId: string
  rsvpSettings: RsvpSettings | null
  childrenAllowed: boolean
}) {
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const payload = {
      event_id: eventId,
      invitation_text: settings?.invitation_text ?? '',
      rsvp_deadline: settings?.rsvp_deadline ?? null,
      show_meal_choice: settings?.show_meal_choice ?? true,
      show_plus_one: settings?.show_plus_one ?? true,
      updated_by: undefined,
    }
    if (settings?.id) {
      await supabase.from('rsvp_settings').update(payload).eq('id', settings.id)
    } else {
      const { data } = await supabase.from('rsvp_settings').insert(payload).select().single()
      if (data) setSettings(data as RsvpSettings)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const s = settings

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="bp-field">
        <label className="bp-label-text">Einladungstext</label>
        <p className="bp-caption" style={{ marginBottom: '0.5rem' }}>{'Verwende {{Name}} als Platzhalter für den Gastnamen.'}</p>
        <textarea
          className="bp-textarea"
          rows={6}
          value={s?.invitation_text ?? ''}
          onChange={e => setSettings(prev => ({ ...(prev ?? {} as RsvpSettings), invitation_text: e.target.value }))}
        />
      </div>

      <div className="bp-field">
        <label className="bp-label-text">RSVP-Frist</label>
        <input
          className="bp-input"
          type="date"
          value={s?.rsvp_deadline ?? ''}
          onChange={e => setSettings(prev => ({ ...(prev ?? {} as RsvpSettings), rsvp_deadline: e.target.value || null }))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.9375rem', color: 'var(--bp-ink-2)' }}>
          <input
            type="checkbox"
            className="bp-checkbox"
            checked={s?.show_meal_choice ?? true}
            onChange={e => setSettings(prev => ({ ...(prev ?? {} as RsvpSettings), show_meal_choice: e.target.checked }))}
          />
          Menüwahl im RSVP-Formular anzeigen
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.9375rem', color: 'var(--bp-ink-2)' }}>
          <input
            type="checkbox"
            className="bp-checkbox"
            checked={s?.show_plus_one ?? true}
            onChange={e => setSettings(prev => ({ ...(prev ?? {} as RsvpSettings), show_plus_one: e.target.checked }))}
          />
          Begleitperson-Option anzeigen
        </label>
      </div>

      <p className="bp-caption" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bp-ivory-2)', borderRadius: 'var(--bp-r-sm)' }}>
        Massenversand per E-Mail wird in einem zukünftigen Update verfügbar sein.
      </p>

      <button
        className="bp-btn bp-btn-primary"
        onClick={save}
        disabled={saving}
      >
        {saving ? 'Speichert…' : saved ? 'Gespeichert ✓' : 'Einstellungen speichern'}
      </button>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BrautpaarGaeste({
  eventId, userId, initialGuests, mealOptions, childrenAllowed,
  hotels, inviteCodes, rsvpSettings,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('gaesteliste')
  const [guests, setGuests] = useState<Guest[]>(initialGuests)

  const handleGuestUpdate = useCallback((g: Guest) => {
    setGuests(prev => {
      const exists = prev.some(x => x.id === g.id)
      return exists ? prev.map(x => x.id === g.id ? g : x) : [...prev, g]
    })
  }, [])

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Gäste</h1>
      </div>

      <div className="bp-tabs bp-mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className="bp-tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'gaesteliste' && (
        <GaestelisteTab
          guests={guests}
          eventId={eventId}
          mealOptions={mealOptions}
          onUpdate={handleGuestUpdate}
        />
      )}
      {activeTab === 'hotel' && (
        <HotelTab hotels={hotels} guests={guests} />
      )}
      {activeTab === 'rsvp' && (
        <RsvpTab eventId={eventId} inviteCodes={inviteCodes} />
      )}
      {activeTab === 'einstellungen' && (
        <EinstellungenTab
          eventId={eventId}
          rsvpSettings={rsvpSettings}
          childrenAllowed={childrenAllowed}
        />
      )}
    </div>
  )
}
