'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Hotel, Mail, Settings, Plus, Copy, Check, Trash2, QrCode, Download, X } from 'lucide-react'

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
  token: string | null
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

// ── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'gaesteliste' | 'hotel' | 'rsvp' | 'einstellungen'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'gaesteliste',   label: 'Gästeliste',          icon: <Users size={15} /> },
  { key: 'hotel',         label: 'Hotel',                icon: <Hotel size={15} /> },
  { key: 'rsvp',          label: 'Einladungen',          icon: <Mail size={15} /> },
  { key: 'einstellungen', label: 'Gäste-Einstellungen',  icon: <Settings size={15} /> },
]

// ── Guest badge ──────────────────────────────────────────────────────────────

function AttendingBadge({ status }: { status: string }) {
  if (status === 'ja')    return <span className="bp-badge bp-badge-green">Zugesagt</span>
  if (status === 'nein')  return <span className="bp-badge bp-badge-red">Abgesagt</span>
  return <span className="bp-badge bp-badge-neutral">Ausstehend</span>
}

// ── Gästeliste tab ───────────────────────────────────────────────────────────

function GaestelisteTab({ guests, eventId, onUpdate }: {
  guests: Guest[]
  eventId: string
  onUpdate: (g: Guest) => void
}) {
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState<'all' | 'ja' | 'nein' | 'ausstehend'>('all')
  const [adding,  setAdding]  = useState(false)
  const [newName, setNewName] = useState('')
  const [newSide, setNewSide] = useState('')
  const [saving,  setSaving]  = useState(false)

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
      .insert({ event_id: eventId, name: newName.trim(), side: newSide || null, attending: 'ausstehend' })
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      onUpdate(data as Guest)
      setNewName(''); setNewSide(''); setAdding(false)
    }
  }

  const ja         = guests.filter(g => g.attending === 'ja').length
  const nein       = guests.filter(g => g.attending === 'nein').length
  const ausstehend = guests.filter(g => g.attending === 'ausstehend').length

  return (
    <div>
      {/* Stats strip */}
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
        <div className="bp-empty-body">Hotels werden vom Veranstalter eingetragen.</div>
      </div>
    )
  }

  return (
    <div>
      {hotels.map(hotel => {
        const rooms = hotel.hotel_rooms ?? []
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
                      <td>
                        {roomGuests.length > 0
                          ? roomGuests.map(g => g.name).join(', ')
                          : <span style={{ color: 'var(--bp-ink-3)' }}>Nicht belegt</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

// ── Einladungen (RSVP) tab ───────────────────────────────────────────────────

function RsvpTab({ guests, onUpdateGuest }: {
  guests: Guest[]
  onUpdateGuest: (g: Guest) => void
}) {
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null)
  const [emailInput,     setEmailInput]     = useState('')
  const [savingEmail,    setSavingEmail]    = useState(false)
  const [copiedId,       setCopiedId]       = useState<string | null>(null)
  const [qrGuestId,      setQrGuestId]      = useState<string | null>(null)
  const [qrDataUrls,     setQrDataUrls]     = useState<Record<string, string>>({})
  const [qrLoading,      setQrLoading]      = useState(false)

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
      const dataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: { dark: '#3D3833', light: '#FDFAF7' },
      })
      setQrDataUrls(prev => ({ ...prev, [guest.id]: dataUrl }))
    } catch (e) {
      console.error('QR generation failed', e)
    }
    setQrLoading(false)
  }

  function downloadQr(guestName: string, dataUrl: string) {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `RSVP-QR-${guestName.replace(/\s+/g, '-')}.png`
    a.click()
  }

  function startEditEmail(guest: Guest) {
    setEditingEmailId(guest.id)
    setEmailInput(guest.email ?? '')
  }

  async function saveEmail(guest: Guest) {
    setSavingEmail(true)
    const supabase = createClient()
    const newEmail = emailInput.trim() || null
    const { error } = await supabase
      .from('guests')
      .update({ email: newEmail })
      .eq('id', guest.id)
    setSavingEmail(false)
    if (!error) onUpdateGuest({ ...guest, email: newEmail })
    setEditingEmailId(null)
  }

  const activeQrGuest  = qrGuestId ? guests.find(g => g.id === qrGuestId) ?? null : null
  const activeQrUrl    = activeQrGuest ? qrDataUrls[activeQrGuest.id] ?? null : null

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 className="bp-section-title" style={{ margin: '0 0 0.25rem' }}>Einladungslinks</h3>
        <p className="bp-caption">
          Jeder Gast hat einen personalisierten RSVP-Link. Per E-Mail versenden oder als QR-Code für einen Einladungsbrief ausdrucken.
        </p>
      </div>

      <div className="bp-card" style={{ overflow: 'hidden' }}>
        {guests.length === 0 ? (
          <div className="bp-empty">
            <div className="bp-empty-title">Noch keine Gäste</div>
            <div className="bp-empty-body">Fügt Gäste in der Gästeliste hinzu.</div>
          </div>
        ) : (
          <table className="bp-table">
            <thead>
              <tr>
                <th>Gast</th>
                <th>E-Mail</th>
                <th style={{ textAlign: 'right' }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {guests.map(guest => (
                <tr key={guest.id}>
                  <td style={{ fontWeight: 500, color: 'var(--bp-ink)' }}>{guest.name}</td>

                  {/* E-Mail (inline edit) */}
                  <td>
                    {editingEmailId === guest.id ? (
                      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        <input
                          className="bp-input"
                          type="email"
                          value={emailInput}
                          onChange={e => setEmailInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  saveEmail(guest)
                            if (e.key === 'Escape') setEditingEmailId(null)
                          }}
                          autoFocus
                          style={{ maxWidth: 200, padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                          placeholder="email@beispiel.de"
                        />
                        <button className="bp-btn bp-btn-primary bp-btn-sm" onClick={() => saveEmail(guest)} disabled={savingEmail}>
                          {savingEmail ? '…' : <Check size={13} />}
                        </button>
                        <button className="bp-btn bp-btn-ghost bp-btn-sm" onClick={() => setEditingEmailId(null)}>
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="bp-btn bp-btn-ghost bp-btn-sm"
                        onClick={() => startEditEmail(guest)}
                        style={{
                          color: guest.email ? 'var(--bp-ink-2)' : 'var(--bp-ink-4)',
                          fontSize: '0.875rem',
                        }}
                      >
                        {guest.email ?? '+ E-Mail eintragen'}
                      </button>
                    )}
                  </td>

                  {/* Actions */}
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                      <button
                        className="bp-btn bp-btn-secondary bp-btn-sm"
                        onClick={() => copyLink(guest)}
                        disabled={!guest.token}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                        title="RSVP-Link kopieren"
                      >
                        {copiedId === guest.id ? <Check size={13} /> : <Copy size={13} />}
                        {copiedId === guest.id ? 'Kopiert' : 'Link'}
                      </button>

                      {/* QR-Code: always available, especially useful without email */}
                      <button
                        className="bp-btn bp-btn-secondary bp-btn-sm"
                        onClick={() => toggleQr(guest)}
                        disabled={!guest.token}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                        title="QR-Code anzeigen (für Brief ohne E-Mail)"
                      >
                        <QrCode size={13} />
                        QR
                      </button>

                      {/* mailto shortcut if email is set */}
                      {guest.email && guest.token && (
                        <a
                          href={`mailto:${guest.email}?subject=Eure Hochzeitseinladung&body=${encodeURIComponent(
                            `Liebe/r ${guest.name},\n\nbitte bestätigt eure Teilnahme über folgenden persönlichen Link:\n${getRsvpUrl(guest.token)}`
                          )}`}
                          className="bp-btn bp-btn-secondary bp-btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none' }}
                          title="E-Mail-Programm öffnen"
                        >
                          <Mail size={13} />
                          Mail
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

      {/* QR-Code panel */}
      {qrGuestId && activeQrGuest && (
        <div className="bp-card" style={{ marginTop: '1rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontWeight: 500, color: 'var(--bp-ink)', marginBottom: 2 }}>
                QR-Code für {activeQrGuest.name}
              </div>
              {activeQrGuest.token && (
                <div style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)', fontFamily: 'monospace' }}>
                  /rsvp/{activeQrGuest.token.slice(0, 20)}…
                </div>
              )}
            </div>
            <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={() => setQrGuestId(null)}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            {qrLoading && (
              <div style={{ color: 'var(--bp-ink-3)', fontSize: '0.875rem', padding: '2rem 0' }}>
                Generiere QR-Code…
              </div>
            )}
            {activeQrUrl && (
              <>
                <img
                  src={activeQrUrl}
                  alt={`RSVP QR-Code für ${activeQrGuest.name}`}
                  style={{ width: 200, height: 200, display: 'block' }}
                />
                <button
                  className="bp-btn bp-btn-secondary"
                  onClick={() => downloadQr(activeQrGuest.name, activeQrUrl)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Download size={14} />
                  Als PNG speichern
                </button>
                <p className="bp-caption" style={{ textAlign: 'center', maxWidth: 320 }}>
                  Bild speichern und in Word einfügen, um es als postalischen Einladungsbrief zu versenden.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Einstellungen tab ────────────────────────────────────────────────────────

function EinstellungenTab({ eventId, rsvpSettings: initialSettings }: {
  eventId: string
  rsvpSettings: RsvpSettings | null
}) {
  const [settings, setSettings] = useState(initialSettings)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const payload = {
      event_id:         eventId,
      invitation_text:  settings?.invitation_text ?? '',
      rsvp_deadline:    settings?.rsvp_deadline ?? null,
      show_meal_choice: settings?.show_meal_choice ?? true,
      show_plus_one:    settings?.show_plus_one ?? true,
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

      <button className="bp-btn bp-btn-primary" onClick={save} disabled={saving}>
        {saving ? 'Speichert…' : saved ? 'Gespeichert ✓' : 'Einstellungen speichern'}
      </button>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BrautpaarGaeste({
  eventId, userId, initialGuests, mealOptions, childrenAllowed,
  hotels, rsvpSettings,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('gaesteliste')
  const [guests,    setGuests]    = useState<Guest[]>(initialGuests)

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
        {activeTab === 'gaesteliste' && (
          <GaestelisteTab guests={guests} eventId={eventId} onUpdate={handleGuestUpdate} />
        )}
        {activeTab === 'hotel' && (
          <HotelTab hotels={hotels} guests={guests} />
        )}
        {activeTab === 'rsvp' && (
          <RsvpTab guests={guests} onUpdateGuest={handleGuestUpdate} />
        )}
        {activeTab === 'einstellungen' && (
          <EinstellungenTab eventId={eventId} rsvpSettings={rsvpSettings} />
        )}
      </div>
    </div>
  )
}
