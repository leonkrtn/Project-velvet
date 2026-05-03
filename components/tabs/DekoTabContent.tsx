'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit2, Check, X, MapPin, Clock, Lightbulb } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface SetupItem {
  id: string
  title: string
  description: string
  location_in_venue: string
  setup_by: string
  teardown_at: string
  sort_order: number
}

interface DekorWish {
  id: string
  title: string
  notes: string | null
  image_url: string | null
}

export interface ItemPerm { can_view: boolean; can_edit: boolean }

type Access = 'none' | 'read' | 'write'

interface Props {
  eventId: string
  mode: 'veranstalter' | 'dienstleister'
  hasFullModuleAccess?: boolean
  itemPermissions?: Record<string, ItemPerm>
  tabAccess?: Access
  sectionPerms?: Record<string, Access>
  onPropose?: () => void
}

function secVis(sectionPerms: Record<string, Access> | undefined, tabAccess: Access, key: string): boolean {
  return (sectionPerms?.[key] ?? tabAccess) !== 'none'
}

function secReadOnly(sectionPerms: Record<string, Access> | undefined, tabAccess: Access, key: string): boolean {
  return (sectionPerms?.[key] ?? tabAccess) === 'read'
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 5 }}>
      {children}
    </label>
  )
}

function inputStyle() {
  return { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
}

// ── Setup Item Row ────────────────────────────────────────────────────────────

function SetupItemRow({ item, index, canEdit, mode, onUpdate, onDelete, onPropose }: {
  item: SetupItem; index: number; canEdit: boolean; mode: 'veranstalter' | 'dienstleister'
  onUpdate: (i: SetupItem) => void; onDelete: () => void; onPropose?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(item)
  const [saving, setSaving]   = useState(false)

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('decor_setup_items').update({
      title: draft.title, description: draft.description,
      location_in_venue: draft.location_in_venue, setup_by: draft.setup_by, teardown_at: draft.teardown_at,
    }).eq('id', item.id)
    setSaving(false)
    if (!error) { onUpdate(draft); setEditing(false) }
  }

  if (editing) {
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gold)', padding: '14px 16px', marginBottom: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Label>Titel</Label>
            <input value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} style={inputStyle()} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Label>Beschreibung</Label>
            <textarea value={draft.description} onChange={e => setDraft(p => ({ ...p, description: e.target.value }))} rows={2} style={{ ...inputStyle(), resize: 'vertical' }} />
          </div>
          <div><Label>Ort in Location</Label><input value={draft.location_in_venue} onChange={e => setDraft(p => ({ ...p, location_in_venue: e.target.value }))} placeholder="z.B. Eingang" style={inputStyle()} /></div>
          <div><Label>Aufbau bis</Label><input value={draft.setup_by} onChange={e => setDraft(p => ({ ...p, setup_by: e.target.value }))} placeholder="z.B. 14:00" style={inputStyle()} /></div>
          <div><Label>Abbau ab</Label><input value={draft.teardown_at} onChange={e => setDraft(p => ({ ...p, teardown_at: e.target.value }))} placeholder="z.B. 23:00" style={inputStyle()} /></div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={save} disabled={saving} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? '…' : <><Check size={12} /> Speichern</>}</button>
          <button onClick={() => { setDraft(item); setEditing(false) }} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer' }}><X size={12} /></button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '14px 16px', display: 'flex', gap: 14, marginBottom: 8 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{index + 1}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: item.description ? 3 : 6 }}>{item.title}</p>
        {item.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>{item.description}</p>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {item.location_in_venue && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}><MapPin size={11} />{item.location_in_venue}</span>}
          {item.setup_by && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}><Clock size={11} />bis {item.setup_by}</span>}
          {item.teardown_at && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Abbau: {item.teardown_at}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {canEdit && (
          <>
            <button onClick={() => setEditing(true)} style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}><Edit2 size={12} style={{ color: 'var(--text-secondary)' }} /></button>
            {mode === 'veranstalter' && <button onClick={onDelete} style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}><Trash2 size={12} style={{ color: '#FF3B30' }} /></button>}
          </>
        )}
        {!canEdit && mode === 'dienstleister' && onPropose && (
          <button onClick={onPropose} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}><Lightbulb size={11} /> Vorschlag</button>
        )}
      </div>
    </div>
  )
}

// ── Wish Card ─────────────────────────────────────────────────────────────────

function WishCard({ wish, canEdit, mode, onUpdate, onDelete, onPropose }: {
  wish: DekorWish; canEdit: boolean; mode: 'veranstalter' | 'dienstleister'
  onUpdate: (w: DekorWish) => void; onDelete: () => void; onPropose?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(wish)
  const [saving, setSaving]   = useState(false)

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('deko_wishes').update({
      title: draft.title, notes: draft.notes, image_url: draft.image_url,
    }).eq('id', wish.id)
    setSaving(false)
    if (!error) { onUpdate(draft); setEditing(false) }
  }

  if (editing) {
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gold)', padding: '14px 16px' }}>
        <Label>Titel</Label>
        <input value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} style={{ ...inputStyle(), marginBottom: 8 }} />
        <Label>Notizen</Label>
        <textarea value={draft.notes ?? ''} onChange={e => setDraft(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...inputStyle(), resize: 'vertical', marginBottom: 8 }} />
        <Label>Bild-URL</Label>
        <input value={draft.image_url ?? ''} onChange={e => setDraft(p => ({ ...p, image_url: e.target.value }))} placeholder="https://…" style={{ ...inputStyle(), marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={save} disabled={saving} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? '…' : 'Speichern'}</button>
          <button onClick={() => { setDraft(wish); setEditing(false) }} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer' }}>Abbrechen</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative' }}>
      {wish.image_url && <img src={wish.image_url} alt={wish.title} style={{ width: '100%', height: 140, objectFit: 'cover' }} />}
      <div style={{ padding: '12px 14px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: wish.notes ? 4 : 0 }}>{wish.title}</p>
        {wish.notes && <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{wish.notes}</p>}
        {(canEdit || (!canEdit && mode === 'dienstleister')) && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {canEdit && (
              <>
                <button onClick={() => setEditing(true)} style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}><Edit2 size={11} /></button>
                {mode === 'veranstalter' && <button onClick={onDelete} style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}><Trash2 size={11} style={{ color: '#FF3B30' }} /></button>}
              </>
            )}
            {!canEdit && onPropose && (
              <button onClick={onPropose} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}><Lightbulb size={11} /> Vorschlag</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Add Forms ─────────────────────────────────────────────────────────────────

function AddSetupItemForm({ eventId, count, onAdded }: { eventId: string; count: number; onAdded: (i: SetupItem) => void }) {
  const [open, setOpen]     = useState(false)
  const [title, setTitle]   = useState('')
  const [desc, setDesc]     = useState('')
  const [loc, setLoc]       = useState('')
  const [setup, setSetup]   = useState('')
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('decor_setup_items').insert({
      event_id: eventId, title: title.trim(), description: desc.trim(),
      location_in_venue: loc.trim(), setup_by: setup.trim(), teardown_at: '', sort_order: count,
    }).select().single()
    setSaving(false)
    if (!error && data) { onAdded(data as SetupItem); setTitle(''); setDesc(''); setLoc(''); setSetup(''); setOpen(false) }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', width: '100%', marginTop: 4 }}>
      <Plus size={14} /> Aufgabe hinzufügen
    </button>
  )
  return (
    <div style={{ padding: '14px 16px', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', marginTop: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div style={{ gridColumn: '1 / -1' }}><Label>Titel *</Label><input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle()} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>Beschreibung</Label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} style={{ ...inputStyle(), resize: 'vertical' }} /></div>
        <div><Label>Ort</Label><input value={loc} onChange={e => setLoc(e.target.value)} placeholder="z.B. Eingang" style={inputStyle()} /></div>
        <div><Label>Aufbau bis</Label><input value={setup} onChange={e => setSetup(e.target.value)} placeholder="z.B. 14:00" style={inputStyle()} /></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={add} disabled={saving || !title.trim()} style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: saving || !title.trim() ? 0.6 : 1 }}>{saving ? 'Hinzufügen…' : 'Hinzufügen'}</button>
        <button onClick={() => setOpen(false)} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer' }}>Abbrechen</button>
      </div>
    </div>
  )
}

function AddWishForm({ eventId, onAdded }: { eventId: string; onAdded: (w: DekorWish) => void }) {
  const [open, setOpen]       = useState(false)
  const [title, setTitle]     = useState('')
  const [notes, setNotes]     = useState('')
  const [imageUrl, setImgUrl] = useState('')
  const [saving, setSaving]   = useState(false)

  async function add() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('deko_wishes').insert({
      event_id: eventId, title: title.trim(), notes: notes.trim() || null, image_url: imageUrl.trim() || null,
    }).select('id, title, notes, image_url').single()
    setSaving(false)
    if (!error && data) { onAdded(data as DekorWish); setTitle(''); setNotes(''); setImgUrl(''); setOpen(false) }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', width: '100%', marginTop: 4 }}>
      <Plus size={14} /> Dekor-Wunsch hinzufügen
    </button>
  )
  return (
    <div style={{ padding: '14px 16px', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', marginTop: 4 }}>
      <div style={{ marginBottom: 8 }}><Label>Titel *</Label><input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle()} /></div>
      <div style={{ marginBottom: 8 }}><Label>Notizen</Label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle(), resize: 'vertical' }} /></div>
      <div style={{ marginBottom: 10 }}><Label>Bild-URL</Label><input value={imageUrl} onChange={e => setImgUrl(e.target.value)} placeholder="https://…" style={inputStyle()} /></div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={add} disabled={saving || !title.trim()} style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: saving || !title.trim() ? 0.6 : 1 }}>{saving ? 'Hinzufügen…' : 'Hinzufügen'}</button>
        <button onClick={() => setOpen(false)} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer' }}>Abbrechen</button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DekoTabContent({ eventId, mode, hasFullModuleAccess = true, tabAccess = 'write', sectionPerms, onPropose }: Props) {
  const [items, setItems]     = useState<SetupItem[]>([])
  const [wishes, setWishes]   = useState<DekorWish[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('decor_setup_items').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('deko_wishes').select('id, title, notes, image_url').eq('event_id', eventId).order('created_at'),
    ]).then(([{ data: i }, { data: w }]) => {
      setItems(i ?? [])
      setWishes(w ?? [])
      setLoading(false)
    })
  }, [eventId])

  const aufbauVisible = secVis(sectionPerms, tabAccess, 'aufbau')
  const aufbauReadOnly = secReadOnly(sectionPerms, tabAccess, 'aufbau')
  const wuenscheVisible = secVis(sectionPerms, tabAccess, 'wuensche')
  const wuenscheReadOnly = secReadOnly(sectionPerms, tabAccess, 'wuensche')

  function canEditItem(section: 'aufbau' | 'wuensche') {
    if (mode === 'veranstalter') return true
    if (section === 'aufbau') return !aufbauReadOnly && hasFullModuleAccess
    return !wuenscheReadOnly && hasFullModuleAccess
  }

  async function deleteSetupItem(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('decor_setup_items').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(x => x.id !== id))
  }

  async function deleteWish(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('deko_wishes').delete().eq('id', id)
    if (!error) setWishes(prev => prev.filter(x => x.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>Dekoration</h1>
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
          {/* Aufbau-Aufgaben */}
          {aufbauVisible && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Aufbau-Aufgaben ({items.length})</p>
            {items.length === 0 && mode !== 'veranstalter' && (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
                Noch keine Aufgaben hinterlegt.
              </div>
            )}
            {items.map((item, idx) => (
              <SetupItemRow
                key={item.id} item={item} index={idx}
                canEdit={canEditItem('aufbau')} mode={mode}
                onUpdate={updated => setItems(prev => prev.map(x => x.id === updated.id ? updated : x))}
                onDelete={() => deleteSetupItem(item.id)}
                onPropose={onPropose}
              />
            ))}
            {(mode === 'veranstalter' || canEditItem('aufbau')) && (
              <AddSetupItemForm eventId={eventId} count={items.length} onAdded={i => setItems(prev => [...prev, i])} />
            )}
          </div>
          )}

          {/* Dekor-Wünsche */}
          {wuenscheVisible && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Dekor-Wünsche ({wishes.length})</p>
            {wishes.length === 0 && mode !== 'veranstalter' && (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
                Noch keine Wünsche hinterlegt.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {wishes.map(w => (
                <WishCard
                  key={w.id} wish={w}
                  canEdit={canEditItem('wuensche')} mode={mode}
                  onUpdate={updated => setWishes(prev => prev.map(x => x.id === updated.id ? updated : x))}
                  onDelete={() => deleteWish(w.id)}
                  onPropose={onPropose}
                />
              ))}
            </div>
            {(mode === 'veranstalter' || canEditItem('wuensche')) && (
              <AddWishForm eventId={eventId} onAdded={w => setWishes(prev => [...prev, w])} />
            )}
          </div>
          )}

          {!aufbauVisible && !wuenscheVisible && mode !== 'veranstalter' && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
              Noch keine Dekoration-Informationen hinterlegt.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
