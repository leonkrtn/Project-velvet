'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit2, Check, X, Heart, Ban, ListMusic, Lightbulb } from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

interface Song {
  id: string
  title: string
  artist: string
  type: 'wish' | 'no_go' | 'playlist'
  moment: string
  sort_order: number
}

interface Requirements {
  soundcheck_date: string
  soundcheck_time: string
  pa_notes: string
  stage_dimensions: string
  microphone_count: number
  power_required: string
  streaming_needed: boolean
  streaming_notes: string
  notes: string
}

export interface ItemPerm { can_view: boolean; can_edit: boolean }

interface Props {
  eventId: string
  mode: 'veranstalter' | 'dienstleister'
  hasFullModuleAccess?: boolean
  itemPermissions?: Record<string, ItemPerm>
  onPropose?: () => void
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  wish:     { icon: <Heart size={13} />,     label: 'Wunschlied', color: '#C4717A' },
  no_go:    { icon: <Ban size={13} />,       label: 'No-Go',      color: '#FF3B30' },
  playlist: { icon: <ListMusic size={13} />, label: 'Playlist',   color: 'var(--text-secondary)' },
}

const MOMENTS = ['Einzug', 'Zeremonie', 'Sektempfang', 'Abendessen', 'Party', 'Abschluss', 'Allgemein']

// ── Helpers ──────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 5 }}>
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
      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
    />
  )
}

// ── Requirements Edit Form ───────────────────────────────────────────────────

function RequirementsForm({ reqs, eventId, canEdit, onSaved }: { reqs: Requirements | null; eventId: string; canEdit: boolean; onSaved: (r: Requirements) => void }) {
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState<Requirements | null>(null)
  const [saving, setSaving]     = useState(false)

  function startEdit() {
    setDraft(reqs ?? {
      soundcheck_date: '', soundcheck_time: '', pa_notes: '',
      stage_dimensions: '', microphone_count: 2, power_required: '',
      streaming_needed: false, streaming_notes: '', notes: '',
    })
    setEditing(true)
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('music_requirements')
      .upsert({ event_id: eventId, ...draft }, { onConflict: 'event_id' })
      .select()
      .single()
    setSaving(false)
    if (!error && data) { onSaved(data as Requirements); setEditing(false) }
  }

  function row(label: string, field: keyof Requirements, placeholder?: string, type = 'text') {
    return (
      <div>
        <Label>{label}</Label>
        <FieldInput
          value={draft?.[field] as string ?? ''}
          onChange={v => setDraft(prev => prev ? { ...prev, [field]: type === 'number' ? Number(v) : v } : null)}
          placeholder={placeholder}
          type={type}
        />
      </div>
    )
  }

  if (!canEdit) {
    if (!reqs) return null
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Technische Anforderungen</p>
        {reqs.soundcheck_date && <InfoRow label="Soundcheck" value={[reqs.soundcheck_date, reqs.soundcheck_time].filter(Boolean).join(' ')} />}
        {reqs.stage_dimensions && <InfoRow label="Bühnenmaße" value={reqs.stage_dimensions} />}
        {reqs.microphone_count > 0 && <InfoRow label="Mikrofone" value={String(reqs.microphone_count)} />}
        {reqs.power_required && <InfoRow label="Stromanschluss" value={reqs.power_required} />}
        {reqs.pa_notes && <InfoRow label="PA-Anforderungen" value={reqs.pa_notes} />}
        {reqs.streaming_needed && <InfoRow label="Streaming" value={reqs.streaming_notes || 'Erforderlich'} />}
        {reqs.notes && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>{reqs.notes}</p>}
      </div>
    )
  }

  if (!editing) {
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>Technische Anforderungen</p>
          <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Edit2 size={12} /> Bearbeiten
          </button>
        </div>
        {!reqs ? (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Noch keine Angaben. Klicke "Bearbeiten" um Anforderungen hinzuzufügen.</p>
        ) : (
          <>
            {reqs.soundcheck_date && <InfoRow label="Soundcheck" value={[reqs.soundcheck_date, reqs.soundcheck_time].filter(Boolean).join(' ')} />}
            {reqs.stage_dimensions && <InfoRow label="Bühnenmaße" value={reqs.stage_dimensions} />}
            {reqs.microphone_count > 0 && <InfoRow label="Mikrofone" value={String(reqs.microphone_count)} />}
            {reqs.power_required && <InfoRow label="Stromanschluss" value={reqs.power_required} />}
            {reqs.pa_notes && <InfoRow label="PA-Anforderungen" value={reqs.pa_notes} />}
            {reqs.streaming_needed && <InfoRow label="Streaming" value={reqs.streaming_notes || 'Erforderlich'} />}
            {reqs.notes && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>{reqs.notes}</p>}
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--gold)', padding: '18px 20px', marginBottom: 24 }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 16 }}>Technische Anforderungen bearbeiten</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {row('Soundcheck Datum', 'soundcheck_date', 'z.B. 12.06.2025')}
        {row('Soundcheck Uhrzeit', 'soundcheck_time', 'z.B. 14:00')}
        {row('Bühnenmaße', 'stage_dimensions', 'z.B. 5m × 4m')}
        {row('Mikrofone (Anzahl)', 'microphone_count', '2', 'number')}
        {row('Stromanschluss', 'power_required', 'z.B. 32A CEE')}
        {row('PA-Anforderungen', 'pa_notes', 'Notizen zur Beschallung')}
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Sonstige Hinweise</Label>
        <textarea
          value={draft?.notes ?? ''}
          onChange={e => setDraft(prev => prev ? { ...prev, notes: e.target.value } : null)}
          rows={3}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <input
          type="checkbox"
          id="streaming"
          checked={draft?.streaming_needed ?? false}
          onChange={e => setDraft(prev => prev ? { ...prev, streaming_needed: e.target.checked } : null)}
        />
        <label htmlFor="streaming" style={{ fontSize: 13 }}>Streaming erforderlich</label>
        {draft?.streaming_needed && (
          <input
            value={draft.streaming_notes}
            onChange={e => setDraft(prev => prev ? { ...prev, streaming_notes: e.target.value } : null)}
            placeholder="Details zum Streaming"
            style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
        <button onClick={() => setEditing(false)} style={{ padding: '8px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}

// ── Song Row ──────────────────────────────────────────────────────────────────

function SongRow({
  song, canEdit, mode, onUpdate, onDelete, onPropose,
}: {
  song: Song
  canEdit: boolean
  mode: 'veranstalter' | 'dienstleister'
  onUpdate: (s: Song) => void
  onDelete: () => void
  onPropose?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(song)
  const [saving, setSaving]   = useState(false)

  const cfg = TYPE_CONFIG[song.type] ?? TYPE_CONFIG.playlist

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('music_songs').update({
      title: draft.title, artist: draft.artist, type: draft.type, moment: draft.moment,
    }).eq('id', song.id)
    setSaving(false)
    if (!error) { onUpdate(draft); setEditing(false) }
  }

  if (editing) {
    return (
      <div style={{ padding: '12px 14px', background: 'rgba(255,215,0,0.04)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <Label>Titel</Label>
            <FieldInput value={draft.title} onChange={v => setDraft(p => ({ ...p, title: v }))} placeholder="Songtitel" />
          </div>
          <div>
            <Label>Künstler</Label>
            <FieldInput value={draft.artist} onChange={v => setDraft(p => ({ ...p, artist: v }))} placeholder="Interpret" />
          </div>
          <div>
            <Label>Typ</Label>
            <select value={draft.type} onChange={e => setDraft(p => ({ ...p, type: e.target.value as Song['type'] }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit' }}>
              <option value="wish">Wunschlied</option>
              <option value="no_go">No-Go</option>
              <option value="playlist">Playlist</option>
            </select>
          </div>
          <div>
            <Label>Moment</Label>
            <select value={draft.moment} onChange={e => setDraft(p => ({ ...p, moment: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit' }}>
              {MOMENTS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={save} disabled={saving} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? '…' : <><Check size={12} /> Speichern</>}
          </button>
          <button onClick={() => { setDraft(song); setEditing(false) }} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer' }}>
            <X size={12} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: cfg.color, flexShrink: 0 }}>{cfg.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{song.title || '—'}</span>
        {song.artist && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>— {song.artist}</span>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {canEdit && (
          <>
            <button onClick={() => setEditing(true)} style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Edit2 size={12} style={{ color: 'var(--text-secondary)' }} />
            </button>
            {mode === 'veranstalter' && (
              <button onClick={onDelete} style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={12} style={{ color: '#FF3B30' }} />
              </button>
            )}
          </>
        )}
        {!canEdit && mode === 'dienstleister' && onPropose && (
          <button onClick={onPropose} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
            <Lightbulb size={11} /> Vorschlag
          </button>
        )}
      </div>
    </div>
  )
}

// ── Add Song Form ─────────────────────────────────────────────────────────────

function AddSongForm({ eventId, onAdded }: { eventId: string; onAdded: (s: Song) => void }) {
  const [open, setOpen]   = useState(false)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [type, setType]   = useState<Song['type']>('wish')
  const [moment, setMoment] = useState('Allgemein')
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('music_songs')
      .insert({ event_id: eventId, title: title.trim(), artist: artist.trim(), type, moment, sort_order: 0 })
      .select().single()
    setSaving(false)
    if (!error && data) {
      onAdded(data as Song)
      setTitle(''); setArtist(''); setType('wish'); setMoment('Allgemein')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', width: '100%', marginTop: 4 }}>
        <Plus size={14} /> Song hinzufügen
      </button>
    )
  }

  return (
    <div style={{ padding: '12px 14px', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', marginTop: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <Label>Titel *</Label>
          <FieldInput value={title} onChange={setTitle} placeholder="Songtitel" />
        </div>
        <div>
          <Label>Künstler</Label>
          <FieldInput value={artist} onChange={setArtist} placeholder="Interpret" />
        </div>
        <div>
          <Label>Typ</Label>
          <select value={type} onChange={e => setType(e.target.value as Song['type'])} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit' }}>
            <option value="wish">Wunschlied</option>
            <option value="no_go">No-Go</option>
            <option value="playlist">Playlist</option>
          </select>
        </div>
        <div>
          <Label>Moment</Label>
          <select value={moment} onChange={e => setMoment(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit' }}>
            {MOMENTS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={add} disabled={saving || !title.trim()} style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: saving || !title.trim() ? 0.6 : 1 }}>
          {saving ? 'Hinzufügen…' : 'Hinzufügen'}
        </button>
        <button onClick={() => setOpen(false)} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer' }}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MusikTabContent({ eventId, mode, hasFullModuleAccess = true, itemPermissions = {}, onPropose }: Props) {
  const [songs, setSongs]       = useState<Song[]>([])
  const [reqs, setReqs]         = useState<Requirements | null>(null)
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<string>('all')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('music_songs').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('music_requirements').select('*').eq('event_id', eventId).single(),
    ]).then(([{ data: s }, { data: r }]) => {
      setSongs(s ?? [])
      setReqs(r ?? null)
      setLoading(false)
    })
  }, [eventId])

  function canViewItem(id: string) {
    if (mode === 'veranstalter') return true
    const p = itemPermissions[id]
    if (p) return p.can_view
    return true
  }

  function canEditItem(id: string) {
    if (mode === 'veranstalter') return true
    const p = itemPermissions[id]
    if (p) return p.can_edit
    return hasFullModuleAccess
  }

  async function deleteSong(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('music_songs').delete().eq('id', id)
    if (!error) setSongs(prev => prev.filter(s => s.id !== id))
  }

  const visibleSongs = songs.filter(s => canViewItem(s.id))
  const filtered     = filter === 'all' ? visibleSongs : visibleSongs.filter(s => s.type === filter)
  const moments      = Array.from(new Set(filtered.map(s => s.moment))).filter(Boolean)

  const reqsCanEdit = mode === 'veranstalter' || hasFullModuleAccess

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>Musik</h1>
        {mode === 'dienstleister' && onPropose && (
          <button onClick={onPropose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
            <Lightbulb size={14} /> Vorschlag erstellen
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
      ) : (
        <div style={{ maxWidth: 760 }}>
          {/* Technische Anforderungen */}
          <RequirementsForm reqs={reqs} eventId={eventId} canEdit={reqsCanEdit} onSaved={setReqs} />

          {/* Songliste */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
                Songliste ({visibleSongs.length})
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', 'wish', 'no_go', 'playlist'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: filter === f ? 'var(--accent)' : 'var(--surface)', color: filter === f ? '#fff' : 'var(--text-secondary)', fontWeight: filter === f ? 600 : 400 }}>
                    {f === 'all' ? 'Alle' : TYPE_CONFIG[f]?.label}
                  </button>
                ))}
              </div>
            </div>

            {visibleSongs.length === 0 ? (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
                Noch keine Songs hinterlegt.
              </div>
            ) : (
              moments.map(moment => (
                <div key={moment} style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{moment}</p>
                  <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    {filtered.filter(s => s.moment === moment).map(s => (
                      <SongRow
                        key={s.id}
                        song={s}
                        canEdit={canEditItem(s.id)}
                        mode={mode}
                        onUpdate={updated => setSongs(prev => prev.map(x => x.id === updated.id ? updated : x))}
                        onDelete={() => deleteSong(s.id)}
                        onPropose={onPropose}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}

            {mode === 'veranstalter' && (
              <AddSongForm eventId={eventId} onAdded={s => setSongs(prev => [...prev, s])} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
