'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit2, Check, X, Heart, Ban, ListMusic, Lightbulb, Music2, Link, ExternalLink } from 'lucide-react'
import { useAutoSave } from '@/hooks/useAutoSave'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { runOptimistic, runOptimisticInsert, tempId } from '@/lib/optimistic'
import ToggleSwitch from '@/components/ui/ToggleSwitch'
import ExternalEmbed from '@/components/consent/ExternalEmbed'

// ── Types ───────────────────────────────────────────────────────────────────

interface Song {
  id: string
  title: string
  artist: string
  type: 'wish' | 'no_go' | 'playlist'
  moment: string
  sort_order: number
  source?: string
  suggested_by_guest_name?: string | null
}

interface Playlist {
  id: string
  event_id: string
  title: string
  url: string
  platform: 'spotify' | 'youtube' | 'apple_music' | 'other'
  sort_order: number
}

interface MusicSuggestion {
  id: string
  guest_name: string
  song_title: string
  artist: string
  created_at: string
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

type Access = 'none' | 'read' | 'write'

interface Props {
  eventId: string
  mode: 'veranstalter' | 'dienstleister' | 'brautpaar'
  hasFullModuleAccess?: boolean
  tabAccess?: Access
  sectionPerms?: Record<string, Access>
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

  function startEdit() {
    setDraft(reqs ?? {
      soundcheck_date: '', soundcheck_time: '', pa_notes: '',
      stage_dimensions: '', microphone_count: 2, power_required: '',
      streaming_needed: false, streaming_notes: '', notes: '',
    })
    setEditing(true)
  }

  async function save(d: Requirements | null) {
    if (!d) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('music_requirements')
      .upsert({ event_id: eventId, ...d }, { onConflict: 'event_id' })
      .select()
      .single()
    if (error) throw error
    if (data) onSaved(data as Requirements)
  }

  const { status: saveStatus } = useAutoSave(draft, save, { enabled: editing && canEdit })

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
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Noch keine Angaben. Klicke &quot;Bearbeiten&quot; um Anforderungen hinzuzufügen.</p>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>Technische Anforderungen bearbeiten</p>
        <SaveStatus status={saveStatus} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
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
        <ToggleSwitch
          checked={draft?.streaming_needed ?? false}
          onChange={v => setDraft(prev => prev ? { ...prev, streaming_needed: v } : null)}
          size="sm"
          aria-label="Streaming erforderlich"
        />
        <span style={{ fontSize: 13 }}>Streaming erforderlich</span>
        {draft?.streaming_needed && (
          <input
            value={draft.streaming_notes}
            onChange={e => setDraft(prev => prev ? { ...prev, streaming_notes: e.target.value } : null)}
            placeholder="Details zum Streaming"
            style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setEditing(false)} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
          Fertig
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Änderungen werden automatisch gespeichert.</span>
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
  mode: 'veranstalter' | 'dienstleister' | 'brautpaar'
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
    const ok = await runOptimistic({
      apply: () => { onUpdate(draft); setEditing(false) },
      rollback: () => { onUpdate(song); setEditing(true) },
      commit: () => supabase.from('music_songs').update({
        title: draft.title, artist: draft.artist, type: draft.type, moment: draft.moment,
      }).eq('id', song.id),
      onError: e => console.error('Song speichern fehlgeschlagen', e),
    })
    setSaving(false)
    void ok
  }

  if (editing) {
    return (
      <div style={{ padding: '12px 14px', background: 'rgba(255,215,0,0.04)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 8 }}>
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
            {mode !== 'dienstleister' && (
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

function AddSongForm({ eventId, onInsertPlaceholder, onReconcile, onRollback }: {
  eventId: string
  onInsertPlaceholder: (s: Song) => void
  onReconcile: (tid: string, real: Song) => void
  onRollback: (tid: string) => void
}) {
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
    const tid = tempId()
    const placeholder: Song = { id: tid, title: title.trim(), artist: artist.trim(), type, moment, sort_order: 0 }
    await runOptimisticInsert<Song>({
      apply: () => {
        onInsertPlaceholder(placeholder)
        setTitle(''); setArtist(''); setType('wish'); setMoment('Allgemein')
        setOpen(false)
      },
      commit: async () => {
        const { data, error } = await supabase.from('music_songs')
          .insert({ event_id: eventId, title: placeholder.title, artist: placeholder.artist, type: placeholder.type, moment: placeholder.moment, sort_order: 0 })
          .select().single()
        if (error || !data) throw error ?? new Error('Insert lieferte keine Daten')
        return data as Song
      },
      reconcile: real => onReconcile(tid, real),
      rollback: () => onRollback(tid),
      onError: e => console.error('Song hinzufügen fehlgeschlagen', e),
    })
    setSaving(false)
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 8 }}>
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

// ── Brautpaar Section ─────────────────────────────────────────────────────────

const BP_SECTION_CFG: Record<string, { icon: React.ReactNode; label: string; accentColor: string; dividerColor: string; hint: string }> = {
  wish:     { icon: <Heart size={12} />,     label: 'Wünsche',  accentColor: '#C4717A', dividerColor: 'rgba(196,113,122,0.12)', hint: 'Lieder, die auf jeden Fall laufen sollen.' },
  no_go:    { icon: <Ban size={12} />,       label: 'No-Gos',   accentColor: '#e05252', dividerColor: 'rgba(224,82,82,0.12)',   hint: 'Lieder, die auf keinen Fall gespielt werden dürfen.' },
  playlist: { icon: <ListMusic size={12} />, label: 'Playlist', accentColor: 'var(--bp-gold, #B89968)', dividerColor: 'rgba(184,148,62,0.15)', hint: 'Eure Lieblingslieder für die Feier.' },
}

function BrautpaarSongSection({
  type, songs, eventId, onInsertPlaceholder, onReconcile, onRollbackInsert, onUpdate, onDelete,
}: {
  type: Song['type']
  songs: Song[]
  eventId: string
  onInsertPlaceholder: (s: Song) => void
  onReconcile: (tempId: string, real: Song) => void
  onRollbackInsert: (tempId: string) => void
  onUpdate: (s: Song) => void
  onDelete: (id: string) => void
}) {
  const cfg = BP_SECTION_CFG[type]
  const [title, setTitle]   = useState('')
  const [artist, setArtist] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle]   = useState('')
  const [editArtist, setEditArtist] = useState('')

  async function add() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const tid = tempId()
    const placeholder: Song = { id: tid, title: title.trim(), artist: artist.trim(), type, moment: 'Allgemein', sort_order: 0 }
    await runOptimisticInsert<Song>({
      apply: () => { onInsertPlaceholder(placeholder); setTitle(''); setArtist('') },
      commit: async () => {
        const { data, error } = await supabase.from('music_songs')
          .insert({ event_id: eventId, title: placeholder.title, artist: placeholder.artist, type, moment: 'Allgemein', sort_order: 0 })
          .select().single()
        if (error || !data) throw error ?? new Error('Insert lieferte keine Daten')
        return data as Song
      },
      reconcile: real => onReconcile(tid, real),
      rollback: () => onRollbackInsert(tid),
      onError: e => console.error('Song hinzufügen fehlgeschlagen', e),
    })
    setSaving(false)
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim()) return
    const song = songs.find(s => s.id === id)
    if (!song) return
    const supabase = createClient()
    const updated = { ...song, title: editTitle.trim(), artist: editArtist.trim() }
    await runOptimistic({
      apply: () => { onUpdate(updated); setEditId(null) },
      rollback: () => { onUpdate(song); setEditId(id); setEditTitle(song.title); setEditArtist(song.artist) },
      commit: () => supabase.from('music_songs').update({ title: updated.title, artist: updated.artist }).eq('id', id),
      onError: e => console.error('Song speichern fehlgeschlagen', e),
    })
  }

  function startEdit(song: Song) {
    setEditId(song.id)
    setEditTitle(song.title)
    setEditArtist(song.artist)
  }

  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--bp-rule, #ede5dc)', overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px 10px', borderBottom: `1px solid ${cfg.dividerColor}` }}>
        <span style={{ color: cfg.accentColor, display: 'flex', alignItems: 'center' }}>{cfg.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: cfg.accentColor }}>{cfg.label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500, color: cfg.accentColor, opacity: 0.55 }}>{songs.length}</span>
      </div>

      {/* Songs */}
      {songs.length === 0 && (
        <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--bp-ink-3, #8C8076)', lineHeight: 1.5 }}>
          {cfg.hint}
        </div>
      )}
      {songs.map((song, i) => (
        <div key={song.id} style={{ borderBottom: i < songs.length - 1 ? `1px solid ${cfg.dividerColor}` : undefined }}>
          {editId === song.id ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'rgba(250,248,245,0.8)' }}>
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Titel"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(song.id); if (e.key === 'Escape') setEditId(null) }}
                style={{ flex: 2, padding: '6px 9px', border: `1px solid ${cfg.accentColor}`, borderRadius: 5, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
              />
              <input
                value={editArtist}
                onChange={e => setEditArtist(e.target.value)}
                placeholder="Interpret"
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(song.id); if (e.key === 'Escape') setEditId(null) }}
                style={{ flex: 1, padding: '6px 9px', border: '1px solid var(--bp-rule, #e6ddd4)', borderRadius: 5, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
              />
              <button onClick={() => saveEdit(song.id)} style={{ padding: '6px 9px', background: cfg.accentColor, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Check size={12} />
              </button>
              <button onClick={() => setEditId(null)} style={{ padding: '6px 8px', background: 'none', border: '1px solid var(--bp-rule, #e6ddd4)', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={12} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--bp-ink, #3a3028)' }}>{song.title || '—'}</span>
                {song.artist && <span style={{ fontSize: 12, color: 'var(--bp-ink, #3a3028)', opacity: 0.42, marginLeft: 7 }}>— {song.artist}</span>}
              </div>
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                <button onClick={() => startEdit(song)} style={{ padding: '4px 7px', background: 'none', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.35 }}>
                  <Edit2 size={12} />
                </button>
                <button onClick={() => onDelete(song.id)} style={{ padding: '4px 7px', background: 'none', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.45 }}>
                  <Trash2 size={12} style={{ color: '#e05252' }} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Inline add */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderTop: songs.length > 0 ? `1px solid ${cfg.dividerColor}` : undefined, background: 'rgba(250,248,245,0.5)' }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Titel hinzufügen…"
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          style={{ flex: 2, padding: '6px 9px', border: '1px solid transparent', borderRadius: 5, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'transparent', color: 'var(--bp-ink, #3a3028)' }}
        />
        <input
          value={artist}
          onChange={e => setArtist(e.target.value)}
          placeholder="Interpret (optional)"
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          style={{ flex: 1, padding: '6px 9px', border: '1px solid transparent', borderRadius: 5, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'transparent', color: 'var(--bp-ink, #3a3028)' }}
        />
        <button
          onClick={add}
          disabled={saving || !title.trim()}
          style={{ padding: '6px 10px', background: title.trim() ? cfg.accentColor : 'transparent', color: title.trim() ? '#fff' : 'var(--bp-ink, #3a3028)', border: title.trim() ? 'none' : '1px solid var(--bp-rule, #e6ddd4)', borderRadius: 5, cursor: title.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', transition: 'all 0.15s', opacity: saving ? 0.6 : title.trim() ? 1 : 0.4 }}
        >
          {saving ? '…' : <Plus size={13} />}
        </button>
      </div>
    </div>
  )
}

function BrautpaarMusikView({ eventId, songs, setSongs }: { eventId: string; songs: Song[]; setSongs: React.Dispatch<React.SetStateAction<Song[]>> }) {
  async function deleteSong(id: string) {
    const supabase = createClient()
    const snapshot = songs
    await runOptimistic({
      apply: () => setSongs(prev => prev.filter(s => s.id !== id)),
      rollback: () => setSongs(snapshot),
      commit: () => supabase.from('music_songs').delete().eq('id', id),
      onError: e => console.error('Song löschen fehlgeschlagen', e),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {(['wish', 'no_go'] as Song['type'][]).map(type => (
        <BrautpaarSongSection
          key={type}
          type={type}
          songs={songs.filter(s => s.type === type)}
          eventId={eventId}
          onInsertPlaceholder={s => setSongs(prev => [...prev, s])}
          onReconcile={(tid, real) => setSongs(prev => prev.map(x => x.id === tid ? real : x))}
          onRollbackInsert={tid => setSongs(prev => prev.filter(x => x.id !== tid))}
          onUpdate={updated => setSongs(prev => prev.map(x => x.id === updated.id ? updated : x))}
          onDelete={deleteSong}
        />
      ))}
    </div>
  )
}

// ── Vorschläge Lightbox ───────────────────────────────────────────────────────

function VorschlaegeLightbox({
  eventId,
  mode,
  suggestions,
  loading,
  onAccept,
  onReject,
  onClose,
}: {
  eventId: string
  mode: 'veranstalter' | 'dienstleister' | 'brautpaar'
  suggestions: MusicSuggestion[]
  loading: boolean
  onAccept: (sug: MusicSuggestion) => Promise<void>
  onReject: (id: string) => Promise<void>
  onClose: () => void
}) {
  const [acting, setActing] = useState<string | null>(null)
  const canAct = mode === 'brautpaar'

  async function accept(sug: MusicSuggestion) {
    setActing(sug.id)
    await onAccept(sug)
    setActing(null)
  }

  async function reject(id: string) {
    setActing(id)
    await onReject(id)
    setActing(null)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface, #fff)', borderRadius: 'var(--radius, 8px)', border: '1px solid var(--border)', width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Gäste-Vorschläge</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Musikwünsche aus den RSVP-Antworten</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 0' }}>
          {loading ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Wird geladen…</div>
          ) : suggestions.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Noch keine Vorschläge von Gästen.</div>
          ) : (
            suggestions.map(sug => (
              <div key={sug.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{sug.song_title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sug.artist} &middot; von <em>{sug.guest_name}</em></div>
                </div>
                {canAct && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => accept(sug)}
                      disabled={acting === sug.id}
                      title="Zur Playlist hinzufügen"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--accent, #15803D)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: acting === sug.id ? 0.6 : 1 }}
                    >
                      <Check size={12} /> Annehmen
                    </button>
                    <button
                      onClick={() => reject(sug.id)}
                      disabled={acting === sug.id}
                      title="Vorschlag ablehnen"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#e05252', opacity: acting === sug.id ? 0.6 : 1 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {!canAct && suggestions.length > 0 && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)' }}>
            Nur das Brautpaar kann Vorschläge annehmen oder ablehnen.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Playlist helpers ──────────────────────────────────────────────────────────

function detectPlatform(url: string): Playlist['platform'] {
  if (/open\.spotify\.com/i.test(url)) return 'spotify'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/music\.apple\.com/i.test(url)) return 'apple_music'
  return 'other'
}

function buildEmbedUrl(url: string, platform: Playlist['platform']): string | null {
  try {
    if (platform === 'spotify') {
      // https://open.spotify.com/(playlist|track|album)/ID → embed version
      const m = url.match(/open\.spotify\.com\/(playlist|track|album)\/([A-Za-z0-9]+)/)
      if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`
      return null
    }
    if (platform === 'youtube') {
      // youtu.be shortlink
      const short = url.match(/youtu\.be\/([A-Za-z0-9_-]+)/)
      if (short) return `https://www.youtube.com/embed/${short[1]}`
      // playlist
      const pl = url.match(/[?&]list=([A-Za-z0-9_-]+)/)
      if (pl) {
        const v = url.match(/[?&]v=([A-Za-z0-9_-]+)/)
        return `https://www.youtube.com/embed/${v ? v[1] : 'videoseries'}?list=${pl[1]}`
      }
      // single video
      const v = url.match(/[?&]v=([A-Za-z0-9_-]+)/)
      if (v) return `https://www.youtube.com/embed/${v[1]}`
      return null
    }
    if (platform === 'apple_music') {
      // https://music.apple.com/... → https://embed.music.apple.com/...
      return url.replace('https://music.apple.com/', 'https://embed.music.apple.com/')
    }
  } catch { /* ignore */ }
  return null
}

const PLATFORM_LABELS: Record<Playlist['platform'], string> = {
  spotify:     'Spotify',
  youtube:     'YouTube',
  apple_music: 'Apple Music',
  other:       'Link',
}

const PLATFORM_PRIVACY: Record<Playlist['platform'], string> = {
  spotify:     'https://www.spotify.com/de/legal/privacy-policy/',
  youtube:     'https://policies.google.com/privacy',
  apple_music: 'https://www.apple.com/legal/privacy/',
  other:       'https://policies.google.com/privacy',
}

const PLATFORM_COLORS: Record<Playlist['platform'], string> = {
  spotify:     '#1DB954',
  youtube:     '#FF0000',
  apple_music: '#FC3C44',
  other:       'var(--bp-ink-3, #8C8076)',
}

function PlaylistCard({
  pl, canEdit, onDelete,
}: { pl: Playlist; canEdit: boolean; onDelete: () => void }) {
  const embedUrl = buildEmbedUrl(pl.url, pl.platform)
  const color    = PLATFORM_COLORS[pl.platform]

  const defaultHeight = pl.platform === 'spotify' ? 352 : pl.platform === 'apple_music' ? 400 : 450
  const [height, setHeight] = useState(defaultHeight)
  const dragRef = useRef({ active: false, startY: 0, startH: 0 })

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current.active) return
      const delta = e.clientY - dragRef.current.startY
      setHeight(Math.max(120, dragRef.current.startH + delta))
    }
    function onMouseUp() {
      dragRef.current.active = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = { active: true, startY: e.clientY, startH: height }
  }

  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--bp-rule, #ede5dc)', overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--bp-rule, #ede5dc)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--bp-ink, #2C2825)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pl.title || PLATFORM_LABELS[pl.platform]}
        </span>
        <span style={{ fontSize: 11, color: 'var(--bp-ink-3, #8C8076)', flexShrink: 0 }}>{PLATFORM_LABELS[pl.platform]}</span>
        <a
          href={pl.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Im Browser öffnen"
          style={{ display: 'flex', alignItems: 'center', padding: '2px 4px', opacity: 0.5, flexShrink: 0, color: 'var(--bp-ink-2, #6b5e54)' }}
        >
          <ExternalLink size={13} />
        </a>
        {canEdit && (
          <button
            onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 4px', opacity: 0.45, flexShrink: 0 }}
          >
            <Trash2 size={13} style={{ color: '#e05252' }} />
          </button>
        )}
      </div>

      {/* Embed or fallback */}
      {embedUrl ? (
        <>
          <div style={{ padding: pl.platform === 'spotify' ? 0 : 8 }}>
            <ExternalEmbed provider={PLATFORM_LABELS[pl.platform]} privacyUrl={PLATFORM_PRIVACY[pl.platform]} minHeight={Math.max(120, Number(height) || 152)}>
              <iframe
                src={embedUrl}
                style={{ border: 'none', borderRadius: pl.platform === 'spotify' ? 0 : 8, width: '100%', height, display: 'block' }}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                title={pl.title || PLATFORM_LABELS[pl.platform]}
              />
            </ExternalEmbed>
          </div>
          {/* Resize handle */}
          <div
            onMouseDown={onDragStart}
            style={{ height: 14, cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--bp-rule, #ede5dc)' }}
          >
            <div style={{ width: 36, height: 3, borderRadius: 2, background: 'var(--bp-rule, #d6cdc5)' }} />
          </div>
        </>
      ) : (
        <div style={{ padding: '14px 16px' }}>
          <a href={pl.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: color, textDecoration: 'none', wordBreak: 'break-all' }}>
            <Link size={13} />
            {pl.url}
          </a>
          <p style={{ fontSize: 11, color: 'var(--bp-ink-3, #8C8076)', marginTop: 6 }}>Kein einbettbares Format erkannt – Link öffnet sich im Browser.</p>
        </div>
      )}
    </div>
  )
}

function PlaylistSection({
  eventId, playlists, setPlaylists, canEdit,
}: {
  eventId: string
  playlists: Playlist[]
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>
  canEdit: boolean
}) {
  const [url, setUrl]     = useState('')
  const [title, setTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [open, setOpen]   = useState(false)

  async function add() {
    const trimmed = url.trim()
    if (!trimmed) return
    setAdding(true)
    const platform = detectPlatform(trimmed)
    const supabase = createClient()
    const tid = tempId()
    const placeholder: Playlist = { id: tid, event_id: eventId, url: trimmed, title: title.trim(), platform, sort_order: playlists.length }
    await runOptimisticInsert<Playlist>({
      apply: () => {
        setPlaylists(prev => [...prev, placeholder])
        setUrl(''); setTitle(''); setOpen(false)
      },
      commit: async () => {
        const { data, error } = await supabase
          .from('musik_playlisten')
          .insert({ event_id: eventId, url: placeholder.url, title: placeholder.title, platform, sort_order: placeholder.sort_order })
          .select().single()
        if (error || !data) throw error ?? new Error('Insert lieferte keine Daten')
        return data as Playlist
      },
      reconcile: real => setPlaylists(prev => prev.map(p => p.id === tid ? real : p)),
      rollback: () => setPlaylists(prev => prev.filter(p => p.id !== tid)),
      onError: e => console.error('Playlist hinzufügen fehlgeschlagen', e),
    })
    setAdding(false)
  }

  async function del(id: string) {
    const supabase = createClient()
    const snapshot = playlists
    await runOptimistic({
      apply: () => setPlaylists(prev => prev.filter(p => p.id !== id)),
      rollback: () => setPlaylists(snapshot),
      commit: () => supabase.from('musik_playlisten').delete().eq('id', id),
      onError: e => console.error('Playlist löschen fehlgeschlagen', e),
    })
  }

  const accentColor = 'var(--bp-gold, #B89968)'

  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--bp-rule, #ede5dc)', overflow: 'hidden', background: '#fff' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px 10px', borderBottom: playlists.length > 0 || open ? '1px solid rgba(184,148,62,0.15)' : undefined }}>
        <span style={{ color: accentColor, display: 'flex', alignItems: 'center' }}><Music2 size={12} /></span>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: accentColor }}>Playlisten</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500, color: accentColor, opacity: 0.55 }}>{playlists.length}</span>
      </div>

      {/* Playlist cards */}
      {playlists.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
          {playlists.map(pl => (
            <PlaylistCard key={pl.id} pl={pl} canEdit={canEdit} onDelete={() => del(pl.id)} />
          ))}
        </div>
      )}

      {/* Add row */}
      {canEdit && (
        <div style={{ borderTop: playlists.length > 0 ? '1px solid rgba(184,148,62,0.12)' : undefined, background: 'rgba(250,248,245,0.5)' }}>
          {open ? (
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Spotify-, YouTube- oder Apple-Music-Link einfügen…"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setOpen(false) }}
                style={{ padding: '7px 10px', border: `1px solid ${accentColor}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: 'var(--bp-ink, #3a3028)' }}
              />
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Bezeichnung (optional)"
                onKeyDown={e => { if (e.key === 'Enter') add() }}
                style={{ padding: '7px 10px', border: '1px solid var(--bp-rule, #e6ddd4)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: 'var(--bp-ink, #3a3028)' }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={add}
                  disabled={adding || !url.trim()}
                  style={{ padding: '6px 14px', background: url.trim() ? accentColor : 'transparent', color: url.trim() ? '#fff' : 'var(--bp-ink)', border: url.trim() ? 'none' : '1px solid var(--bp-rule)', borderRadius: 6, fontSize: 13, cursor: url.trim() ? 'pointer' : 'default', fontFamily: 'inherit', opacity: adding ? 0.6 : 1 }}
                >
                  {adding ? '…' : 'Hinzufügen'}
                </button>
                <button onClick={() => { setOpen(false); setUrl(''); setTitle('') }} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--bp-rule, #e6ddd4)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Abbrechen</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'transparent', border: 'none', fontSize: 13, color: 'var(--bp-ink-3, #8C8076)', cursor: 'pointer', fontFamily: 'inherit', width: '100%', opacity: 0.7 }}
            >
              <Plus size={13} /> Playlist hinzufügen
            </button>
          )}
        </div>
      )}

      {playlists.length === 0 && !open && (
        <div style={{ padding: '12px 16px 13px', fontSize: 12.5, color: 'var(--bp-ink, #3a3028)', opacity: 0.35, fontStyle: 'italic' }}>
          Noch keine Playlisten
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MusikTabContent({ eventId, mode, hasFullModuleAccess = true, tabAccess = 'write', sectionPerms, onPropose }: Props) {
  const [songs, setSongs]             = useState<Song[]>([])
  const [playlists, setPlaylists]     = useState<Playlist[]>([])
  const [reqs, setReqs]               = useState<Requirements | null>(null)
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<string>('all')
  const [showVorschlaege, setShowVorschlaege] = useState(false)
  const [vorschlaege, setVorschlaege] = useState<MusicSuggestion[]>([])
  const [vorschlaegeLoading, setVorschlaegeLoading] = useState(false)
  const [vorschlaegeCount, setVorschlaegeCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    if (mode === 'brautpaar') {
      Promise.all([
        supabase.from('music_songs').select('*').eq('event_id', eventId).order('sort_order'),
        supabase.from('musik_playlisten').select('*').eq('event_id', eventId).order('sort_order'),
        supabase.from('rsvp_music_suggestions').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      ]).then(([{ data: s }, { data: p }, { count }]) => {
        setSongs(s ?? [])
        setPlaylists(p ?? [])
        setVorschlaegeCount(count ?? 0)
        setLoading(false)
      })
    } else {
      Promise.all([
        supabase.from('music_songs').select('*').eq('event_id', eventId).order('sort_order'),
        supabase.from('music_requirements').select('*').eq('event_id', eventId).single(),
        supabase.from('musik_playlisten').select('*').eq('event_id', eventId).order('sort_order'),
      ]).then(([{ data: s }, { data: r }, { data: p }]) => {
        setSongs(s ?? [])
        setReqs((r ?? null) as Requirements | null)
        setPlaylists(p ?? [])
        setLoading(false)
      })
    }
  }, [eventId, mode])

  function canEditItem() {
    if (mode !== 'dienstleister') return true
    return hasFullModuleAccess && !secReadOnly('songliste')
  }

  async function deleteSong(id: string) {
    const supabase = createClient()
    const snapshot = songs
    await runOptimistic({
      apply: () => setSongs(prev => prev.filter(s => s.id !== id)),
      rollback: () => setSongs(snapshot),
      commit: () => supabase.from('music_songs').delete().eq('id', id),
      onError: e => console.error('Song löschen fehlgeschlagen', e),
    })
  }

  async function openVorschlaege() {
    setShowVorschlaege(true)
    setVorschlaegeLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('rsvp_music_suggestions')
      .select('id, guest_name, song_title, artist, created_at')
      .eq('event_id', eventId)
      .order('created_at')
    setVorschlaege(data ?? [])
    setVorschlaegeCount((data ?? []).length)
    setVorschlaegeLoading(false)
  }

  async function acceptVorschlag(sug: MusicSuggestion) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('music_songs')
      .insert({
        event_id: eventId,
        title: sug.song_title,
        artist: sug.artist,
        // Gäste-Vorschläge sind Musikwünsche → als 'wish' speichern, damit sie
        // in der "Wünsche"-Sektion des Brautpaars (BrautpaarMusikView) erscheinen.
        // 'playlist' würde in dieser Ansicht herausgefiltert und nie angezeigt.
        type: 'wish',
        moment: 'Allgemein',
        sort_order: 0,
        source: 'gast',
        suggested_by_guest_name: sug.guest_name,
      })
      .select().single()
    if (!error) {
      await supabase.from('rsvp_music_suggestions').delete().eq('id', sug.id)
      if (data) setSongs(prev => [...prev, data as Song])
      setVorschlaege(prev => prev.filter(v => v.id !== sug.id))
      setVorschlaegeCount(c => Math.max(0, c - 1))
    }
  }

  async function rejectVorschlag(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('rsvp_music_suggestions').delete().eq('id', id)
    if (!error) {
      setVorschlaege(prev => prev.filter(v => v.id !== id))
      setVorschlaegeCount(c => Math.max(0, c - 1))
    }
  }

  const visibleSongs = songs
  const filtered     = filter === 'all' ? visibleSongs : visibleSongs.filter(s => s.type === filter)
  const moments      = Array.from(new Set(filtered.map(s => s.moment))).filter(Boolean)

  const reqsCanEdit = mode !== 'dienstleister' || hasFullModuleAccess

  function secVis(key: string): boolean {
    if (mode !== 'dienstleister') return true
    return (sectionPerms?.[key] ?? tabAccess) !== 'none'
  }
  function secReadOnly(key: string): boolean {
    if (mode !== 'dienstleister') return false
    const access = sectionPerms?.[key] ?? tabAccess
    return access === 'read'
  }

  if (mode === 'brautpaar') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: '2rem' }}>
          <div className="bp-page-header" style={{ marginBottom: 0 }}>
            <h1 className="bp-page-title">Musik</h1>
            <p className="bp-page-subtitle">Wünsche, No-Gos und eure Playlisten für den großen Tag.</p>
          </div>
          <button
            onClick={openVorschlaege}
            className="bp-btn bp-btn-secondary bp-btn-sm"
            style={{ flexShrink: 0 }}
          >
            <Lightbulb size={14} /> Vorschläge
            {vorschlaegeCount > 0 && (
              <span className="bp-chip bp-chip-gold" style={{ height: 18, padding: '0 6px' }}>{vorschlaegeCount}</span>
            )}
          </button>
        </div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} aria-hidden>
            <div className="bp-skeleton" style={{ height: 132, borderRadius: 10 }} />
            <div className="bp-skeleton" style={{ height: 132, borderRadius: 10 }} />
            <div className="bp-skeleton" style={{ height: 96, borderRadius: 10 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BrautpaarMusikView eventId={eventId} songs={songs} setSongs={setSongs} />
            <PlaylistSection
              eventId={eventId}
              playlists={playlists}
              setPlaylists={setPlaylists}
              canEdit
            />
          </div>
        )}
        {showVorschlaege && (
          <VorschlaegeLightbox
            eventId={eventId}
            mode={mode}
            suggestions={vorschlaege}
            loading={vorschlaegeLoading}
            onAccept={acceptVorschlag}
            onReject={rejectVorschlag}
            onClose={() => setShowVorschlaege(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>Musik</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={openVorschlaege} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
            <Lightbulb size={14} /> Vorschläge
          </button>
          {mode === 'dienstleister' && onPropose && (
            <button onClick={onPropose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
              Vorschlag erstellen
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
      ) : (
        <div>
          {/* Technische Anforderungen */}
          {secVis('anforderungen') && (
            <RequirementsForm reqs={reqs} eventId={eventId} canEdit={reqsCanEdit && !secReadOnly('anforderungen')} onSaved={setReqs} />
          )}

          {/* Songliste */}
          {secVis('songliste') && (
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
                        canEdit={canEditItem()}
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

            {mode !== 'dienstleister' && (
              <AddSongForm
                eventId={eventId}
                onInsertPlaceholder={s => setSongs(prev => [...prev, s])}
                onReconcile={(tid, real) => setSongs(prev => prev.map(x => x.id === tid ? real : x))}
                onRollback={tid => setSongs(prev => prev.filter(x => x.id !== tid))}
              />
            )}
          </div>
          )}

          {/* Playlisten */}
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Playlisten</p>
            <PlaylistSection
              eventId={eventId}
              playlists={playlists}
              setPlaylists={setPlaylists}
              canEdit={mode !== 'dienstleister'}
            />
          </div>
        </div>
      )}
      {showVorschlaege && (
        <VorschlaegeLightbox
          eventId={eventId}
          mode={mode}
          suggestions={vorschlaege}
          loading={vorschlaegeLoading}
          onAccept={acceptVorschlag}
          onReject={rejectVorschlag}
          onClose={() => setShowVorschlaege(false)}
        />
      )}
    </div>
  )
}
