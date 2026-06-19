'use client'
// app/brautpaar/[eventId]/website/WebsiteEditorClient.tsx
// Editor der Hochzeitswebsite: Formular links, Live-Vorschau (iframe) rechts.
// Auto-Save als Entwurf + expliziter "Veröffentlichen"-Button.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Heart, Sparkles, MapPin, Plane, Home, Gem, GlassWater, Music, Camera,
  Star, Sun, Coffee, Bike, Loader, Plus, Trash2, ArrowUp, ArrowDown,
  ImagePlus, Monitor, Smartphone, Globe, ExternalLink, CalendarDays,
  RotateCcw, Maximize2, X, type LucideIcon,
} from 'lucide-react'
import {
  HEADING_FONTS, BODY_FONTS, PALETTES, TEXTURES, RADII, BUTTON_STYLES, ORNAMENTS,
  STORY_ALIGNS, STORY_LINES, STORY_MARKERS,
} from '@/lib/wedding/style'
import { TEMPLATES } from '@/lib/wedding/templates'
import {
  WEDDING_LIMITS, MIN_STATIONS, MAX_STATIONS, MAX_SCHEDULE_ITEMS, STATION_ICONS,
  type WeddingContent, type WeddingImage, type WeddingStation,
} from '@/lib/wedding/types'
import { defaultContent, emptyStation, slugify } from '@/lib/wedding/content'

const ICONS: Record<string, LucideIcon> = {
  Heart, Sparkles, MapPin, Plane, Home, Gem, GlassWater, Music, Camera, Star, Sun, Coffee, Bike,
}

type Tab = 'template' | 'style' | 'start' | 'story' | 'rsvp' | 'share' | 'publish'
const TABS: { key: Tab; label: string }[] = [
  { key: 'template', label: 'Design' },
  { key: 'style', label: 'Stil' },
  { key: 'start', label: 'Start' },
  { key: 'story', label: 'Geschichte' },
  { key: 'rsvp', label: 'RSVP' },
  { key: 'share', label: 'Teilen' },
  { key: 'publish', label: 'Veröffentlichen' },
]

interface EventData { id: string; coupleName: string; date: string | null; venue: string | null; venueAddress: string | null }

interface RsvpSettingsState {
  invitationText: string; deadline: string | null; phoneContact: string
  showMealChoice: boolean; showPlusOne: boolean; maxBegleitpersonen: number
  mealOptions: string[]
  toggles: { menu: boolean; begleitpersonen: boolean; musikwunsch: boolean; geschenke: boolean; hotel: boolean }
}
const DEFAULT_RSVP_SETTINGS: RsvpSettingsState = {
  invitationText: '', deadline: null, phoneContact: '', showMealChoice: true, showPlusOne: true,
  maxBegleitpersonen: 2, mealOptions: ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
  toggles: { menu: true, begleitpersonen: true, musikwunsch: true, geschenke: true, hotel: true },
}

// ── Bild-Upload via R2-Pipeline ───────────────────────────────────────────────
async function uploadImage(file: File, eventId: string): Promise<{ fileId: string; r2Key: string } | null> {
  const reqRes = await fetch('/api/files/request-upload', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId, module: 'wedding', filename: file.name,
      contentType: file.type || 'application/octet-stream', sizeBytes: file.size, category: 'wedding',
    }),
  })
  if (!reqRes.ok) return null
  const { fileId, uploadUrl, r2Key } = await reqRes.json()
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
  if (!put.ok) return null
  await fetch(`/api/files/${fileId}/confirm`, { method: 'PATCH' })
  return { fileId, r2Key }
}

async function fetchImageUrl(fileId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/files/${fileId}/download-url`)
    if (!res.ok) return null
    return (await res.json()).downloadUrl ?? null
  } catch { return null }
}

function collectFileIds(c: WeddingContent): string[] {
  const ids: string[] = []
  const add = (i: WeddingImage | null) => { if (i?.fileId) ids.push(i.fileId) }
  add(c.landing.hero.image); add(c.landing.location.image); add(c.rsvp.image)
  for (const s of c.story.stations) add(s.image)
  return ids
}

export default function WebsiteEditorClient({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState<WeddingContent>(defaultContent())
  const [templateId, setTemplateId] = useState('classic-elegance')
  const [slug, setSlug] = useState('')
  const [og, setOg] = useState({ title: '', description: '', imageKey: null as string | null })
  const [isOnline, setIsOnline] = useState(true)
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [event, setEvent] = useState<EventData | null>(null)
  const [rsvpCfg, setRsvpCfg] = useState<RsvpSettingsState>(DEFAULT_RSVP_SETTINGS)

  const [tab, setTab] = useState<Tab>('template')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [fullscreen, setFullscreen] = useState(false)
  const [fsDevice, setFsDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [fsSection, setFsSection] = useState<'landing' | 'story' | 'rsvp'>('landing')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [slugError, setSlugError] = useState<string | null>(null)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({})
  const [iframeNonce, setIframeNonce] = useState(0)

  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const rsvpTimer = useRef<ReturnType<typeof setTimeout>>()
  const initialized = useRef(false)

  // Vorschau-Sektion folgt dem aktiven Tab.
  const previewSection = tab === 'story' ? 'story' : tab === 'rsvp' ? 'rsvp' : 'landing'

  // ── Initial laden ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/wedding/${eventId}`)
      if (res.ok) {
        const d = await res.json()
        setContent(d.site.content)
        setTemplateId(d.site.templateId)
        setSlug(d.site.slug ?? '')
        setOg({ title: d.site.og.title ?? '', description: d.site.og.description ?? '', imageKey: d.site.og.imageKey ?? null })
        setIsOnline(d.site.isOnline)
        setStatus(d.site.status)
        setEvent(d.event)
        if (d.rsvpSettings) setRsvpCfg({ ...DEFAULT_RSVP_SETTINGS, ...d.rsvpSettings, toggles: { ...DEFAULT_RSVP_SETTINGS.toggles, ...(d.rsvpSettings.toggles ?? {}) } })
        // Bestehende Bild-URLs auflösen
        const ids = Array.from(new Set(collectFileIds(d.site.content)))
        const pairs = await Promise.all(ids.map(async id => [id, await fetchImageUrl(id)] as const))
        const map: Record<string, string> = {}
        for (const [id, url] of pairs) if (url) map[id] = url
        setImgUrls(map)
      }
      setLoading(false)
      initialized.current = true
    })()
  }, [eventId])

  // ── Auto-Save (debounced) ─────────────────────────────────────────────────────
  const scheduleSave = useCallback((override?: { slug?: string; templateId?: string; isOnline?: boolean }) => {
    if (!initialized.current) return
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const body = {
        content,
        templateId: override?.templateId ?? templateId,
        slug: override?.slug ?? slug,
        og,
        isOnline: override?.isOnline ?? isOnline,
      }
      try {
        const res = await fetch(`/api/wedding/${eventId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
        const d = await res.json()
        if (!res.ok) {
          if (d.field === 'slug') setSlugError(d.error)
          setSaveState('error')
          return
        }
        setSlugError(null)
        setSaveState('saved')
        setIframeNonce(n => n + 1) // Vorschau aktualisieren
      } catch { setSaveState('error') }
    }, 700)
  }, [content, templateId, slug, og, isOnline, eventId])

  // Bei Inhalts-/OG-Änderung neu speichern
  useEffect(() => { scheduleSave() /* eslint-disable-next-line */ }, [content, og])

  // RSVP-Einstellungen separat speichern (kein Einfluss auf die Inhalts-Vorschau).
  useEffect(() => {
    if (!initialized.current) return
    setSaveState('saving')
    if (rsvpTimer.current) clearTimeout(rsvpTimer.current)
    rsvpTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/wedding/${eventId}/rsvp-settings`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rsvpCfg),
        })
        setSaveState(res.ok ? 'saved' : 'error')
      } catch { setSaveState('error') }
    }, 700)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rsvpCfg, eventId])

  // ── Helper ────────────────────────────────────────────────────────────────────
  function update(mut: (c: WeddingContent) => void) {
    setContent(prev => { const next = structuredClone(prev); mut(next); return next })
  }
  function updateRsvp(patch: Partial<RsvpSettingsState>) { setRsvpCfg(prev => ({ ...prev, ...patch })) }

  async function pickImage(file: File, setImg: (c: WeddingContent, img: WeddingImage) => void) {
    const up = await uploadImage(file, eventId)
    if (!up) { alert('Bild-Upload fehlgeschlagen.'); return }
    const url = await fetchImageUrl(up.fileId)
    if (url) setImgUrls(m => ({ ...m, [up.fileId]: url }))
    update(c => setImg(c, { fileId: up.fileId, r2Key: up.r2Key, focusX: 50, focusY: 50 }))
  }

  async function publish() {
    setPublishMsg(null)
    // erst sicher speichern
    await fetch(`/api/wedding/${eventId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, templateId, slug, og, isOnline }),
    })
    const res = await fetch(`/api/wedding/${eventId}/publish`, { method: 'POST' })
    const d = await res.json()
    if (!res.ok) { setPublishMsg(d.error ?? 'Veröffentlichen fehlgeschlagen'); return }
    setStatus('published')
    setPublishMsg('Veröffentlicht!')
    setIframeNonce(n => n + 1)
  }

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--bp-ink-3)' }}><Loader className="we-spin" /></div>
  }

  return (
    <div className="we-wrap">
      {/* ── Formular ───────────────────────────────────────────────────────────── */}
      <div className="we-form">
        <div className="we-form-inner">
          <div className="we-tabs">
            {TABS.map(t => (
              <button key={t.key} className={`we-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>

          {tab === 'template' && (
            <TemplatePanel
              templateId={templateId}
              onSelect={id => { setTemplateId(id); scheduleSave({ templateId: id }) }}
            />
          )}

          {tab === 'style' && (
            <StylePanel style={content.style} update={update} />
          )}

          {tab === 'start' && (
            <StartPanel content={content} event={event} update={update} imgUrls={imgUrls} pickImage={pickImage} setImgUrls={setImgUrls} />
          )}

          {tab === 'story' && (
            <StoryPanel content={content} update={update} imgUrls={imgUrls} pickImage={pickImage} setImgUrls={setImgUrls} />
          )}

          {tab === 'rsvp' && (
            <RsvpPanel content={content} update={update} imgUrls={imgUrls} pickImage={pickImage} setImgUrls={setImgUrls} rsvpCfg={rsvpCfg} updateRsvp={updateRsvp} />
          )}

          {tab === 'share' && (
            <SharePanel
              slug={slug} setSlug={(v) => { setSlug(v); setSlugError(null); scheduleSave({ slug: v }) }}
              slugError={slugError} event={event} og={og} setOg={setOg}
              suggestSlug={() => { const s = slugify(event?.coupleName ?? ''); setSlug(s); scheduleSave({ slug: s }) }}
            />
          )}

          {tab === 'publish' && (
            <PublishPanel
              status={status} slug={slug} isOnline={isOnline}
              setOnline={(v) => { setIsOnline(v); scheduleSave({ isOnline: v }) }}
              onPublish={publish} publishMsg={publishMsg}
            />
          )}
        </div>
      </div>

      {/* ── Vorschau ───────────────────────────────────────────────────────────── */}
      <div className="we-preview">
        <div className="we-preview-bar">
          <div className="we-savebar">
            <span className="we-dot" style={{ background: saveState === 'saved' ? '#2e7d52' : saveState === 'saving' ? '#d6a44a' : saveState === 'error' ? '#c0392b' : '#bbb' }} />
            {saveState === 'saving' ? 'Speichern…' : saveState === 'saved' ? 'Entwurf gespeichert' : saveState === 'error' ? 'Fehler beim Speichern' : 'Bereit'}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
            <button className={`we-icon-btn${device === 'desktop' ? ' selected' : ''}`} onClick={() => setDevice('desktop')} title="Desktop" style={device === 'desktop' ? { background: 'var(--bp-gold)', color: '#fff' } : undefined}><Monitor size={16} /></button>
            <button className={`we-icon-btn${device === 'mobile' ? ' selected' : ''}`} onClick={() => setDevice('mobile')} title="Mobil" style={device === 'mobile' ? { background: 'var(--bp-gold)', color: '#fff' } : undefined}><Smartphone size={16} /></button>
            <button className="we-icon-btn" onClick={() => setFullscreen(true)} title="Vollbild-Vorschau"><Maximize2 size={16} /></button>
          </div>
        </div>
        <div className="we-preview-frame">
          <div className={`we-iframe-shell ${device}`}>
            <iframe
              key={`${previewSection}-${iframeNonce}`}
              className="we-iframe"
              src={`/wedding-preview/${eventId}?section=${previewSection}`}
              title="Vorschau"
            />
          </div>
        </div>
      </div>

      {/* Vollbild-Vorschau-Overlay */}
      {fullscreen && (
        <div className="we-fs">
          <div className="we-fs-bar">
            <div className="we-fs-sections">
              {(['landing', 'story', 'rsvp'] as const).map(s => (
                <button key={s} className={`we-tab${fsSection === s ? ' active' : ''}`} onClick={() => setFsSection(s)}>
                  {s === 'landing' ? 'Start' : s === 'story' ? 'Geschichte' : 'RSVP'}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
              <button className={`we-icon-btn${fsDevice === 'desktop' ? ' selected' : ''}`} onClick={() => setFsDevice('desktop')} title="Desktop" style={fsDevice === 'desktop' ? { background: 'var(--bp-gold)', color: '#fff' } : undefined}><Monitor size={16} /></button>
              <button className={`we-icon-btn${fsDevice === 'mobile' ? ' selected' : ''}`} onClick={() => setFsDevice('mobile')} title="Mobil" style={fsDevice === 'mobile' ? { background: 'var(--bp-gold)', color: '#fff' } : undefined}><Smartphone size={16} /></button>
              <button className="we-icon-btn" onClick={() => setFullscreen(false)} title="Schließen"><X size={16} /></button>
            </div>
          </div>
          <div className="we-fs-stage">
            <div className={`we-iframe-shell ${fsDevice}`} style={fsDevice === 'desktop' ? { width: '100%', maxWidth: '100%', height: '100%' } : undefined}>
              <iframe
                key={`fs-${fsSection}-${iframeNonce}`}
                className="we-iframe"
                src={`/wedding-preview/${eventId}?section=${fsSection}`}
                title="Vollbild-Vorschau"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Wiederverwendbare Felder ────────────────────────────────────────────────────
function Field({ label, max, value, onChange, textarea, placeholder, readOnly, hint }: {
  label: string; max?: number; value: string; onChange?: (v: string) => void
  textarea?: boolean; placeholder?: string; readOnly?: boolean; hint?: string
}) {
  return (
    <div className="we-field">
      <div className="we-flabel">
        <span>{label}</span>
        {max !== undefined && !readOnly && <span className={`we-count${value.length >= max ? ' over' : ''}`}>{value.length}/{max}</span>}
      </div>
      {textarea
        ? <textarea className={`we-textarea${readOnly ? ' we-readonly' : ''}`} value={value} maxLength={max} placeholder={placeholder} readOnly={readOnly} onChange={e => onChange?.(e.target.value)} />
        : <input className={`we-input${readOnly ? ' we-readonly' : ''}`} value={value} maxLength={max} placeholder={placeholder} readOnly={readOnly} onChange={e => onChange?.(e.target.value)} />}
      {hint && <div className="we-hint">{hint}</div>}
    </div>
  )
}

function ImageField({ label, image, url, onPick, onRemove, onFocus }: {
  label: string; image: WeddingImage | null; url: string | null
  onPick: (f: File) => void; onRemove: () => void; onFocus: (x: number, y: number) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  function handleFocusClick(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    onFocus(Math.round(((e.clientX - r.left) / r.width) * 100), Math.round(((e.clientY - r.top) / r.height) * 100))
  }
  return (
    <div className="we-field">
      <div className="we-flabel"><span>{label}</span></div>
      <div className="we-image">
        {image && url ? (
          <>
            <div className="we-image-preview" onClick={handleFocusClick} title="Klicken, um den Bildausschnitt (Fokus) zu setzen">
              <img src={url} alt="" style={{ objectPosition: `${image.focusX ?? 50}% ${image.focusY ?? 50}%` }} />
              <span className="we-image-focus" style={{ left: `${image.focusX ?? 50}%`, top: `${image.focusY ?? 50}%` }} />
            </div>
            <div className="we-hint">Klick aufs Bild setzt den Fokuspunkt für den Zuschnitt.</div>
          </>
        ) : (
          <div className="we-image-preview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}>
            {busy ? <Loader className="we-spin" /> : <span className="we-hint">Noch kein Bild</span>}
          </div>
        )}
        <div className="we-image-actions">
          <button className="we-btn" onClick={() => ref.current?.click()} disabled={busy}>
            <ImagePlus size={15} /> {image ? 'Ersetzen' : 'Bild wählen'}
          </button>
          {image && <button className="we-btn" onClick={onRemove} disabled={busy}><Trash2 size={15} /> Entfernen</button>}
        </div>
        <input
          ref={ref} type="file" accept="image/*" hidden
          onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return
            setBusy(true); await onPick(f); setBusy(false)
            if (ref.current) ref.current.value = ''
          }}
        />
      </div>
    </div>
  )
}

// ── Panels ──────────────────────────────────────────────────────────────────────
function ScheduleImport({ eventId, onImport }: { eventId?: string; onImport: (items: any[]) => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  async function run() {
    if (!eventId) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/wedding/${eventId}/timeline`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Fehler')
      const items = (d.items ?? []).slice(0, MAX_SCHEDULE_ITEMS).map((it: any) => ({
        id: crypto.randomUUID(),
        time: String(it.time ?? '').slice(0, WEDDING_LIMITS.scheduleItemTime),
        label: String(it.label ?? '').slice(0, WEDDING_LIMITS.scheduleItemLabel),
        description: it.description ? String(it.description).slice(0, WEDDING_LIMITS.scheduleItemDescription) : undefined,
      }))
      if (items.length === 0) { setMsg('Im Ablaufplan wurden keine Einträge gefunden.'); return }
      onImport(items)
      setMsg(`${items.length} Einträge übernommen.`)
    } catch (e: any) { setMsg(e.message ?? 'Fehler') } finally { setBusy(false) }
  }
  return (
    <div className="we-field">
      <button className="we-btn we-btn-block" onClick={run} disabled={busy}>
        {busy ? <Loader size={15} className="we-spin" /> : <CalendarDays size={15} />} Aus Ablaufplan übernehmen
      </button>
      <div className="we-hint">Übernimmt Uhrzeit & Programmpunkt aus eurem geplanten Ablaufplan (ersetzt die Liste).</div>
      {msg && <div className="we-ok">{msg}</div>}
    </div>
  )
}

function TemplatePanel({ templateId, onSelect }: { templateId: string; onSelect: (id: string) => void }) {
  return (
    <>
      <h2 className="we-section-title">Design auswählen</h2>
      <p className="we-section-sub">Wählt eines von sechs Templates. Eure Texte & Bilder bleiben beim Wechsel erhalten.</p>
      <div className="we-templates">
        {TEMPLATES.map(t => (
          <button key={t.id} className={`we-tpl${templateId === t.id ? ' selected' : ''}`} onClick={() => onSelect(t.id)}>
            <div className="we-tpl-swatch">{t.swatch.map((c, i) => <span key={i} style={{ background: c }} />)}</div>
            <div className="we-tpl-body">
              <div className="we-tpl-name">{t.name}</div>
              <div className="we-tpl-tag">{t.tagline}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

// ── Stil-Panel ────────────────────────────────────────────────────────────────
function StyleGroup({ label, onReset, children }: { label: string; onReset: () => void; children: React.ReactNode }) {
  return (
    <div className="we-field">
      <div className="we-flabel">
        <span>{label}</span>
        <button className="we-reset" onClick={onReset} title="Auf Template-Standard zurücksetzen"><RotateCcw size={12} /></button>
      </div>
      {children}
    </div>
  )
}
function Chips({ value, options, onPick }: { value?: string; options: { key: string; label: string }[]; onPick: (v: string) => void }) {
  return (
    <div className="we-chips">
      {options.map(o => (
        <button key={o.key} className={`we-chip${value === o.key ? ' selected' : ''}`} onClick={() => onPick(o.key)}>{o.label}</button>
      ))}
    </div>
  )
}
function SelectStd({ value, options, onChange }: { value?: string; options: { key: string; label: string }[]; onChange: (v: string | undefined) => void }) {
  return (
    <select className="we-input" value={value ?? ''} onChange={e => onChange(e.target.value || undefined)}>
      <option value="">Standard (Template)</option>
      {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  )
}

function StylePanel({ style, update }: { style: WeddingContent['style']; update: (m: (c: WeddingContent) => void) => void }) {
  const set = (k: string, v: string | undefined) => update(c => {
    const s = c.style as Record<string, unknown>
    if (v === undefined) delete s[k]; else s[k] = v
  })
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <h2 className="we-section-title" style={{ margin: 0 }}>Stil anpassen</h2>
        <button className="we-btn" onClick={() => update(c => { c.style = {} })}><RotateCcw size={14} /> Alles zurücksetzen</button>
      </div>
      <p className="we-section-sub">Feinschliff über dem Template. „Standard" bedeutet: Wert kommt vom gewählten Template.</p>

      <StyleGroup label="Farbpalette" onReset={() => set('palette', undefined)}>
        <div className="we-pal-grid">
          {PALETTES.map(p => (
            <button key={p.key} className={`we-pal${style.palette === p.key ? ' selected' : ''}`} onClick={() => set('palette', p.key)}>
              <span className="we-pal-sw">{p.swatch.map((c, i) => <span key={i} style={{ background: c }} />)}</span>
              <span className="we-pal-name">{p.label}</span>
            </button>
          ))}
        </div>
      </StyleGroup>

      <StyleGroup label="Überschriften-Schrift" onReset={() => set('fontHeading', undefined)}>
        <SelectStd value={style.fontHeading} options={HEADING_FONTS} onChange={v => set('fontHeading', v)} />
      </StyleGroup>
      <StyleGroup label="Fließtext-Schrift" onReset={() => set('fontBody', undefined)}>
        <SelectStd value={style.fontBody} options={BODY_FONTS} onChange={v => set('fontBody', v)} />
      </StyleGroup>

      <StyleGroup label="Hintergrund-Textur" onReset={() => set('texture', undefined)}>
        <Chips value={style.texture} options={TEXTURES} onPick={v => set('texture', v)} />
      </StyleGroup>
      <StyleGroup label="Ecken" onReset={() => set('radius', undefined)}>
        <Chips value={style.radius} options={RADII} onPick={v => set('radius', v)} />
      </StyleGroup>
      <StyleGroup label="Buttons" onReset={() => set('button', undefined)}>
        <Chips value={style.button} options={BUTTON_STYLES} onPick={v => set('button', v)} />
      </StyleGroup>
      <StyleGroup label="Ornamente / Trenner" onReset={() => set('ornament', undefined)}>
        <Chips value={style.ornament} options={ORNAMENTS} onPick={v => set('ornament', v)} />
      </StyleGroup>

      <h2 className="we-section-title" style={{ marginTop: '1.75rem' }}>Geschichte · Roter Faden</h2>
      <StyleGroup label="Ausrichtung / Layout" onReset={() => set('storyAlign', undefined)}>
        <Chips value={style.storyAlign} options={STORY_ALIGNS} onPick={v => set('storyAlign', v)} />
      </StyleGroup>
      <StyleGroup label="Linien-Stil" onReset={() => set('storyLine', undefined)}>
        <Chips value={style.storyLine} options={STORY_LINES} onPick={v => set('storyLine', v)} />
      </StyleGroup>
      <StyleGroup label="Marker" onReset={() => set('storyMarker', undefined)}>
        <Chips value={style.storyMarker} options={STORY_MARKERS} onPick={v => set('storyMarker', v)} />
      </StyleGroup>
    </>
  )
}

type PanelImgProps = {
  imgUrls: Record<string, string>
  pickImage: (f: File, setImg: (c: WeddingContent, img: WeddingImage) => void) => Promise<void>
  setImgUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

function StartPanel({ content, event, update, imgUrls, pickImage }: {
  content: WeddingContent; event: EventData | null; update: (m: (c: WeddingContent) => void) => void
} & PanelImgProps) {
  const L = content.landing
  return (
    <>
      <h2 className="we-section-title">Startseite</h2>
      <p className="we-section-sub">Titelbild, Begrüßung, Location & Tagesablauf.</p>

      <ImageField
        label="Titelbild (Hero)" image={L.hero.image} url={L.hero.image ? imgUrls[L.hero.image.fileId] : null}
        onPick={f => pickImage(f, (c, img) => { c.landing.hero.image = img })}
        onRemove={() => update(c => { c.landing.hero.image = null })}
        onFocus={(x, y) => update(c => { if (c.landing.hero.image) { c.landing.hero.image.focusX = x; c.landing.hero.image.focusY = y } })}
      />
      <Field label="Überschrift" max={WEDDING_LIMITS.heroHeadline} value={L.hero.headline}
        onChange={v => update(c => { c.landing.hero.headline = v })} placeholder="Wir heiraten" />
      <Field label="Unterzeile" max={WEDDING_LIMITS.heroSubline} value={L.hero.subline}
        onChange={v => update(c => { c.landing.hero.subline = v })} />

      <Field label="Datum (aus Event)" value={event?.date ? new Date(event.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} readOnly hint="Wird im Event gepflegt." />

      <hr style={{ border: 0, borderTop: '1px solid var(--bp-line)', margin: '1.5rem 0' }} />
      <Field label="Location-Titel" max={WEDDING_LIMITS.locationTitle} value={L.location.title}
        onChange={v => update(c => { c.landing.location.title = v })} />
      <Field label="Location (aus Event)" value={[event?.venue, event?.venueAddress].filter(Boolean).join(' · ') || '—'} readOnly hint="Name & Adresse kommen aus dem Event." />
      <Field label="Beschreibung / Anfahrt" textarea max={WEDDING_LIMITS.locationDescription} value={L.location.description}
        onChange={v => update(c => { c.landing.location.description = v })} placeholder="Parkmöglichkeiten, Hinweise…" />
      <ImageField
        label="Location-Bild" image={L.location.image} url={L.location.image ? imgUrls[L.location.image.fileId] : null}
        onPick={f => pickImage(f, (c, img) => { c.landing.location.image = img })}
        onRemove={() => update(c => { c.landing.location.image = null })}
        onFocus={(x, y) => update(c => { if (c.landing.location.image) { c.landing.location.image.focusX = x; c.landing.location.image.focusY = y } })}
      />

      <hr style={{ border: 0, borderTop: '1px solid var(--bp-line)', margin: '1.5rem 0' }} />
      <Field label="Tagesablauf-Titel" max={WEDDING_LIMITS.scheduleTitle} value={L.schedule.title}
        onChange={v => update(c => { c.landing.schedule.title = v })} />
      <ScheduleImport eventId={event?.id} onImport={items => update(c => { c.landing.schedule.items = items })} />
      {L.schedule.items.map((it, i) => (
        <div className="we-item" key={it.id}>
          <div className="we-item-head">
            <span className="we-item-no">{i + 1}.</span>
            <div className="we-item-tools">
              <button className="we-icon-btn" disabled={i === 0} onClick={() => update(c => { const a = c.landing.schedule.items;[a[i - 1], a[i]] = [a[i], a[i - 1]] })}><ArrowUp size={14} /></button>
              <button className="we-icon-btn" disabled={i === L.schedule.items.length - 1} onClick={() => update(c => { const a = c.landing.schedule.items;[a[i + 1], a[i]] = [a[i], a[i + 1]] })}><ArrowDown size={14} /></button>
              <button className="we-icon-btn" onClick={() => update(c => { c.landing.schedule.items.splice(i, 1) })}><Trash2 size={14} /></button>
            </div>
          </div>
          <Field label="Uhrzeit" max={WEDDING_LIMITS.scheduleItemTime} value={it.time} onChange={v => update(c => { c.landing.schedule.items[i].time = v })} placeholder="14:00" />
          <Field label="Programmpunkt" max={WEDDING_LIMITS.scheduleItemLabel} value={it.label} onChange={v => update(c => { c.landing.schedule.items[i].label = v })} placeholder="Freie Trauung" />
          <Field label="Beschreibung (optional)" max={WEDDING_LIMITS.scheduleItemDescription} value={it.description ?? ''} onChange={v => update(c => { c.landing.schedule.items[i].description = v })} placeholder="z.B. im Schlossgarten" />
        </div>
      ))}
      {L.schedule.items.length < MAX_SCHEDULE_ITEMS && (
        <button className="we-btn we-btn-block" onClick={() => update(c => { c.landing.schedule.items.push({ id: crypto.randomUUID(), time: '', label: '' }) })}>
          <Plus size={15} /> Programmpunkt hinzufügen
        </button>
      )}
    </>
  )
}

function StoryPanel({ content, update, imgUrls, pickImage }: {
  content: WeddingContent; update: (m: (c: WeddingContent) => void) => void
} & PanelImgProps) {
  const stations = content.story.stations
  return (
    <>
      <h2 className="we-section-title">Unsere Geschichte</h2>
      <p className="we-section-sub">Der rote Faden mit {MIN_STATIONS}–{MAX_STATIONS} Stationen.</p>
      <Field label="Titel" max={WEDDING_LIMITS.storyIntroTitle} value={content.story.intro.title} onChange={v => update(c => { c.story.intro.title = v })} />
      <Field label="Einleitung" textarea max={WEDDING_LIMITS.storyIntroText} value={content.story.intro.text} onChange={v => update(c => { c.story.intro.text = v })} />

      {stations.map((s, i) => (
        <div className="we-item" key={s.id}>
          <div className="we-item-head">
            <span className="we-item-no">Station {i + 1}</span>
            <div className="we-item-tools">
              <button className="we-icon-btn" disabled={i === 0} onClick={() => update(c => { const a = c.story.stations;[a[i - 1], a[i]] = [a[i], a[i - 1]] })}><ArrowUp size={14} /></button>
              <button className="we-icon-btn" disabled={i === stations.length - 1} onClick={() => update(c => { const a = c.story.stations;[a[i + 1], a[i]] = [a[i], a[i + 1]] })}><ArrowDown size={14} /></button>
              <button className="we-icon-btn" disabled={stations.length <= MIN_STATIONS} onClick={() => update(c => { c.story.stations.splice(i, 1) })}><Trash2 size={14} /></button>
            </div>
          </div>
          <div className="we-field">
            <div className="we-flabel"><span>Symbol</span></div>
            <div className="we-icon-grid">
              {STATION_ICONS.map(name => {
                const Ic = ICONS[name] ?? Heart
                return (
                  <button key={name} className={`we-icon-opt${s.icon === name ? ' selected' : ''}`} onClick={() => update(c => { c.story.stations[i].icon = name })} title={name}>
                    <Ic size={16} />
                  </button>
                )
              })}
            </div>
          </div>
          <Field label="Titel" max={WEDDING_LIMITS.stationTitle} value={s.title} onChange={v => update(c => { c.story.stations[i].title = v })} placeholder="Unser erstes Date" />
          <Field label="Zeitpunkt" max={WEDDING_LIMITS.stationDate} value={s.date} onChange={v => update(c => { c.story.stations[i].date = v })} placeholder="Sommer 2019" />
          <Field label="Ort" max={WEDDING_LIMITS.stationLocation} value={s.location} onChange={v => update(c => { c.story.stations[i].location = v })} placeholder="Paris" />
          <Field label="Text" textarea max={WEDDING_LIMITS.stationText} value={s.text} onChange={v => update(c => { c.story.stations[i].text = v })} />
          <ImageField
            label="Bild (optional)" image={s.image} url={s.image ? imgUrls[s.image.fileId] : null}
            onPick={f => pickImage(f, (c, img) => { c.story.stations[i].image = img })}
            onRemove={() => update(c => { c.story.stations[i].image = null })}
            onFocus={(x, y) => update(c => { const im = c.story.stations[i].image; if (im) { im.focusX = x; im.focusY = y } })}
          />
        </div>
      ))}
      {stations.length < MAX_STATIONS && (
        <button className="we-btn we-btn-block" onClick={() => update(c => { c.story.stations.push(emptyStation()) })}>
          <Plus size={15} /> Station hinzufügen
        </button>
      )}
    </>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="we-field" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: 3 }} />
      <span>
        <span style={{ fontSize: '0.9rem', color: 'var(--bp-ink)' }}>{label}</span>
        {hint && <span className="we-hint" style={{ display: 'block' }}>{hint}</span>}
      </span>
    </label>
  )
}

function RsvpPanel({ content, update, imgUrls, pickImage, rsvpCfg, updateRsvp }: {
  content: WeddingContent; update: (m: (c: WeddingContent) => void) => void
  rsvpCfg: RsvpSettingsState; updateRsvp: (p: Partial<RsvpSettingsState>) => void
} & PanelImgProps) {
  const t = rsvpCfg.toggles
  const setT = (patch: Partial<RsvpSettingsState['toggles']>) => updateRsvp({ toggles: { ...rsvpCfg.toggles, ...patch } })
  // Deadline als YYYY-MM-DD fürs date-Input
  const deadlineDate = rsvpCfg.deadline ? rsvpCfg.deadline.slice(0, 10) : ''
  return (
    <>
      <h2 className="we-section-title">RSVP-Seite</h2>
      <p className="we-section-sub">Begrüßungstext über dem Anmeldeformular. Die Anmelde-Logik (Code / Neuanmeldung) ist automatisch enthalten.</p>
      <Field label="Titel" max={WEDDING_LIMITS.rsvpTitle} value={content.rsvp.title} onChange={v => update(c => { c.rsvp.title = v })} />
      <Field label="Text" textarea max={WEDDING_LIMITS.rsvpText} value={content.rsvp.text} onChange={v => update(c => { c.rsvp.text = v })} />
      <ImageField
        label="Kopfbild (optional)" image={content.rsvp.image} url={content.rsvp.image ? imgUrls[content.rsvp.image.fileId] : null}
        onPick={f => pickImage(f, (c, img) => { c.rsvp.image = img })}
        onRemove={() => update(c => { c.rsvp.image = null })}
        onFocus={(x, y) => update(c => { if (c.rsvp.image) { c.rsvp.image.focusX = x; c.rsvp.image.focusY = y } })}
      />

      <hr style={{ border: 0, borderTop: '1px solid var(--bp-line)', margin: '1.5rem 0' }} />
      <h2 className="we-section-title">Anmelde-Einstellungen</h2>
      <p className="we-section-sub">Diese Einstellungen ersetzen die frühere RSVP-Konfiguration.</p>

      <div className="we-field">
        <div className="we-flabel"><span>Anmeldefrist (RSVP-Deadline)</span></div>
        <input className="we-input" type="date" value={deadlineDate}
          onChange={e => updateRsvp({ deadline: e.target.value || null })} />
        <div className="we-hint">Nach diesem Datum sind keine Änderungen mehr möglich. Leer = keine Frist.</div>
      </div>

      <Toggle label="Menüwahl abfragen" hint="Gäste wählen ein Gericht aus den Menüoptionen." checked={t.menu} onChange={v => setT({ menu: v })} />

      <Toggle label="Begleitpersonen erlauben" checked={t.begleitpersonen} onChange={v => setT({ begleitpersonen: v })} />
      {t.begleitpersonen && (
        <div className="we-field">
          <div className="we-flabel"><span>Max. Begleitpersonen pro Gast</span></div>
          <input className="we-input" type="number" min={0} max={20} value={rsvpCfg.maxBegleitpersonen}
            onChange={e => updateRsvp({ maxBegleitpersonen: Math.max(0, Math.min(20, parseInt(e.target.value || '0', 10) || 0)) })} />
        </div>
      )}

      <Toggle label="Übernachtung / Hotel abfragen" hint="Gäste können im RSVP ein Hotelzimmer wählen (sofern Hotels hinterlegt sind)." checked={t.hotel} onChange={v => setT({ hotel: v })} />
      <Toggle label="Musikwünsche sammeln" hint="Gäste können nach der Zusage Songs vorschlagen." checked={t.musikwunsch} onChange={v => setT({ musikwunsch: v })} />
      <Toggle label="Wunschliste anzeigen" hint="Zeigt eure Geschenk-/Wunschliste auf der RSVP-Seite." checked={t.geschenke} onChange={v => setT({ geschenke: v })} />
    </>
  )
}

function SharePanel({ slug, setSlug, slugError, event, og, setOg, suggestSlug }: {
  slug: string; setSlug: (v: string) => void; slugError: string | null; event: EventData | null
  og: { title: string; description: string; imageKey: string | null }
  setOg: React.Dispatch<React.SetStateAction<{ title: string; description: string; imageKey: string | null }>>
  suggestSlug: () => void
}) {
  const base = typeof window !== 'undefined' ? `${window.location.origin}/wedding/` : '/wedding/'
  return (
    <>
      <h2 className="we-section-title">Teilen & Link</h2>
      <p className="we-section-sub">Euer öffentlicher Link und die Vorschau beim Teilen (z.B. WhatsApp).</p>
      <div className="we-field">
        <div className="we-flabel"><span>Link (Slug)</span></div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span className="we-hint" style={{ whiteSpace: 'nowrap' }}>{base}</span>
          <input className="we-input" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="lisa-und-tom" />
        </div>
        {slugError ? <div className="we-error">{slugError}</div> : <div className="we-ok">3–60 Zeichen, Kleinbuchstaben, Zahlen, Bindestriche.</div>}
        <button className="we-btn" style={{ marginTop: '0.5rem' }} onClick={suggestSlug}>Vorschlag aus Namen</button>
      </div>
      <hr style={{ border: 0, borderTop: '1px solid var(--bp-line)', margin: '1.5rem 0' }} />
      <Field label="Titel beim Teilen" max={WEDDING_LIMITS.ogTitle} value={og.title} onChange={v => setOg(o => ({ ...o, title: v }))} placeholder={`${event?.coupleName ?? ''} — Wir heiraten`} />
      <Field label="Beschreibung beim Teilen" textarea max={WEDDING_LIMITS.ogDescription} value={og.description} onChange={v => setOg(o => ({ ...o, description: v }))} placeholder="Wir freuen uns, diesen Tag mit euch zu feiern." />
    </>
  )
}

function PublishPanel({ status, slug, isOnline, setOnline, onPublish, publishMsg }: {
  status: 'draft' | 'published'; slug: string; isOnline: boolean
  setOnline: (v: boolean) => void; onPublish: () => void; publishMsg: string | null
}) {
  const url = (typeof window !== 'undefined' ? window.location.origin : '') + `/wedding/${slug}`
  return (
    <>
      <h2 className="we-section-title">Veröffentlichen</h2>
      <p className="we-section-sub">Bis zur Veröffentlichung ist eure Seite privat. Änderungen werden als Entwurf gespeichert und erst durch „Veröffentlichen" live.</p>
      <div className="we-publish-card">
        <div style={{ marginBottom: '0.75rem' }}>
          <strong>Status:</strong> {status === 'published' ? 'Veröffentlicht' : 'Entwurf (noch nicht live)'}
        </div>
        {slug
          ? <div style={{ marginBottom: '0.75rem' }}><div className="we-hint">Öffentlicher Link</div><a className="we-url" href={url} target="_blank" rel="noreferrer">{url} <ExternalLink size={12} /></a></div>
          : <div className="we-error" style={{ marginBottom: '0.75rem' }}>Bitte zuerst im Tab „Teilen" einen Link festlegen.</div>}

        {status === 'published' && (
          <label className="we-switch" style={{ marginBottom: '0.75rem' }}>
            <input type="checkbox" checked={isOnline} onChange={e => setOnline(e.target.checked)} />
            <span>Seite öffentlich erreichbar ({isOnline ? 'online' : 'offline'})</span>
          </label>
        )}

        <button className="we-btn we-btn-primary we-btn-block" onClick={onPublish} disabled={!slug}>
          <Globe size={15} /> {status === 'published' ? 'Änderungen veröffentlichen' : 'Jetzt veröffentlichen'}
        </button>
        {publishMsg && <div className={publishMsg.includes('!') ? 'we-ok' : 'we-error'} style={{ marginTop: '0.5rem' }}>{publishMsg}</div>}
      </div>
    </>
  )
}
