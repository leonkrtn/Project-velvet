'use client'
import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ChevronDown, ChevronUp, ImageIcon } from 'lucide-react'

type SuggestionStatus = 'vorschlag' | 'akzeptiert' | 'abgelehnt'

interface VendorSuggestion {
  id: string
  event_id: string
  name: string | null
  category: string | null
  description: string | null
  price_estimate: number
  contact_email: string | null
  contact_phone: string | null
  status: SuggestionStatus
  created_at: string
}

interface HotelSuggestion {
  id: string
  event_id: string
  name: string | null
  address: string | null
  distance_km: number
  price_per_night: number
  total_rooms: number
  description: string | null
  status: SuggestionStatus
  created_at: string
}

interface DekoSuggestion {
  id: string
  event_id: string
  title: string | null
  description: string | null
  image_url: string | null
  status: SuggestionStatus
  created_at: string
}

interface Props {
  eventId: string
  initialVendors: VendorSuggestion[]
  initialHotels: HotelSuggestion[]
  initialDeko: DekoSuggestion[]
}

type Tab = 'dienstleister' | 'hotels' | 'dekoration'

const STATUS_CFG: Record<SuggestionStatus, { label: string; bg: string; color: string }> = {
  vorschlag:  { label: 'Vorschlag',   bg: '#F0F0F0', color: '#666' },
  akzeptiert: { label: 'Akzeptiert',  bg: '#EAF5EE', color: '#3D7A56' },
  abgelehnt:  { label: 'Abgelehnt',  bg: '#FDEAEA', color: '#A04040' },
}

function StatusBadge({ status, onChange }: { status: SuggestionStatus; onChange?: (s: SuggestionStatus) => void }) {
  const cfg = STATUS_CFG[status]
  if (!onChange) return (
    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
  )
  return (
    <select
      value={status}
      onChange={e => onChange(e.target.value as SuggestionStatus)}
      style={{ padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: cfg.bg, color: cfg.color, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
    >
      {(Object.entries(STATUS_CFG) as [SuggestionStatus, typeof STATUS_CFG[SuggestionStatus]][]).map(([k, v]) => (
        <option key={k} value={k}>{v.label}</option>
      ))}
    </select>
  )
}

function fmtMoney(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '10px 13px', background: '#fff',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 5,
}

export default function VorschlaegeClient({ eventId, initialVendors, initialHotels, initialDeko }: Props) {
  const [tab, setTab] = useState<Tab>('dienstleister')
  const [vendors, setVendors] = useState(initialVendors)
  const [hotels, setHotels] = useState(initialHotels)
  const [deko, setDeko] = useState(initialDeko)
  const [modal, setModal] = useState<Tab | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const supabase = createClient()

  // Vendor form
  const [vForm, setVForm] = useState({ name: '', category: '', description: '', price_estimate: '', contact_email: '', contact_phone: '' })
  // Hotel form
  const [hForm, setHForm] = useState({ name: '', address: '', distance_km: '', price_per_night: '', total_rooms: '', description: '' })
  // Deko form
  const [dForm, setDForm] = useState({ title: '', description: '', image_url: '' })
  const [saving, setSaving] = useState(false)

  function toggleExpand(id: string) {
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function addVendor() {
    setSaving(true)
    const { data } = await supabase.from('organizer_vendor_suggestions').insert({
      event_id: eventId,
      name: vForm.name || null,
      category: vForm.category || null,
      description: vForm.description || null,
      price_estimate: parseFloat(vForm.price_estimate) || 0,
      contact_email: vForm.contact_email || null,
      contact_phone: vForm.contact_phone || null,
    }).select().single()
    if (data) setVendors(v => [data, ...v])
    setVForm({ name: '', category: '', description: '', price_estimate: '', contact_email: '', contact_phone: '' })
    setModal(null); setSaving(false)
  }

  async function addHotel() {
    setSaving(true)
    const { data } = await supabase.from('organizer_hotel_suggestions').insert({
      event_id: eventId,
      name: hForm.name || null,
      address: hForm.address || null,
      distance_km: parseFloat(hForm.distance_km) || 0,
      price_per_night: parseFloat(hForm.price_per_night) || 0,
      total_rooms: parseInt(hForm.total_rooms) || 0,
      description: hForm.description || null,
    }).select().single()
    if (data) setHotels(h => [data, ...h])
    setHForm({ name: '', address: '', distance_km: '', price_per_night: '', total_rooms: '', description: '' })
    setModal(null); setSaving(false)
  }

  async function addDeko() {
    setSaving(true)
    const { data } = await supabase.from('deko_suggestions').insert({
      event_id: eventId,
      title: dForm.title || null,
      description: dForm.description || null,
      image_url: dForm.image_url || null,
    }).select().single()
    if (data) setDeko(d => [data, ...d])
    setDForm({ title: '', description: '', image_url: '' })
    setModal(null); setSaving(false)
  }

  async function updateVendorStatus(id: string, status: SuggestionStatus) {
    await supabase.from('organizer_vendor_suggestions').update({ status }).eq('id', id)
    setVendors(v => v.map(x => x.id === id ? { ...x, status } : x))
  }

  async function updateHotelStatus(id: string, status: SuggestionStatus) {
    await supabase.from('organizer_hotel_suggestions').update({ status }).eq('id', id)
    setHotels(h => h.map(x => x.id === id ? { ...x, status } : x))
  }

  async function updateDekoStatus(id: string, status: SuggestionStatus) {
    await supabase.from('deko_suggestions').update({ status }).eq('id', id)
    setDeko(d => d.map(x => x.id === id ? { ...x, status } : x))
  }

  async function deleteVendor(id: string) {
    await supabase.from('organizer_vendor_suggestions').delete().eq('id', id)
    setVendors(v => v.filter(x => x.id !== id))
  }

  async function deleteHotel(id: string) {
    await supabase.from('organizer_hotel_suggestions').delete().eq('id', id)
    setHotels(h => h.filter(x => x.id !== id))
  }

  async function deleteDeko(id: string) {
    await supabase.from('deko_suggestions').delete().eq('id', id)
    setDeko(d => d.filter(x => x.id !== id))
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'dienstleister', label: 'Dienstleister', count: vendors.length },
    { key: 'hotels', label: 'Hotels', count: hotels.length },
    { key: 'dekoration', label: 'Dekoration', count: deko.length },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Vorschläge</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Präsentiere dem Brautpaar Optionen für Dienstleister, Hotels und Dekoration</p>
        </div>
        <button
          onClick={() => setModal(tab)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
        >
          <Plus size={15} /> Hinzufügen
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-sel={tab === t.key ? '1' : undefined}
            style={{
              padding: '10px 20px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: 500,
              color: tab === t.key ? 'var(--accent)' : 'var(--text-tertiary)',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {t.label} <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* Dienstleister Tab */}
      {tab === 'dienstleister' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {vendors.length === 0 && <EmptyState label="Noch keine Dienstleister-Vorschläge" />}
          {vendors.map(v => (
            <div key={v.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{v.name ?? 'Unbenannt'}</div>
                  {v.category && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{v.category}</div>}
                </div>
                <button onClick={() => deleteVendor(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
              {v.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>{v.description}</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{fmtMoney(v.price_estimate)}</span>
                <StatusBadge status={v.status} onChange={s => updateVendorStatus(v.id, s)} />
              </div>
              {(v.contact_email || v.contact_phone) && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {v.contact_email && <div>{v.contact_email}</div>}
                  {v.contact_phone && <div>{v.contact_phone}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hotels Tab */}
      {tab === 'hotels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {hotels.length === 0 && <EmptyState label="Noch keine Hotel-Vorschläge" />}
          {hotels.map(h => {
            const isOpen = expanded.has(h.id)
            return (
              <div key={h.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }} onClick={() => toggleExpand(h.id)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{h.name ?? 'Unbenannt'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {h.address ?? '—'} · {h.distance_km} km · {h.total_rooms} Zimmer · {fmtMoney(h.price_per_night)}/Nacht
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusBadge status={h.status} onChange={s => updateHotelStatus(h.id, s)} />
                    <button onClick={e => { e.stopPropagation(); deleteHotel(h.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}>
                      <Trash2 size={14} />
                    </button>
                    {isOpen ? <ChevronUp size={16} color="var(--text-tertiary)" /> : <ChevronDown size={16} color="var(--text-tertiary)" />}
                  </div>
                </div>
                {isOpen && h.description && (
                  <div style={{ padding: '0 20px 16px', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{h.description}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Dekoration Tab */}
      {tab === 'dekoration' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {deko.length === 0 && <EmptyState label="Noch keine Deko-Vorschläge" />}
          {deko.map(d => (
            <div key={d.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ height: 160, background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {d.image_url ? (
                  <img src={d.image_url} alt={d.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <ImageIcon size={32} color="var(--text-tertiary)" />
                )}
                <button onClick={() => deleteDeko(d.id)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, display: 'flex', color: '#fff' }}>
                  <Trash2 size={13} />
                </button>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{d.title ?? 'Unbenannt'}</div>
                {d.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>{d.description}</p>}
                <StatusBadge status={d.status} onChange={s => updateDekoStatus(d.id, s)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setModal(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>

            {modal === 'dienstleister' && (
              <>
                <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 20 }}>Dienstleister hinzufügen</h3>
                <ModalGrid>
                  <ModalField label="Name"><input style={inputSt} value={vForm.name} onChange={e => setVForm(f => ({ ...f, name: e.target.value }))} /></ModalField>
                  <ModalField label="Kategorie"><input style={inputSt} value={vForm.category} onChange={e => setVForm(f => ({ ...f, category: e.target.value }))} placeholder="z.B. Fotograf" /></ModalField>
                </ModalGrid>
                <ModalField label="Beschreibung">
                  <textarea style={{ ...inputSt, minHeight: 70, resize: 'vertical' }} value={vForm.description} onChange={e => setVForm(f => ({ ...f, description: e.target.value }))} />
                </ModalField>
                <ModalGrid>
                  <ModalField label="Kostenvoranschlag (€)"><input type="number" style={inputSt} value={vForm.price_estimate} onChange={e => setVForm(f => ({ ...f, price_estimate: e.target.value }))} /></ModalField>
                  <ModalField label="Telefon"><input style={inputSt} value={vForm.contact_phone} onChange={e => setVForm(f => ({ ...f, contact_phone: e.target.value }))} /></ModalField>
                </ModalGrid>
                <ModalField label="E-Mail"><input type="email" style={inputSt} value={vForm.contact_email} onChange={e => setVForm(f => ({ ...f, contact_email: e.target.value }))} /></ModalField>
              </>
            )}

            {modal === 'hotels' && (
              <>
                <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 20 }}>Hotel hinzufügen</h3>
                <ModalGrid>
                  <ModalField label="Name"><input style={inputSt} value={hForm.name} onChange={e => setHForm(f => ({ ...f, name: e.target.value }))} /></ModalField>
                  <ModalField label="Entfernung (km)"><input type="number" style={inputSt} value={hForm.distance_km} onChange={e => setHForm(f => ({ ...f, distance_km: e.target.value }))} /></ModalField>
                </ModalGrid>
                <ModalField label="Adresse"><input style={inputSt} value={hForm.address} onChange={e => setHForm(f => ({ ...f, address: e.target.value }))} /></ModalField>
                <ModalGrid>
                  <ModalField label="Preis/Nacht (€)"><input type="number" style={inputSt} value={hForm.price_per_night} onChange={e => setHForm(f => ({ ...f, price_per_night: e.target.value }))} /></ModalField>
                  <ModalField label="Zimmer gesamt"><input type="number" style={inputSt} value={hForm.total_rooms} onChange={e => setHForm(f => ({ ...f, total_rooms: e.target.value }))} /></ModalField>
                </ModalGrid>
                <ModalField label="Beschreibung">
                  <textarea style={{ ...inputSt, minHeight: 70, resize: 'vertical' }} value={hForm.description} onChange={e => setHForm(f => ({ ...f, description: e.target.value }))} />
                </ModalField>
              </>
            )}

            {modal === 'dekoration' && (
              <>
                <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 20 }}>Deko-Vorschlag hinzufügen</h3>
                <ModalField label="Titel"><input style={inputSt} value={dForm.title} onChange={e => setDForm(f => ({ ...f, title: e.target.value }))} /></ModalField>
                <ModalField label="Beschreibung">
                  <textarea style={{ ...inputSt, minHeight: 80, resize: 'vertical' }} value={dForm.description} onChange={e => setDForm(f => ({ ...f, description: e.target.value }))} />
                </ModalField>
                <ModalField label="Bild-URL"><input type="url" style={inputSt} value={dForm.image_url} onChange={e => setDForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://…" /></ModalField>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(null)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
              <button
                onClick={modal === 'dienstleister' ? addVendor : modal === 'hotels' ? addHotel : addDeko}
                disabled={saving}
                style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500 }}
              >
                {saving ? 'Speichern…' : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ gridColumn: '1/-1', padding: '48px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, fontStyle: 'italic' }}>
      {label}
    </div>
  )
}

function ModalGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 0 }}>{children}</div>
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelSt}>{label}</label>
      {children}
    </div>
  )
}
