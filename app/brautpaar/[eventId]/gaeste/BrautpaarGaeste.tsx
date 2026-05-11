'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Hotel as HotelIcon, Mail, Settings, Plus, Copy, Check,
  Trash2, QrCode, Download, X, Edit2, Star, Gift, ChevronDown, ChevronRight,
} from 'lucide-react'
import GeschenkTab from './GeschenkTab'

// ── Types ─────────────────────────────────────────────────────────────────────

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
  token: string | null
}

interface HotelRoom {
  id: string
  hotel_id: string
  room_type: string | null
  room_number: string | null
  max_occupancy: number
  total_rooms: number
  booked_rooms: number
  price_per_night: number | null
  description: string | null
}

interface Hotel {
  id: string
  name: string
  address: string | null
  stars: number | null
  website: string | null
  notes: string | null
  hotel_rooms: HotelRoom[]
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
  rsvpSettings: RsvpSettings | null
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'gaesteliste' | 'geschenke' | 'hotel' | 'rsvp' | 'einstellungen'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'gaesteliste',   label: 'Gästeliste',         icon: <Users size={15} /> },
  { key: 'geschenke',     label: 'Geschenkliste',       icon: <Gift size={15} /> },
  { key: 'hotel',         label: 'Hotel',               icon: <HotelIcon size={15} /> },
  { key: 'rsvp',          label: 'Einladungen',         icon: <Mail size={15} /> },
  { key: 'einstellungen', label: 'Gäste-Einstellungen', icon: <Settings size={15} /> },
]

// ── Attending badge ───────────────────────────────────────────────────────────

function AttendingBadge({ status }: { status: string }) {
  if (status === 'ja')    return <span className="bp-badge bp-badge-green">Zugesagt</span>
  if (status === 'nein')  return <span className="bp-badge bp-badge-red">Abgesagt</span>
  return <span className="bp-badge bp-badge-neutral">Ausstehend</span>
}

// ── Star picker ───────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div style={{ display: 'flex', gap: '0.25rem' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n} type="button"
          onClick={() => onChange(value === n ? null : n)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
        >
          <Star
            size={20}
            fill={value && n <= value ? '#B89968' : 'none'}
            color={value && n <= value ? '#B89968' : 'var(--bp-rule)'}
          />
        </button>
      ))}
    </div>
  )
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, width = 520 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(44,40,37,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bp-paper)', borderRadius: 'var(--bp-r-lg)',
        padding: '1.75rem', width: '100%', maxWidth: width,
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: 'var(--bp-shadow-elevated)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="bp-h2" style={{ margin: 0 }}>{title}</h2>
          <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Hotel tab ─────────────────────────────────────────────────────────────────

interface HotelFormData {
  name: string; address: string; stars: number | null; website: string; notes: string
}
interface RoomFormData {
  room_type: string; room_number: string; total_rooms: string
  max_occupancy: string; price_per_night: string; description: string
}

function emptyHotelForm(): HotelFormData {
  return { name: '', address: '', stars: null, website: '', notes: '' }
}
function emptyRoomForm(): RoomFormData {
  return { room_type: '', room_number: '', total_rooms: '1', max_occupancy: '2', price_per_night: '', description: '' }
}

function HotelTab({ eventId, hotels: initialHotels }: { eventId: string; hotels: Hotel[] }) {
  const [hotels, setHotels] = useState<Hotel[]>(initialHotels)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Hotel modal
  const [hotelModal, setHotelModal] = useState<'create' | 'edit' | null>(null)
  const [editingHotelId, setEditingHotelId] = useState<string | null>(null)
  const [hotelForm, setHotelForm] = useState<HotelFormData>(emptyHotelForm())
  const [hotelSaving, setHotelSaving] = useState(false)

  // Room modal
  const [roomModal, setRoomModal] = useState<'create' | 'edit' | null>(null)
  const [roomParentId, setRoomParentId] = useState<string | null>(null)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [roomForm, setRoomForm] = useState<RoomFormData>(emptyRoomForm())
  const [roomSaving, setRoomSaving] = useState(false)

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Hotel CRUD ──

  function openCreateHotel() {
    setHotelForm(emptyHotelForm())
    setEditingHotelId(null)
    setHotelModal('create')
  }

  function openEditHotel(h: Hotel) {
    setHotelForm({ name: h.name, address: h.address ?? '', stars: h.stars, website: h.website ?? '', notes: h.notes ?? '' })
    setEditingHotelId(h.id)
    setHotelModal('edit')
  }

  async function saveHotel() {
    if (!hotelForm.name.trim()) return
    setHotelSaving(true)
    const supabase = createClient()
    const payload = {
      event_id: eventId,
      name: hotelForm.name.trim(),
      address: hotelForm.address.trim() || null,
      stars: hotelForm.stars,
      website: hotelForm.website.trim() || null,
      notes: hotelForm.notes.trim() || null,
    }
    if (editingHotelId) {
      const { error } = await supabase.from('hotels').update(payload).eq('id', editingHotelId)
      if (!error) {
        setHotels(prev => prev.map(h => h.id === editingHotelId ? { ...h, ...payload } : h))
      }
    } else {
      const { data, error } = await supabase.from('hotels').insert(payload).select().single()
      if (!error && data) {
        const newHotel: Hotel = { ...data, hotel_rooms: [] }
        setHotels(prev => [...prev, newHotel])
        setExpandedIds(prev => new Set(Array.from(prev).concat(data.id)))
      }
    }
    setHotelSaving(false)
    setHotelModal(null)
  }

  async function deleteHotel(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('hotels').delete().eq('id', id)
    if (!error) setHotels(prev => prev.filter(h => h.id !== id))
  }

  // ── Room CRUD ──

  function openCreateRoom(hotelId: string) {
    setRoomForm(emptyRoomForm())
    setRoomParentId(hotelId)
    setEditingRoomId(null)
    setRoomModal('create')
  }

  function openEditRoom(room: HotelRoom) {
    setRoomForm({
      room_type: room.room_type ?? '',
      room_number: room.room_number ?? '',
      total_rooms: String(room.total_rooms ?? 1),
      max_occupancy: String(room.max_occupancy ?? 2),
      price_per_night: room.price_per_night != null ? String(room.price_per_night) : '',
      description: room.description ?? '',
    })
    setRoomParentId(room.hotel_id)
    setEditingRoomId(room.id)
    setRoomModal('edit')
  }

  async function saveRoom() {
    if (!roomForm.room_type.trim() || !roomParentId) return
    setRoomSaving(true)
    const supabase = createClient()
    const payload = {
      hotel_id: roomParentId,
      room_type: roomForm.room_type.trim(),
      room_number: roomForm.room_number.trim() || null,
      total_rooms: Number(roomForm.total_rooms) || 1,
      max_occupancy: Number(roomForm.max_occupancy) || 2,
      price_per_night: roomForm.price_per_night ? Number(roomForm.price_per_night) : null,
      description: roomForm.description.trim() || null,
    }
    if (editingRoomId) {
      const { error } = await supabase.from('hotel_rooms').update(payload).eq('id', editingRoomId)
      if (!error) {
        setHotels(prev => prev.map(h =>
          h.id === roomParentId
            ? { ...h, hotel_rooms: h.hotel_rooms.map(r => r.id === editingRoomId ? { ...r, ...payload } : r) }
            : h,
        ))
      }
    } else {
      const { data, error } = await supabase.from('hotel_rooms').insert({ ...payload, booked_rooms: 0 }).select().single()
      if (!error && data) {
        setHotels(prev => prev.map(h =>
          h.id === roomParentId
            ? { ...h, hotel_rooms: [...h.hotel_rooms, data as HotelRoom] }
            : h,
        ))
      }
    }
    setRoomSaving(false)
    setRoomModal(null)
  }

  async function deleteRoom(hotelId: string, roomId: string) {
    const supabase = createClient()
    const { error } = await supabase.from('hotel_rooms').delete().eq('id', roomId)
    if (!error) {
      setHotels(prev => prev.map(h =>
        h.id === hotelId ? { ...h, hotel_rooms: h.hotel_rooms.filter(r => r.id !== roomId) } : h,
      ))
    }
  }

  // ── Render ──

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h3 className="bp-section-title" style={{ marginBottom: '0.25rem' }}>Hotels</h3>
          <p className="bp-caption">Zimmer hier anlegen — Gäste können diese beim RSVP buchen.</p>
        </div>
        <button
          className="bp-btn bp-btn-primary"
          onClick={openCreateHotel}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}
        >
          <Plus size={16} /> Hotel hinzufügen
        </button>
      </div>

      {hotels.length === 0 ? (
        <div className="bp-card">
          <div className="bp-empty">
            <div className="bp-empty-icon"><HotelIcon size={40} /></div>
            <div className="bp-empty-title">Noch keine Hotels</div>
            <div className="bp-empty-body">Fügt Hotels hinzu, damit Gäste beim RSVP ein Zimmer buchen können.</div>
            <button
              className="bp-btn bp-btn-primary"
              onClick={openCreateHotel}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Hotel hinzufügen
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {hotels.map(hotel => {
            const expanded = expandedIds.has(hotel.id)
            const totalRooms = hotel.hotel_rooms.reduce((s, r) => s + (r.total_rooms ?? 0), 0)
            const bookedRooms = hotel.hotel_rooms.reduce((s, r) => s + (r.booked_rooms ?? 0), 0)

            return (
              <div key={hotel.id} className="bp-card" style={{ overflow: 'hidden' }}>
                {/* Hotel header */}
                <div className="bp-card-header" style={{ gap: '0.75rem' }}>
                  <button
                    onClick={() => toggleExpand(hotel.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', flex: 1, textAlign: 'left', padding: 0 }}
                  >
                    <span style={{ color: 'var(--bp-ink-3)', flexShrink: 0 }}>
                      {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                        <span className="bp-section-title" style={{ margin: 0 }}>{hotel.name}</span>
                        {hotel.stars && (
                          <span style={{ display: 'flex', gap: 1 }}>
                            {Array.from({ length: hotel.stars }).map((_, i) => (
                              <Star key={i} size={13} fill="#B89968" color="#B89968" />
                            ))}
                          </span>
                        )}
                        <span className="bp-badge bp-badge-neutral">
                          {hotel.hotel_rooms.length} Zimmertypen · {totalRooms - bookedRooms} verfügbar
                        </span>
                      </div>
                      {hotel.address && <p className="bp-caption" style={{ marginTop: 2 }}>{hotel.address}</p>}
                    </div>
                  </button>

                  <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                    <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={() => openEditHotel(hotel)} title="Bearbeiten">
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon"
                      onClick={() => { if (confirm(`Hotel "${hotel.name}" löschen? Alle Zimmer werden ebenfalls gelöscht.`)) deleteHotel(hotel.id) }}
                      title="Löschen"
                      style={{ color: '#B91C1C' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Hotel details + rooms (expanded) */}
                {expanded && (
                  <div style={{ padding: '1rem 1.25rem' }}>
                    {/* Meta */}
                    {(hotel.website || hotel.notes) && (
                      <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        {hotel.website && (
                          <a href={hotel.website} target="_blank" rel="noopener noreferrer" className="bp-caption" style={{ color: 'var(--bp-gold-deep)' }}>
                            {hotel.website}
                          </a>
                        )}
                        {hotel.notes && <p className="bp-caption">{hotel.notes}</p>}
                      </div>
                    )}

                    {/* Rooms */}
                    <div style={{ marginBottom: '0.875rem' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--bp-ink-3)', marginBottom: '0.5rem' }}>
                        Zimmer
                      </p>
                      {hotel.hotel_rooms.length === 0 ? (
                        <p className="bp-caption" style={{ fontStyle: 'italic' }}>Noch keine Zimmer angelegt.</p>
                      ) : (
                        <div className="bp-card" style={{ overflow: 'hidden', marginBottom: '0.5rem' }}>
                          <table className="bp-table">
                            <thead>
                              <tr>
                                <th>Typ</th>
                                <th>Zimmer-Nr.</th>
                                <th>Anzahl</th>
                                <th>Max. Pers.</th>
                                <th>€/Nacht</th>
                                <th>Gebucht</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {hotel.hotel_rooms.map(room => (
                                <tr key={room.id}>
                                  <td style={{ fontWeight: 500, color: 'var(--bp-ink)' }}>
                                    {room.room_type ?? '—'}
                                    {room.description && (
                                      <div className="bp-caption" style={{ marginTop: 2 }}>{room.description}</div>
                                    )}
                                  </td>
                                  <td>{room.room_number ?? '—'}</td>
                                  <td>{room.total_rooms}</td>
                                  <td>{room.max_occupancy}</td>
                                  <td>{room.price_per_night != null ? `€ ${Number(room.price_per_night).toLocaleString('de-DE')}` : '—'}</td>
                                  <td>
                                    <span className={room.booked_rooms > 0 ? 'bp-badge bp-badge-gold' : 'bp-badge bp-badge-neutral'}>
                                      {room.booked_rooms} / {room.total_rooms}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                      <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={() => openEditRoom(room)} title="Bearbeiten">
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon"
                                        onClick={() => { if (confirm('Zimmer löschen?')) deleteRoom(hotel.id, room.id) }}
                                        title="Löschen"
                                        style={{ color: '#B91C1C' }}
                                      >
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
                      <button
                        className="bp-btn bp-btn-secondary bp-btn-sm"
                        onClick={() => openCreateRoom(hotel.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                      >
                        <Plus size={14} /> Zimmer hinzufügen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Hotel modal */}
      {hotelModal && (
        <Modal
          title={hotelModal === 'edit' ? 'Hotel bearbeiten' : 'Hotel hinzufügen'}
          onClose={() => setHotelModal(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="bp-field" style={{ marginBottom: 0 }}>
              <label className="bp-label-text">Name *</label>
              <input
                className="bp-input"
                value={hotelForm.name}
                onChange={e => setHotelForm(f => ({ ...f, name: e.target.value }))}
                placeholder="z.B. Hotel Seeblick"
                autoFocus
              />
            </div>
            <div className="bp-field" style={{ marginBottom: 0 }}>
              <label className="bp-label-text">Adresse</label>
              <input
                className="bp-input"
                value={hotelForm.address}
                onChange={e => setHotelForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Musterstraße 1, 12345 Berlin"
              />
            </div>
            <div className="bp-field" style={{ marginBottom: 0 }}>
              <label className="bp-label-text">Sterne</label>
              <StarPicker value={hotelForm.stars} onChange={v => setHotelForm(f => ({ ...f, stars: v }))} />
            </div>
            <div className="bp-field" style={{ marginBottom: 0 }}>
              <label className="bp-label-text">Website</label>
              <input
                className="bp-input"
                type="url"
                value={hotelForm.website}
                onChange={e => setHotelForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="bp-field" style={{ marginBottom: 0 }}>
              <label className="bp-label-text">Notizen</label>
              <textarea
                className="bp-textarea"
                rows={2}
                value={hotelForm.notes}
                onChange={e => setHotelForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Besonderheiten, Anfahrt, Kontakt…"
                style={{ minHeight: 72 }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button className="bp-btn bp-btn-ghost" onClick={() => setHotelModal(null)}>Abbrechen</button>
            <button
              className="bp-btn bp-btn-primary"
              onClick={saveHotel}
              disabled={hotelSaving || !hotelForm.name.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            >
              {hotelSaving ? '…' : <><Check size={14} /> {hotelModal === 'edit' ? 'Speichern' : 'Hotel anlegen'}</>}
            </button>
          </div>
        </Modal>
      )}

      {/* Room modal */}
      {roomModal && (
        <Modal
          title={roomModal === 'edit' ? 'Zimmer bearbeiten' : 'Zimmer hinzufügen'}
          onClose={() => setRoomModal(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="bp-grid-2" style={{ gap: '0.75rem' }}>
              <div className="bp-field" style={{ marginBottom: 0 }}>
                <label className="bp-label-text">Zimmertyp *</label>
                <input
                  className="bp-input"
                  value={roomForm.room_type}
                  onChange={e => setRoomForm(f => ({ ...f, room_type: e.target.value }))}
                  placeholder="z.B. Doppelzimmer"
                  autoFocus
                />
              </div>
              <div className="bp-field" style={{ marginBottom: 0 }}>
                <label className="bp-label-text">Zimmernummer (optional)</label>
                <input
                  className="bp-input"
                  value={roomForm.room_number}
                  onChange={e => setRoomForm(f => ({ ...f, room_number: e.target.value }))}
                  placeholder="z.B. 101"
                />
              </div>
              <div className="bp-field" style={{ marginBottom: 0 }}>
                <label className="bp-label-text">Anzahl Zimmer</label>
                <input
                  className="bp-input"
                  type="number" min="1"
                  value={roomForm.total_rooms}
                  onChange={e => setRoomForm(f => ({ ...f, total_rooms: e.target.value }))}
                />
              </div>
              <div className="bp-field" style={{ marginBottom: 0 }}>
                <label className="bp-label-text">Max. Belegung</label>
                <input
                  className="bp-input"
                  type="number" min="1"
                  value={roomForm.max_occupancy}
                  onChange={e => setRoomForm(f => ({ ...f, max_occupancy: e.target.value }))}
                />
              </div>
              <div className="bp-field" style={{ marginBottom: 0 }}>
                <label className="bp-label-text">Preis / Nacht</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--bp-ink-3)', fontSize: '0.875rem', pointerEvents: 'none' }}>€</span>
                  <input
                    className="bp-input"
                    type="number" min="0" step="0.01"
                    value={roomForm.price_per_night}
                    onChange={e => setRoomForm(f => ({ ...f, price_per_night: e.target.value }))}
                    placeholder="0"
                    style={{ paddingLeft: '1.75rem' }}
                  />
                </div>
              </div>
            </div>
            <div className="bp-field" style={{ marginBottom: 0 }}>
              <label className="bp-label-text">Beschreibung</label>
              <textarea
                className="bp-textarea"
                rows={2}
                value={roomForm.description}
                onChange={e => setRoomForm(f => ({ ...f, description: e.target.value }))}
                placeholder="z.B. Balkon, Meerblick, Badewanne…"
                style={{ minHeight: 72 }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button className="bp-btn bp-btn-ghost" onClick={() => setRoomModal(null)}>Abbrechen</button>
            <button
              className="bp-btn bp-btn-primary"
              onClick={saveRoom}
              disabled={roomSaving || !roomForm.room_type.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            >
              {roomSaving ? '…' : <><Check size={14} /> {roomModal === 'edit' ? 'Speichern' : 'Zimmer anlegen'}</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Gästeliste tab ────────────────────────────────────────────────────────────

function GaestelisteTab({ guests, eventId, userId, onUpdate }: {
  guests: Guest[]; eventId: string; userId: string; onUpdate: (g: Guest) => void
}) {
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<'all' | 'ja' | 'nein' | 'ausstehend'>('all')
  const [adding, setAdding]   = useState(false)
  const [newName, setNewName] = useState('')
  const [newSide, setNewSide] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving]   = useState(false)

  const filtered = guests.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || g.attending === filter
    return matchSearch && matchFilter
  })

  async function addGuest() {
    if (!newName.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('guests')
      .insert({
        event_id: eventId, name: newName.trim(),
        side: newSide || null, email: newEmail.trim() || null,
        attending: 'ausstehend', created_by: userId,
        token: crypto.randomUUID(),
      })
      .select().single()
    setSaving(false)
    if (!error && data) {
      onUpdate(data as Guest)
      setNewName(''); setNewSide(''); setNewEmail(''); setAdding(false)
    }
  }

  const ja = guests.filter(g => g.attending === 'ja').length
  const nein = guests.filter(g => g.attending === 'nein').length
  const ausstehend = guests.filter(g => g.attending === 'ausstehend').length

  return (
    <div>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Gesamt',     value: guests.length, color: 'var(--bp-ink)' },
          { label: 'Zugesagt',   value: ja,            color: '#15803D' },
          { label: 'Abgesagt',   value: nein,          color: '#B91C1C' },
          { label: 'Ausstehend', value: ausstehend,    color: 'var(--bp-ink-3)' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="bp-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name suchen…" style={{ flex: 1, minWidth: 200 }} />
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

      {adding && (
        <div className="bp-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div className="bp-grid-2" style={{ marginBottom: '0.75rem' }}>
            <div className="bp-field" style={{ marginBottom: 0 }}>
              <label className="bp-label-text">Name *</label>
              <input className="bp-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Vorname Nachname" autoFocus onKeyDown={e => e.key === 'Enter' && addGuest()} />
            </div>
            <div className="bp-field" style={{ marginBottom: 0 }}>
              <label className="bp-label-text">Seite</label>
              <select className="bp-select" value={newSide} onChange={e => setNewSide(e.target.value)}>
                <option value="">Nicht zugeordnet</option>
                <option value="Braut">Brautseite</option>
                <option value="Bräutigam">Bräutigam-Seite</option>
                <option value="Gemeinsam">Gemeinsam</option>
              </select>
            </div>
            <div className="bp-field" style={{ marginBottom: 0 }}>
              <label className="bp-label-text">E-Mail</label>
              <input className="bp-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@beispiel.de" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="bp-btn bp-btn-ghost bp-btn-sm" onClick={() => { setAdding(false); setNewName(''); setNewSide(''); setNewEmail('') }}>Abbrechen</button>
            <button className="bp-btn bp-btn-primary bp-btn-sm" onClick={addGuest} disabled={saving || !newName.trim()}>{saving ? '…' : 'Hinzufügen'}</button>
          </div>
        </div>
      )}

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
                <th>Name</th><th>Status</th><th>Seite</th><th>Menü</th><th>Allergien</th>
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
                      : '—'}
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

// ── Einladungen (RSVP) tab ────────────────────────────────────────────────────

function RsvpTab({ guests, onUpdateGuest }: { guests: Guest[]; onUpdateGuest: (g: Guest) => void }) {
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null)
  const [emailInput, setEmailInput]         = useState('')
  const [savingEmail, setSavingEmail]       = useState(false)
  const [copiedId, setCopiedId]             = useState<string | null>(null)
  const [qrGuestId, setQrGuestId]           = useState<string | null>(null)
  const [qrDataUrls, setQrDataUrls]         = useState<Record<string, string>>({})
  const [qrLoading, setQrLoading]           = useState(false)

  function getRsvpUrl(token: string) {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/rsvp/${token}`
  }

  function copyLink(guest: Guest) {
    if (!guest.token) return
    navigator.clipboard.writeText(getRsvpUrl(guest.token)).then(() => {
      setCopiedId(guest.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  async function toggleQr(guest: Guest) {
    if (qrGuestId === guest.id) { setQrGuestId(null); return }
    if (!guest.token) return
    setQrGuestId(guest.id)
    if (qrDataUrls[guest.id]) return
    setQrLoading(true)
    try {
      const url = getRsvpUrl(guest.token)
      const QRCode = (await import('qrcode')).default
      const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2, color: { dark: '#3D3833', light: '#FDFAF7' } })
      setQrDataUrls(prev => ({ ...prev, [guest.id]: dataUrl }))
    } catch (e) { console.error('QR generation failed', e) }
    setQrLoading(false)
  }

  function downloadQr(guestName: string, dataUrl: string) {
    const a = document.createElement('a')
    a.href = dataUrl; a.download = `RSVP-QR-${guestName.replace(/\s+/g, '-')}.png`; a.click()
  }

  async function saveEmail(guest: Guest) {
    setSavingEmail(true)
    const supabase = createClient()
    const newEmail = emailInput.trim() || null
    const { error } = await supabase.from('guests').update({ email: newEmail }).eq('id', guest.id)
    setSavingEmail(false)
    if (!error) onUpdateGuest({ ...guest, email: newEmail })
    setEditingEmailId(null)
  }

  const activeQrGuest = qrGuestId ? guests.find(g => g.id === qrGuestId) ?? null : null
  const activeQrUrl   = activeQrGuest ? qrDataUrls[activeQrGuest.id] ?? null : null

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 className="bp-section-title" style={{ margin: '0 0 0.25rem' }}>Einladungslinks</h3>
        <p className="bp-caption">Jeder Gast hat einen personalisierten RSVP-Link.</p>
      </div>

      <div className="bp-card" style={{ overflow: 'hidden' }}>
        {guests.length === 0 ? (
          <div className="bp-empty">
            <div className="bp-empty-title">Noch keine Gäste</div>
            <div className="bp-empty-body">Fügt Gäste in der Gästeliste hinzu.</div>
          </div>
        ) : (
          <table className="bp-table">
            <thead><tr><th>Gast</th><th>E-Mail</th><th style={{ textAlign: 'right' }}>Aktionen</th></tr></thead>
            <tbody>
              {guests.map(guest => (
                <tr key={guest.id}>
                  <td style={{ fontWeight: 500, color: 'var(--bp-ink)' }}>{guest.name}</td>
                  <td>
                    {editingEmailId === guest.id ? (
                      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        <input
                          className="bp-input"
                          type="email"
                          value={emailInput}
                          onChange={e => setEmailInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEmail(guest); if (e.key === 'Escape') setEditingEmailId(null) }}
                          autoFocus
                          style={{ maxWidth: 200, padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                          placeholder="email@beispiel.de"
                        />
                        <button className="bp-btn bp-btn-primary bp-btn-sm" onClick={() => saveEmail(guest)} disabled={savingEmail}>
                          {savingEmail ? '…' : <Check size={13} />}
                        </button>
                        <button className="bp-btn bp-btn-ghost bp-btn-sm" onClick={() => setEditingEmailId(null)}><X size={13} /></button>
                      </div>
                    ) : (
                      <button
                        className="bp-btn bp-btn-ghost bp-btn-sm"
                        onClick={() => { setEditingEmailId(guest.id); setEmailInput(guest.email ?? '') }}
                        style={{ color: guest.email ? 'var(--bp-ink-2)' : 'var(--bp-ink-3)', fontSize: '0.875rem' }}
                      >
                        {guest.email ?? '+ E-Mail eintragen'}
                      </button>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                      <button className="bp-btn bp-btn-secondary bp-btn-sm" onClick={() => copyLink(guest)} disabled={!guest.token} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {copiedId === guest.id ? <Check size={13} /> : <Copy size={13} />}
                        {copiedId === guest.id ? 'Kopiert' : 'Link'}
                      </button>
                      <button className="bp-btn bp-btn-secondary bp-btn-sm" onClick={() => toggleQr(guest)} disabled={!guest.token} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <QrCode size={13} /> QR
                      </button>
                      {guest.email && guest.token && (
                        <a
                          href={`mailto:${guest.email}?subject=Eure Hochzeitseinladung&body=${encodeURIComponent(`Liebe/r ${guest.name},\n\nbitte bestätigt eure Teilnahme über folgenden persönlichen Link:\n${getRsvpUrl(guest.token)}`)}`}
                          className="bp-btn bp-btn-secondary bp-btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none' }}
                        >
                          <Mail size={13} /> Mail
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {qrGuestId && activeQrGuest && (
        <div className="bp-card" style={{ marginTop: '1rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontWeight: 500, color: 'var(--bp-ink)', marginBottom: 2 }}>QR-Code für {activeQrGuest.name}</div>
              {activeQrGuest.token && <div style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)', fontFamily: 'monospace' }}>/rsvp/{activeQrGuest.token.slice(0, 20)}…</div>}
            </div>
            <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={() => setQrGuestId(null)}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            {qrLoading && <div style={{ color: 'var(--bp-ink-3)', fontSize: '0.875rem', padding: '2rem 0' }}>Generiere QR-Code…</div>}
            {activeQrUrl && (
              <>
                <img src={activeQrUrl} alt={`RSVP QR-Code für ${activeQrGuest.name}`} style={{ width: 200, height: 200, display: 'block' }} />
                <button className="bp-btn bp-btn-secondary" onClick={() => downloadQr(activeQrGuest.name, activeQrUrl)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Download size={14} /> Als PNG speichern
                </button>
                <p className="bp-caption" style={{ textAlign: 'center', maxWidth: 320 }}>
                  Bild speichern und in Word einfügen, um es als Einladungsbrief zu versenden.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Einstellungen tab ─────────────────────────────────────────────────────────

function EinstellungenTab({ eventId, rsvpSettings: initialSettings }: { eventId: string; rsvpSettings: RsvpSettings | null }) {
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const payload = {
      event_id: eventId,
      invitation_text: settings?.invitation_text ?? '',
      rsvp_deadline: settings?.rsvp_deadline ?? null,
      show_meal_choice: settings?.show_meal_choice ?? true,
      show_plus_one: settings?.show_plus_one ?? true,
    }
    if (settings?.id) {
      await supabase.from('rsvp_settings').update(payload).eq('id', settings.id)
    } else {
      const { data } = await supabase.from('rsvp_settings').insert(payload).select().single()
      if (data) setSettings(data as RsvpSettings)
    }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  const s = settings
  return (
    <div style={{ maxWidth: 600 }}>
      <div className="bp-field">
        <label className="bp-label-text">Einladungstext</label>
        <p className="bp-caption" style={{ marginBottom: '0.5rem' }}>{'Verwende {{Name}} als Platzhalter für den Gastnamen.'}</p>
        <textarea className="bp-textarea" rows={6} value={s?.invitation_text ?? ''} onChange={e => setSettings(prev => ({ ...(prev ?? {} as RsvpSettings), invitation_text: e.target.value }))} />
      </div>
      <div className="bp-field">
        <label className="bp-label-text">RSVP-Frist</label>
        <input className="bp-input" type="date" value={s?.rsvp_deadline ?? ''} onChange={e => setSettings(prev => ({ ...(prev ?? {} as RsvpSettings), rsvp_deadline: e.target.value || null }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.9375rem', color: 'var(--bp-ink-2)' }}>
          <input type="checkbox" className="bp-checkbox" checked={s?.show_meal_choice ?? true} onChange={e => setSettings(prev => ({ ...(prev ?? {} as RsvpSettings), show_meal_choice: e.target.checked }))} />
          Menüwahl im RSVP-Formular anzeigen
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.9375rem', color: 'var(--bp-ink-2)' }}>
          <input type="checkbox" className="bp-checkbox" checked={s?.show_plus_one ?? true} onChange={e => setSettings(prev => ({ ...(prev ?? {} as RsvpSettings), show_plus_one: e.target.checked }))} />
          Begleitperson-Option anzeigen
        </label>
      </div>
      <button className="bp-btn bp-btn-primary" onClick={save} disabled={saving}>
        {saving ? 'Speichert…' : saved ? 'Gespeichert ✓' : 'Einstellungen speichern'}
      </button>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BrautpaarGaeste({ eventId, userId, initialGuests, mealOptions, childrenAllowed, hotels, rsvpSettings }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('gaesteliste')
  const [guests, setGuests]       = useState<Guest[]>(initialGuests)

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

      <div className="bp-step-tabs">
        {TABS.map((tab, idx) => (
          <button
            key={tab.key}
            className="bp-step-tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="bp-step-tab-num">{idx + 1}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ minHeight: 480 }}>
        {activeTab === 'gaesteliste'   && <GaestelisteTab guests={guests} eventId={eventId} userId={userId} onUpdate={handleGuestUpdate} />}
        {activeTab === 'geschenke'     && <GeschenkTab eventId={eventId} />}
        {activeTab === 'hotel'         && <HotelTab eventId={eventId} hotels={hotels} />}
        {activeTab === 'rsvp'          && <RsvpTab guests={guests} onUpdateGuest={handleGuestUpdate} />}
        {activeTab === 'einstellungen' && <EinstellungenTab eventId={eventId} rsvpSettings={rsvpSettings} />}
      </div>
    </div>
  )
}
