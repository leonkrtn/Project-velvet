'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ImagePlus, Loader2, Trash2, Sparkles, Eye, Palette, Mail, CheckCircle, XCircle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_DISPLAY_SETTINGS, HEADING_FONTS, BODY_FONTS, ACCENT_PRESETS, BG_COLOR_PRESETS, THEME_PRESETS,
  RSVP_SECTIONS, RSVP_TEXT_DEFAULTS, fontHrefFor, bodyFontHrefFor, shade, textureStyle,
  invitationFont, buildRsvpThemeCss,
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

export default function AnzeigeeinstellungenPanel({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [s, setS] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS)
  const [rsvp, setRsvp] = useState<RsvpSettings>(EMPTY_RSVP)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const coverInput = useRef<HTMLInputElement>(null)
  const bgPhotoInput = useRef<HTMLInputElement>(null)
  const [bgPhotoBusy, setBgPhotoBusy] = useState(false)
  const einladungRef = useRef<HTMLDivElement>(null)

  // Deep-Link aus dem Gäste-Bereich (#einladung) — zur Einladungs-Karte scrollen.
  useEffect(() => {
    if (loading) return
    if (typeof window !== 'undefined' && window.location.hash === '#einladung') {
      einladungRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [loading])

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
      router.refresh()
    } finally { setCoverBusy(false) }
  }
  async function removeCover() {
    setCoverBusy(true)
    try { await fetch(`/api/events/${eventId}/cover`, { method: 'DELETE' }); router.refresh() }
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
      if (dispRes.ok) { setSaved(true); router.refresh() }
    } finally { setSaving(false) }
  }

  async function saveAndOpen() {
    await save()
    window.open(`/rsvp/_preview?event=${eventId}`, '_blank', 'noopener')
  }

  if (loading) {
    return (
      <div className="bp-card" style={{ padding: '1.25rem' }}>
        <p style={{ color: 'var(--bp-ink-3)', fontSize: 14, margin: 0 }}>Lädt…</p>
      </div>
    )
  }

  const fontHref = fontHrefFor(s.headingFont)
  const radius = s.cornerStyle === 'elegant' ? 4 : 14

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {fontHref && <link rel="stylesheet" href={fontHref} />}

      {/* ════════════ KARTE 1: ANZEIGE & STIL ════════════ */}
      <div className="bp-card" style={{ overflow: 'hidden' }}>
        <div className="bp-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Palette size={18} style={{ color: 'var(--bp-gold-deep)' }} />
            <div>
              <h2 className="bp-section-title" style={{ margin: 0 }}>Anzeige &amp; Stil</h2>
              <p className="bp-caption" style={{ margin: '2px 0 0' }}>Farben, Schriften und das Erscheinungsbild eurer Seiten.</p>
            </div>
          </div>
        </div>
        <div className="bp-card-body" style={{ padding: '1.5rem' }}>
          {/* Stilpaket */}
          <SubSection title="Stilpaket" hint="Wähle einen fertigen Look — die Details darunter kannst du danach feinjustieren.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {THEME_PRESETS.map(p => (
                <button key={p.key} type="button" onClick={() => applyPreset(p.key, p.settings)}
                  style={{ ...chip, ...(s.preset === p.key ? chipActive : {}) }}>
                  <Sparkles size={13} /> {p.label}
                </button>
              ))}
            </div>
          </SubSection>

          <Divider />

          {/* Farben */}
          <SubSection title="Farben">
            <div style={twoCol}>
              <div style={col}>
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

              <div style={col}>
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
              </div>
            </div>
          </SubSection>

          <Divider />

          {/* Schrift */}
          <SubSection title="Schrift">
            <div style={twoCol}>
              <Field label="Schriftart der Überschriften">
                <select className="bp-input" value={s.headingFont} onChange={e => set('headingFont', e.target.value as HeadingFontKey)}>
                  {(Object.keys(HEADING_FONTS) as HeadingFontKey[]).map(k => (
                    <option key={k} value={k}>{HEADING_FONTS[k].label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Schriftart des Fließtexts">
                <select className="bp-input" value={s.bodyFont} onChange={e => set('bodyFont', e.target.value as BodyFontKey)}>
                  {(Object.keys(BODY_FONTS) as BodyFontKey[]).map(k => (
                    <option key={k} value={k}>{BODY_FONTS[k].label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Größe der Überschriften">
                <SegmentRow value={s.headingScale} onChange={v => set('headingScale', v as DisplaySettings['headingScale'])}
                  options={[['kompakt', 'Kompakt'], ['standard', 'Standard'], ['gross', 'Groß']]} />
              </Field>
            </div>
          </SubSection>

          <Divider />

          {/* Form & Layout */}
          <SubSection title="Form &amp; Layout">
            <div style={twoCol}>
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
            </div>
            <div style={{ marginTop: 18 }}>
              <Field label="Monogramm / Initialen (Wordmark)">
                <input className="bp-input" value={s.monogram} maxLength={24} placeholder="z. B. A & M"
                  onChange={e => set('monogram', e.target.value)} />
              </Field>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <ToggleRow label="Dezente Ornamente & Trennlinien" checked={s.ornaments} onChange={v => set('ornaments', v)} />
              <ToggleRow label="Countdown zum Termin anzeigen" checked={s.countdown} onChange={v => set('countdown', v)} />
            </div>
          </SubSection>

          <Divider />

          {/* Bilder */}
          <SubSection title="Bilder">
            <div style={twoCol}>
              <div>
                <label className="bp-label-text">Titelbild (Hero)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input ref={coverInput} type="file" accept="image/*" hidden onChange={onCover} />
                  <button type="button" className="bp-btn" disabled={coverBusy} onClick={() => coverInput.current?.click()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {coverBusy ? <Loader2 size={14} className="bp-spin" /> : <ImagePlus size={14} />} Hochladen
                  </button>
                  <button type="button" className="bp-btn" disabled={coverBusy} onClick={removeCover}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--bp-red)' }}>
                    <Trash2 size={14} /> Entfernen
                  </button>
                </div>
                <p style={{ fontSize: 12, color: 'var(--bp-ink-3)', margin: '8px 0 0' }}>
                  Großflächiger Kopf der RSVP-Seite. Sichtbar in der Vorschau nach „Übernehmen“.
                </p>
              </div>

              <div>
                <label className="bp-label-text">Hintergrundfoto (ganze Seite)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input ref={bgPhotoInput} type="file" accept="image/*" hidden onChange={onBgPhoto} />
                  <button type="button" className="bp-btn" disabled={bgPhotoBusy} onClick={() => bgPhotoInput.current?.click()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {bgPhotoBusy ? <Loader2 size={14} className="bp-spin" /> : <ImagePlus size={14} />} Hochladen
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
                    <label className="bp-label-text" style={{ marginBottom: 6 }}>Weichzeichnung: {s.bgPhotoBlur}px</label>
                    <input type="range" min={0} max={30} value={s.bgPhotoBlur} onChange={e => set('bgPhotoBlur', Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--bp-gold)' }} />
                  </div>
                )}
              </div>
            </div>
          </SubSection>

          <Divider />

          {/* Stil-Vorschau */}
          <SubSection title="Stil-Vorschau" hint="So wirken eure Einstellungen — aktualisiert sich sofort.">
            <CompactPreview s={s} radius={radius} />
          </SubSection>
        </div>
      </div>

      {/* ════════════ KARTE 2: EINLADUNG & RSVP ════════════ */}
      <div className="bp-card" id="einladung" ref={einladungRef} style={{ overflow: 'hidden', scrollMarginTop: 16 }}>
        <div className="bp-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mail size={18} style={{ color: 'var(--bp-gold-deep)' }} />
            <div>
              <h2 className="bp-section-title" style={{ margin: 0 }}>Einladung &amp; RSVP</h2>
              <p className="bp-caption" style={{ margin: '2px 0 0' }}>Texte, Motiv und Formularoptionen der Antwortseite eurer Gäste.</p>
            </div>
          </div>
        </div>
        <div className="bp-card-body" style={{ padding: '1.5rem' }}>
          {/* Einladungs-Gestaltung */}
          <SubSection title="Einladungs-Gestaltung" hint="Begrüßung und Motiv der Einladungsseite. Leere Felder erben automatisch „Anzeige & Stil“.">
            <div style={twoCol}>
              <div style={col}>
                <Field label="Begrüßung – Überschrift">
                  <input className="bp-input" value={s.invitation.greetingTitle} maxLength={120}
                    placeholder="z. B. Wir heiraten!" onChange={e => setInv('greetingTitle', e.target.value)} />
                </Field>
                <Field label="Begrüßung – Untertitel">
                  <textarea className="bp-textarea" value={s.invitation.greetingSubtitle} maxLength={240} rows={2}
                    style={{ minHeight: 64 }}
                    placeholder="z. B. Feiert mit uns den schönsten Tag unseres Lebens." onChange={e => setInv('greetingSubtitle', e.target.value)} />
                </Field>
              </div>

              <div style={col}>
                <div>
                  <label className="bp-label-text">Einladungs-Motiv (Hintergrund)</label>
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
          </SubSection>

          <Divider />

          {/* RSVP-Einstellungen */}
          <SubSection title="RSVP-Einstellungen" hint="Einladungstext, Frist und Formularoptionen für die Antwortseite.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 620 }}>
              <Field label="Einladungstext">
                <p className="bp-caption" style={{ marginBottom: '0.5rem' }}>{'Einleitung auf der RSVP-Seite. {{Name}} = Gastname.'}</p>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ToggleRow label="Menüwahl im RSVP-Formular anzeigen" checked={rsvp.show_meal_choice}
                  onChange={v => setRsvpField('show_meal_choice', v)} />
                <ToggleRow label="Begleitperson-Option anzeigen" checked={rsvp.show_plus_one}
                  onChange={v => setRsvpField('show_plus_one', v)} />
              </div>
            </div>
          </SubSection>

          <Divider />

          {/* Abschnitte ein-/ausblenden */}
          <SubSection title="Sichtbare Abschnitte" hint="Lege fest, welche Abschnitte eure Gäste auf der RSVP-Seite sehen.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {RSVP_SECTIONS.map(sec => (
                <ToggleRow key={sec.key} label={sec.label}
                  checked={!s.hiddenSections.includes(sec.key)}
                  onChange={v => toggleSection(sec.key, !v)} />
              ))}
            </div>
          </SubSection>

          <Divider />

          {/* Beispielansicht */}
          <SubSection title="Beispielansicht der RSVP-Seite"
            hint="Beispielhafte Darstellung mit euren Einstellungen — Titelbild/Motiv zeigt die echte Vorschau.">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button type="button" className="bp-btn" onClick={saveAndOpen} disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Eye size={14} /> Echte Vorschau im Tab
              </button>
            </div>
            <RsvpExamplePreview s={s} rsvp={rsvp} />
          </SubSection>
        </div>
      </div>

      {/* ── Speicher-Leiste (für beide Karten) ── */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '0.875rem 1.25rem', background: 'var(--bp-paper)',
        border: '1px solid var(--bp-rule)', borderRadius: 'var(--bp-r-md)',
        boxShadow: 'var(--bp-shadow-card)',
      }}>
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

// Zwei-Spalten-Raster (bricht auf schmalen Karten automatisch auf eine Spalte um).
const twoCol: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, alignItems: 'start',
}
const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 18 }

function SubSection({ title, hint, children }: { title: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '0.9375rem', fontWeight: 600, color: 'var(--bp-ink)', margin: 0 }}>
        {title}
      </h3>
      {hint
        ? <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '4px 0 16px' }}>{hint}</p>
        : <div style={{ height: 14 }} />}
      {children}
    </section>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--bp-rule)', margin: '24px 0' }} />
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
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', fontSize: 14, color: 'var(--bp-ink)' }}>
      {label}
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--bp-gold)', flexShrink: 0 }} />
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

// Exemplarische, sofort aktualisierende RSVP-Beispielansicht — rendert eine
// repräsentative Antwortseite (Hero, Buttons, Karte) aus den aktuellen
// Einstellungen, ganz ohne iframe/Neuladen. Nutzt dieselben Theme-Tokens
// (.rsvp-root) wie die echte RSVP-Seite.
function RsvpExamplePreview({ s, rsvp }: { s: DisplaySettings; rsvp: RsvpSettings }) {
  const effFont = invitationFont(s)
  const headingFamily = HEADING_FONTS[effFont].family
  const headingHref = fontHrefFor(effFont)
  const bodyHref = bodyFontHrefFor(s.bodyFont)
  const themeCss = buildRsvpThemeCss(s)
  const radius = s.cornerStyle === 'elegant' ? 6 : 18
  const intro = (rsvp.invitation_text?.trim() || 'Liebe/r {{Name}}, wir freuen uns auf deine Antwort.')
    .replace(/\{\{\s*Name\s*\}\}/g, 'Anna')

  return (
    <div className="rsvp-root" style={{
      maxWidth: 460, margin: '0 auto', borderRadius: radius, overflow: 'hidden',
      border: '1px solid var(--bp-rule)', background: s.bgColor,
      boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
    }}>
      <style>{themeCss}</style>
      {headingHref && <link rel="stylesheet" href={headingHref} />}
      {bodyHref && <link rel="stylesheet" href={bodyHref} />}

      {/* Hero */}
      <div style={{
        padding: '34px 22px 26px', textAlign: 'center',
        backgroundImage: 'linear-gradient(160deg, var(--gold-pale), transparent 72%)',
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--gold)', margin: '0 0 10px' }}>
          {RSVP_TEXT_DEFAULTS.introEyebrow}
        </p>
        <h1 style={{ fontFamily: headingFamily, fontSize: 'clamp(26px, 7vw, 38px)', fontWeight: 500, color: 'var(--text)', lineHeight: 1.12, margin: '0 0 8px' }}>
          Anna &amp; Max
        </h1>
        {s.ornaments && (
          <div aria-hidden style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '14px 0', opacity: 0.75 }}>
            <span style={{ height: 1, width: 40, background: 'linear-gradient(to right, transparent, var(--gold))' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)' }} />
            <span style={{ height: 1, width: 40, background: 'linear-gradient(to left, transparent, var(--gold))' }} />
          </div>
        )}
        <p style={{ fontFamily: headingFamily, fontSize: 15, fontStyle: 'italic', color: 'var(--text-light)', maxWidth: 380, margin: '8px auto 0', lineHeight: 1.5 }}>
          {intro}
        </p>
        {s.countdown && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 18 }}>
            {[['120', 'Tage'], ['06', 'Std'], ['30', 'Min']].map(([v, l]) => (
              <div key={l} style={{ minWidth: 50, padding: '8px 6px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: headingFamily, fontSize: 20, fontWeight: 600, color: 'var(--gold)', lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Body: Antwort-Buttons + Detailkarte + Primär-Button */}
      <div style={{ padding: '16px 18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { sel: true, icon: <CheckCircle size={18} color="var(--gold)" />, t: 'Ja, ich bin dabei!', sub: 'Ich freue mich auf diesen besonderen Tag.' },
          { sel: false, icon: <XCircle size={18} color="var(--text-dim)" />, t: 'Leider nicht', sub: 'Ich kann leider nicht teilnehmen.' },
        ].map((o, i) => (
          <div key={i} style={{
            padding: '14px 16px', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12,
            border: `1.5px solid ${o.sel ? 'var(--gold)' : 'var(--border)'}`,
            background: o.sel ? 'var(--gold-pale)' : 'var(--surface)',
            boxShadow: 'var(--ui-card-shadow, none)',
          }}>
            {o.icon}
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: o.sel ? 'var(--gold)' : 'var(--text)' }}>{o.t}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{o.sub}</div>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 4, padding: 'var(--ui-card-pad, 16px)', borderRadius: 'var(--r-md)', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--ui-card-shadow, none)' }}>
          {[
            { icon: <Clock size={13} color="var(--gold)" />, label: 'Datum', value: 'Samstag, 12. Juli 2026' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ marginTop: 1 }}>{row.icon}</span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)' }}>{row.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-mid)' }}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>

        <button type="button" disabled style={{
          marginTop: 4, padding: '13px', borderRadius: 'var(--ui-btn-radius, 999px)', border: 'none', cursor: 'default',
          color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
          background: s.accentGradient ? `linear-gradient(135deg, var(--gold), var(--gold-deep))` : 'var(--gold)',
        }}>
          Jetzt antworten
        </button>
      </div>
    </div>
  )
}
