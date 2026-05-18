'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit2, Check, X, Star, MinusCircle, XCircle, Lightbulb, ChevronDown, ChevronRight } from 'lucide-react'
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

const PRESET_CATEGORIES = [
  'Zeremonie', 'Sektempfang', 'Brautpaar', 'Familie', 'Freunde & Gruppen',
  'Party & Tanzen', 'Details & Dekoration', 'Allgemein',
]

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

// ── Shot Item Row (redesigned) ────────────────────────────────────────────────

function ShotItemRow({ item, canEdit, mode, onUpdate, onDelete, onPropose }: {
  item: ShotItem; canEdit: boolean; mode: 'veranstalter' | 'dienstleister' | 'brautpaar'
  onUpdate: (i: ShotItem) => void; onDelete: () => void; onPropose?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(item)
  const [saving, setSaving]   = useState(false)
  const [saveError, setSaveError] = useState('')
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.optional

  async function save() {
    setSaving(true)
    setSaveError('')
    const supabase = createClient()
    const { error } = await supabase.from('media_shot_items').update({
      title: draft.title, description: draft.description, type: draft.type, category: draft.category,
    }).eq('id', item.id).select()
    setSaving(false)
    if (error) { setSaveError('Fehler beim Speichern.') }
    else { onUpdate(draft); setEditing(false) }
  }

  if (editing) {
    return (
      <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ marginBottom: 8 }}>
          <input
            value={draft.title}
            onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
            placeholder="Titel"
            autoFocus
            style={inputStyle()}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <textarea
            value={draft.description}
            onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
            rows={2} placeholder="Beschreibung (optional)"
            style={{ ...inputStyle(), resize: 'vertical' }}
          />
        </div>
        {/* Type toggle */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          {(['must_have', 'optional', 'forbidden'] as ShotItem['type'][]).map(t => {
            const c = TYPE_CONFIG[t]
            return (
              <button
                key={t}
                onClick={() => setDraft(p => ({ ...p, type: t }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                  border: `1px solid ${draft.type === t ? c.color : 'var(--border)'}`,
                  borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  background: draft.type === t ? c.bg : 'transparent',
                  color: draft.type === t ? c.color : 'var(--text-secondary)',
                  fontWeight: draft.type === t ? 600 : 400,
                }}
              >
                {c.icon} {c.label}
              </button>
            )
          })}
        </div>
        {/* Category */}
        <div style={{ marginBottom: 8 }}>
          <input
            value={draft.category}
            onChange={e => setDraft(p => ({ ...p, category: e.target.value }))}
            placeholder="Kategorie"
            list="shot-categories"
            style={{ ...inputStyle() }}
          />
          <datalist id="shot-categories">
            {PRESET_CATEGORIES.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
        {saveError && <p style={{ fontSize: 11, color: '#FF3B30', marginBottom: 5 }}>{saveError}</p>}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={save} disabled={saving} style={{ padding: '5px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? '…' : 'Speichern'}</button>
          <button onClick={() => { setDraft(item); setSaveError(''); setEditing(false) }} style={{ padding: '5px 9px', background: 'none', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}><X size={12} /></button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ padding: '2px 7px', borderRadius: 4, background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {cfg.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</p>
        {item.description && <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{item.description}</p>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {canEdit && (
          <>
            <button onClick={() => setEditing(true)} style={{ padding: '3px 7px', background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Edit2 size={11} style={{ color: 'var(--text-secondary)' }} /></button>
            {mode !== 'dienstleister' && <button onClick={onDelete} style={{ padding: '3px 7px', background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={11} style={{ color: '#FF3B30' }} /></button>}
          </>
        )}
        {!canEdit && mode === 'dienstleister' && onPropose && (
          <button onClick={onPropose} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}><Lightbulb size={11} /> Vorschlag</button>
        )}
      </div>
    </div>
  )
}

// ── Category section with inline add ──────────────────────────────────────────

function ShotCategorySection({ category, shots, canEdit, eventId, mode, onAdded, onUpdate, onDelete, onPropose }: {
  category: string; shots: ShotItem[]; canEdit: boolean; eventId: string
  mode: 'veranstalter' | 'dienstleister' | 'brautpaar'
  onAdded: (s: ShotItem) => void; onUpdate: (s: ShotItem) => void
  onDelete: (id: string) => void; onPropose?: () => void
}) {
  const [open, setOpen] = useState(true)
  const [addTitle, setAddTitle]   = useState('')
  const [addType, setAddType]     = useState<ShotItem['type']>('must_have')
  const [addDesc, setAddDesc]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [addError, setAddError]   = useState('')

  async function add() {
    if (!addTitle.trim()) return
    setSaving(true)
    setAddError('')
    const supabase = createClient()
    const { data, error } = await supabase.from('media_shot_items').insert({
      event_id: eventId, title: addTitle.trim(), description: addDesc.trim(),
      type: addType, category, sort_order: shots.length,
    }).select().single()
    setSaving(false)
    if (error) { setAddError('Fehler beim Speichern.') }
    else if (data) { onAdded(data as ShotItem); setAddTitle(''); setAddDesc(''); setAddType('must_have') }
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
      {/* Category header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', cursor: 'pointer', borderBottom: open ? '1px solid var(--border)' : undefined, background: 'rgba(0,0,0,0.015)' }}
        onClick={() => setOpen(p => !p)}
      >
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', flex: 1 }}>{category}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', opacity: 0.6 }}>{shots.length}</span>
        {open ? <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />}
      </div>

      {open && (
        <>
          {shots.map(s => (
            <ShotItemRow
              key={s.id} item={s} canEdit={canEdit} mode={mode}
              onUpdate={onUpdate} onDelete={() => onDelete(s.id)} onPropose={onPropose}
            />
          ))}

          {/* Inline add */}
          {canEdit && (
            <div style={{ padding: '8px 14px', background: 'rgba(0,0,0,0.01)', borderTop: shots.length > 0 ? '1px solid var(--border)' : undefined }}>
              {/* Type toggles */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {(['must_have', 'optional', 'forbidden'] as ShotItem['type'][]).map(t => {
                  const c = TYPE_CONFIG[t]
                  return (
                    <button
                      key={t}
                      onClick={() => setAddType(t)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px',
                        border: `1px solid ${addType === t ? c.color : 'var(--border)'}`,
                        borderRadius: 4, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                        background: addType === t ? c.bg : 'transparent',
                        color: addType === t ? c.color : 'var(--text-tertiary)',
                        fontWeight: addType === t ? 700 : 400,
                      }}
                    >
                      {c.icon} {c.label}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  value={addTitle}
                  onChange={e => setAddTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') add() }}
                  placeholder={`Aufnahme hinzufügen…`}
                  style={{ flex: 1, padding: '5px 9px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
                />
                <button
                  onClick={add}
                  disabled={saving || !addTitle.trim()}
                  style={{ padding: '5px 10px', background: addTitle.trim() ? 'var(--accent)' : 'var(--surface)', color: addTitle.trim() ? '#fff' : 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 5, cursor: addTitle.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
                >
                  {saving ? <span style={{ fontSize: 11 }}>…</span> : <Plus size={13} />}
                </button>
              </div>
              {addError && <p style={{ fontSize: 11, color: '#FF3B30', marginTop: 4 }}>{addError}</p>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Add Shot Form (global - kept for backward compat) ─────────────────────────

function AddShotForm({ eventId, count, onAdded }: { eventId: string; count: number; onAdded: (i: ShotItem) => void }) {
  return null
}

// ── Add category row (preset buttons + custom input) ─────────────────────────

function AddCategoryRow({ existingCategories, eventId, shotCount, onAdded }: {
  existingCategories: string[]; eventId: string; shotCount: number; onAdded: (s: ShotItem) => void
}) {
  const [customCat, setCustomCat] = useState('')
  const [saving, setSaving]       = useState<string | null>(null)

  const availablePresets = PRESET_CATEGORIES.filter(p => !existingCategories.includes(p))

  async function addFirstShotIn(category: string) {
    setSaving(category)
    const supabase = createClient()
    const { data, error } = await supabase.from('media_shot_items').insert({
      event_id: eventId, title: 'Neue Aufnahme', description: '',
      type: 'must_have', category, sort_order: shotCount,
    }).select().single()
    setSaving(null)
    if (!error && data) onAdded(data as ShotItem)
  }

  if (availablePresets.length === 0 && !customCat) return null

  return (
    <div style={{ marginTop: 4 }}>
      {availablePresets.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>Kategorie hinzufügen:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {availablePresets.map(p => (
              <button
                key={p}
                onClick={() => addFirstShotIn(p)}
                disabled={saving === p}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}
              >
                {saving === p ? '…' : <><Plus size={11} /> {p}</>}
              </button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input
                value={customCat}
                onChange={e => setCustomCat(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && customCat.trim()) { addFirstShotIn(customCat.trim()); setCustomCat('') } }}
                placeholder="Eigene Kategorie…"
                style={{ padding: '4px 9px', border: '1px dashed var(--border)', borderRadius: 20, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: 'var(--surface)', color: 'var(--text-secondary)', minWidth: 140 }}
              />
              {customCat.trim() && (
                <button onClick={() => { addFirstShotIn(customCat.trim()); setCustomCat('') }} style={{ padding: '4px 9px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Erstellen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
  // categories derived from all shots (so empty categories after filter still appear)
  const categories      = Array.from(new Set(shots.map(s => s.category))).filter(Boolean)

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
              {/* Type filter pills */}
              <div style={{ display: 'flex', gap: 5 }}>
                {['all', 'must_have', 'optional', 'forbidden'].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: typeFilter === f ? 'var(--accent)' : 'var(--surface)', color: typeFilter === f ? '#fff' : 'var(--text-secondary)', fontWeight: typeFilter === f ? 600 : 400 }}>
                    {f === 'all' ? 'Alle' : TYPE_CONFIG[f]?.label}
                  </button>
                ))}
              </div>
            </div>

            {shots.length === 0 && !canEditShot() ? (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
                Noch keine Shot-Liste hinterlegt.
              </div>
            ) : (
              <>
                {/* Existing category sections */}
                {categories.map(cat => (
                  <ShotCategorySection
                    key={cat}
                    category={cat}
                    shots={filtered.filter(s => s.category === cat)}
                    canEdit={canEditShot()}
                    eventId={eventId}
                    mode={mode}
                    onAdded={s => setShots(prev => [...prev, s])}
                    onUpdate={updated => setShots(prev => prev.map(x => x.id === updated.id ? updated : x))}
                    onDelete={deleteShot}
                    onPropose={onPropose}
                  />
                ))}

                {/* Add new category section (preset buttons + custom) */}
                {canEditShot() && (
                  <AddCategoryRow
                    existingCategories={categories}
                    eventId={eventId}
                    shotCount={shots.length}
                    onAdded={s => setShots(prev => [...prev, s])}
                  />
                )}
              </>
            )}
          </div>
          )}

          {galleryEnabled && <GuestPhotosSection eventId={eventId} mode={mode} />}
        </div>
      )}
    </div>
  )
}
