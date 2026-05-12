'use client'
import React, { useState, useEffect, useRef } from 'react'
import { X, Trash2, ArrowUp, Plus, Minus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  DekoItem, DekoCatalogItem, DekoFlatRate, DekoRole,
  ImageUploadData, ImageUrlData, ColorPaletteData,
  TextBlockData, StickyNoteData, HeadingData,
  ArticleData, FlatRateArticleData, FabricData,
  FrameData, DividerData, AreaLabelData,
  VoteCardData, ChecklistData, LinkCardData, TableRefData,
  DekoItemData,
} from '@/lib/deko/types'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  item: DekoItem
  catalog: DekoCatalogItem[]
  flatRates: DekoFlatRate[]
  role: DekoRole
  userId: string
  eventId: string
  canEdit: boolean
  onDataChange: (d: DekoItemData) => void
  onDelete: () => void
  onBringToFront: () => void
  onClose: () => void
  onCatalogCreated?: (item: DekoCatalogItem) => void
}

// ── Shared input styles ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid var(--border)',
  borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none',
  background: 'var(--surface)', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'var(--text-tertiary)', marginBottom: 4,
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={labelStyle}>{label}</label>{children}</div>
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>
}

// ── Catalog item picker / creator ─────────────────────────────────────────────

function CatalogPicker({
  catalog, selectedId, itemType, eventId, role, userId,
  onSelect, onCreated,
}: {
  catalog: DekoCatalogItem[]
  selectedId: string | undefined
  itemType: 'article' | 'fabric'
  eventId: string
  role: DekoRole
  userId: string
  onSelect: (id: string) => void
  onCreated?: (item: DekoCatalogItem) => void
}) {
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = catalog.filter(c =>
    c.item_type === itemType &&
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  async function createItem() {
    if (!newName.trim()) return
    setSaving(true)
    const { data } = await supabase.from('deko_catalog_items').insert({
      event_id: eventId,
      item_type: itemType,
      name: newName.trim(),
      created_by: userId,
    }).select().single()
    setSaving(false)
    if (data) {
      onCreated?.(data as DekoCatalogItem)
      onSelect(data.id)
      setCreating(false)
      setNewName('')
    }
  }

  return (
    <div>
      <input placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
      <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
        {filtered.map(c => (
          <div key={c.id}
            onClick={() => onSelect(c.id)}
            style={{
              padding: '7px 10px', fontSize: 13, cursor: 'pointer',
              background: c.id === selectedId ? 'var(--accent-light)' : 'transparent',
              fontWeight: c.id === selectedId ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            {c.image_url && <img src={c.image_url} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 3 }} />}
            <span style={{ flex: 1 }}>{c.name}</span>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: '10px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>Kein Treffer</div>}
      </div>
      {!creating
        ? <button onClick={() => setCreating(true)} style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            + Neuen {itemType === 'fabric' ? 'Stoff' : 'Artikel'} anlegen
          </button>
        : <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createItem()}
            placeholder="Name…" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={createItem} disabled={saving || !newName.trim()}
            style={{ padding: '7px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
            {saving ? '…' : 'Anlegen'}
          </button>
          <button onClick={() => setCreating(false)} style={{ padding: '7px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
            <X size={12} />
          </button>
        </div>
      }
    </div>
  )
}

// ── Per-type edit forms ───────────────────────────────────────────────────────

function EditImageUrl({ data, onChange, eventId }: { data: ImageUrlData; onChange: (d: ImageUrlData) => void; eventId: string }) {
  const [fetching, setFetching] = useState(false)
  async function fetchPreview(url: string) {
    if (!url) return
    setFetching(true)
    try {
      const res = await fetch(`/api/deko/og-preview?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      onChange({ ...data, url, preview_url: json.image || url, caption: data.caption || json.title })
    } catch {
      onChange({ ...data, url })
    } finally { setFetching(false) }
  }
  return (
    <>
      <Field label="URL">
        <input value={data.url || ''} onChange={e => onChange({ ...data, url: e.target.value })}
          onBlur={e => fetchPreview(e.target.value)}
          placeholder="https://…" style={inputStyle} />
      </Field>
      {fetching && <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Vorschau wird geladen…</p>}
      {data.preview_url && (
        <div style={{ marginBottom: 14, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <img src={data.preview_url} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover' }} />
        </div>
      )}
      <Field label="Beschriftung">
        <input value={data.caption || ''} onChange={e => onChange({ ...data, caption: e.target.value })} style={inputStyle} />
      </Field>
    </>
  )
}

function EditColorPalette({ data, onChange }: { data: ColorPaletteData; onChange: (d: ColorPaletteData) => void }) {
  const colors = data.colors ?? []
  function update(idx: number, field: 'hex' | 'name', val: string) {
    onChange({ colors: colors.map((c, i) => i === idx ? { ...c, [field]: val } : c) })
  }
  return (
    <>
      {colors.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input type="color" value={c.hex} onChange={e => update(i, 'hex', e.target.value)}
            style={{ width: 36, height: 32, border: '1px solid var(--border)', borderRadius: 4, padding: 2, cursor: 'pointer' }} />
          <input value={c.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Name" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={() => onChange({ colors: colors.filter((_, j) => j !== i) })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={12} /></button>
        </div>
      ))}
      {colors.length < 8 && (
        <button onClick={() => onChange({ colors: [...colors, { hex: '#C9B99A', name: '' }] })}
          style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          + Farbe hinzufügen
        </button>
      )}
    </>
  )
}

function EditArticle({ data, catalog, flatRates, onChange, eventId, role, userId, onCatalogCreated }: {
  data: ArticleData; catalog: DekoCatalogItem[]; flatRates: DekoFlatRate[]
  onChange: (d: ArticleData) => void; eventId: string; role: DekoRole; userId: string
  onCatalogCreated?: (item: DekoCatalogItem) => void
}) {
  const cat = catalog.find(c => c.id === data.catalog_item_id)
  const supabase = createClient()
  const [catDraft, setCatDraft] = useState<Partial<DekoCatalogItem>>(cat ?? {})
  const [savingCat, setSavingCat] = useState(false)

  async function saveCatalogItem() {
    if (!cat) return
    setSavingCat(true)
    await supabase.from('deko_catalog_items').update(catDraft).eq('id', cat.id)
    setSavingCat(false)
  }

  return (
    <>
      <Field label="Artikel aus Katalog">
        <CatalogPicker catalog={catalog} selectedId={data.catalog_item_id} itemType="article"
          eventId={eventId} role={role} userId={userId}
          onSelect={id => onChange({ ...data, catalog_item_id: id })}
          onCreated={onCatalogCreated} />
      </Field>
      {cat && (
        <>
          <Row>
            <Field label="Menge">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => onChange({ ...data, quantity: Math.max(1, (data.quantity ?? 1) - 1) })} style={qtyBtnStyle}><Minus size={12} /></button>
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{data.quantity ?? 1}</span>
                <button onClick={() => onChange({ ...data, quantity: (data.quantity ?? 1) + 1 })} style={qtyBtnStyle}><Plus size={12} /></button>
              </div>
            </Field>
            <Field label="Notizen">
              <input value={data.notes ?? ''} onChange={e => onChange({ ...data, notes: e.target.value })} style={inputStyle} />
            </Field>
          </Row>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />
          <p style={{ ...labelStyle, marginBottom: 10 }}>Artikel-Details (Katalog)</p>
          <Row>
            <Field label="Farbe"><input value={catDraft.color ?? ''} onChange={e => setCatDraft(p => ({ ...p, color: e.target.value }))} onBlur={saveCatalogItem} style={inputStyle} /></Field>
            <Field label="Material"><input value={catDraft.material ?? ''} onChange={e => setCatDraft(p => ({ ...p, material: e.target.value }))} onBlur={saveCatalogItem} style={inputStyle} /></Field>
          </Row>
          <Row>
            <Field label="Preis / Stück (€)">
              <input type="number" value={catDraft.price_per_unit ?? ''} onChange={e => setCatDraft(p => ({ ...p, price_per_unit: parseFloat(e.target.value) || 0 }))} onBlur={saveCatalogItem} style={inputStyle} />
            </Field>
            <Field label="Verfügbarkeit">
              <select value={catDraft.availability ?? 'available'} onChange={e => { setCatDraft(p => ({ ...p, availability: e.target.value as DekoCatalogItem['availability'] })); saveCatalogItem() }} style={{ ...inputStyle }}>
                <option value="available">Verfügbar</option>
                <option value="limited">Begrenzt</option>
                <option value="unavailable">Nicht verfügbar</option>
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="Breite (cm)"><input type="number" value={catDraft.dim_width_cm ?? ''} onChange={e => setCatDraft(p => ({ ...p, dim_width_cm: parseFloat(e.target.value) || null }))} onBlur={saveCatalogItem} style={inputStyle} /></Field>
            <Field label="Höhe (cm)"><input type="number" value={catDraft.dim_height_cm ?? ''} onChange={e => setCatDraft(p => ({ ...p, dim_height_cm: parseFloat(e.target.value) || null }))} onBlur={saveCatalogItem} style={inputStyle} /></Field>
          </Row>
          <Field label="Pauschale">
            <select value={catDraft.flat_rate_id ?? ''} onChange={e => { setCatDraft(p => ({ ...p, flat_rate_id: e.target.value || null })); saveCatalogItem() }} style={{ ...inputStyle }}>
              <option value="">Kein — Einzelpreis</option>
              {flatRates.map(fr => <option key={fr.id} value={fr.id}>{fr.name} ({fr.amount} €)</option>)}
            </select>
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
            <input type="checkbox" checked={catDraft.is_free ?? false} onChange={e => { setCatDraft(p => ({ ...p, is_free: e.target.checked })); saveCatalogItem() }} />
            Gratis (kein Budget-Eintrag)
          </label>
          {cat.image_url && <img src={cat.image_url} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />}
          <Field label="Bild-URL">
            <input value={catDraft.image_url ?? ''} onChange={e => setCatDraft(p => ({ ...p, image_url: e.target.value }))} onBlur={saveCatalogItem} placeholder="https://…" style={inputStyle} />
          </Field>
        </>
      )}
    </>
  )
}

function EditFabric({ data, catalog, onChange, eventId, role, userId, onCatalogCreated }: {
  data: FabricData; catalog: DekoCatalogItem[]
  onChange: (d: FabricData) => void; eventId: string; role: DekoRole; userId: string
  onCatalogCreated?: (item: DekoCatalogItem) => void
}) {
  const cat = catalog.find(c => c.id === data.catalog_item_id)
  const supabase = createClient()
  const [catDraft, setCatDraft] = useState<Partial<DekoCatalogItem>>(cat ?? {})

  async function saveCatalogItem() {
    if (!cat) return
    await supabase.from('deko_catalog_items').update(catDraft).eq('id', cat.id)
  }

  return (
    <>
      <Field label="Stoff aus Katalog">
        <CatalogPicker catalog={catalog} selectedId={data.catalog_item_id} itemType="fabric"
          eventId={eventId} role={role} userId={userId}
          onSelect={id => onChange({ ...data, catalog_item_id: id })}
          onCreated={onCatalogCreated} />
      </Field>
      {cat && (
        <>
          <Row>
            <Field label="Benötigte Meter">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => onChange({ ...data, quantity_meters: Math.max(0.5, (data.quantity_meters ?? 1) - 0.5) })} style={qtyBtnStyle}><Minus size={12} /></button>
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 36, textAlign: 'center' }}>{data.quantity_meters ?? 1} m</span>
                <button onClick={() => onChange({ ...data, quantity_meters: (data.quantity_meters ?? 1) + 0.5 })} style={qtyBtnStyle}><Plus size={12} /></button>
              </div>
            </Field>
            <Field label="Notizen"><input value={data.notes ?? ''} onChange={e => onChange({ ...data, notes: e.target.value })} style={inputStyle} /></Field>
          </Row>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />
          <p style={{ ...labelStyle, marginBottom: 10 }}>Stoff-Details (Katalog)</p>
          <Row>
            <Field label="Farbe"><input value={catDraft.color ?? ''} onChange={e => setCatDraft(p => ({ ...p, color: e.target.value }))} onBlur={saveCatalogItem} style={inputStyle} /></Field>
            <Field label="Gewebeart"><input value={catDraft.fabric_type ?? ''} onChange={e => setCatDraft(p => ({ ...p, fabric_type: e.target.value }))} onBlur={saveCatalogItem} placeholder="z.B. Satin, Chiffon…" style={inputStyle} /></Field>
          </Row>
          <Row>
            <Field label="Breite (cm)"><input type="number" value={catDraft.fabric_width_cm ?? ''} onChange={e => setCatDraft(p => ({ ...p, fabric_width_cm: parseFloat(e.target.value) || null }))} onBlur={saveCatalogItem} style={inputStyle} /></Field>
            <Field label="Preis / Meter (€)"><input type="number" value={catDraft.price_per_meter ?? ''} onChange={e => setCatDraft(p => ({ ...p, price_per_meter: parseFloat(e.target.value) || 0 }))} onBlur={saveCatalogItem} style={inputStyle} /></Field>
          </Row>
          <Field label="Bild-URL"><input value={catDraft.image_url ?? ''} onChange={e => setCatDraft(p => ({ ...p, image_url: e.target.value }))} onBlur={saveCatalogItem} placeholder="https://…" style={inputStyle} /></Field>
        </>
      )}
    </>
  )
}

function EditChecklist({ data, onChange }: { data: ChecklistData; onChange: (d: ChecklistData) => void }) {
  const items = data.items ?? []
  function addItem() {
    onChange({ ...data, items: [...items, { id: crypto.randomUUID(), text: '', checked: false }] })
  }
  return (
    <>
      <Field label="Titel">
        <input value={data.title ?? ''} onChange={e => onChange({ ...data, title: e.target.value })} style={inputStyle} />
      </Field>
      <p style={labelStyle}>Punkte</p>
      {items.map((item, i) => (
        <div key={item.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input value={item.text} onChange={e => onChange({ ...data, items: items.map((it, j) => j === i ? { ...it, text: e.target.value } : it) })}
            style={{ ...inputStyle, flex: 1 }} placeholder={`Punkt ${i + 1}`} />
          <button onClick={() => onChange({ ...data, items: items.filter((_, j) => j !== i) })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={12} /></button>
        </div>
      ))}
      <button onClick={addItem} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginTop: 4 }}>
        + Punkt hinzufügen
      </button>
    </>
  )
}

function EditVoteCard({ data, onChange }: { data: VoteCardData; onChange: (d: VoteCardData) => void }) {
  return (
    <>
      <Field label="Titel"><input value={data.title ?? ''} onChange={e => onChange({ ...data, title: e.target.value })} style={inputStyle} /></Field>
      <Field label="Bild-URL"><input value={data.image_url ?? ''} onChange={e => onChange({ ...data, image_url: e.target.value })} placeholder="https://…" style={inputStyle} /></Field>
      <Field label="Beschreibung">
        <textarea value={data.description ?? ''} onChange={e => onChange({ ...data, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>
    </>
  )
}

function EditFrame({ data, onChange }: { data: FrameData; onChange: (d: FrameData) => void }) {
  return (
    <>
      <Field label="Bezeichnung"><input value={data.label ?? ''} onChange={e => onChange({ ...data, label: e.target.value })} style={inputStyle} /></Field>
      <Row>
        <Field label="Rahmenfarbe">
          <input type="color" value={data.color || '#C9B99A'} onChange={e => onChange({ ...data, color: e.target.value })}
            style={{ ...inputStyle, height: 36, padding: 2, cursor: 'pointer' }} />
        </Field>
        <Field label="Deckkraft ({Math.round((data.opacity??0.1)*100)}%)">
          <input type="range" min="0" max="0.5" step="0.05" value={data.opacity ?? 0.1}
            onChange={e => onChange({ ...data, opacity: parseFloat(e.target.value) })}
            style={{ width: '100%', marginTop: 8 }} />
        </Field>
      </Row>
    </>
  )
}

function EditHeading({ data, onChange }: { data: HeadingData; onChange: (d: HeadingData) => void }) {
  return (
    <>
      <Field label="Text"><input value={data.text ?? ''} onChange={e => onChange({ ...data, text: e.target.value })} style={inputStyle} /></Field>
      <Field label="Größe">
        <div style={{ display: 'flex', gap: 6 }}>
          {([1, 2, 3] as const).map(l => (
            <button key={l} onClick={() => onChange({ ...data, level: l })}
              style={{ flex: 1, padding: '6px 0', border: `1px solid ${data.level === l ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', background: data.level === l ? 'var(--accent-light)' : 'none', fontSize: 12 - l * 1, fontWeight: 700 }}>
              H{l}
            </button>
          ))}
        </div>
      </Field>
    </>
  )
}

function EditTableRef({ data, onChange, eventId }: { data: TableRefData; onChange: (d: TableRefData) => void; eventId: string }) {
  const [tables, setTables] = useState<{ id: string; name: string; capacity: number; shape: string }[]>([])
  useEffect(() => {
    createClient().from('seating_tables').select('id, name, capacity, shape').eq('event_id', eventId).then(({ data: d }) => setTables(d ?? []))
  }, [eventId])
  return (
    <>
      <Field label="Tisch">
        <select value={data.table_id ?? ''} onChange={e => onChange({ ...data, table_id: e.target.value })} style={{ ...inputStyle }}>
          <option value="">— Tisch wählen —</option>
          {tables.map(t => <option key={t.id} value={t.id}>{t.name || `Tisch ${t.id.slice(0, 6)}`} ({t.shape}, {t.capacity} Pl.)</option>)}
        </select>
      </Field>
      <Field label="Bezeichnung (optional)"><input value={data.label ?? ''} onChange={e => onChange({ ...data, label: e.target.value })} style={inputStyle} /></Field>
    </>
  )
}

function EditLinkCard({ data, onChange, eventId }: { data: LinkCardData; onChange: (d: LinkCardData) => void; eventId: string }) {
  const [fetching, setFetching] = useState(false)
  async function fetchPreview(url: string) {
    if (!url) return
    setFetching(true)
    try {
      const res = await fetch(`/api/deko/og-preview?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      onChange({ ...data, url, title: data.title || json.title, description: data.description || json.description, image_url: data.image_url || json.image, domain: json.domain })
    } catch { onChange({ ...data, url }) }
    finally { setFetching(false) }
  }
  return (
    <>
      <Field label="URL">
        <input value={data.url ?? ''} onChange={e => onChange({ ...data, url: e.target.value })}
          onBlur={e => fetchPreview(e.target.value)} placeholder="https://…" style={inputStyle} />
      </Field>
      {fetching && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10 }}>Vorschau lädt…</p>}
      <Field label="Titel"><input value={data.title ?? ''} onChange={e => onChange({ ...data, title: e.target.value })} style={inputStyle} /></Field>
      <Field label="Beschreibung"><textarea value={data.description ?? ''} onChange={e => onChange({ ...data, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
    </>
  )
}

function EditDivider({ data, onChange }: { data: DividerData; onChange: (d: DividerData) => void }) {
  return (
    <Row>
      <Field label="Richtung">
        <select value={data.orientation ?? 'horizontal'} onChange={e => onChange({ ...data, orientation: e.target.value as 'horizontal' | 'vertical' })} style={{ ...inputStyle }}>
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertikal</option>
        </select>
      </Field>
      <Field label="Stil">
        <select value={data.style ?? 'solid'} onChange={e => onChange({ ...data, style: e.target.value as DividerData['style'] })} style={{ ...inputStyle }}>
          <option value="solid">Durchgehend</option>
          <option value="dashed">Gestrichelt</option>
          <option value="dotted">Gepunktet</option>
        </select>
      </Field>
    </Row>
  )
}

function EditAreaLabel({ data, onChange }: { data: AreaLabelData; onChange: (d: AreaLabelData) => void }) {
  return (
    <>
      <Field label="Text"><input value={data.text ?? ''} onChange={e => onChange({ ...data, text: e.target.value })} style={inputStyle} /></Field>
      <Row>
        <Field label="Textfarbe"><input type="color" value={data.color || '#ffffff'} onChange={e => onChange({ ...data, color: e.target.value })} style={{ ...inputStyle, height: 36, padding: 2, cursor: 'pointer' }} /></Field>
        <Field label="Hintergrund"><input type="color" value={data.bg_color || '#C9B99A'} onChange={e => onChange({ ...data, bg_color: e.target.value })} style={{ ...inputStyle, height: 36, padding: 2, cursor: 'pointer' }} /></Field>
      </Row>
    </>
  )
}

function EditFlatRateArticle({ data, catalog, flatRates, onChange, eventId, role, userId, onCatalogCreated }: {
  data: FlatRateArticleData; catalog: DekoCatalogItem[]; flatRates: DekoFlatRate[]
  onChange: (d: FlatRateArticleData) => void; eventId: string; role: DekoRole; userId: string
  onCatalogCreated?: (item: DekoCatalogItem) => void
}) {
  return (
    <>
      <Field label="Artikel aus Katalog">
        <CatalogPicker catalog={catalog} selectedId={data.catalog_item_id} itemType="article"
          eventId={eventId} role={role} userId={userId}
          onSelect={id => onChange({ ...data, catalog_item_id: id })}
          onCreated={onCatalogCreated} />
      </Field>
      <Field label="Pauschale">
        <select value={data.flat_rate_id ?? ''} onChange={e => onChange({ ...data, flat_rate_id: e.target.value })} style={{ ...inputStyle }}>
          <option value="">— Pauschale wählen —</option>
          {flatRates.map(fr => <option key={fr.id} value={fr.id}>{fr.name} ({fr.amount} €)</option>)}
        </select>
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
        <input type="checkbox" checked={data.is_free ?? false} onChange={e => onChange({ ...data, is_free: e.target.checked })} />
        Gratis (kein Budget-Eintrag)
      </label>
      <Field label="Notizen"><input value={data.notes ?? ''} onChange={e => onChange({ ...data, notes: e.target.value })} style={inputStyle} /></Field>
    </>
  )
}

// ── EditImageUpload ───────────────────────────────────────────────────────────

function EditImageUpload({ data, onChange, eventId }: {
  data: ImageUploadData
  onChange: (d: ImageUploadData) => void
  eventId: string
}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load presigned URL for existing image
  useEffect(() => {
    if (!data.storage_key) return
    fetch(`/api/deko/image-url?r2Key=${encodeURIComponent(data.storage_key)}&eventId=${eventId}`)
      .then(r => r.json())
      .then(({ url }) => { if (url) setPreviewUrl(url) })
      .catch(() => {})
  }, [data.storage_key, eventId])

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    setProgress(0)
    try {
      const res = await fetch('/api/deko/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, filename: file.name, contentType: file.type, sizeBytes: file.size }),
      })
      if (!res.ok) {
        const { error: e } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(e)
      }
      const { uploadUrl, r2Key } = await res.json() as { uploadUrl: string; r2Key: string }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 95))
        }
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`R2 ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Netzwerkfehler'))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })

      // Local preview while presigned URL is still warm
      const localUrl = URL.createObjectURL(file)
      setPreviewUrl(localUrl)
      setProgress(100)
      onChange({ ...data, storage_key: r2Key, caption: data.caption })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      {/* Drop zone / preview */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          border: `2px dashed var(--border)`, borderRadius: 8, cursor: uploading ? 'default' : 'pointer',
          overflow: 'hidden', minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface)', marginBottom: 12, position: 'relative',
        }}
      >
        {previewUrl
          ? <img src={previewUrl} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', display: 'block' }} />
          : <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🖼</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Klicken oder Bild hierher ziehen</p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>JPEG, PNG, WebP, GIF · max. 20 MB</p>
            </div>
        }
        {uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ width: 160, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: 'width .15s' }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{progress}%</p>
          </div>
        )}
      </div>

      {error && <p style={{ fontSize: 12, color: '#E06C75', marginBottom: 10 }}>{error}</p>}

      {previewUrl && !uploading && (
        <button onClick={() => inputRef.current?.click()}
          style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          Anderes Bild wählen
        </button>
      )}

      <Field label="Beschriftung (optional)">
        <input value={data.caption ?? ''} onChange={e => onChange({ ...data, caption: e.target.value })}
          placeholder="z. B. Tischdekoration Variante A" style={inputStyle} />
      </Field>

      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}

// ── Main Lightbox ─────────────────────────────────────────────────────────────

const TITLES: Record<string, string> = {
  image_upload: 'Bild-Upload', image_url: 'Bild-URL', color_palette: 'Farbpalette',
  color_swatch: 'Farbfeld', text_block: 'Textblock', sticky_note: 'Notizzettel',
  heading: 'Überschrift', article: 'Dekoartikel', flat_rate_article: 'Pauschalen-Artikel',
  fabric: 'Stoff', frame: 'Rahmen', divider: 'Trennlinie', area_label: 'Bereichs-Label',
  vote_card: 'Abstimmungs-Karte', checklist: 'Checkliste', link_card: 'Link-Karte',
  table_ref: 'Tisch-Referenz', room_info: 'Rauminfo', guest_count: 'Gästezahl',
}

export default function DekoItemLightbox({
  item, catalog, flatRates, role, userId, eventId, canEdit,
  onDataChange, onDelete, onBringToFront, onClose, onCatalogCreated,
}: Props) {
  const [data, setData] = useState(item.data)

  function commit(d: DekoItemData) {
    setData(d)
    onDataChange(d)
  }

  const editProps = { data, catalog, flatRates, role, userId, eventId, onChange: commit, onCatalogCreated }

  function renderForm() {
    switch (item.type) {
      case 'image_url':         return <EditImageUrl {...editProps} data={data as ImageUrlData} onChange={commit} />
      case 'color_palette':     return <EditColorPalette {...editProps} data={data as ColorPaletteData} onChange={commit} />
      case 'heading':           return <EditHeading data={data as HeadingData} onChange={commit} />
      case 'article':           return <EditArticle {...editProps} data={data as ArticleData} onChange={commit} />
      case 'flat_rate_article': return <EditFlatRateArticle {...editProps} data={data as FlatRateArticleData} onChange={commit} />
      case 'fabric':            return <EditFabric {...editProps} data={data as FabricData} onChange={commit} />
      case 'frame':             return <EditFrame data={data as FrameData} onChange={commit} />
      case 'divider':           return <EditDivider data={data as DividerData} onChange={commit} />
      case 'area_label':        return <EditAreaLabel data={data as AreaLabelData} onChange={commit} />
      case 'vote_card':         return <EditVoteCard data={data as VoteCardData} onChange={commit} />
      case 'checklist':         return <EditChecklist data={data as ChecklistData} onChange={commit} />
      case 'link_card':         return <EditLinkCard data={data as LinkCardData} onChange={commit} eventId={eventId} />
      case 'table_ref':         return <EditTableRef data={data as TableRefData} onChange={commit} eventId={eventId} />
      case 'sticky_note':       return (
        <Field label="Inhalt">
          <textarea value={(data as StickyNoteData).content ?? ''} rows={5}
            onChange={e => commit({ ...data as StickyNoteData, content: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </Field>
      )
      case 'text_block':        return (
        <Field label="Inhalt">
          <textarea value={(data as TextBlockData).content ?? ''} rows={6}
            onChange={e => commit({ content: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </Field>
      )
      case 'image_upload':      return <EditImageUpload data={data as ImageUploadData} onChange={commit} eventId={eventId} />
      case 'room_info':
      case 'guest_count':       return <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Dieses Item zeigt Live-Daten — keine Konfiguration nötig.</p>
      default:                  return null
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      {/* backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} />
      {/* panel */}
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
        onClick={e => e.stopPropagation()}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{TITLES[item.type] ?? item.type}</h3>
          {canEdit && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button title="In den Vordergrund" onClick={onBringToFront} style={iconBtnStyle}><ArrowUp size={14} /></button>
              <button title="Löschen" onClick={() => { onDelete(); onClose() }} style={{ ...iconBtnStyle, color: '#E06C75' }}><Trash2 size={14} /></button>
            </div>
          )}
          <button onClick={onClose} style={{ ...iconBtnStyle, marginLeft: 4 }}><X size={16} /></button>
        </div>
        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px' }}>
          {canEdit ? renderForm() : <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Dieses Element ist schreibgeschützt.</p>}
        </div>
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 30, height: 30, border: '1px solid var(--border)', borderRadius: 6,
  background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const qtyBtnStyle: React.CSSProperties = {
  width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6,
  background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
