'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ImagePlus, Loader2, Trash2, Sparkles, Eye, RefreshCw, Type } from 'lucide-react'
import {
  DEFAULT_DISPLAY_SETTINGS, HEADING_FONTS, BODY_FONTS, ACCENT_PRESETS, BG_COLOR_PRESETS, THEME_PRESETS,
  RSVP_TEXT_DEFAULTS, RSVP_SECTIONS, fontHrefFor, shade,
  type DisplaySettings, type HeadingFontKey, type BodyFontKey, type RsvpTexts,
} from '@/lib/display-settings'

const TEXTURE_LABEL: Record<DisplaySettings['bgTexture'], string> = {
  none: 'Keine', paper: 'Papier', dots: 'Punkte', floral: 'Floral',
  marble: 'Marmor', linen: 'Leinen', watercolor: 'Aquarell',
}

const CARD_STYLE_LABEL: Record<DisplaySettings['cardStyle'], string> = {
  border: 'Rahmen', shadow: 'Schatten', flat: 'Flach',
}

// Gruppierung der anpassbaren Texte für den Editor.
const TEXT_FIELDS: { key: keyof RsvpTexts; label: string }[] = [
  { key: 'introEyebrow',    label: 'Kleine Zeile über dem Namen' },
  { key: 'rsvpTitle',       label: 'Überschrift: Zusage-Schritt' },
  { key: 'detailsTitle',    label: 'Überschrift: Details-Schritt' },
  { key: 'hotelTitle',      label: 'Überschrift: Hotel-Schritt' },
  { key: 'yesLabel',        label: 'Button: Zusage' },
  { key: 'noLabel',         label: 'Button: Absage' },
  { key: 'nextLabel',       label: 'Button: Weiter' },
  { key: 'declineLabel',    label: 'Button: Absage senden' },
  { key: 'thankYouAccept',  label: 'Danke-Text bei Zusage' },
  { key: 'thankYouDecline', label: 'Text bei Absage' },
]

export default function AnzeigeeinstellungenPanel({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [s, setS] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const coverInput = useRef<HTMLInputElement>(null)
  const [previewKey, setPreviewKey] = useState(0)  // erzwingt iframe-Reload nach Speichern
  const bgPhotoInput = useRef<HTMLInputElement>(null)
  const [bgPhotoBusy, setBgPhotoBusy] = useState(false)

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
  function setText(key: keyof RsvpTexts, value: string) {
    setS(prev => ({ ...prev, texts: { ...prev.texts, [key]: value }, preset: null }))
    setSaved(false)
  }
  function toggleSection(key: string, hide: boolean) {
    setS(prev => {
      const set = new Set(prev.hiddenSections)
      if (hide) set.add(key); else set.delete(key)
      return { ...prev, hiddenSections: Array.from(set), preset: null }
    })
    setSaved(false)
  }

  async function onBgPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setBgPhotoBusy(true)
    try {
      const reqRes = await fetch(`/api/events/${eventId}/bg-photo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type }),
      })
      const { uploadUrl, key } = await reqRes.json()
      if (!uploadUrl) return
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      set('bgPhotoR2Key', key as string)
    } finally { setBgPhotoBusy(false) }
  }
  async function removeBgPhoto() {
    setBgPhotoBusy(true)
    try { await fetch(`/api/events/${eventId}/bg-photo`, { method: 'DELETE' }); set('bgPhotoR2Key', null) }
    finally { setBgPhotoBusy(false) }
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
      if (res.ok) { setSaved(true); setPreviewKey(k => k + 1); router.refresh() }
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
  const radius = s.cornerStyle === 'elegant' ? 4 : 14

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

          {/* Fließtext-Schrift */}
          <Field label="Schriftart des Fließtexts">
            <select className="bp-input" value={s.bodyFont} onChange={e => set('bodyFont', e.target.value as BodyFontKey)}>
              {(Object.keys(BODY_FONTS) as BodyFontKey[]).map(k => (
                <option key={k} value={k}>{BODY_FONTS[k].label}</option>
              ))}
            </select>
          </Field>

          {/* Zweite Akzent-/Kontrastfarbe */}
          <Field label="Zweite Akzentfarbe (Badges, Links)">
            <ToggleRow label="Eigene zweite Farbe verwenden" checked={s.accent2 !== null}
              onChange={v => set('accent2', v ? shade(s.accent, -0.3) : null)} />
            {s.accent2 !== null && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                {ACCENT_PRESETS.map(p => (
                  <button key={p.value} type="button" title={p.label} onClick={() => set('accent2', p.value)}
                    style={{ width: 24, height: 24, borderRadius: 999, background: p.value, cursor: 'pointer',
                      border: (s.accent2 ?? '').toLowerCase() === p.value.toLowerCase() ? '2px solid var(--bp-ink)' : '1px solid rgba(0,0,0,0.15)' }} />
                ))}
                <input type="color" value={s.accent2 ?? s.accent} onChange={e => set('accent2', e.target.value)}
                  style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
              </div>
            )}
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

          {/* Sanfter Farbverlauf-Hintergrund */}
          <ToggleRow label="Sanfter Farbverlauf-Hintergrund" checked={s.bgGradient} onChange={v => set('bgGradient', v)} />

          {/* Karten-Stil */}
          <Field label="Karten-Stil">
            <SegmentRow value={s.cardStyle} onChange={v => set('cardStyle', v as DisplaySettings['cardStyle'])}
              options={(Object.keys(CARD_STYLE_LABEL) as DisplaySettings['cardStyle'][]).map(k => [k, CARD_STYLE_LABEL[k]])} />
          </Field>

          {/* Dichte / Abstände */}
          <Field label="Abstände (Dichte)">
            <SegmentRow value={s.density} onChange={v => set('density', v as DisplaySettings['density'])}
              options={[['kompakt', 'Kompakt'], ['standard', 'Standard'], ['luftig', 'Luftig']]} />
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

          {/* Ornamente & Countdown */}
          <ToggleRow label="Dezente Ornamente & Trennlinien" checked={s.ornaments} onChange={v => set('ornaments', v)} />
          <ToggleRow label="Countdown zum Termin anzeigen" checked={s.countdown} onChange={v => set('countdown', v)} />
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
        <p style={{ fontSize: 12, color: 'var(--bp-ink-3)', margin: '8px 0 0' }}>Erscheint als großflächiger Kopf der RSVP-Seite.</p>
      </div>

      {/* ── Hintergrundfoto (Ganzseite, weichgezeichnet) ── */}
      <div style={{ marginTop: 20 }}>
        <p className="bp-label-text" style={{ marginBottom: 8 }}>Hintergrundfoto (ganze Seite)</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input ref={bgPhotoInput} type="file" accept="image/*" hidden onChange={onBgPhoto} />
          <button type="button" className="bp-btn" disabled={bgPhotoBusy} onClick={() => bgPhotoInput.current?.click()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {bgPhotoBusy ? <Loader2 size={14} className="bp-spin" /> : <ImagePlus size={14} />} Foto hochladen
          </button>
          {s.bgPhotoR2Key && (
            <button type="button" className="bp-btn" disabled={bgPhotoBusy} onClick={removeBgPhoto}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--bp-red)' }}>
              <Trash2 size={14} /> Entfernen
            </button>
          )}
          {s.bgPhotoR2Key && <span style={{ fontSize: 12, color: 'var(--bp-green)' }}>Foto gesetzt</span>}
        </div>
        {s.bgPhotoR2Key && (
          <div style={{ marginTop: 12, maxWidth: 280 }}>
            <label className="bp-label-text" style={{ display: 'block', marginBottom: 6 }}>Weichzeichnung: {s.bgPhotoBlur}px</label>
            <input type="range" min={0} max={30} value={s.bgPhotoBlur} onChange={e => set('bgPhotoBlur', Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--bp-gold)' }} />
          </div>
        )}
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
              <textarea className="bp-textarea" value={s.invitation.greetingSubtitle} maxLength={240} rows={2}
                style={{ minHeight: 64 }}
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

      {/* ── Texte anpassen ── */}
      <div style={{ marginTop: 26, paddingTop: 20, borderTop: '1px solid var(--bp-rule)' }}>
        <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: '0 0 4px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Type size={16} /> Texte der RSVP-Seite
        </h4>
        <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 16px' }}>
          Überschreibe einzelne Texte. Leere Felder verwenden automatisch den Standard.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {TEXT_FIELDS.map(f => (
            <Field key={f.key} label={f.label}>
              <input className="bp-input" value={s.texts?.[f.key] ?? ''} maxLength={280}
                placeholder={RSVP_TEXT_DEFAULTS[f.key]} onChange={e => setText(f.key, e.target.value)} />
            </Field>
          ))}
        </div>
      </div>

      {/* ── Sektionen ein-/ausblenden ── */}
      <div style={{ marginTop: 26, paddingTop: 20, borderTop: '1px solid var(--bp-rule)' }}>
        <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: '0 0 4px' }}>Abschnitte ein-/ausblenden</h4>
        <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 16px' }}>
          Blende einzelne Abschnitte der RSVP-Seite für eure Gäste aus.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {RSVP_SECTIONS.map(sec => (
            <ToggleRow key={sec.key} label={sec.label}
              checked={!s.hiddenSections.includes(sec.key)}
              onChange={v => toggleSection(sec.key, !v)} />
          ))}
        </div>
      </div>

      {/* ── Live-Vorschau ── */}
      <div style={{ marginTop: 26, paddingTop: 20, borderTop: '1px solid var(--bp-rule)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <p className="bp-label-text" style={{ margin: 0 }}>Live-Vorschau</p>
          <button type="button" className="bp-btn" onClick={async () => { await save() }} disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {saving ? <Loader2 size={14} className="bp-spin" /> : <RefreshCw size={14} />} Speichern & aktualisieren
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--bp-ink-3)', margin: '0 0 10px' }}>
          Die Vorschau zeigt den zuletzt gespeicherten Stand. Nach „Speichern &amp; aktualisieren“ wird sie neu geladen.
        </p>
        <div style={{ border: '1px solid var(--bp-rule)', borderRadius: radius, overflow: 'hidden', background: s.bgColor }}>
          <iframe key={previewKey} src={`/rsvp/_preview?event=${eventId}`} title="RSVP-Vorschau"
            style={{ width: '100%', height: 620, border: 'none', display: 'block' }} />
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
