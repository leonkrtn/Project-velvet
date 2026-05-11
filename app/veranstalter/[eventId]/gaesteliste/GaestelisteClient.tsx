'use client'
import React, { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Search, X, Edit2, ChevronDown, ChevronRight, Star } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Guest {
  id: string
  name: string
  status: string
  side: string | null
  allergy_tags: string[]
  allergy_custom: string | null
  meal_choice: string | null
}

interface HotelRoom {
  id: string
  hotel_id: string
  room_type: string
  room_number: string | null
  total_rooms: number
  max_occupancy: number
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

interface Props {
  eventId: string
  initialGuests: Guest[]
  mealOptions: string[]
  initialHotels: Hotel[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['angelegt', 'eingeladen', 'zugesagt', 'abgesagt']
const STATUS_LABELS: Record<string, string> = {
  angelegt: 'Angelegt', eingeladen: 'Eingeladen', zugesagt: 'Zugesagt', abgesagt: 'Abgesagt',
}
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  zugesagt: { bg: '#EAF5EE', color: '#3D7A56' },
  abgesagt: { bg: '#FDEAEA', color: '#A04040' },
  eingeladen: { bg: '#FFF8E6', color: '#B8860B' },
  angelegt: { bg: '#F0F0F0', color: '#666' },
}
const SIDE_OPTIONS = ['Braut', 'Bräutigam', 'Beide']
const ALLERGY_TAGS = ['Glutenfrei', 'Laktosefrei', 'Vegan', 'Vegetarisch', 'Nussallergie', 'Sonstige']

// ── Helpers ───────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>
      {children}
    </label>
  )
}

function FieldInput({ value, onChange, placeholder, type = 'text' }: { value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' }}
    />
  )
}

// ── Star Picker ───────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: (value ?? 0) >= n ? '#f5a623' : 'var(--border)' }}
        >
          <Star size={18} fill={(value ?? 0) >= n ? '#f5a623' : 'none'} />
        </button>
      ))}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

// ── Hotel Tab ─────────────────────────────────────────────────────────────────

function HotelTab({ eventId, initialHotels }: { eventId: string; initialHotels: Hotel[] }) {
  const supabase = createClient()
  const [hotels, setHotels] = useState<Hotel[]>(initialHotels)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [hotelModal, setHotelModal] = useState<Hotel | 'new' | null>(null)
  const [roomModal, setRoomModal] = useState<{ hotelId: string; room: HotelRoom | 'new' } | null>(null)
  const [saving, setSaving] = useState(false)

  // Hotel form state
  const [hName, setHName] = useState('')
  const [hAddr, setHAddr] = useState('')
  const [hStars, setHStars] = useState<number | null>(null)
  const [hWeb, setHWeb] = useState('')
  const [hNotes, setHNotes] = useState('')

  // Room form state
  const [rType, setRType] = useState('')
  const [rNum, setRNum] = useState('')
  const [rTotal, setRTotal] = useState('')
  const [rOcc, setROcc] = useState('')
  const [rPrice, setRPrice] = useState('')
  const [rDesc, setRDesc] = useState('')

  function openHotel(h: Hotel | 'new') {
    setHotelModal(h)
    if (h === 'new') { setHName(''); setHAddr(''); setHStars(null); setHWeb(''); setHNotes('') }
    else { setHName(h.name); setHAddr(h.address ?? ''); setHStars(h.stars ?? null); setHWeb(h.website ?? ''); setHNotes(h.notes ?? '') }
  }

  function openRoom(hotelId: string, r: HotelRoom | 'new') {
    setRoomModal({ hotelId, room: r })
    if (r === 'new') { setRType(''); setRNum(''); setRTotal(''); setROcc(''); setRPrice(''); setRDesc('') }
    else { setRType(r.room_type); setRNum(r.room_number ?? ''); setRTotal(String(r.total_rooms ?? '')); setROcc(String(r.max_occupancy ?? '')); setRPrice(r.price_per_night != null ? String(r.price_per_night) : ''); setRDesc(r.description ?? '') }
  }

  async function saveHotel() {
    if (!hName.trim()) return
    setSaving(true)
    const payload = { name: hName.trim(), address: hAddr.trim() || null, stars: hStars, website: hWeb.trim() || null, notes: hNotes.trim() || null }
    if (hotelModal === 'new') {
      const { data, error } = await supabase.from('hotels').insert({ event_id: eventId, ...payload }).select('id, name, address, stars, website, notes').single()
      if (!error && data) setHotels(prev => [...prev, { ...data, hotel_rooms: [] } as Hotel])
    } else if (hotelModal) {
      const { error } = await supabase.from('hotels').update(payload).eq('id', hotelModal.id)
      if (!error) setHotels(prev => prev.map(h => h.id === (hotelModal as Hotel).id ? { ...h, ...payload } : h))
    }
    setSaving(false)
    setHotelModal(null)
  }

  async function deleteHotel(id: string) {
    if (!confirm('Hotel und alle Zimmer löschen?')) return
    const { error } = await supabase.from('hotels').delete().eq('id', id)
    if (!error) setHotels(prev => prev.filter(h => h.id !== id))
  }

  async function saveRoom() {
    if (!roomModal || !rType.trim()) return
    setSaving(true)
    const payload = {
      room_type: rType.trim(),
      room_number: rNum.trim() || null,
      total_rooms: parseInt(rTotal) || 0,
      max_occupancy: parseInt(rOcc) || 0,
      price_per_night: rPrice ? parseFloat(rPrice) : null,
      description: rDesc.trim() || null,
    }
    const { room, hotelId } = roomModal
    if (room === 'new') {
      const { data, error } = await supabase.from('hotel_rooms').insert({ hotel_id: hotelId, ...payload }).select('id, hotel_id, room_type, room_number, total_rooms, max_occupancy, booked_rooms, price_per_night, description').single()
      if (!error && data) setHotels(prev => prev.map(h => h.id === hotelId ? { ...h, hotel_rooms: [...h.hotel_rooms, data as HotelRoom] } : h))
    } else {
      const { error } = await supabase.from('hotel_rooms').update(payload).eq('id', room.id)
      if (!error) setHotels(prev => prev.map(h => h.id === hotelId ? { ...h, hotel_rooms: h.hotel_rooms.map(r => r.id === room.id ? { ...r, ...payload } : r) } : h))
    }
    setSaving(false)
    setRoomModal(null)
  }

  async function deleteRoom(hotelId: string, roomId: string) {
    if (!confirm('Zimmer löschen?')) return
    const { error } = await supabase.from('hotel_rooms').delete().eq('id', roomId)
    if (!error) setHotels(prev => prev.map(h => h.id === hotelId ? { ...h, hotel_rooms: h.hotel_rooms.filter(r => r.id !== roomId) } : h))
  }

  function toggleExpand(id: string) {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{hotels.length} Hotel{hotels.length !== 1 ? 's' : ''}</p>
        <button onClick={() => openHotel('new')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
          <Plus size={14} /> Hotel hinzufügen
        </button>
      </div>

      {hotels.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '32px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
          Noch keine Hotels angelegt.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {hotels.map(hotel => {
          const open = expanded.has(hotel.id)
          const totalRooms = hotel.hotel_rooms.reduce((s, r) => s + (r.total_rooms ?? 0), 0)
          const bookedRooms = hotel.hotel_rooms.reduce((s, r) => s + (r.booked_rooms ?? 0), 0)
          return (
            <div key={hotel.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              {/* Hotel header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', cursor: 'pointer' }} onClick={() => toggleExpand(hotel.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{hotel.name}</span>
                    {hotel.stars && (
                      <span style={{ fontSize: 11, color: '#f5a623' }}>{'★'.repeat(hotel.stars)}</span>
                    )}
                  </div>
                  {hotel.address && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{hotel.address}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{bookedRooms}/{totalRooms} belegt</span>
                  <button onClick={e => { e.stopPropagation(); openHotel(hotel) }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Edit2 size={12} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteHotel(hotel.id) }} style={{ background: 'none', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={12} style={{ color: '#DC2626' }} />
                  </button>
                  {open ? <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />}
                </div>
              </div>

              {/* Expanded rooms */}
              {open && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {hotel.hotel_rooms.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#F5F5F7' }}>
                            {['Zimmertyp', 'Nr.', 'Gesamt', 'Belegung', 'Preis/Nacht', ''].map(h => (
                              <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {hotel.hotel_rooms.map(room => (
                            <tr key={room.id} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 500 }}>{room.room_type}</td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{room.room_number ?? '—'}</td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{room.total_rooms ?? '—'}</td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                                {room.booked_rooms}/{room.total_rooms} · {room.max_occupancy}P
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                                {room.price_per_night != null ? `€ ${Number(room.price_per_night).toFixed(2)}` : '—'}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                  <button onClick={() => openRoom(hotel.id, room)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <Edit2 size={12} style={{ color: 'var(--text-secondary)' }} />
                                  </button>
                                  <button onClick={() => deleteRoom(hotel.id, room.id)} style={{ background: 'none', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <Trash2 size={12} style={{ color: '#DC2626' }} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div style={{ padding: '10px 14px' }}>
                    <button onClick={() => openRoom(hotel.id, 'new')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Plus size={13} /> Zimmer hinzufügen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Hotel modal */}
      {hotelModal && (
        <Modal title={hotelModal === 'new' ? 'Hotel hinzufügen' : 'Hotel bearbeiten'} onClose={() => setHotelModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Name *</Label>
              <FieldInput value={hName} onChange={setHName} placeholder="Hotelname" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Adresse</Label>
              <FieldInput value={hAddr} onChange={setHAddr} placeholder="Straße, PLZ Ort" />
            </div>
            <div>
              <Label>Website</Label>
              <FieldInput value={hWeb} onChange={setHWeb} placeholder="https://…" />
            </div>
            <div>
              <Label>Sterne</Label>
              <StarPicker value={hStars} onChange={setHStars} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Notizen</Label>
              <textarea value={hNotes} onChange={e => setHNotes(e.target.value)} rows={2}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setHotelModal(null)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
            <button onClick={saveHotel} disabled={saving || !hName.trim()} style={{ padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, opacity: saving || !hName.trim() ? 0.6 : 1 }}>
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </Modal>
      )}

      {/* Room modal */}
      {roomModal && (
        <Modal title={roomModal.room === 'new' ? 'Zimmer hinzufügen' : 'Zimmer bearbeiten'} onClose={() => setRoomModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <Label>Zimmertyp *</Label>
              <FieldInput value={rType} onChange={setRType} placeholder="z.B. Doppelzimmer" />
            </div>
            <div>
              <Label>Zimmernummer</Label>
              <FieldInput value={rNum} onChange={setRNum} placeholder="z.B. 101" />
            </div>
            <div>
              <Label>Anzahl Zimmer</Label>
              <FieldInput value={rTotal} onChange={setRTotal} placeholder="z.B. 10" type="number" />
            </div>
            <div>
              <Label>Max. Belegung</Label>
              <FieldInput value={rOcc} onChange={setROcc} placeholder="z.B. 2" type="number" />
            </div>
            <div>
              <Label>Preis/Nacht (€)</Label>
              <FieldInput value={rPrice} onChange={setRPrice} placeholder="z.B. 120" type="number" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Beschreibung</Label>
              <textarea value={rDesc} onChange={e => setRDesc(e.target.value)} rows={2}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setRoomModal(null)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
            <button onClick={saveRoom} disabled={saving || !rType.trim()} style={{ padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, opacity: saving || !rType.trim() ? 0.6 : 1 }}>
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function GaestelisteClient({ eventId, initialGuests, mealOptions, initialHotels }: Props) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'gaeste' | 'hotel'>('gaeste')
  const [guests, setGuests] = useState<Guest[]>(initialGuests)
  const [query, setQuery] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<Partial<Guest>>({})

  const filtered = guests.filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
  const zugesagt = guests.filter(g => g.status === 'zugesagt').length

  const openEdit = useCallback((g: Guest) => {
    setEditId(g.id)
    setForm({ name: g.name, status: g.status, side: g.side, allergy_tags: g.allergy_tags ?? [], allergy_custom: g.allergy_custom, meal_choice: g.meal_choice })
    setShowAdd(false)
  }, [])

  const openAdd = useCallback(() => {
    setEditId(null)
    setForm({ name: '', status: 'angelegt', side: null, allergy_tags: [], allergy_custom: null, meal_choice: null })
    setShowAdd(true)
  }, [])

  const closeForm = useCallback(() => {
    setEditId(null)
    setShowAdd(false)
    setForm({})
  }, [])

  const saveGuest = useCallback(async () => {
    if (!form.name?.trim()) return
    setSaving(true)
    try {
      if (editId) {
        const { error } = await supabase.from('guests').update({
          name: form.name!.trim(),
          status: form.status ?? 'angelegt',
          side: form.side ?? null,
          allergy_tags: form.allergy_tags ?? [],
          allergy_custom: form.allergy_custom ?? null,
          meal_choice: form.meal_choice ?? null,
        }).eq('id', editId)
        if (!error) {
          setGuests(prev => prev.map(g => g.id === editId ? { ...g, ...form, name: form.name!.trim() } as Guest : g))
        }
      } else {
        const { data, error } = await supabase.from('guests').insert({
          event_id: eventId,
          name: form.name!.trim(),
          status: form.status ?? 'angelegt',
          side: form.side ?? null,
          allergy_tags: form.allergy_tags ?? [],
          allergy_custom: form.allergy_custom ?? null,
          meal_choice: form.meal_choice ?? null,
        }).select('id, name, status, side, allergy_tags, allergy_custom, meal_choice').single()
        if (!error && data) {
          setGuests(prev => [...prev, data as Guest].sort((a, b) => a.name.localeCompare(b.name)))
        }
      }
      closeForm()
    } finally {
      setSaving(false)
    }
  }, [editId, form, eventId, supabase, closeForm])

  const deleteGuest = useCallback(async (id: string) => {
    const { error } = await supabase.from('guests').delete().eq('id', id)
    if (!error) {
      setGuests(prev => prev.filter(g => g.id !== id))
      if (editId === id) closeForm()
    }
  }, [editId, supabase, closeForm])

  const toggleAllergyTag = useCallback((tag: string) => {
    setForm(prev => {
      const tags = prev.allergy_tags ?? []
      return { ...prev, allergy_tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] }
    })
  }, [])

  const formPanel = (showAdd || editId) ? (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{editId ? 'Gast bearbeiten' : 'Neuer Gast'}</h3>
        <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Name</label>
          <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Status</label>
          <select value={form.status ?? 'angelegt'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff' }}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Seite</label>
          <select value={form.side ?? ''} onChange={e => setForm(f => ({ ...f, side: e.target.value || null }))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff' }}>
            <option value="">—</option>
            {SIDE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Essenswahl</label>
          <select value={form.meal_choice ?? ''} onChange={e => setForm(f => ({ ...f, meal_choice: e.target.value || null }))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff' }}>
            <option value="">—</option>
            {mealOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Allergien</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALLERGY_TAGS.map(tag => {
            const active = (form.allergy_tags ?? []).includes(tag)
            return (
              <button key={tag} type="button" onClick={() => toggleAllergyTag(tag)} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
                background: active ? '#FEF2F2' : '#fff',
                borderColor: active ? 'rgba(220,38,38,0.3)' : 'var(--border)',
                color: active ? '#DC2626' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400, fontFamily: 'inherit',
              }}>{tag}</button>
            )
          })}
        </div>
        <input value={form.allergy_custom ?? ''} onChange={e => setForm(f => ({ ...f, allergy_custom: e.target.value || null }))}
          placeholder="Sonstiges…" style={{ marginTop: 8, width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {editId && (
          <button onClick={() => deleteGuest(editId)} style={{ padding: '8px 14px', background: '#FEF2F2', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={13} /> Löschen
          </button>
        )}
        <button onClick={closeForm} style={{ padding: '8px 14px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
        <button onClick={saveGuest} disabled={saving || !form.name?.trim()} style={{ padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', fontWeight: 500, opacity: saving || !form.name?.trim() ? 0.6 : 1 }}>
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  ) : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Gästeverwaltung</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{zugesagt} zugesagt · {guests.length} gesamt</p>
        </div>
        {activeTab === 'gaeste' && (
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
            <Plus size={15} /> Gast hinzufügen
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid var(--border)' }}>
        {[
          { key: 'gaeste', label: 'Gästeliste' },
          { key: 'hotel', label: `Hotel (${initialHotels.length})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as 'gaeste' | 'hotel')} style={{
            padding: '9px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.key ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -2, fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 400,
            color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'gaeste' && (
        <>
          {formPanel}

          <div style={{ position: 'relative', marginBottom: 16, maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Gast suchen…"
              style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }} />
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 160px', padding: '10px 20px', background: '#F5F5F7', borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Seite', 'Menü', 'Allergien'].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>{h}</span>
              ))}
            </div>
            {filtered.length === 0 && (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, fontStyle: 'italic' }}>Keine Gäste gefunden</div>
            )}
            {filtered.map(g => {
              const st = STATUS_STYLE[g.status] ?? STATUS_STYLE.angelegt
              return (
                <div key={g.id} onClick={() => openEdit(g)} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 160px', padding: '12px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{g.name}</div>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>
                      {STATUS_LABELS[g.status] ?? g.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{g.side ?? '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{g.meal_choice ?? '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {[...(g.allergy_tags ?? []), g.allergy_custom].filter(Boolean).join(', ') || '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {activeTab === 'hotel' && (
        <HotelTab eventId={eventId} initialHotels={initialHotels} />
      )}
    </div>
  )
}
