'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ImagePlus, Loader2, Trash2, Sparkles, Eye } from 'lucide-react'
import {
  DEFAULT_DISPLAY_SETTINGS, HEADING_FONTS, ACCENT_PRESETS, BG_COLOR_PRESETS, THEME_PRESETS,
  fontHrefFor, shade, textureStyle, type DisplaySettings, type HeadingFontKey,
} from '@/lib/display-settings'

const TEXTURE_LABEL: Record<DisplaySettings['bgTexture'], string> = {
  none: 'Keine', paper: 'Papier', dots: 'Punkte', floral: 'Floral',
}

export default function AnzeigeeinstellungenPanel({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [s, setS] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const coverInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/events/${eventId}/display-settings`)
      .then(r => r.json())
      .then(j => { if (j.settings) setS(j.settings) })
      .finally(() => setLoading(false))
  }, [eventId])

  function set<K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) {
    setS(prev => ({ ...prev, [key]: value, preset: null }))
    setSaved(false)
  }
  function applyPreset(key: string, partial: Partial<DisplaySettings>) {
    setS(prev => ({ ...prev, ...partial, preset: key }))
    setSaved(false)
  }
  function setInv<K extends keyof DisplaySettings['invitation']>(key: K, value: DisplaySettings['invitation'][K]) {
    setS(prev => ({ ...prev, invitation: { ...prev.invitation, [key]: value }, preset: null }))
    setSaved(false)
  }

  const motiveInput = useRef<HTMLInputElement>(null)
  const [motiveBusy, setMotiveBusy] = useState(false)
  async function onMotive(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setMotiveBusy(true)
    try {
      const reqRes = await fetch(`/api/events/${eventId}/invitation-motive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type }),
      })
      const { uploadUrl, key } = await reqRes.json()
      if (!uploadUrl) return
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      setInv('motiveR2Key', key as string)
    } finally { setMotiveBusy(false) }
  }
  async function removeMotive() {
    setMotiveBusy(true)
    try { await fetch(`/api/events/${eventId}/invitation-motive`, { method: 'DELETE' }); setInv('motiveR2Key', null) }
    finally { setMotiveBusy(false) }
  }

  // Speichert den aktuellen Stand und öffnet die echte RSVP-Vorschau im neuen Tab.
  async function openPreview() {
    await save()
    window.open(`/rsvp/_preview?event=${eventId}`, '_blank', 'noopener')
  }

  async function save() {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch(`/api/events/${eventId}/display-settings`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: s }),
      })
      if (res.ok) { setSaved(true); router.refresh() }
    } finally { setSaving(false) }
  }

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setCoverBusy(true)
    try {
      const reqRes = await fetch(`/api/events/${eventId}/cover`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type }),
      })
      const { uploadUrl, key } = await reqRes.json()
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      await fetch(`/api/events/${eventId}/cover`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cover_image_r2_key: key }),
      })
      router.refresh()
    } finally { setCoverBusy(false) }
  }
  async function removeCover() {
    setCoverBusy(true)
    try { await fetch(`/api/events/${eventId}/cover`, { method: 'DELETE' }); router.refresh() }
    finally { setCoverBusy(false) }
  }

  if (loading) return <p style={{ color: 'var(--bp-ink-3)', fontSize: 14 }}>Lädt…</p>

  const fontHref = fontHrefFor(s.headingFont)
  const deep = shade(s.accent, -0.18)
  const pale = shade(s.accent, 0.82)
  const scale = s.headingScale === 'gross' ? 1.15 : s.headingScale === 'kompakt' ? 0.9 : 1
  const radius = s.cornerStyle === 'elegant' ? 4 : 14
  const btnRadius = s.buttonStyle === 'square' ? 8 : 999

  return (
    <div>
      {/* lädt die aktuell gewählte Schrift für die Vorschau */}
      {fontHref && <link rel="stylesheet" href={fontHref} />}

      {/* ── Theme-Presets ── */}
      <p className="bp-label-text" style={{ marginBottom: 8 }}>Stilpaket (1 Klick)</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {THEME_PRESETS.map(p => (
          <button key={p.key} type="button" onClick={() => applyPreset(p.key, p.settings)}
            style={{ ...chip, ...(s.preset === p.key ? chipActive : {}) }}>
            <Sparkles size={13} /> {p.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Akzentfarbe */}
          <Field label="Akzentfarbe">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {ACCENT_PRESETS.map(p => (
                <button key={p.value} type="button" title={p.label} onClick={() => set('accent', p.value)}
                  style={{ width: 26, height: 26, borderRadius: 999, background: p.value, cursor: 'pointer',
                    border: s.accent.toLowerCase() === p.value.toLowerCase() ? '2px solid var(--bp-ink)' : '1px solid rgba(0,0,0,0.15)' }} />
              ))}
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--bp-ink-2)', cursor: 'pointer' }}>
                <input type="color" value={s.accent} onChange={e => set('accent', e.target.value)}
                  style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                Eigene
              </label>
            </div>
          </Field>

          {/* Akzent-Verlauf */}
          <ToggleRow label="Akzent als Farbverlauf" checked={s.accentGradient} onChange={v => set('accentGradient', v)} />

          {/* Überschriften-Schrift */}
          <Field label="Schriftart der Überschriften">
            <select className="bp-input" value={s.headingFont} onChange={e => set('headingFont', e.target.value as HeadingFontKey)}>
              {(Object.keys(HEADING_FONTS) as HeadingFontKey[]).map(k => (
                <option key={k} value={k}>{HEADING_FONTS[k].label}</option>
              ))}
            </select>
          </Field>

          {/* Schriftgröße */}
          <Field label="Größe der Überschriften">
            <SegmentRow value={s.headingScale} onChange={v => set('headingScale', v as DisplaySettings['headingScale'])}
              options={[['kompakt', 'Kompakt'], ['standard', 'Standard'], ['gross', 'Groß']]} />
          </Field>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Hintergrundfarbe (nur helle Pastelltöne) */}
          <Field label="Hintergrundfarbe">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {BG_COLOR_PRESETS.map(p => (
                <button key={p.value} type="button" title={p.label} onClick={() => set('bgColor', p.value)}
                  style={{ width: 26, height: 26, borderRadius: 8, background: p.value, cursor: 'pointer',
                    border: s.bgColor.toLowerCase() === p.value.toLowerCase() ? '2px solid var(--bp-ink)' : '1px solid rgba(0,0,0,0.18)' }} />
              ))}
            </div>
          </Field>

          {/* Hintergrund-Muster */}
          <Field label="Hintergrund-Muster">
            <SegmentRow value={s.bgTexture} onChange={v => set('bgTexture', v as DisplaySettings['bgTexture'])}
              options={(Object.keys(TEXTURE_LABEL) as DisplaySettings['bgTexture'][]).map(k => [k, TEXTURE_LABEL[k]])} />
          </Field>

          {/* Eckenform */}
          <Field label="Form (Ecken)">
            <SegmentRow value={s.cornerStyle} onChange={v => set('cornerStyle', v as DisplaySettings['cornerStyle'])}
              options={[['soft', 'Verspielt'], ['elegant', 'Elegant']]} />
          </Field>

          {/* Button-Stil */}
          <Field label="Button-Stil">
            <SegmentRow value={s.buttonStyle} onChange={v => set('buttonStyle', v as DisplaySettings['buttonStyle'])}
              options={[['pill', 'Rund'], ['square', 'Eckig']]} />
          </Field>

          {/* Monogramm */}
          <Field label="Monogramm / Initialen (Wordmark)">
            <input className="bp-input" value={s.monogram} maxLength={24} placeholder="z. B. A & M"
              onChange={e => set('monogram', e.target.value)} />
          </Field>
        </div>
      </div>

      {/* ── Titelbild ── */}
      <div style={{ marginTop: 20 }}>
        <p className="bp-label-text" style={{ marginBottom: 8 }}>Titelbild (Hero)</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input ref={coverInput} type="file" accept="image/*" hidden onChange={onCover} />
          <button type="button" className="bp-btn" disabled={coverBusy} onClick={() => coverInput.current?.click()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {coverBusy ? <Loader2 size={14} className="bp-spin" /> : <ImagePlus size={14} />} Titelbild hochladen
          </button>
          <button type="button" className="bp-btn" disabled={coverBusy} onClick={removeCover}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--bp-red)' }}>
            <Trash2 size={14} /> Entfernen
          </button>
        </div>
      </div>

      {/* ── Einladung (individuell) ── */}
      <div style={{ marginTop: 26, paddingTop: 20, borderTop: '1px solid var(--bp-rule)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: 0 }}>Einladung</h4>
          <button type="button" className="bp-btn" onClick={openPreview} disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Eye size={14} /> RSVP-Vorschau öffnen
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 16px' }}>
          Gestalte die Einladungs- und RSVP-Seite für eure Gäste. Leere Felder erben automatisch die Einstellungen oben.
          Die Vorschau zeigt den zuletzt gespeicherten Stand.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Begrüßung – Überschrift">
              <input className="bp-input" value={s.invitation.greetingTitle} maxLength={120}
                placeholder="z. B. Wir heiraten!" onChange={e => setInv('greetingTitle', e.target.value)} />
            </Field>
            <Field label="Begrüßung – Untertitel">
              <textarea className="bp-input" value={s.invitation.greetingSubtitle} maxLength={240} rows={2}
                placeholder="z. B. Feiert mit uns den schönsten Tag unseres Lebens." onChange={e => setInv('greetingSubtitle', e.target.value)} />
            </Field>
            <div>
              <label className="bp-label-text" style={{ display: 'block', marginBottom: 6 }}>Einladungs-Motiv (Hintergrund)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input ref={motiveInput} type="file" accept="image/*" hidden onChange={onMotive} />
                <button type="button" className="bp-btn" disabled={motiveBusy} onClick={() => motiveInput.current?.click()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {motiveBusy ? <Loader2 size={14} className="bp-spin" /> : <ImagePlus size={14} />} Motiv hochladen
                </button>
                {s.invitation.motiveR2Key && (
                  <button type="button" className="bp-btn" disabled={motiveBusy} onClick={removeMotive}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--bp-red)' }}>
                    <Trash2 size={14} /> Entfernen
                  </button>
                )}
                {s.invitation.motiveR2Key && <span style={{ fontSize: 12, color: 'var(--bp-green)', alignSelf: 'center' }}>Motiv gesetzt</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Akzentfarbe der Einladung">
              <ToggleRow label="Eigene Akzentfarbe verwenden" checked={s.invitation.accent !== null}
                onChange={v => setInv('accent', v ? s.accent : null)} />
              {s.invitation.accent !== null && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                  {ACCENT_PRESETS.map(p => (
                    <button key={p.value} type="button" title={p.label} onClick={() => setInv('accent', p.value)}
                      style={{ width: 24, height: 24, borderRadius: 999, background: p.value, cursor: 'pointer',
                        border: (s.invitation.accent ?? '').toLowerCase() === p.value.toLowerCase() ? '2px solid var(--bp-ink)' : '1px solid rgba(0,0,0,0.15)' }} />
                  ))}
                  <input type="color" value={s.invitation.accent ?? s.accent} onChange={e => setInv('accent', e.target.value)}
                    style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                </div>
              )}
            </Field>
            <Field label="Überschriften-Schrift der Einladung">
              <select className="bp-input" value={s.invitation.headingFont ?? ''}
                onChange={e => setInv('headingFont', (e.target.value || null) as HeadingFontKey | null)}>
                <option value="">Wie global ({HEADING_FONTS[s.headingFont].label})</option>
                {(Object.keys(HEADING_FONTS) as HeadingFontKey[]).map(k => (
                  <option key={k} value={k}>{HEADING_FONTS[k].label}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* ── Vorschau ── */}
      <div style={{ marginTop: 22 }}>
        <p className="bp-label-text" style={{ marginBottom: 8 }}>Vorschau</p>
        <div style={{
          border: '1px solid var(--bp-rule)', borderRadius: radius, padding: 22, overflow: 'hidden',
          backgroundColor: s.bgColor,
          backgroundImage: textureStyle(s.bgTexture).image,
          backgroundSize: textureStyle(s.bgTexture).size,
        }}>
          <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: deep, margin: 0 }}>
            {s.monogram || 'FOREVR'} · Hochzeitsjournal
          </p>
          <h3 style={{ fontFamily: HEADING_FONTS[s.headingFont].family, fontSize: 2 * scale + 'rem', fontWeight: 600, margin: '6px 0 4px', color: 'var(--bp-ink)' }}>
            Anna &amp; Max
          </h3>
          <p style={{ fontSize: 13.5, color: 'var(--bp-ink-2)', margin: '0 0 14px' }}>
            So sieht euer Portal mit diesen Einstellungen aus.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: '9px 18px', borderRadius: btnRadius, color: '#fff', fontSize: 13, fontWeight: 600,
              background: s.accentGradient ? `linear-gradient(135deg, ${s.accent}, ${deep})` : s.accent,
            }}>Beispiel-Button</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: '5px 12px', borderRadius: 999, background: pale, color: deep, fontSize: 12, fontWeight: 700 }}>
              Akzent-Chip
            </span>
          </div>
        </div>
      </div>

      {/* ── Speichern ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
        <button type="button" className="bp-btn bp-btn-primary" onClick={save} disabled={saving}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {saving ? <Loader2 size={14} className="bp-spin" /> : saved ? <Check size={14} /> : null}
          {saving ? 'Speichert…' : saved ? 'Gespeichert' : 'Übernehmen'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--bp-ink-3)' }}>Wirkt auf euer Portal und die Gäste-Seiten.</span>
      </div>
    </div>
  )
}

// ── kleine UI-Helfer ──────────────────────────────────────────────────────────
const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, gap: 6, padding: '7px 14px', borderRadius: 999,
  border: '1px solid var(--bp-rule)', background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 13, fontWeight: 600, color: 'var(--bp-ink-2)',
}
const chipActive: React.CSSProperties = { background: 'var(--bp-ink)', color: '#fff', borderColor: 'var(--bp-ink)' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="bp-label-text" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function SegmentRow({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(([val, label]) => (
        <button key={val} type="button" onClick={() => onChange(val)}
          style={{ ...chip, padding: '6px 12px', ...(value === val ? chipActive : {}) }}>
          {label}
        </button>
      ))}
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 14, color: 'var(--bp-ink)' }}>
      {label}
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--bp-gold)' }} />
    </label>
  )
}
