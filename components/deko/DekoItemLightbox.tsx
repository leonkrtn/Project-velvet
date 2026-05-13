'use client'
import React, { useState, useEffect, useRef } from 'react'
import { X, Trash2, ArrowUp, Plus, Minus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  DekoItem, DekoCatalogItem, DekoFlatRate, DekoRole,
  ImageUploadData, ImageUrlData, ColorPaletteData, ColorSwatchData,
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
  anchorRect?: { left: number; top: number; width: number; height: number }
  onDataChange: (d: DekoItemData) => void
  onDelete: () => void
  onBringToFront: () => void
  onClose: () => void
  onCatalogCreated?: (item: DekoCatalogItem) => void
  onCatalogUpdated?: (item: DekoCatalogItem) => void
}

// ── Shared input styles ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
  borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none',
  background: '#fafaf9', boxSizing: 'border-box', color: 'var(--text)',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.09em',
  color: 'var(--text-tertiary)', marginBottom: 5,
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
      <input placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)}
        style={{ ...inputStyle, marginBottom: 6 }} />
      <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 7, background: '#fafaf9' }}>
        {filtered.map(c => (
          <div key={c.id}
            onClick={() => onSelect(c.id)}
            style={{
              padding: '7px 10px', fontSize: 13, cursor: 'pointer',
              background: c.id === selectedId ? 'rgba(201,185,154,0.15)' : 'transparent',
              fontWeight: c.id === selectedId ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 8,
              color: c.id === selectedId ? 'var(--accent, #C9B99A)' : 'var(--text)',
            }}>
            {c.image_url && <img src={c.image_url} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />}
            <span style={{ flex: 1 }}>{c.name}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '12px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>Kein Treffer</div>
        )}
      </div>
      {!creating
        ? <button onClick={() => setCreating(true)}
            style={{ marginTop: 7, fontSize: 12, color: 'var(--accent, #C9B99A)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            + Neuen {itemType === 'fabric' ? 'Stoff' : 'Artikel'} anlegen
          </button>
        : <div style={{ marginTop: 7, display: 'flex', gap: 6 }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createItem()}
            placeholder="Name…" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={createItem} disabled={saving || !newName.trim()}
            style={{ padding: '8px 12px', background: 'var(--accent, #C9B99A)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>
            {saving ? '…' : 'Anlegen'}
          </button>
          <button onClick={() => setCreating(false)}
            style={{ padding: '8px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={12} />
          </button>
        </div>
      }
    </div>
  )
}

// ── Per-type edit forms ───────────────────────────────────────────────────────

function EditImageUpload({ data, onChange, eventId }: { data: ImageUploadData; onChange: (d: ImageUploadData) => void; eventId: string }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 95)) }
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`R2 ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Netzwerkfehler'))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })
      setPreviewUrl(URL.createObjectURL(file))
      setProgress(100)
      onChange({ ...data, storage_key: r2Key })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onDragOver={e => e.preventDefault()}
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          border: `2px dashed ${uploading ? 'var(--accent, #C9B99A)' : 'var(--border)'}`,
          borderRadius: 10, cursor: uploading ? 'default' : 'pointer',
          overflow: 'hidden', minHeight: 130, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: '#faf8f5', marginBottom: 12, position: 'relative',
        }}
      >
        {previewUrl
          ? <img src={previewUrl} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block' }} />
          : <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🖼</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Klicken oder Bild hierher ziehen</p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>JPEG, PNG, WebP · max. 20 MB</p>
            </div>
        }
        {uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ width: 150, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent, #C9B99A)', transition: 'width .15s', borderRadius: 3 }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{progress}%</p>
          </div>
        )}
      </div>
      {error && <p style={{ fontSize: 12, color: '#E06C75', marginBottom: 10 }}>{error}</p>}
      {previewUrl && !uploading && (
        <button onClick={() => inputRef.current?.click()}
          style={{ fontSize: 12, color: 'var(--accent, #C9B99A)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
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

function EditImageUrl({ data, onChange }: { data: ImageUrlData; onChange: (d: ImageUrlData) => void }) {
  const [fetching, setFetching] = useState(false)
  async function fetchPreview(url: string) {
    if (!url) return
    setFetching(true)
    try {
      const res = await fetch(`/api/deko/og-preview?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      onChange({ ...data, url, preview_url: json.image || url, caption: data.caption || json.title })
    } catch { onChange({ ...data, url }) }
    finally { setFetching(false) }
  }
  return (
    <>
      <Field label="Bild-URL">
        <input value={data.url || ''} onChange={e => onChange({ ...data, url: e.target.value })}
          onBlur={e => fetchPreview(e.target.value)} placeholder="https://…" style={inputStyle} />
      </Field>
      {fetching && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10 }}>Vorschau wird geladen…</p>}
      {data.preview_url && (
        <div style={{ marginBottom: 14, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <img src={data.preview_url} alt="" style={{ width: '100%', maxHeight: 130, objectFit: 'cover' }} />
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
            style={{ width: 38, height: 34, border: '1px solid var(--border)', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'none' }} />
          <input value={c.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Name" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={() => onChange({ colors: colors.filter((_, j) => j !== i) })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}><X size={12} /></button>
        </div>
      ))}
      {colors.length < 8 && (
        <button onClick={() => onChange({ colors: [...colors, { hex: '#C9B99A', name: '' }] })}
          style={{ fontSize: 12, color: 'var(--accent, #C9B99A)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          + Farbe hinzufügen
        </button>
      )}
    </>
  )
}

function EditColorSwatch({ data, onChange }: { data: ColorSwatchData; onChange: (d: ColorSwatchData) => void }) {
  return (
    <>
      <Field label="Farbe">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="color" value={data.hex || '#C9B99A'} onChange={e => onChange({ ...data, hex: e.target.value })}
            style={{ width: 50, height: 40, border: '1px solid var(--border)', borderRadius: 7, padding: 2, cursor: 'pointer', background: 'none', flexShrink: 0 }} />
          <input value={data.hex || '#C9B99A'} onChange={e => onChange({ ...data, hex: e.target.value })}
            placeholder="#C9B99A" style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }} />
        </div>
      </Field>
      <Field label="Name (optional)">
        <input value={data.name || ''} onChange={e => onChange({ ...data, name: e.target.value })}
          placeholder="z. B. Champagner" style={inputStyle} />
      </Field>
      {/* Live preview */}
      <div style={{ height: 48, borderRadius: 8, background: data.hex || '#C9B99A', marginBottom: 14, border: '1px solid var(--border)' }} />
    </>
  )
}

function EditArticle({ data, catalog, flatRates, onChange, eventId, role, userId, onCatalogCreated, onCatalogUpdated }: {
  data: ArticleData; catalog: DekoCatalogItem[]; flatRates: DekoFlatRate[]
  onChange: (d: ArticleData) => void; eventId: string; role: DekoRole; userId: string
  onCatalogCreated?: (item: DekoCatalogItem) => void
  onCatalogUpdated?: (item: DekoCatalogItem) => void
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
    onCatalogUpdated?.({ ...cat, ...catDraft } as DekoCatalogItem)
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => onChange({ ...data, quantity: Math.max(1, (data.quantity ?? 1) - 1) })} style={qtyBtnStyle}><Minus size={12} /></button>
                <span style={{ fontSize: 15, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{data.quantity ?? 1}</span>
                <button onClick={() => onChange({ ...data, quantity: (data.quantity ?? 1) + 1 })} style={qtyBtnStyle}><Plus size={12} /></button>
              </div>
            </Field>
            <Field label="Notizen">
              <input value={data.notes ?? ''} onChange={e => onChange({ ...data, notes: e.target.value })} style={inputStyle} />
            </Field>
          </Row>
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0 14px' }} />
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
          <Field label="Pauschale">
            <select value={catDraft.flat_rate_id ?? ''} onChange={e => { setCatDraft(p => ({ ...p, flat_rate_id: e.target.value || null })); saveCatalogItem() }} style={{ ...inputStyle }}>
              <option value="">Kein — Einzelpreis</option>
              {flatRates.map(fr => <option key={fr.id} value={fr.id}>{fr.name} ({fr.amount} €)</option>)}
            </select>
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
            <input type="checkbox" checked={catDraft.is_free ?? false} onChange={e => { setCatDraft(p => ({ ...p, is_free: e.target.checked })); saveCatalogItem() }} />
            Gratis (kein Budget-Eintrag)
          </label>
          <Field label="Artikelbild">
            <CatalogImageField
              imageUrl={catDraft.image_url ?? ''}
              eventId={eventId}
              onSave={async (url) => {
                setCatDraft(p => ({ ...p, image_url: url }))
                await supabase.from('deko_catalog_items').update({ image_url: url }).eq('id', cat.id)
                onCatalogUpdated?.({ ...cat, ...catDraft, image_url: url } as DekoCatalogItem)
              }}
            />
          </Field>
        </>
      )}
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
        <input type="checkbox" checked={data.is_free ?? false} onChange={e => onChange({ ...data, is_free: e.target.checked })} />
        Gratis (kein Budget-Eintrag)
      </label>
      <Field label="Notizen"><input value={data.notes ?? ''} onChange={e => onChange({ ...data, notes: e.target.value })} style={inputStyle} /></Field>
    </>
  )
}

function EditFabric({ data, catalog, onChange, eventId, role, userId, onCatalogCreated, onCatalogUpdated }: {
  data: FabricData; catalog: DekoCatalogItem[]
  onChange: (d: FabricData) => void; eventId: string; role: DekoRole; userId: string
  onCatalogCreated?: (item: DekoCatalogItem) => void
  onCatalogUpdated?: (item: DekoCatalogItem) => void
}) {
  const cat = catalog.find(c => c.id === data.catalog_item_id)
  const supabase = createClient()
  const [catDraft, setCatDraft] = useState<Partial<DekoCatalogItem>>(cat ?? {})

  async function saveCatalogItem() {
    if (!cat) return
    await supabase.from('deko_catalog_items').update(catDraft).eq('id', cat.id)
    onCatalogUpdated?.({ ...cat, ...catDraft } as DekoCatalogItem)
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => onChange({ ...data, quantity_meters: Math.max(0.5, (data.quantity_meters ?? 1) - 0.5) })} style={qtyBtnStyle}><Minus size={12} /></button>
                <span style={{ fontSize: 15, fontWeight: 700, minWidth: 36, textAlign: 'center' }}>{data.quantity_meters ?? 1} m</span>
                <button onClick={() => onChange({ ...data, quantity_meters: (data.quantity_meters ?? 1) + 0.5 })} style={qtyBtnStyle}><Plus size={12} /></button>
              </div>
            </Field>
            <Field label="Notizen"><input value={data.notes ?? ''} onChange={e => onChange({ ...data, notes: e.target.value })} style={inputStyle} /></Field>
          </Row>
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0 14px' }} />
          <p style={{ ...labelStyle, marginBottom: 10 }}>Stoff-Details (Katalog)</p>
          <Row>
            <Field label="Farbe"><input value={catDraft.color ?? ''} onChange={e => setCatDraft(p => ({ ...p, color: e.target.value }))} onBlur={saveCatalogItem} style={inputStyle} /></Field>
            <Field label="Gewebeart"><input value={catDraft.fabric_type ?? ''} onChange={e => setCatDraft(p => ({ ...p, fabric_type: e.target.value }))} onBlur={saveCatalogItem} placeholder="Satin, Chiffon…" style={inputStyle} /></Field>
          </Row>
          <Row>
            <Field label="Breite (cm)"><input type="number" value={catDraft.fabric_width_cm ?? ''} onChange={e => setCatDraft(p => ({ ...p, fabric_width_cm: parseFloat(e.target.value) || null }))} onBlur={saveCatalogItem} style={inputStyle} /></Field>
            <Field label="Preis / Meter (€)"><input type="number" value={catDraft.price_per_meter ?? ''} onChange={e => setCatDraft(p => ({ ...p, price_per_meter: parseFloat(e.target.value) || 0 }))} onBlur={saveCatalogItem} style={inputStyle} /></Field>
          </Row>
          <Field label="Stoffbild">
            <CatalogImageField
              imageUrl={catDraft.image_url ?? ''}
              eventId={eventId}
              onSave={async (url) => {
                setCatDraft(p => ({ ...p, image_url: url }))
                await supabase.from('deko_catalog_items').update({ image_url: url }).eq('id', cat.id)
                onCatalogUpdated?.({ ...cat, ...catDraft, image_url: url } as DekoCatalogItem)
              }}
            />
          </Field>
        </>
      )}
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
              style={{
                flex: 1, padding: '7px 0', border: `1.5px solid ${data.level === l ? 'var(--accent, #C9B99A)' : 'var(--border)'}`,
                borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                background: data.level === l ? 'rgba(201,185,154,0.12)' : '#fafaf9',
                fontSize: 13 - l, fontWeight: 700, color: data.level === l ? 'var(--accent, #C9B99A)' : 'var(--text)',
              }}>
              H{l}
            </button>
          ))}
        </div>
      </Field>
    </>
  )
}

function EditFrame({ data, onChange }: { data: FrameData; onChange: (d: FrameData) => void }) {
  const opacityPct = Math.round((data.opacity ?? 0.06) * 100)
  return (
    <>
      <Field label="Bezeichnung">
        <input value={data.label ?? ''} onChange={e => onChange({ ...data, label: e.target.value })} style={inputStyle} />
      </Field>
      <Row>
        <Field label="Rahmenfarbe">
          <input type="color" value={data.color || '#C9B99A'} onChange={e => onChange({ ...data, color: e.target.value })}
            style={{ ...inputStyle, height: 38, padding: 2, cursor: 'pointer' }} />
        </Field>
        <Field label={`Füllung (${opacityPct}%)`}>
          <input type="range" min="0" max="1" step="0.02" value={data.opacity ?? 0.06}
            onChange={e => onChange({ ...data, opacity: parseFloat(e.target.value) })}
            style={{ width: '100%', marginTop: 10, accentColor: 'var(--accent, #C9B99A)' }} />
        </Field>
      </Row>
    </>
  )
}

function EditDivider({ data, onChange }: { data: DividerData; onChange: (d: DividerData) => void }) {
  return (
    <>
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
      <Field label="Farbe">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="color" value={data.color || '#C9B99A'} onChange={e => onChange({ ...data, color: e.target.value })}
            style={{ width: 38, height: 34, border: '1px solid var(--border)', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'none', flexShrink: 0 }} />
          <input value={data.color || '#C9B99A'} onChange={e => onChange({ ...data, color: e.target.value })}
            style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }} />
        </div>
      </Field>
    </>
  )
}

function EditAreaLabel({ data, onChange }: { data: AreaLabelData; onChange: (d: AreaLabelData) => void }) {
  return (
    <>
      <Field label="Text"><input value={data.text ?? ''} onChange={e => onChange({ ...data, text: e.target.value })} style={inputStyle} /></Field>
      <Row>
        <Field label="Textfarbe">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="color" value={data.color || '#ffffff'} onChange={e => onChange({ ...data, color: e.target.value })}
              style={{ width: 38, height: 34, border: '1px solid var(--border)', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'none' }} />
            <input value={data.color || '#ffffff'} onChange={e => onChange({ ...data, color: e.target.value })} style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }} />
          </div>
        </Field>
        <Field label="Hintergrund">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="color" value={data.bg_color || '#C9B99A'} onChange={e => onChange({ ...data, bg_color: e.target.value })}
              style={{ width: 38, height: 34, border: '1px solid var(--border)', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'none' }} />
            <input value={data.bg_color || '#C9B99A'} onChange={e => onChange({ ...data, bg_color: e.target.value })} style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }} />
          </div>
        </Field>
      </Row>
    </>
  )
}

function EditStickyNote({ data, onChange }: { data: StickyNoteData; onChange: (d: StickyNoteData) => void }) {
  const COLORS = ['#FFF8DC', '#DDEEFF', '#DDFFDD', '#FFE4E4', '#EEE0FF', '#FFE4C0', '#F0F0F0']
  return (
    <>
      <Field label="Farbe">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map(c => (
            <div key={c}
              onClick={() => onChange({ ...data, color: c })}
              title={c}
              style={{
                width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer',
                border: data.color === c ? '2px solid #555' : '1.5px solid rgba(0,0,0,0.15)',
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      </Field>
      <Field label="Inhalt">
        <textarea value={data.content ?? ''} rows={5}
          onChange={e => onChange({ ...data, content: e.target.value })}
          style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>
    </>
  )
}

function EditVoteCard({ data, onChange, eventId }: { data: VoteCardData; onChange: (d: VoteCardData) => void; eventId: string }) {
  const [imgMode, setImgMode] = useState<'url' | 'file'>(data.storage_key ? 'file' : 'url')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!data.storage_key) return
    fetch(`/api/deko/image-url?r2Key=${encodeURIComponent(data.storage_key)}&eventId=${eventId}`)
      .then(r => r.json()).then(({ url }) => { if (url) setPreviewUrl(url) }).catch(() => {})
  }, [data.storage_key, eventId])

  async function handleFile(file: File) {
    setUploadError(null)
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
        xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 95)) }
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`R2 ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Netzwerkfehler'))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })
      setPreviewUrl(URL.createObjectURL(file))
      setProgress(100)
      onChange({ ...data, storage_key: r2Key, image_url: undefined })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  const currentPreview = previewUrl || data.image_url

  return (
    <>
      <Field label="Titel"><input value={data.title ?? ''} onChange={e => onChange({ ...data, title: e.target.value })} style={inputStyle} /></Field>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Bild</label>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {(['url', 'file'] as const).map(m => (
            <button key={m} onClick={() => setImgMode(m)} style={{
              fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6,
              cursor: 'pointer', fontFamily: 'inherit',
              background: imgMode === m ? 'rgba(201,185,154,0.15)' : 'none',
              color: imgMode === m ? 'var(--accent, #C9B99A)' : 'var(--text-secondary)',
              fontWeight: imgMode === m ? 600 : 400,
            }}>
              {m === 'url' ? 'URL' : 'Hochladen'}
            </button>
          ))}
        </div>
        {imgMode === 'url'
          ? <input value={data.image_url ?? ''} onChange={e => onChange({ ...data, image_url: e.target.value, storage_key: undefined })} placeholder="https://…" style={inputStyle} />
          : <div>
            <div
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onDragOver={e => e.preventDefault()}
              onClick={() => !uploading && fileRef.current?.click()}
              style={{
                border: `2px dashed ${uploading ? 'var(--accent, #C9B99A)' : 'var(--border)'}`,
                borderRadius: 10, cursor: uploading ? 'default' : 'pointer',
                overflow: 'hidden', minHeight: 110, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: '#faf8f5', position: 'relative',
              }}
            >
              {currentPreview && imgMode === 'file'
                ? <img src={currentPreview} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', display: 'block' }} />
                : <div style={{ textAlign: 'center', padding: 20 }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>🗳</div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Klicken oder Bild hierher ziehen</p>
                  </div>
              }
              {uploading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ width: 120, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent, #C9B99A)', transition: 'width .15s', borderRadius: 2 }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{progress}%</p>
                </div>
              )}
            </div>
            {uploadError && <p style={{ fontSize: 11, color: '#E06C75', margin: '4px 0 0' }}>{uploadError}</p>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>
        }
      </div>
      <Field label="Beschreibung">
        <textarea value={data.description ?? ''} onChange={e => onChange({ ...data, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>
    </>
  )
}

function EditChecklist({ data, onChange }: { data: ChecklistData; onChange: (d: ChecklistData) => void }) {
  const items = data.items ?? []
  return (
    <>
      <Field label="Titel">
        <input value={data.title ?? ''} onChange={e => onChange({ ...data, title: e.target.value })} style={inputStyle} />
      </Field>
      <p style={labelStyle}>Punkte</p>
      {items.map((item, i) => (
        <div key={item.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input value={item.text}
            onChange={e => onChange({ ...data, items: items.map((it, j) => j === i ? { ...it, text: e.target.value } : it) })}
            style={{ ...inputStyle, flex: 1 }} placeholder={`Punkt ${i + 1}`} />
          <button onClick={() => onChange({ ...data, items: items.filter((_, j) => j !== i) })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}><X size={12} /></button>
        </div>
      ))}
      <button onClick={() => onChange({ ...data, items: [...items, { id: crypto.randomUUID(), text: '', checked: false }] })}
        style={{ fontSize: 12, color: 'var(--accent, #C9B99A)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginTop: 4 }}>
        + Punkt hinzufügen
      </button>
    </>
  )
}

function EditLinkCard({ data, onChange }: { data: LinkCardData; onChange: (d: LinkCardData) => void }) {
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
      <Field label="Beschreibung">
        <textarea value={data.description ?? ''} onChange={e => onChange({ ...data, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>
    </>
  )
}

function EditTableRef({ data, onChange, eventId }: { data: TableRefData; onChange: (d: TableRefData) => void; eventId: string }) {
  const [tables, setTables] = useState<{ id: string; name: string; capacity: number; shape: string }[]>([])
  useEffect(() => {
    createClient().from('seating_tables').select('id, name, capacity, shape').eq('event_id', eventId)
      .then(({ data: d }) => setTables(d ?? []))
  }, [eventId])
  return (
    <>
      <Field label="Tisch">
        <select value={data.table_id ?? ''} onChange={e => onChange({ ...data, table_id: e.target.value })} style={{ ...inputStyle }}>
          <option value="">— Tisch wählen —</option>
          {tables.map(t => <option key={t.id} value={t.id}>{t.name || `Tisch ${t.id.slice(0, 6)}`} ({t.shape}, {t.capacity} Pl.)</option>)}
        </select>
      </Field>
      <Field label="Bezeichnung (optional)">
        <input value={data.label ?? ''} onChange={e => onChange({ ...data, label: e.target.value })} style={inputStyle} />
      </Field>
    </>
  )
}

// ── Catalog image: URL or file upload ────────────────────────────────────────

function CatalogImageField({ imageUrl, eventId, onSave }: {
  imageUrl: string
  eventId: string
  onSave: (url: string) => void
}) {
  const [mode, setMode] = useState<'url' | 'file'>('url')
  const [urlValue, setUrlValue] = useState(imageUrl)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { uploadUrl, r2Key } = await res.json() as { uploadUrl: string; r2Key: string }
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 95)) }
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`R2 ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Netzwerkfehler'))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })
      setProgress(100)
      const urlRes = await fetch(`/api/deko/image-url?r2Key=${encodeURIComponent(r2Key)}&eventId=${eventId}`)
      const { url } = await urlRes.json() as { url?: string }
      const finalUrl = url ?? ''
      setUrlValue(finalUrl)
      onSave(finalUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['url', 'file'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6,
            cursor: 'pointer', fontFamily: 'inherit',
            background: mode === m ? 'rgba(201,185,154,0.15)' : 'none',
            color: mode === m ? 'var(--accent, #C9B99A)' : 'var(--text-secondary)',
            fontWeight: mode === m ? 600 : 400,
          }}>
            {m === 'url' ? 'URL' : 'Hochladen'}
          </button>
        ))}
      </div>

      {mode === 'url' ? (
        <input value={urlValue} onChange={e => setUrlValue(e.target.value)}
          onBlur={() => onSave(urlValue)}
          placeholder="https://…" style={inputStyle} />
      ) : (
        <div>
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onDragOver={e => e.preventDefault()}
            style={{
              border: `2px dashed ${uploading ? 'var(--accent, #C9B99A)' : 'var(--border)'}`,
              borderRadius: 8, padding: 16, textAlign: 'center' as const,
              cursor: uploading ? 'default' : 'pointer',
              background: '#faf8f5', position: 'relative' as const, minHeight: 80,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              {uploading ? `${progress}%` : 'Bild hochladen oder hierher ziehen'}
            </p>
            {uploading && (
              <div style={{ position: 'absolute' as const, bottom: 8, left: 12, right: 12, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent, #C9B99A)', transition: 'width .15s', borderRadius: 2 }} />
              </div>
            )}
          </div>
          {error && <p style={{ fontSize: 11, color: '#E06C75', margin: '4px 0 0' }}>{error}</p>}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      )}

      {imageUrl && (
        <div style={{ marginTop: 8, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', maxHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf8f5' }}>
          <img src={imageUrl} alt="" style={{ maxHeight: 90, maxWidth: '100%', objectFit: 'contain' }} />
        </div>
      )}
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
  anchorRect, onDataChange, onDelete, onBringToFront, onClose, onCatalogCreated, onCatalogUpdated,
}: Props) {
  const [data, setData] = useState(item.data)

  // Only update local state — DB write happens when user confirms with ArrowUp
  function commit(d: DekoItemData) {
    setData(d)
  }

  function handleSave() {
    onDataChange(data)
    onClose()
  }

  const editProps = { data, catalog, flatRates, role, userId, eventId, onChange: commit, onCatalogCreated, onCatalogUpdated }

  function renderForm() {
    switch (item.type) {
      case 'image_upload':      return <EditImageUpload data={data as ImageUploadData} onChange={commit} eventId={eventId} />
      case 'image_url':         return <EditImageUrl data={data as ImageUrlData} onChange={commit} />
      case 'color_palette':     return <EditColorPalette data={data as ColorPaletteData} onChange={commit} />
      case 'color_swatch':      return <EditColorSwatch data={data as ColorSwatchData} onChange={commit} />
      case 'sticky_note':       return <EditStickyNote data={data as StickyNoteData} onChange={commit} />
      case 'heading':           return <EditHeading data={data as HeadingData} onChange={commit} />
      case 'text_block':        return (
        <Field label="Inhalt">
          <textarea value={(data as TextBlockData).content ?? ''} rows={6}
            onChange={e => commit({ content: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </Field>
      )
      case 'article':           return <EditArticle {...editProps} data={data as ArticleData} onChange={commit} />
      case 'flat_rate_article': return <EditFlatRateArticle {...editProps} data={data as FlatRateArticleData} onChange={commit} />
      case 'fabric':            return <EditFabric {...editProps} data={data as FabricData} onChange={commit} />
      case 'frame':             return <EditFrame data={data as FrameData} onChange={commit} />
      case 'divider':           return <EditDivider data={data as DividerData} onChange={commit} />
      case 'area_label':        return <EditAreaLabel data={data as AreaLabelData} onChange={commit} />
      case 'vote_card':         return <EditVoteCard data={data as VoteCardData} onChange={commit} eventId={eventId} />
      case 'checklist':         return <EditChecklist data={data as ChecklistData} onChange={commit} />
      case 'link_card':         return <EditLinkCard data={data as LinkCardData} onChange={commit} />
      case 'table_ref':         return <EditTableRef data={data as TableRefData} onChange={commit} eventId={eventId} />
      case 'room_info':
      case 'guest_count':       return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Dieses Item zeigt Live-Daten aus dem Event — keine Konfiguration nötig.</p>
      default:                  return null
    }
  }

  const anchoredStyle: React.CSSProperties | undefined = (() => {
    if (!anchorRect || typeof window === 'undefined') return undefined
    const W = 460, MARGIN = 12
    const vpW = window.innerWidth, vpH = window.innerHeight
    let left = anchorRect.left + anchorRect.width + MARGIN
    if (left + W > vpW - MARGIN) left = anchorRect.left - W - MARGIN
    left = Math.max(MARGIN, left)
    const top = Math.max(MARGIN, Math.min(anchorRect.top, vpH * 0.1))
    return { position: 'fixed', left, top, maxWidth: W, width: W, maxHeight: `${vpH - top - MARGIN}px` }
  })()

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: anchoredStyle ? 'block' : 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }} />
      <div
        style={{
          ...(anchoredStyle ?? { position: 'relative', width: '100%', maxWidth: 460, maxHeight: '88vh' }),
          background: '#fff', borderRadius: 14,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 18px', borderBottom: '1px solid var(--border)', gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, flex: 1, color: 'var(--text)' }}>{TITLES[item.type] ?? item.type}</h3>
          {canEdit && (
            <div style={{ display: 'flex', gap: 5 }}>
              <button title="Übernehmen" onClick={handleSave}
                style={{ ...iconBtnStyle, background: 'rgba(201,185,154,0.12)', borderColor: '#C9B99A', color: '#C9B99A' }}>
                <ArrowUp size={13} />
              </button>
              <button title="Löschen" onClick={() => { onDelete(); onClose() }} style={{ ...iconBtnStyle, color: '#E06C75', borderColor: '#FECDD3' }}><Trash2 size={13} /></button>
            </div>
          )}
          <button title="Abbrechen" onClick={onClose} style={{ ...iconBtnStyle, marginLeft: 2 }}><X size={15} /></button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 22px' }}>
          {canEdit
            ? renderForm()
            : <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Dieses Element ist schreibgeschützt.</p>
          }
        </div>
      </div>
    </div>
  )
}

// ── Shared button styles ──────────────────────────────────────────────────────

const iconBtnStyle: React.CSSProperties = {
  width: 30, height: 30, border: '1px solid var(--border)', borderRadius: 7,
  background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0,
}
const qtyBtnStyle: React.CSSProperties = {
  width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 7,
  background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0,
}
