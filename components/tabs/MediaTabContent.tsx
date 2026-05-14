'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit2, Check, X, Star, MinusCircle, XCircle, Lightbulb } from 'lucide-react'
import GuestPhotosSection from '@/components/medien/GuestPhotosSection'

// ── Types ────────────────────────────────────────────────────────────────────

interface Briefing {
  photo_briefing: string
  video_briefing: string
  photo_restrictions: string
  upload_instructions: string
  delivery_deadline: string
}

interface ShotItem {
  id: string
  title: string
  description: string
  type: 'must_have' | 'optional' | 'forbidden'
  category: string
  sort_order: number
}

export interface ItemPerm { can_view: boolean; can_edit: boolean }

type Access = 'none' | 'read' | 'write'

interface Props {
  eventId: string
  mode: 'veranstalter' | 'dienstleister' | 'brautpaar'
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

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; bg: string; color: string }> = {
  must_have: { icon: <Star size={13} />,        label: 'Pflichtaufnahme', bg: 'rgba(52,199,89,0.1)',  color: '#34A853' },
  optional:  { icon: <MinusCircle size={13} />, label: 'Optional',        bg: 'rgba(29,29,31,0.06)', color: 'var(--text-tertiary)' },
  forbidden: { icon: <XCircle size={13} />,     label: 'Verboten',        bg: 'rgba(255,59,48,0.08)', color: '#FF3B30' },
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

// ── Briefing Section ──────────────────────────────────────────────────────────

function BriefingSection({ briefing, eventId, canEdit, onSaved }: {
  briefing: Briefing | null; eventId: string; canEdit: boolean; onSaved: (b: Briefing) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState<Briefing>(briefing ?? {
    photo_briefing: '', video_briefing: '', photo_restrictions: '',
    upload_instructions: '', delivery_deadline: '',
  })
  const [saving, setSaving] = useState(false)

  function set<K extends keyof Briefing>(k: K, v: string) {
    setDraft(p => ({ ...p, [k]: v }))
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('media_briefing')
      .upsert({ event_id: eventId, ...draft }, { onConflict: 'event_id' })
      .select().single()
    setSaving(false)
    if (!error && data) { onSaved(data as Briefing); setEditing(false) }
  }

  if (!briefing && !canEdit) return null

  if (editing || (!briefing && canEdit)) {
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--gold)', padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>Briefing</p>
          {briefing && <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <Label>Foto-Briefing</Label>
            <textarea value={draft.photo_briefing} onChange={e => set('photo_briefing', e.target.value)} rows={4} placeholder="Briefing für Fotografen…" style={{ ...inputStyle(), resize: 'vertical' }} />
          </div>
          <div>
            <Label>Video-Briefing</Label>
            <textarea value={draft.video_briefing} onChange={e => set('video_briefing', e.target.value)} rows={4} placeholder="Briefing für Videografen…" style={{ ...inputStyle(), resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <Label>Aufnahmebeschränkungen</Label>
          <textarea value={draft.photo_restrictions} onChange={e => set('photo_restrictions', e.target.value)} rows={2} placeholder="Was darf nicht fotografiert werden?" style={{ ...inputStyle(), resize: 'vertical' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <Label>Upload-Anweisungen</Label>
            <textarea value={draft.upload_instructions} onChange={e => set('upload_instructions', e.target.value)} rows={2} placeholder="Wie sollen Dateien geliefert werden?" style={{ ...inputStyle(), resize: 'vertical' }} />
          </div>
          <div>
            <Label>Lieferfrist</Label>
            <input value={draft.delivery_deadline} onChange={e => set('delivery_deadline', e.target.value)} placeholder="z.B. 4 Wochen nach Event" style={inputStyle()} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={saving} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>{saving ? 'Speichern…' : 'Speichern'}</button>
          {briefing && <button onClick={() => setEditing(false)} style={{ padding: '8px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer' }}>Abbrechen</button>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>Briefing</p>
        {canEdit && <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}><Edit2 size={12} /> Bearbeiten</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: briefing?.video_briefing ? '1fr 1fr' : '1fr', gap: 16, marginBottom: briefing?.photo_restrictions ? 12 : 0 }}>
        {briefing?.photo_briefing && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Fotografie</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{briefing.photo_briefing}</p>
          </div>
        )}
        {briefing?.video_briefing && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Video</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{briefing.video_briefing}</p>
          </div>
        )}
      </div>
      {briefing?.photo_restrictions && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,59,48,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,59,48,0.15)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#FF3B30', marginBottom: 3 }}>Aufnahmebeschränkungen</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>{briefing.photo_restrictions}</p>
        </div>
      )}
      {briefing?.delivery_deadline && (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>Lieferfrist: {briefing.delivery_deadline}</p>
      )}
    </div>
  )
}

// ── Shot Item Row ─────────────────────────────────────────────────────────────

function ShotItemRow({ item, canEdit, mode, onUpdate, onDelete, onPropose }: {
  item: ShotItem; canEdit: boolean; mode: 'veranstalter' | 'dienstleister' | 'brautpaar'
  onUpdate: (i: ShotItem) => void; onDelete: () => void; onPropose?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(item)
  const [saving, setSaving]   = useState(false)
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.optional

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('media_shot_items').update({
      title: draft.title, description: draft.description, type: draft.type, category: draft.category,
    }).eq('id', item.id)
    setSaving(false)
    if (!error) { onUpdate(draft); setEditing(false) }
  }

  if (editing) {
    return (
      <div style={{ padding: '12px 14px', background: 'rgba(255,215,0,0.04)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div style={{ gridColumn: '1 / -1' }}><Label>Titel</Label><input value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} style={inputStyle()} /></div>
          <div style={{ gridColumn: '1 / -1' }}><Label>Beschreibung</Label><textarea value={draft.description} onChange={e => setDraft(p => ({ ...p, description: e.target.value }))} rows={2} style={{ ...inputStyle(), resize: 'vertical' }} /></div>
          <div>
            <Label>Typ</Label>
            <select value={draft.type} onChange={e => setDraft(p => ({ ...p, type: e.target.value as ShotItem['type'] }))} style={{ ...inputStyle() }}>
              <option value="must_have">Pflichtaufnahme</option>
              <option value="optional">Optional</option>
              <option value="forbidden">Verboten</option>
            </select>
          </div>
          <div><Label>Kategorie</Label><input value={draft.category} onChange={e => setDraft(p => ({ ...p, category: e.target.value }))} placeholder="z.B. Zeremonie" style={inputStyle()} /></div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={save} disabled={saving} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? '…' : <><Check size={12} /> Speichern</>}</button>
          <button onClick={() => { setDraft(item); setEditing(false) }} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer' }}><X size={12} /></button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ padding: '3px 8px', borderRadius: 4, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {cfg.icon} {cfg.label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</p>
        {item.description && <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{item.description}</p>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {canEdit && (
          <>
            <button onClick={() => setEditing(true)} style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}><Edit2 size={12} style={{ color: 'var(--text-secondary)' }} /></button>
            {mode !== 'dienstleister' && <button onClick={onDelete} style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}><Trash2 size={12} style={{ color: '#FF3B30' }} /></button>}
          </>
        )}
        {!canEdit && mode === 'dienstleister' && onPropose && (
          <button onClick={onPropose} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}><Lightbulb size={11} /> Vorschlag</button>
        )}
      </div>
    </div>
  )
}

// ── Add Shot Form ─────────────────────────────────────────────────────────────

function AddShotForm({ eventId, count, onAdded }: { eventId: string; count: number; onAdded: (i: ShotItem) => void }) {
  const [open, setOpen]     = useState(false)
  const [title, setTitle]   = useState('')
  const [desc, setDesc]     = useState('')
  const [type, setType]     = useState<ShotItem['type']>('must_have')
  const [cat, setCat]       = useState('Allgemein')
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('media_shot_items').insert({
      event_id: eventId, title: title.trim(), description: desc.trim(), type, category: cat, sort_order: count,
    }).select().single()
    setSaving(false)
    if (!error && data) { onAdded(data as ShotItem); setTitle(''); setDesc(''); setType('must_have'); setCat('Allgemein'); setOpen(false) }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', width: '100%', marginTop: 4 }}>
      <Plus size={14} /> Aufnahme hinzufügen
    </button>
  )
  return (
    <div style={{ padding: '12px 14px', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', marginTop: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div style={{ gridColumn: '1 / -1' }}><Label>Titel *</Label><input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle()} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label>Beschreibung</Label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} style={{ ...inputStyle(), resize: 'vertical' }} /></div>
        <div>
          <Label>Typ</Label>
          <select value={type} onChange={e => setType(e.target.value as ShotItem['type'])} style={inputStyle()}>
            <option value="must_have">Pflichtaufnahme</option>
            <option value="optional">Optional</option>
            <option value="forbidden">Verboten</option>
          </select>
        </div>
        <div><Label>Kategorie</Label><input value={cat} onChange={e => setCat(e.target.value)} placeholder="z.B. Zeremonie" style={inputStyle()} /></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={add} disabled={saving || !title.trim()} style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: saving || !title.trim() ? 0.6 : 1 }}>{saving ? 'Hinzufügen…' : 'Hinzufügen'}</button>
        <button onClick={() => setOpen(false)} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer' }}>Abbrechen</button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MediaTabContent({ eventId, mode, hasFullModuleAccess = true, tabAccess = 'write', sectionPerms, onPropose }: Props) {
  const [briefing, setBriefing]           = useState<Briefing | null>(null)
  const [shots, setShots]                 = useState<ShotItem[]>([])
  const [loading, setLoading]             = useState(true)
  const [typeFilter, setFilter]           = useState<string>('all')
  const [galleryEnabled, setGalleryEnabled] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('media_briefing').select('*').eq('event_id', eventId).maybeSingle(),
      supabase.from('media_shot_items').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('feature_toggles').select('enabled').eq('event_id', eventId).eq('key', 'gaeste-fotos').maybeSingle(),
    ]).then(([{ data: b }, { data: s }, { data: ft }]) => {
      setBriefing(b ?? null)
      setShots(s ?? [])
      setGalleryEnabled(ft?.enabled ?? true)
      setLoading(false)
    })
  }, [eventId])

  const briefingVisible = secVis(sectionPerms, tabAccess, 'briefing')
  const briefingReadOnly = secReadOnly(sectionPerms, tabAccess, 'briefing')
  const shotlisteVisible = secVis(sectionPerms, tabAccess, 'shotliste')
  const shotlisteReadOnly = secReadOnly(sectionPerms, tabAccess, 'shotliste')

  function canEditShot() {
    if (mode !== 'dienstleister') return true
    return !shotlisteReadOnly && hasFullModuleAccess
  }

  async function deleteShot(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('media_shot_items').delete().eq('id', id)
    if (!error) setShots(prev => prev.filter(s => s.id !== id))
  }

  const briefingCanEdit = (mode !== 'dienstleister' || hasFullModuleAccess) && !briefingReadOnly
  const filtered        = typeFilter === 'all' ? shots : shots.filter(s => s.type === typeFilter)
  const categories      = Array.from(new Set(filtered.map(s => s.category))).filter(Boolean)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>Foto & Videograf</h1>
        {mode === 'dienstleister' && onPropose && (
          <button onClick={onPropose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
            <Lightbulb size={14} /> Vorschlag erstellen
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
      ) : (
        <div>
          {briefingVisible && (
            <BriefingSection briefing={briefing} eventId={eventId} canEdit={briefingCanEdit} onSaved={setBriefing} />
          )}

          {/* Shot-Liste */}
          {shotlisteVisible && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
                Shot-Liste ({shots.length})
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', 'must_have', 'optional', 'forbidden'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: typeFilter === f ? 'var(--accent)' : 'var(--surface)', color: typeFilter === f ? '#fff' : 'var(--text-secondary)', fontWeight: typeFilter === f ? 600 : 400 }}>
                    {f === 'all' ? 'Alle' : TYPE_CONFIG[f]?.label}
                  </button>
                ))}
              </div>
            </div>

            {shots.length === 0 ? (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
                Noch keine Shot-Liste hinterlegt.
              </div>
            ) : (
              categories.map(cat => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{cat}</p>
                  <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    {filtered.filter(s => s.category === cat).map(s => (
                      <ShotItemRow
                        key={s.id} item={s}
                        canEdit={canEditShot()} mode={mode}
                        onUpdate={updated => setShots(prev => prev.map(x => x.id === updated.id ? updated : x))}
                        onDelete={() => deleteShot(s.id)}
                        onPropose={onPropose}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}

            {(mode !== 'dienstleister' || canEditShot()) && (
              <AddShotForm eventId={eventId} count={shots.length} onAdded={s => setShots(prev => [...prev, s])} />
            )}
          </div>
          )}

          {galleryEnabled && <GuestPhotosSection eventId={eventId} mode={mode} />}
        </div>
      )}
    </div>
  )
}
