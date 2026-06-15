'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ImagePlus, Loader2, Trash2, Sparkles, Eye, RefreshCw, Palette, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_DISPLAY_SETTINGS, HEADING_FONTS, BODY_FONTS, ACCENT_PRESETS, BG_COLOR_PRESETS, THEME_PRESETS,
  RSVP_SECTIONS, fontHrefFor, shade, textureStyle,
  type DisplaySettings, type HeadingFontKey, type BodyFontKey,
} from '@/lib/display-settings'

const TEXTURE_LABEL: Record<DisplaySettings['bgTexture'], string> = {
  none: 'Keine', paper: 'Papier', dots: 'Punkte', floral: 'Floral',
  marble: 'Marmor', linen: 'Leinen', watercolor: 'Aquarell',
}

const CARD_STYLE_LABEL: Record<DisplaySettings['cardStyle'], string> = {
  border: 'Rahmen', shadow: 'Schatten', flat: 'Flach',
}

// RSVP-/Einladungs-Einstellungen (Tabelle rsvp_settings) — ehemals im Gäste-Tab.
interface RsvpSettings {
  id?: string
  invitation_text: string
  rsvp_deadline: string | null
  show_meal_choice: boolean
  show_plus_one: boolean
  phone_contact: string | null
}

const EMPTY_RSVP: RsvpSettings = {
  invitation_text: '', rsvp_deadline: null, show_meal_choice: true, show_plus_one: true, phone_contact: null,
}

type PanelTab = 'anzeige' | 'einladung'

export default function AnzeigeeinstellungenPanel({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [tab, setTab] = useState<PanelTab>('anzeige')
  const [s, setS] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS)
  const [rsvp, setRsvp] = useState<RsvpSettings>(EMPTY_RSVP)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const coverInput = useRef<HTMLInputElement>(null)
  const [previewKey, setPreviewKey] = useState(0)  // erzwingt iframe-Reload (für Bilder / finalen Stand)
  const previewRef = useRef<HTMLIFrameElement>(null)
  const bgPhotoInput = useRef<HTMLInputElement>(null)
  const [bgPhotoBusy, setBgPhotoBusy] = useState(false)

  // Tab aus URL-Hash (#einladung) übernehmen — Deep-Link aus dem Gäste-Bereich.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#einladung') setTab('einladung')
  }, [])

  // Anzeigeeinstellungen + RSVP-Einstellungen laden.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    Promise.all([
      fetch(`/api/events/${eventId}/display-settings`).then(r => r.json()).catch(() => null),
      supabase.from('rsvp_settings').select('*').eq('event_id', eventId).maybeSingle(),
    ]).then(([dj, rs]) => {
      if (cancelled) return
      if (dj?.settings) setS(dj.settings)
      if (rs?.data) setRsvp(rs.data as RsvpSettings)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [eventId])

  // Live-Vorschau: aktuellen (ungespeicherten) Stand an das iframe posten.
  useEffect(() => {
    const win = previewRef.current?.contentWindow
    if (!win) return
    const t = setTimeout(() => {
      win.postMessage({ type: 'forevr-preview', display: s, rsvp }, window.location.origin)
    }, 120)
    return () => clearTimeout(t)
  }, [s, rsvp])

  function postPreviewNow() {
    previewRef.current?.contentWindow?.postMessage(
      { type: 'forevr-preview', display: s, rsvp }, window.location.origin,
    )
  }

  function set<K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) {
    setS(prev => ({ ...prev, [key]: value, preset: null })); setSaved(false)
  }
  function applyPreset(key: string, partial: Partial<DisplaySettings>) {
    setS(prev => ({ ...prev, ...partial, preset: key })); setSaved(false)
  }
  function setInv<K extends keyof DisplaySettings['invitation']>(key: K, value: DisplaySettings['invitation'][K]) {
    setS(prev => ({ ...prev, invitation: { ...prev.invitation, [key]: value }, preset: null })); setSaved(false)
  }
  function setRsvpField<K extends keyof RsvpSettings>(key: K, value: RsvpSettings[K]) {
    setRsvp(prev => ({ ...prev, [key]: value })); setSaved(false)
  }
  function toggleSection(key: string, hide: boolean) {
    setS(prev => {
      const next = new Set(prev.hiddenSections)
      if (hide) next.add(key); else next.delete(key)
      return { ...prev, hiddenSections: Array.from(next), preset: null }
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
      setPreviewKey(k => k + 1); router.refresh()
    } finally { setCoverBusy(false) }
  }
  async function removeCover() {
    setCoverBusy(true)
    try { await fetch(`/api/events/${eventId}/cover`, { method: 'DELETE' }); setPreviewKey(k => k + 1); router.refresh() }
    finally { setCoverBusy(false) }
  }

  // Speichert RSVP-Einstellungen (rsvp_settings) via Supabase.
  async function saveRsvp() {
    const supabase = createClient()
    const payload = {
      event_id: eventId,
      invitation_text: rsvp.invitation_text ?? '',
      rsvp_deadline: rsvp.rsvp_deadline ?? null,
      show_meal_choice: rsvp.show_meal_choice ?? true,
      show_plus_one: rsvp.show_plus_one ?? true,
      phone_contact: rsvp.phone_contact?.trim() || null,
    }
    if (rsvp.id) {
      await supabase.from('rsvp_settings').update(payload).eq('id', rsvp.id)
    } else {
      const { data } = await supabase.from('rsvp_settings').insert(payload).select().single()
      if (data) setRsvp(data as RsvpSettings)
    }
  }

  async function save() {
    setSaving(true); setSaved(false)
    try {
      const [dispRes] = await Promise.all([
        fetch(`/api/events/${eventId}/display-settings`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: s }),
        }),
        saveRsvp(),
      ])
      if (dispRes.ok) { setSaved(true); setPreviewKey(k => k + 1); router.refresh() }
    } finally { setSaving(false) }
  }

  async function saveAndOpen() {
    await save()
    window.open(`/rsvp/_preview?event=${eventId}`, '_blank', 'noopener')
  }

  if (loading) return <p style={{ color: 'var(--bp-ink-3)', fontSize: 14 }}>Lädt…</p>

  const fontHref = fontHrefFor(s.headingFont)
  const radius = s.cornerStyle === 'elegant' ? 4 : 14

  return (
    <div>
      {fontHref && <link rel="stylesheet" href={fontHref} />}

      {/* ── Reiter ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22, borderBottom: '1px solid var(--bp-rule)' }}>
        <TabButton active={tab === 'anzeige'} onClick={() => setTab('anzeige')} icon={<Palette size={15} />} label="Anzeige & Stil" />
        <TabButton active={tab === 'einladung'} onClick={() => setTab('einladung')} icon={<Mail size={15} />} label="Einladung & RSVP" />
      </div>

      {/* ════════════ TAB: ANZEIGE & STIL ════════════ */}
      {tab === 'anzeige' && (
        <div>
          {/* Theme-Presets */}
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

              <ToggleRow label="Akzent als Farbverlauf" checked={s.accentGradient} onChange={v => set('accentGradient', v)} />

              <Field label="Schriftart der Überschriften">
                <select className="bp-input" value={s.headingFont} onChange={e => set('headingFont', e.target.value as HeadingFontKey)}>
                  {(Object.keys(HEADING_FONTS) as HeadingFontKey[]).map(k => (
                    <option key={k} value={k}>{HEADING_FONTS[k].label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Größe der Überschriften">
                <SegmentRow value={s.headingScale} onChange={v => set('headingScale', v as DisplaySettings['headingScale'])}
                  options={[['kompakt', 'Kompakt'], ['standard', 'Standard'], ['gross', 'Groß']]} />
              </Field>

              <Field label="Schriftart des Fließtexts">
                <select className="bp-input" value={s.bodyFont} onChange={e => set('bodyFont', e.target.value as BodyFontKey)}>
                  {(Object.keys(BODY_FONTS) as BodyFontKey[]).map(k => (
                    <option key={k} value={k}>{BODY_FONTS[k].label}</option>
                  ))}
                </select>
              </Field>

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
              <Field label="Hintergrundfarbe">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {BG_COLOR_PRESETS.map(p => (
                    <button key={p.value} type="button" title={p.label} onClick={() => set('bgColor', p.value)}
                      style={{ width: 26, height: 26, borderRadius: 8, background: p.value, cursor: 'pointer',
                        border: s.bgColor.toLowerCase() === p.value.toLowerCase() ? '2px solid var(--bp-ink)' : '1px solid rgba(0,0,0,0.18)' }} />
                  ))}
                </div>
              </Field>

              <Field label="Hintergrund-Muster">
                <SegmentRow value={s.bgTexture} onChange={v => set('bgTexture', v as DisplaySettings['bgTexture'])}
                  options={(Object.keys(TEXTURE_LABEL) as DisplaySettings['bgTexture'][]).map(k => [k, TEXTURE_LABEL[k]])} />
              </Field>

              <ToggleRow label="Sanfter Farbverlauf-Hintergrund" checked={s.bgGradient} onChange={v => set('bgGradient', v)} />

              <Field label="Karten-Stil">
                <SegmentRow value={s.cardStyle} onChange={v => set('cardStyle', v as DisplaySettings['cardStyle'])}
                  options={(Object.keys(CARD_STYLE_LABEL) as DisplaySettings['cardStyle'][]).map(k => [k, CARD_STYLE_LABEL[k]])} />
              </Field>

              <Field label="Abstände (Dichte)">
                <SegmentRow value={s.density} onChange={v => set('density', v as DisplaySettings['density'])}
                  options={[['kompakt', 'Kompakt'], ['standard', 'Standard'], ['luftig', 'Luftig']]} />
              </Field>

              <Field label="Form (Ecken)">
                <SegmentRow value={s.cornerStyle} onChange={v => set('cornerStyle', v as DisplaySettings['cornerStyle'])}
                  options={[['soft', 'Verspielt'], ['elegant', 'Elegant']]} />
              </Field>

              <Field label="Button-Stil">
                <SegmentRow value={s.buttonStyle} onChange={v => set('buttonStyle', v as DisplaySettings['buttonStyle'])}
                  options={[['pill', 'Rund'], ['square', 'Eckig']]} />
              </Field>

              <Field label="Monogramm / Initialen (Wordmark)">
                <input className="bp-input" value={s.monogram} maxLength={24} placeholder="z. B. A & M"
                  onChange={e => set('monogram', e.target.value)} />
              </Field>

              <ToggleRow label="Dezente Ornamente & Trennlinien" checked={s.ornaments} onChange={v => set('ornaments', v)} />
              <ToggleRow label="Countdown zum Termin anzeigen" checked={s.countdown} onChange={v => set('countdown', v)} />
            </div>
          </div>

          {/* Titelbild */}
          <div style={{ marginTop: 22 }}>
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
            <p style={{ fontSize: 12, color: 'var(--bp-ink-3)', margin: '8px 0 0' }}>Erscheint als großflächiger Kopf der RSVP-Seite. Bildwechsel werden in der Vorschau nach „Übernehmen“ sichtbar.</p>
          </div>

          {/* Hintergrundfoto */}
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

          {/* Kompakte Live-Stil-Vorschau */}
          <div style={{ marginTop: 24 }}>
            <p className="bp-label-text" style={{ marginBottom: 8 }}>Stil-Vorschau</p>
            <CompactPreview s={s} radius={radius} />
          </div>
        </div>
      )}

      {/* ════════════ TAB: EINLADUNG & RSVP ════════════ */}
      {tab === 'einladung' && (
        <div>
          {/* Einladungs-Gestaltung */}
          <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: '0 0 4px' }}>Einladungs-Gestaltung</h4>
          <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 16px' }}>
            Begrüßung und Motiv der Einladungs-/RSVP-Seite. Leere Felder erben automatisch die Einstellungen aus „Anzeige & Stil“.
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

          {/* RSVP-Einstellungen (ehemals im Gäste-Bereich) */}
          <div style={{ marginTop: 26, paddingTop: 20, borderTop: '1px solid var(--bp-rule)' }}>
            <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: '0 0 4px' }}>RSVP-Einstellungen</h4>
            <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '0 0 16px' }}>
              Einladungstext, Frist und Formularoptionen für die Antwortseite eurer Gäste.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 620 }}>
              <Field label="Einladungstext">
                <p className="bp-caption" style={{ marginBottom: '0.5rem' }}>{'Wird als Einleitung auf der RSVP-Seite gezeigt. {{Name}} = Gastname.'}</p>
                <textarea className="bp-textarea" rows={5} value={rsvp.invitation_text ?? ''}
                  onChange={e => setRsvpField('invitation_text', e.target.value)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <Field label="RSVP-Frist">
                  <input className="bp-input" type="date" value={rsvp.rsvp_deadline ?? ''}
                    onChange={e => setRsvpField('rsvp_deadline', e.target.value || null)} />
                </Field>
                <Field label="Kontaktnummer (bei Fragen)">
                  <input className="bp-input" type="tel" value={rsvp.phone_contact ?? ''} placeholder="+49 123 456789"
                    onChange={e => setRsvpField('phone_contact', e.target.value)} />
                </Field>
              </div>
              <ToggleRow label="Menüwahl im RSVP-Formular anzeigen" checked={rsvp.show_meal_choice}
                onChange={v => setRsvpField('show_meal_choice', v)} />
              <ToggleRow label="Begleitperson-Option anzeigen" checked={rsvp.show_plus_one}
                onChange={v => setRsvpField('show_plus_one', v)} />
            </div>
          </div>

          {/* Abschnitte ein-/ausblenden */}
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
        </div>
      )}

      {/* ── Volle Live-Vorschau (nur im Reiter „Einladung & RSVP“) ── */}
      {tab === 'einladung' && (
      <div style={{ marginTop: 26, paddingTop: 20, borderTop: '1px solid var(--bp-rule)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <p className="bp-label-text" style={{ margin: 0 }}>Live-Vorschau der RSVP-Seite</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="bp-btn" onClick={() => setPreviewKey(k => k + 1)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} /> Neu laden
            </button>
            <button type="button" className="bp-btn" onClick={saveAndOpen} disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Eye size={14} /> In neuem Tab öffnen
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--bp-ink-3)', margin: '0 0 10px' }}>
          Änderungen erscheinen sofort. Nur neu hochgeladene Bilder werden erst nach „Übernehmen“ bzw. „Neu laden“ sichtbar.
        </p>
        <div style={{ border: '1px solid var(--bp-rule)', borderRadius: radius, overflow: 'hidden', background: s.bgColor }}>
          <iframe key={previewKey} ref={previewRef} src={`/rsvp/_preview?event=${eventId}`} title="RSVP-Vorschau"
            onLoad={postPreviewNow} style={{ width: '100%', height: 640, border: 'none', display: 'block' }} />
        </div>
      </div>
      )}

      {/* ── Speichern ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
        <button type="button" className="bp-btn bp-btn-primary" onClick={save} disabled={saving}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {saving ? <Loader2 size={14} className="bp-spin" /> : saved ? <Check size={14} /> : null}
          {saving ? 'Speichert…' : saved ? 'Gespeichert' : 'Übernehmen'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--bp-ink-3)' }}>Speichert Anzeige- und RSVP-Einstellungen.</span>
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

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', border: 'none', background: 'none',
      cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
      color: active ? 'var(--bp-ink)' : 'var(--bp-ink-3)',
      borderBottom: `2px solid ${active ? 'var(--bp-gold)' : 'transparent'}`, marginBottom: -1,
    }}>
      {icon} {label}
    </button>
  )
}

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

// Kompakte, sofort aktualisierende Stil-Vorschau (Farben/Schrift/Buttons/BG).
function CompactPreview({ s, radius }: { s: DisplaySettings; radius: number }) {
  const deep = shade(s.accent, -0.18)
  const pale = shade(s.accent, 0.82)
  const scale = s.headingScale === 'gross' ? 1.15 : s.headingScale === 'kompakt' ? 0.9 : 1
  const btnRadius = s.buttonStyle === 'square' ? 8 : 999
  const tex = textureStyle(s.bgTexture)
  return (
    <div style={{
      border: '1px solid var(--bp-rule)', borderRadius: radius, padding: 22, overflow: 'hidden',
      backgroundColor: s.bgColor,
      backgroundImage: s.bgGradient ? `linear-gradient(165deg, ${s.bgColor}, ${shade(s.bgColor, -0.06)})` : tex.image,
      backgroundSize: tex.size,
    }}>
      <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: deep, margin: 0 }}>
        {s.monogram || 'FOREVR'}
      </p>
      <h3 style={{ fontFamily: HEADING_FONTS[s.headingFont].family, fontSize: 2 * scale + 'rem', fontWeight: 600, margin: '6px 0 4px', color: 'var(--bp-ink)' }}>
        Anna &amp; Max
      </h3>
      <p style={{ fontSize: 13.5, fontFamily: BODY_FONTS[s.bodyFont].family, color: 'var(--bp-ink-2)', margin: '0 0 14px' }}>
        So wirken Farben, Schrift und Buttons mit diesen Einstellungen.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: '9px 18px', borderRadius: btnRadius, color: '#fff', fontSize: 13, fontWeight: 600,
          background: s.accentGradient ? `linear-gradient(135deg, ${s.accent}, ${deep})` : s.accent,
        }}>Zusagen</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: '5px 12px', borderRadius: 999, background: pale, color: deep, fontSize: 12, fontWeight: 700 }}>
          Akzent-Chip
        </span>
      </div>
    </div>
  )
}
