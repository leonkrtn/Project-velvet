'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Hotel as HotelIcon, Mail, Settings, Plus, Copy, Check,
  Trash2, QrCode, Download, X, Edit2, Star, Gift, ChevronDown, ChevronRight,
  MessageCircle, Share2, Link2, UserCheck, UserPlus2,
} from 'lucide-react'
import GeschenkTab from './GeschenkTab'
import { titleCaseName } from '@/lib/text'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Guest {
  id: string
  name: string
  status: string
  side: string | null
  meal_choice: string | null
  allergy_tags: string[] | null
  allergy_custom: string | null
  email: string | null
  phone: string | null
  hotel_room_id: string | null
  notes: string | null
  token: string | null
  trink_alkohol: boolean | null
  arrival_date: string | null
  arrival_time: string | null
  transport_mode: string | null
  responded_at: string | null
  message: string | null
  invited_at: string | null
  pending_approval: boolean
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
  phone_contact: string | null
}

// Begleitperson in der Listen-Ansicht (eventweit geladen, mit Gast-Zuordnung)
interface BegleitRow {
  id: string
  guest_id: string
  name: string | null
  age_category: string | null
  meal_choice: string | null
  allergy_tags: string[] | null
}

interface Props {
  eventId: string
  userId: string
  initialGuests: Guest[]
  initialBegleitpersonen: BegleitRow[]
  mealOptions: string[]
  childrenAllowed: boolean
  hotels: Hotel[]
  rsvpSettings: RsvpSettings | null
  openInviteToken: string | null
  openInviteEnabled: boolean
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'gaesteliste' | 'geschenke' | 'hotel' | 'rsvp' | 'einstellungen'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'gaesteliste',   label: 'Gästeliste',         icon: <Users size={15} /> },
  { key: 'geschenke',     label: 'Geschenkliste',       icon: <Gift size={15} /> },
  { key: 'hotel',         label: 'Hotel',               icon: <HotelIcon size={15} /> },
  { key: 'einstellungen', label: 'Gäste-Einstellungen', icon: <Settings size={15} /> },
  { key: 'rsvp',          label: 'Einladungen',         icon: <Mail size={15} /> },
]

// ── Attending badge ───────────────────────────────────────────────────────────

function AttendingBadge({ status }: { status: string }) {
  if (status === 'zugesagt') return <span className="bp-badge bp-badge-green">Zugesagt</span>
  if (status === 'abgesagt') return <span className="bp-badge bp-badge-red">Abgesagt</span>
  return <span className="bp-badge bp-badge-neutral">Ausstehend</span>
}

// Versand-Status für den Einladungen-Tab: unterscheidet "noch gar nicht
// eingeladen" von "eingeladen, Antwort steht aus".
function InviteBadge({ guest }: { guest: Guest }) {
  if (guest.status === 'zugesagt') return <span className="bp-badge bp-badge-green">Zugesagt</span>
  if (guest.status === 'abgesagt') return <span className="bp-badge bp-badge-red">Abgesagt</span>
  if (guest.invited_at || guest.status === 'eingeladen') return <span className="bp-badge bp-badge-gold">Eingeladen</span>
  return <span className="bp-badge bp-badge-neutral">Nicht eingeladen</span>
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

// ── Guest lightbox helpers ────────────────────────────────────────────────────

const MEAL_LABELS: Record<string, string> = {
  fleisch: 'Fleisch', fisch: 'Fisch', vegetarisch: 'Vegetarisch', vegan: 'Vegan',
}
const TRANSPORT_LABELS: Record<string, string> = {
  auto: 'Auto', bahn: 'Bahn', flugzeug: 'Flugzeug', andere: 'Andere',
}
const AGE_LABELS: Record<string, string> = {
  erwachsen: 'Erwachsen', '13-17': '13–17 J.', '6-12': '6–12 J.', '0-6': '0–6 J.',
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--bp-ink-3)', margin: '0 0 0.5rem' }}>{title}</p>
      <div style={{ background: 'var(--bp-bg)', borderRadius: 'var(--bp-r-md)', padding: '0.75rem 1rem', border: '1px solid var(--bp-rule)' }}>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: last ? 0 : '0.375rem' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--bp-ink-3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.8125rem', color: 'var(--bp-ink)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

interface Begleitperson {
  id: string
  name: string | null
  age_category: string | null
  meal_choice: string | null
  allergy_tags: string[] | null
  allergy_custom: string | null
}

function GuestLightbox({ guest, hotels, onClose, onUpdate }: {
  guest: Guest
  hotels: Hotel[]
  onClose: () => void
  onUpdate: (g: Guest) => void
}) {
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [copied, setCopied]     = useState(false)
  const [begleit, setBegleit]   = useState<Begleitperson[]>([])
  const [form, setForm] = useState({
    name:  guest.name,
    side:  guest.side  ?? '',
    email: guest.email ?? '',
    phone: guest.phone ?? '',
    notes: guest.notes ?? '',
  })

  useEffect(() => {
    // Immer laden — Begleitpersonen können auch bei späterem Statuswechsel
    // noch in der DB stehen und sollen sichtbar bleiben
    const supabase = createClient()
    supabase
      .from('begleitpersonen')
      .select('id, name, age_category, meal_choice, allergy_tags, allergy_custom')
      .eq('guest_id', guest.id)
      .then(({ data }) => setBegleit(data ?? []))
  }, [guest.id, guest.status])

  function cancelEdit() {
    setEditing(false)
    setForm({ name: guest.name, side: guest.side ?? '', email: guest.email ?? '', phone: guest.phone ?? '', notes: guest.notes ?? '' })
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const patch = {
      name:  titleCaseName(form.name) || guest.name,
      side:  form.side.trim()  || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    }
    const { error } = await supabase.from('guests').update(patch).eq('id', guest.id)
    setSaving(false)
    if (!error) { onUpdate({ ...guest, ...patch }); setEditing(false) }
  }

  function copyLink() {
    if (!guest.token) return
    navigator.clipboard.writeText(`${window.location.origin}/rsvp/${guest.token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const allRooms  = hotels.flatMap(h => h.hotel_rooms.map(r => ({ ...r, hotelName: h.name })))
  const roomEntry = allRooms.find(r => r.id === guest.hotel_room_id)

  const respondedLabel = guest.responded_at
    ? new Date(guest.responded_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(44,40,37,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bp-paper)', borderRadius: 'var(--bp-r-lg)', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--bp-shadow-elevated)' }}>

        {/* ── Sticky header ── */}
        <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bp-paper)', borderBottom: '1px solid var(--bp-rule)', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--bp-font-serif)', fontSize: '1.375rem', fontWeight: 400, margin: '0 0 0.375rem', color: 'var(--bp-ink)' }}>
                {guest.name}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <AttendingBadge status={guest.status} />
                {guest.side && <span style={{ fontSize: '0.8rem', color: 'var(--bp-ink-3)' }}>{guest.side}</span>}
                {respondedLabel && <span style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)' }}>· Geantwortet {respondedLabel}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
              <button
                className={`bp-btn bp-btn-sm bp-btn-icon${editing ? ' bp-btn-primary' : ' bp-btn-ghost'}`}
                onClick={() => editing ? cancelEdit() : setEditing(true)}
                title={editing ? 'Abbrechen' : 'Bearbeiten'}
              >
                <Edit2 size={14} />
              </button>
              <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={onClose}><X size={18} /></button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '1.25rem 1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {editing ? (
            <>
              <div className="bp-grid-2">
                <div className="bp-field" style={{ marginBottom: 0 }}>
                  <label className="bp-label-text">Name</label>
                  <input className="bp-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="bp-field" style={{ marginBottom: 0 }}>
                  <label className="bp-label-text">Seite</label>
                  <select className="bp-select" value={form.side} onChange={e => setForm(p => ({ ...p, side: e.target.value }))}>
                    <option value="">Nicht zugeordnet</option>
                    <option value="Braut">Brautseite</option>
                    <option value="Bräutigam">Bräutigam-Seite</option>
                    <option value="Gemeinsam">Gemeinsam</option>
                  </select>
                </div>
                <div className="bp-field" style={{ marginBottom: 0 }}>
                  <label className="bp-label-text">E-Mail</label>
                  <input className="bp-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="bp-field" style={{ marginBottom: 0 }}>
                  <label className="bp-label-text">Telefon</label>
                  <input className="bp-input" type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div className="bp-field" style={{ marginBottom: 0 }}>
                <label className="bp-label-text">Notizen</label>
                <textarea className="bp-textarea" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Interne Notizen zu diesem Gast…" />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="bp-btn bp-btn-ghost bp-btn-sm" onClick={cancelEdit}>Abbrechen</button>
                <button className="bp-btn bp-btn-primary bp-btn-sm" onClick={save} disabled={saving}>{saving ? '…' : 'Speichern'}</button>
              </div>
            </>
          ) : (
            <>
              {/* Kontakt */}
              {(guest.email || guest.phone) && (
                <InfoSection title="Kontakt">
                  {guest.email && <InfoRow label="E-Mail" value={guest.email} />}
                  {guest.phone && <InfoRow label="Telefon" value={guest.phone} last={!guest.email || !guest.phone} />}
                </InfoSection>
              )}

              {/* Menü & Ernährung */}
              {guest.status === 'zugesagt' && (guest.meal_choice || guest.trink_alkohol !== null || (guest.allergy_tags && guest.allergy_tags.length > 0) || guest.allergy_custom) && (
                <InfoSection title="Menü & Ernährung">
                  {guest.meal_choice && <InfoRow label="Menü" value={MEAL_LABELS[guest.meal_choice] ?? guest.meal_choice} />}
                  {guest.trink_alkohol !== null && guest.trink_alkohol !== undefined && (
                    <InfoRow label="Alkohol" value={guest.trink_alkohol ? 'Ja' : 'Nein'} />
                  )}
                  {guest.allergy_tags && guest.allergy_tags.length > 0 && (
                    <InfoRow label="Allergien" value={guest.allergy_tags.join(', ')} />
                  )}
                  {guest.allergy_custom && <InfoRow label="Sonstiges" value={guest.allergy_custom} last />}
                </InfoSection>
              )}

              {/* Anreise */}
              {guest.status === 'zugesagt' && (guest.arrival_date || guest.arrival_time || guest.transport_mode) && (
                <InfoSection title="Anreise">
                  {guest.arrival_date && (
                    <InfoRow label="Datum" value={new Date(guest.arrival_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })} />
                  )}
                  {guest.arrival_time && <InfoRow label="Uhrzeit" value={guest.arrival_time} />}
                  {guest.transport_mode && <InfoRow label="Transport" value={TRANSPORT_LABELS[guest.transport_mode] ?? guest.transport_mode} last />}
                </InfoSection>
              )}

              {/* Hotel */}
              {guest.status === 'zugesagt' && roomEntry && (
                <InfoSection title="Hotel">
                  <InfoRow label="Hotel" value={roomEntry.hotelName} />
                  {roomEntry.room_type && <InfoRow label="Zimmertyp" value={roomEntry.room_type} last />}
                </InfoSection>
              )}

              {/* Begleitpersonen */}
              {guest.status === 'zugesagt' && begleit.length > 0 && (
                <InfoSection title={`Begleitpersonen (${begleit.length})`}>
                  {begleit.map((b, i) => (
                    <div key={b.id} style={{ paddingBottom: i < begleit.length - 1 ? '0.75rem' : 0, marginBottom: i < begleit.length - 1 ? '0.75rem' : 0, borderBottom: i < begleit.length - 1 ? '1px solid var(--bp-rule)' : 'none' }}>
                      <p style={{ fontWeight: 600, color: 'var(--bp-ink)', fontSize: '0.875rem', margin: '0 0 0.25rem' }}>{b.name || `Person ${i + 1}`}</p>
                      {b.age_category && <InfoRow label="Alter" value={AGE_LABELS[b.age_category] ?? b.age_category} />}
                      {b.meal_choice && <InfoRow label="Menü" value={MEAL_LABELS[b.meal_choice] ?? b.meal_choice} />}
                      {b.allergy_tags && b.allergy_tags.length > 0 && <InfoRow label="Allergien" value={b.allergy_tags.join(', ')} last />}
                    </div>
                  ))}
                </InfoSection>
              )}

              {/* Nachricht vom Gast */}
              {guest.message && (
                <InfoSection title="Nachricht">
                  <p style={{ fontSize: '0.875rem', color: 'var(--bp-ink-2)', fontStyle: 'italic', margin: 0, lineHeight: 1.6 }}>„{guest.message}"</p>
                </InfoSection>
              )}

              {/* Interne Notizen */}
              {guest.notes && (
                <InfoSection title="Notizen (intern)">
                  <p style={{ fontSize: '0.875rem', color: 'var(--bp-ink-2)', margin: 0, lineHeight: 1.6 }}>{guest.notes}</p>
                </InfoSection>
              )}

              {/* RSVP-Link */}
              {guest.token && (
                <InfoSection title="Einladungslink">
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <code style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)', background: 'var(--bp-paper)', padding: '0.375rem 0.625rem', borderRadius: 'var(--bp-r-sm)', border: '1px solid var(--bp-rule)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      /rsvp/{guest.token.slice(0, 28)}…
                    </code>
                    <button className="bp-btn bp-btn-secondary bp-btn-sm" onClick={copyLink} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      {copied ? <><Check size={13} /> Kopiert</> : <><Copy size={13} /> Kopieren</>}
                    </button>
                  </div>
                </InfoSection>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Gästeliste tab ────────────────────────────────────────────────────────────

function GaestelisteTab({ guests, begleitpersonen, eventId, userId, hotels, onUpdate, onDelete }: {
  guests: Guest[]; begleitpersonen: BegleitRow[]; eventId: string; userId: string; hotels: Hotel[]
  onUpdate: (g: Guest) => void; onDelete: (id: string) => void
}) {
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState<'all' | 'zugesagt' | 'abgesagt' | 'ausstehend'>('all')
  const [adding, setAdding]       = useState(false)
  const [newName, setNewName]     = useState('')
  const [newSide, setNewSide]     = useState('')
  const [newEmail, setNewEmail]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting]   = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)

  // Begleitpersonen je Gast (für Anzeige unter dem Gastnamen + Suche)
  const begleitByGuest = new Map<string, BegleitRow[]>()
  for (const b of begleitpersonen) {
    const list = begleitByGuest.get(b.guest_id)
    if (list) list.push(b)
    else begleitByGuest.set(b.guest_id, [b])
  }

  const filtered = guests.filter(g => {
    const q = search.toLowerCase()
    const companions = begleitByGuest.get(g.id) ?? []
    const matchSearch =
      g.name.toLowerCase().includes(q) ||
      companions.some(b => (b.name ?? '').toLowerCase().includes(q))
    const matchFilter = filter === 'all' || g.status === filter
    return matchSearch && matchFilter
  })

  async function addGuest() {
    if (!newName.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('guests')
      .insert({
        event_id: eventId, name: titleCaseName(newName),
        side: newSide || null, email: newEmail.trim() || null,
        status: 'angelegt', created_by: userId,
        token: crypto.randomUUID(),
      })
      .select().single()
    setSaving(false)
    if (!error && data) {
      onUpdate(data as Guest)
      setNewName(''); setNewSide(''); setNewEmail(''); setAdding(false)
    }
  }

  async function deleteGuest(id: string) {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('guests').delete().eq('id', id)
    setDeleting(false)
    if (!error) {
      setConfirmDeleteId(null)
      onDelete(id)
    }
  }

  const ja = guests.filter(g => g.status === 'zugesagt').length
  const nein = guests.filter(g => g.status === 'abgesagt').length
  const ausstehend = guests.filter(g => g.status !== 'zugesagt' && g.status !== 'abgesagt').length
  const begleitCount = begleitpersonen.length
  // Erwartete Personen am Event: zugesagte Gäste + deren Begleitpersonen
  const personenGesamt = ja + begleitpersonen.filter(b => guests.find(g => g.id === b.guest_id)?.status === 'zugesagt').length

  return (
    <div>
      <div style={{
        display: 'flex',
        gap: 0,
        marginBottom: '1.25rem',
        background: 'var(--bp-paper)',
        border: '1px solid var(--bp-rule)',
        borderRadius: 'var(--bp-r-sm)',
        boxShadow: 'var(--bp-shadow-card)',
        overflow: 'hidden',
        width: '100%',
      }}>
        {[
          { label: 'Gesamt',         value: guests.length,  color: 'var(--bp-ink)' },
          { label: 'Zugesagt',       value: ja,             color: '#15803D' },
          { label: 'Abgesagt',       value: nein,           color: '#B91C1C' },
          { label: 'Ausstehend',     value: ausstehend,     color: 'var(--bp-ink-3)' },
          { label: 'Begleitpers.',   value: begleitCount,   color: 'var(--bp-gold-deep)' },
          { label: 'Pers. erwartet', value: personenGesamt, color: 'var(--bp-ink)' },
        ].map((s, i) => (
          <div key={s.label} style={{
            flex: 1,
            minWidth: 0,
            padding: '0.375rem 0.25rem',
            borderLeft: i > 0 ? '1px solid var(--bp-rule)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
          }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="bp-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name suchen…" style={{ flex: 1, minWidth: 200 }} />
        <select className="bp-select" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} style={{ width: 'auto' }}>
          <option value="all">Alle</option>
          <option value="zugesagt">Zugesagt</option>
          <option value="abgesagt">Abgesagt</option>
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

      <div className="bp-hide-mobile bp-card" style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="bp-empty">
            <div className="bp-empty-title">Keine Gäste gefunden</div>
            <div className="bp-empty-body">Passt eure Suche oder den Filter an.</div>
          </div>
        ) : (
          <table className="bp-table">
            <thead>
              <tr>
                <th>Name</th><th>Status</th><th>Seite</th><th>Menü</th><th>Allergien</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => {
                const companions = begleitByGuest.get(g.id) ?? []
                return (
                <tr
                  key={g.id}
                  onClick={() => setSelectedGuest(g)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 500, color: 'var(--bp-ink)' }}>
                    {g.name}
                    {companions.length > 0 && (
                      <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {companions.map(b => (
                          <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', fontWeight: 400, color: 'var(--bp-ink-3)' }}>
                            <UserPlus2 size={11} style={{ flexShrink: 0 }} />
                            {b.name || 'Begleitung'}
                            {b.age_category === 'kind' && ' (Kind)'}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td><AttendingBadge status={g.status} /></td>
                  <td style={{ color: 'var(--bp-ink-3)' }}>{g.side ?? '—'}</td>
                  <td style={{ color: 'var(--bp-ink-3)' }}>{g.meal_choice ? (MEAL_LABELS[g.meal_choice] ?? g.meal_choice) : '—'}</td>
                  <td>
                    {g.allergy_tags && g.allergy_tags.length > 0
                      ? g.allergy_tags.map(t => <span key={t} className="bp-badge bp-badge-neutral" style={{ marginRight: 4 }}>{t}</span>)
                      : '—'}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                    <button
                      className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon"
                      onClick={() => setConfirmDeleteId(g.id)}
                      title="Gast löschen"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bp-mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.length === 0 ? (
          <div className="bp-empty">
            <div className="bp-empty-title">Keine Gäste gefunden</div>
            <div className="bp-empty-body">Passt eure Suche oder den Filter an.</div>
          </div>
        ) : filtered.map(g => {
          const companions = begleitByGuest.get(g.id) ?? []
          return (
          <div
            key={g.id}
            className="bp-card"
            onClick={() => setSelectedGuest(g)}
            style={{ padding: '0.875rem 1rem', cursor: 'pointer', touchAction: 'manipulation', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--bp-ink)', fontSize: '0.9375rem', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {g.name}
              </div>
              {companions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: '0.25rem' }}>
                  {companions.map(b => (
                    <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--bp-ink-3)' }}>
                      <UserPlus2 size={11} style={{ flexShrink: 0 }} />
                      {b.name || 'Begleitung'}
                      {b.age_category === 'kind' && ' (Kind)'}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <AttendingBadge status={g.status} />
                {g.side && <span style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)' }}>{g.side}</span>}
                {g.meal_choice && <span style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)' }}>{MEAL_LABELS[g.meal_choice] ?? g.meal_choice}</span>}
              </div>
            </div>
            <button
              className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon"
              onClick={e => { e.stopPropagation(); setConfirmDeleteId(g.id) }}
              title="Gast löschen"
            >
              <Trash2 size={14} />
            </button>
          </div>
          )
        })}
      </div>

      {confirmDeleteId && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(44,40,37,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteId(null) }}
        >
          <div style={{ background: 'var(--bp-paper)', borderRadius: 'var(--bp-r-lg)', padding: '1.75rem', width: '100%', maxWidth: 360, boxShadow: 'var(--bp-shadow-elevated)' }}>
            <h2 className="bp-h2" style={{ margin: '0 0 0.75rem' }}>Gast löschen?</h2>
            <p className="bp-caption" style={{ margin: '0 0 1.5rem' }}>Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="bp-btn bp-btn-ghost" onClick={() => setConfirmDeleteId(null)}>Abbrechen</button>
              <button
                className="bp-btn bp-btn-sm"
                style={{ background: '#B91C1C', color: '#fff', border: 'none', height: 40 }}
                onClick={() => deleteGuest(confirmDeleteId)}
                disabled={deleting}
              >
                {deleting ? '…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedGuest && (
        <GuestLightbox
          guest={selectedGuest}
          hotels={hotels}
          onClose={() => setSelectedGuest(null)}
          onUpdate={g => { onUpdate(g); setSelectedGuest(g) }}
        />
      )}
    </div>
  )
}

// ── Einladungen (RSVP) tab ────────────────────────────────────────────────────

type InviteFilter = 'alle' | 'nicht_eingeladen' | 'ausstehend' | 'zugesagt' | 'abgesagt'

function RsvpTab({ eventId, guests, onUpdateGuest, invitationText, openInviteToken, openInviteEnabled }: {
  eventId: string
  guests: Guest[]
  onUpdateGuest: (g: Guest) => void
  invitationText: string | null
  openInviteToken: string | null
  openInviteEnabled: boolean
}) {
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null)
  const [emailInput, setEmailInput]         = useState('')
  const [savingEmail, setSavingEmail]       = useState(false)
  const [copiedId, setCopiedId]             = useState<string | null>(null)
  const [qrGuestId, setQrGuestId]           = useState<string | null>(null)
  const [qrDataUrls, setQrDataUrls]         = useState<Record<string, string>>({})
  const [qrLoading, setQrLoading]           = useState(false)
  const [selected, setSelected]             = useState<Set<string>>(new Set())
  const [massModal, setMassModal]           = useState(false)
  const [allLinksCopied, setAllLinksCopied] = useState(false)
  const [search, setSearch]                 = useState('')
  const [statusFilter, setStatusFilter]     = useState<InviteFilter>('alle')
  const [zipBusy, setZipBusy]               = useState(false)
  const [openToken, setOpenToken]           = useState(openInviteToken)
  const [openEnabled, setOpenEnabled]       = useState(openInviteEnabled)
  const [openBusy, setOpenBusy]             = useState(false)
  const [openCopied, setOpenCopied]         = useState(false)

  const isInvited = (g: Guest) => Boolean(g.invited_at) || g.status === 'eingeladen'

  function matchesFilter(g: Guest): boolean {
    switch (statusFilter) {
      case 'nicht_eingeladen': return !isInvited(g) && g.status !== 'zugesagt' && g.status !== 'abgesagt'
      case 'ausstehend':       return ['angelegt', 'eingeladen', 'vielleicht'].includes(g.status)
      case 'zugesagt':         return g.status === 'zugesagt'
      case 'abgesagt':         return g.status === 'abgesagt'
      default:                 return true
    }
  }

  const FILTERS: { key: InviteFilter; label: string; count: number }[] = [
    { key: 'alle',             label: 'Alle',             count: guests.length },
    { key: 'nicht_eingeladen', label: 'Nicht eingeladen', count: guests.filter(g => !isInvited(g) && g.status !== 'zugesagt' && g.status !== 'abgesagt').length },
    { key: 'ausstehend',       label: 'Ausstehend',       count: guests.filter(g => ['angelegt', 'eingeladen', 'vielleicht'].includes(g.status)).length },
    { key: 'zugesagt',         label: 'Zugesagt',         count: guests.filter(g => g.status === 'zugesagt').length },
    { key: 'abgesagt',         label: 'Abgesagt',         count: guests.filter(g => g.status === 'abgesagt').length },
  ]

  const filtered     = guests.filter(g => g.name.toLowerCase().includes(search.toLowerCase()) && matchesFilter(g))
  const allSelected  = filtered.length > 0 && filtered.every(g => selected.has(g.id))
  const someSelected = selected.size > 0

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) { filtered.forEach(g => next.delete(g.id)) }
      else             { filtered.forEach(g => next.add(g.id)) }
      return next
    })
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function getRsvpUrl(token: string) {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/rsvp/${token}`
  }

  // Einladungstext-Vorlage (Gäste-Einstellungen) mit {{Name}}-Platzhalter + Link
  function buildMessage(guest: Guest) {
    const fallback = 'Liebe/r {{Name}},\n\nwir laden dich herzlich zu unserer Hochzeit ein. Bitte gib uns über den folgenden Link Bescheid.'
    const base = (invitationText?.trim() || fallback).replace(/\{\{\s*Name\s*\}\}/g, guest.name)
    return `${base}\n\n${getRsvpUrl(guest.token!)}`
  }

  // Versand-Tracking: beim ersten Kopieren/Teilen wird der Gast als
  // "eingeladen" markiert (Status nur ändern, solange noch keine Antwort da ist)
  async function markInvited(guest: Guest) {
    if (guest.invited_at) return
    const invited_at = new Date().toISOString()
    const newStatus = guest.status === 'angelegt' ? 'eingeladen' : guest.status
    onUpdateGuest({ ...guest, invited_at, status: newStatus })
    const supabase = createClient()
    await supabase.from('guests').update({ invited_at, status: newStatus }).eq('id', guest.id)
  }

  function copyLink(guest: Guest) {
    if (!guest.token) return
    navigator.clipboard.writeText(buildMessage(guest)).then(() => {
      setCopiedId(guest.id)
      setTimeout(() => setCopiedId(null), 2000)
      void markInvited(guest)
    })
  }

  function shareWhatsApp(guest: Guest) {
    if (!guest.token) return
    window.open(`https://wa.me/?text=${encodeURIComponent(buildMessage(guest))}`, '_blank', 'noopener')
    void markInvited(guest)
  }

  async function shareNative(guest: Guest) {
    if (!guest.token) return
    try {
      await navigator.share({ text: buildMessage(guest) })
      void markInvited(guest)
    } catch { /* abgebrochen */ }
  }

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

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

  const selectedGuests = guests.filter(g => selected.has(g.id))

  function copyAllLinks() {
    const withToken = selectedGuests.filter(g => g.token)
    const text = withToken
      .map(g => `${g.name}\n${getRsvpUrl(g.token!)}`)
      .join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      setAllLinksCopied(true)
      setTimeout(() => setAllLinksCopied(false), 2000)
      withToken.forEach(g => void markInvited(g))
    })
  }

  function openBccMail() {
    const withEmailList = selectedGuests.filter(g => g.email && g.token)
    const emails = withEmailList.map(g => g.email!).join(',')
    if (!emails) return
    const subject = encodeURIComponent('Eure persönliche Hochzeitseinladung')
    const body = encodeURIComponent(
      'Liebe Gäste,\n\neure persönlichen RSVP-Links findet ihr unten in dieser Nachricht.\n\nWir freuen uns auf eure Antwort!\n\n' +
      withEmailList.map(g => `${g.name}: ${getRsvpUrl(g.token!)}`).join('\n')
    )
    window.open(`mailto:?bcc=${encodeURIComponent(emails)}&subject=${subject}&body=${body}`)
    withEmailList.forEach(g => void markInvited(g))
  }

  // QR-Codes aller ausgewählten Gäste als ZIP herunterladen
  async function downloadQrZip() {
    const withToken = selectedGuests.filter(g => g.token)
    if (withToken.length === 0) return
    setZipBusy(true)
    try {
      const [{ default: QRCode }, { default: JSZip }] = await Promise.all([
        import('qrcode'),
        import('jszip'),
      ])
      const zip = new JSZip()
      for (const g of withToken) {
        const dataUrl = await QRCode.toDataURL(getRsvpUrl(g.token!), {
          width: 512, margin: 2, color: { dark: '#3D3833', light: '#FFFFFF' },
        })
        zip.file(`RSVP-QR-${g.name.replace(/[^\wäöüÄÖÜß-]+/g, '-')}.png`, dataUrl.split(',')[1], { base64: true })
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'einladungs-qr-codes.zip'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      console.error('QR-ZIP fehlgeschlagen', e)
    } finally {
      setZipBusy(false)
    }
  }

  // Sammel-Link aktivieren/deaktivieren
  async function toggleOpenInvite() {
    setOpenBusy(true)
    try {
      const res = await fetch(`/api/events/${eventId}/open-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !openEnabled }),
      })
      const data = await res.json()
      if (res.ok) {
        setOpenEnabled(data.enabled)
        setOpenToken(data.token)
      }
    } finally {
      setOpenBusy(false)
    }
  }

  const openInviteUrl = openToken && typeof window !== 'undefined'
    ? `${window.location.origin}/einladung/${openToken}`
    : null

  function copyOpenInviteLink() {
    if (!openInviteUrl) return
    navigator.clipboard.writeText(openInviteUrl).then(() => {
      setOpenCopied(true)
      setTimeout(() => setOpenCopied(false), 2000)
    })
  }

  const activeQrGuest = qrGuestId ? guests.find(g => g.id === qrGuestId) ?? null : null
  const activeQrUrl   = activeQrGuest ? qrDataUrls[activeQrGuest.id] ?? null : null
  const withEmail     = selectedGuests.filter(g => g.email && g.token).length
  const withoutEmail  = selectedGuests.filter(g => !g.email).length

  return (
    <div>
      {/* Sammel-Link: Gäste registrieren sich selbst (mit Bestätigung) */}
      <div className="bp-card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'var(--bp-gold-pale)', color: 'var(--bp-gold-deep)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Link2 size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--bp-ink)', margin: 0 }}>Sammel-Link</p>
            <p className="bp-caption" style={{ margin: '0.125rem 0 0' }}>
              Ein Link für alle: Gäste tragen sich selbst ein und erscheinen nach eurer Bestätigung in der Gästeliste.
            </p>
          </div>
          {openEnabled && openInviteUrl && (
            <button
              className="bp-btn bp-btn-secondary bp-btn-sm"
              onClick={copyOpenInviteLink}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            >
              {openCopied ? <><Check size={13} /> Kopiert</> : <><Copy size={13} /> Link kopieren</>}
            </button>
          )}
          <button
            className={`bp-btn ${openEnabled ? 'bp-btn-secondary' : 'bp-btn-primary'} bp-btn-sm`}
            onClick={toggleOpenInvite}
            disabled={openBusy}
          >
            {openBusy ? '…' : openEnabled ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </div>
        {openEnabled && openInviteUrl && (
          <p style={{
            fontSize: '0.75rem', color: 'var(--bp-ink-3)', fontFamily: 'monospace',
            margin: '0.625rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {openInviteUrl}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="bp-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Name suchen…"
          style={{ flex: 1, minWidth: 200 }}
        />
      </div>

      {/* Status-Filter */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.3rem 0.75rem', borderRadius: 999, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.8125rem',
              border: `1px solid ${statusFilter === f.key ? 'var(--bp-gold)' : 'var(--bp-rule)'}`,
              background: statusFilter === f.key ? 'var(--bp-gold-pale)' : 'var(--bp-paper)',
              color: statusFilter === f.key ? 'var(--bp-gold-deep)' : 'var(--bp-ink-2)',
              fontWeight: statusFilter === f.key ? 600 : 400,
            }}
          >
            {f.label}
            <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>({f.count})</span>
          </button>
        ))}
      </div>

      {/* Action bar */}
      {someSelected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          background: 'var(--bp-gold-pale)', border: '1px solid var(--bp-gold-rule)',
          borderRadius: 'var(--bp-r-md)', padding: '0.625rem 1rem', marginBottom: '0.75rem',
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--bp-ink)', marginRight: 'auto' }}>
            {selected.size} {selected.size === 1 ? 'Gast' : 'Gäste'} ausgewählt
          </span>
          <button
            className="bp-btn bp-btn-secondary bp-btn-sm"
            onClick={copyAllLinks}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            {allLinksCopied ? <><Check size={13} /> Kopiert</> : <><Copy size={13} /> Alle Links kopieren</>}
          </button>
          <button
            className="bp-btn bp-btn-secondary bp-btn-sm"
            onClick={downloadQrZip}
            disabled={zipBusy}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <QrCode size={13} /> {zipBusy ? 'Erstelle ZIP…' : 'QR-Codes (ZIP)'}
          </button>
          <button
            className="bp-btn bp-btn-primary bp-btn-sm"
            onClick={() => setMassModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Mail size={13} /> Masseneinladung
          </button>
          <button className="bp-btn bp-btn-ghost bp-btn-sm" onClick={() => setSelected(new Set())}>
            Auswahl aufheben
          </button>
        </div>
      )}

      <div className="bp-card" style={{ overflow: 'hidden' }}>
        {guests.length === 0 ? (
          <div className="bp-empty">
            <div className="bp-empty-title">Noch keine Gäste</div>
            <div className="bp-empty-body">Fügt Gäste in der Gästeliste hinzu.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bp-empty">
            <div className="bp-empty-title">Keine Ergebnisse</div>
            <div className="bp-empty-body">Kein Gast passt zur Suche.</div>
          </div>
        ) : (
          <table className="bp-table">
            <thead>
              <tr>
                <th style={{ width: 36, paddingRight: 0 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer', accentColor: 'var(--bp-gold)' }}
                  />
                </th>
                <th>Gast</th><th>Status</th><th className="bp-hide-mobile">E-Mail</th><th style={{ textAlign: 'right' }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(guest => (
                <tr key={guest.id} onClick={() => toggleOne(guest.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ paddingRight: 0 }} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(guest.id)}
                      onChange={() => toggleOne(guest.id)}
                      style={{ cursor: 'pointer', accentColor: 'var(--bp-gold)' }}
                    />
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--bp-ink)' }}>{guest.name}</td>
                  <td><InviteBadge guest={guest} /></td>
                  <td className="bp-hide-mobile" onClick={e => e.stopPropagation()}>
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
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button
                        className="bp-btn bp-btn-secondary bp-btn-sm"
                        onClick={() => shareWhatsApp(guest)}
                        disabled={!guest.token}
                        title="Einladung per WhatsApp teilen"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </button>
                      {canNativeShare && (
                        <button
                          className="bp-btn bp-btn-secondary bp-btn-sm bp-btn-icon"
                          onClick={() => shareNative(guest)}
                          disabled={!guest.token}
                          aria-label="Einladung teilen"
                        >
                          <Share2 size={13} />
                        </button>
                      )}
                      <button className="bp-btn bp-btn-secondary bp-btn-sm" onClick={() => copyLink(guest)} disabled={!guest.token} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {copiedId === guest.id ? <Check size={13} /> : <Copy size={13} />}
                        {copiedId === guest.id ? 'Kopiert' : 'Link'}
                      </button>
                      <button className="bp-btn bp-btn-secondary bp-btn-sm" onClick={() => toggleQr(guest)} disabled={!guest.token} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <QrCode size={13} /> QR
                      </button>
                      {guest.email && guest.token && (
                        <a
                          href={`mailto:${guest.email}?subject=${encodeURIComponent('Eure Hochzeitseinladung')}&body=${encodeURIComponent(buildMessage(guest))}`}
                          onClick={() => void markInvited(guest)}
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

      {/* QR panel */}
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

      {/* Mass invite modal */}
      {massModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(44,40,37,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setMassModal(false) }}
        >
          <div style={{ background: 'var(--bp-paper)', borderRadius: 'var(--bp-r-lg)', width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', boxShadow: 'var(--bp-shadow-elevated)' }}>
            <div style={{ position: 'sticky', top: 0, background: 'var(--bp-paper)', borderBottom: '1px solid var(--bp-rule)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="bp-h2" style={{ margin: '0 0 0.25rem' }}>Masseneinladung</h2>
                <p className="bp-caption" style={{ margin: 0 }}>
                  {selected.size} {selected.size === 1 ? 'Gast' : 'Gäste'} ausgewählt
                  {withoutEmail > 0 && <span style={{ color: '#B91C1C', marginLeft: '0.5rem' }}>· {withoutEmail} ohne E-Mail</span>}
                </p>
              </div>
              <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={() => setMassModal(false)}><X size={18} /></button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem' }}>
              {/* Bulk actions */}
              <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <button
                  className="bp-btn bp-btn-primary"
                  onClick={openBccMail}
                  disabled={withEmail === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Mail size={15} /> E-Mail-Programm öffnen ({withEmail} mit E-Mail)
                </button>
                <button
                  className="bp-btn bp-btn-secondary"
                  onClick={copyAllLinks}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {allLinksCopied ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Alle Links kopieren</>}
                </button>
              </div>

              {/* Per-guest list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedGuests.map(guest => {
                  const url = guest.token ? getRsvpUrl(guest.token) : null
                  return (
                    <div key={guest.id} style={{
                      background: 'var(--bp-bg)', borderRadius: 'var(--bp-r-md)',
                      border: '1px solid var(--bp-rule)', padding: '0.75rem 1rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 600, color: 'var(--bp-ink)', fontSize: '0.9rem', margin: '0 0 0.2rem' }}>{guest.name}</p>
                          {guest.email
                            ? <p style={{ fontSize: '0.8125rem', color: 'var(--bp-ink-3)', margin: 0 }}>{guest.email}</p>
                            : <p style={{ fontSize: '0.8125rem', color: '#B91C1C', margin: 0 }}>Keine E-Mail hinterlegt</p>
                          }
                          {url && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)', fontFamily: 'monospace', margin: '0.25rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {url}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                          {url && (
                            <button
                              className="bp-btn bp-btn-secondary bp-btn-sm"
                              onClick={() => shareWhatsApp(guest)}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                            >
                              <MessageCircle size={13} /> WhatsApp
                            </button>
                          )}
                          {guest.email && url && (
                            <a
                              href={`mailto:${guest.email}?subject=${encodeURIComponent('Deine persönliche Hochzeitseinladung')}&body=${encodeURIComponent(buildMessage(guest))}`}
                              onClick={() => void markInvited(guest)}
                              className="bp-btn bp-btn-secondary bp-btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none' }}
                            >
                              <Mail size={13} /> Mail
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
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
      phone_contact: settings?.phone_contact?.trim() || null,
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
      <div className="bp-field">
        <label className="bp-label-text">Kontaktnummer (bei Fragen)</label>
        <p className="bp-caption" style={{ marginBottom: '0.5rem' }}>Wird auf der RSVP-Seite angezeigt, wenn die Frist abgelaufen ist.</p>
        <input
          className="bp-input"
          type="tel"
          value={s?.phone_contact ?? ''}
          onChange={e => setSettings(prev => ({ ...(prev ?? {} as RsvpSettings), phone_contact: e.target.value }))}
          placeholder="+49 123 456789"
        />
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
      <button className="bp-btn bp-btn-primary" onClick={save} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        {saved && <Check size={16} />}
        {saving ? 'Speichert…' : saved ? 'Gespeichert' : 'Einstellungen speichern'}
      </button>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

// Selbstregistrierte Gäste (Sammel-Link) — Bestätigungs-Schritt
function PendingApprovals({ pending, onApprove, onReject }: {
  pending: Guest[]
  onApprove: (g: Guest) => void
  onReject: (g: Guest) => void
}) {
  if (pending.length === 0) return null
  return (
    <div className="bp-card" style={{ marginBottom: '1.25rem', border: '1px solid var(--bp-rule-gold)' }}>
      <div className="bp-card-header">
        <span className="bp-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserCheck size={16} style={{ color: 'var(--bp-gold-deep)' }} />
          Neue Anmeldungen über den Sammel-Link
        </span>
        <span className="bp-badge bp-badge-gold">{pending.length}</span>
      </div>
      <div className="bp-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {pending.map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <span style={{ fontWeight: 500, color: 'var(--bp-ink)', fontSize: '0.9375rem' }}>{g.name}</span>
              <span className="bp-caption" style={{ marginLeft: '0.5rem' }}>
                {g.status === 'zugesagt' ? 'hat zugesagt' : g.status === 'abgesagt' ? 'hat abgesagt' : 'noch keine Antwort'}
              </span>
            </div>
            <button className="bp-btn bp-btn-primary bp-btn-sm" onClick={() => onApprove(g)} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Check size={13} /> Bestätigen
            </button>
            <button className="bp-btn bp-btn-danger bp-btn-sm" onClick={() => onReject(g)} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <X size={13} /> Ablehnen
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BrautpaarGaeste({ eventId, userId, initialGuests, initialBegleitpersonen, mealOptions, childrenAllowed, hotels, rsvpSettings, openInviteToken, openInviteEnabled }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('gaesteliste')
  const [guests, setGuests]       = useState<Guest[]>(initialGuests)

  const handleGuestUpdate = useCallback((g: Guest) => {
    setGuests(prev => {
      const exists = prev.some(x => x.id === g.id)
      return exists ? prev.map(x => x.id === g.id ? g : x) : [...prev, g]
    })
  }, [])

  const handleGuestDelete = useCallback((id: string) => {
    setGuests(prev => prev.filter(g => g.id !== id))
  }, [])

  // Sammel-Link-Anmeldungen erst nach Bestätigung als vollwertige Gäste zeigen
  const pendingGuests = guests.filter(g => g.pending_approval)
  const activeGuests  = guests.filter(g => !g.pending_approval)

  const approveGuest = useCallback(async (g: Guest) => {
    handleGuestUpdate({ ...g, pending_approval: false })
    const supabase = createClient()
    await supabase.from('guests').update({ pending_approval: false }).eq('id', g.id)
  }, [handleGuestUpdate])

  const rejectGuest = useCallback(async (g: Guest) => {
    handleGuestDelete(g.id)
    const supabase = createClient()
    await supabase.from('guests').delete().eq('id', g.id)
  }, [handleGuestDelete])

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Gäste</h1>
      </div>

      <PendingApprovals pending={pendingGuests} onApprove={approveGuest} onReject={rejectGuest} />

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
        {activeTab === 'gaesteliste'   && <GaestelisteTab guests={activeGuests} begleitpersonen={initialBegleitpersonen} eventId={eventId} userId={userId} hotels={hotels} onUpdate={handleGuestUpdate} onDelete={handleGuestDelete} />}
        {activeTab === 'geschenke'     && <GeschenkTab eventId={eventId} />}
        {activeTab === 'hotel'         && <HotelTab eventId={eventId} hotels={hotels} />}
        {activeTab === 'rsvp'          && (
          <RsvpTab
            eventId={eventId}
            guests={activeGuests}
            onUpdateGuest={handleGuestUpdate}
            invitationText={rsvpSettings?.invitation_text ?? null}
            openInviteToken={openInviteToken}
            openInviteEnabled={openInviteEnabled}
          />
        )}
        {activeTab === 'einstellungen' && <EinstellungenTab eventId={eventId} rsvpSettings={rsvpSettings} />}
      </div>
    </div>
  )
}
