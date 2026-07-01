'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  X, Search, Undo2, Redo2, Check, Loader2, Monitor, Smartphone, Sparkles, Palette, Type,
  LayoutGrid, Image as ImageIcon, Mail, ClipboardList, Eye, Code, RotateCcw, Copy, ClipboardPaste, Wand2,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_DISPLAY_SETTINGS, HEADING_FONTS, BODY_FONTS, ACCENT_PRESETS, BG_COLOR_PRESETS, THEME_PRESETS,
  RSVP_SECTIONS, fontHrefFor, shade, effectiveAccent2, normalizeSettings, resolveRsvpSettings, DEFAULT_FOCUS,
  type DisplaySettings, type HeadingFontKey, type BodyFontKey,
} from '@/lib/display-settings'
import {
  FONT_PAIRINGS, generateHarmonies, encodeStyleCode, decodeStyleCode, resetSectionPatch,
} from '@/lib/display-studio'
import { Help, Row, Stack, Toggle, Segment, Swatches, Slider, GroupTitle, Hr, chip, chipActive } from './ui'
import ImagePositioner from './ImagePositioner'
import DisplayPreview, { type PreviewImages } from './DisplayPreview'
import AppMenuPreview from './AppMenuPreview'

interface RsvpSettings {
  id?: string
  invitation_text: string
  rsvp_deadline: string | null
  show_meal_choice: boolean
  show_plus_one: boolean
  phone_contact: string | null
}
const EMPTY_RSVP: RsvpSettings = { invitation_text: '', rsvp_deadline: null, show_meal_choice: true, show_plus_one: true, phone_contact: null }

// Stil-Felder, die App und RSVP-Seite gemeinsam kennen (RSVP als Overrides).
type StyleKey =
  | 'accent' | 'accent2' | 'accentGradient' | 'headingFont' | 'bodyFont' | 'headingScale'
  | 'bgColor' | 'bgTexture' | 'bgGradient' | 'cornerStyle' | 'buttonStyle' | 'cardStyle'
  | 'density' | 'ornaments' | 'countdown' | 'monogram'
type StylePatch = Partial<Pick<DisplaySettings, StyleKey>>

// Adapter, damit dieselben Stil-Panes sowohl die App (global) als auch die
// RSVP-Seite (invitation-Overrides) bearbeiten können.
interface StyleCtl {
  v: DisplaySettings                                            // effektive Werte zum Anzeigen
  set: (patch: StylePatch, ck?: string) => void
  applyPreset: (key: string, partial: Partial<DisplaySettings>) => void
  preset: string | null
}

type Doc = { s: DisplaySettings; rsvp: RsvpSettings }
type SectionKey =
  | 'app-stil' | 'app-farben' | 'app-schrift' | 'app-layout'
  | 'rsvp-design' | 'rsvp-stil' | 'rsvp-farben' | 'rsvp-schrift' | 'rsvp-layout'
  | 'einladung' | 'bilder' | 'rsvp-formular' | 'abschnitte'
  | 'code'
type GroupKey = 'anzeige' | 'rsvp' | 'allgemein'

// Strikte Trennung: „Anzeige" (Optik der Seite) vs. „RSVP" (Antwort-Formular).
// RSVP-/Einladungsseite wird jetzt vollständig über die Hochzeitswebsite
// (/brautpaar/[eventId]/website) konfiguriert — daher hier nur noch App-Anzeige + Allgemein.
const GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'anzeige',   label: 'Anzeige · Menü' },
  { key: 'allgemein', label: 'Allgemein' },
]

// rsvpDesign: true = nur sichtbar, wenn eigenes RSVP-Design aktiv ist.
const SECTIONS: { key: SectionKey; label: string; icon: LucideIcon; group: GroupKey; rsvpDesign?: boolean; kw: string[] }[] = [
  // Anzeige (App / Portal-Menü).
  { key: 'app-stil',     label: 'Stilpakete',           icon: Sparkles,      group: 'anzeige',   kw: ['preset', 'stil', 'vorlage', 'theme', 'look'] },
  { key: 'app-farben',   label: 'Farben',               icon: Palette,       group: 'anzeige',   kw: ['farbe', 'akzent', 'hintergrund', 'muster', 'verlauf', 'harmonie'] },
  { key: 'app-schrift',  label: 'Schrift',              icon: Type,          group: 'anzeige',   kw: ['schrift', 'font', 'überschrift', 'größe'] },
  { key: 'app-layout',   label: 'Form & Ecken',         icon: LayoutGrid,    group: 'anzeige',   kw: ['form', 'ecken', 'rundung', 'button'] },
  // RSVP (Einladungs-/Antwortseite der Gäste).
  { key: 'rsvp-design',  label: 'Design',               icon: Wand2,         group: 'rsvp',      kw: ['design', 'eigenes', 'unabhängig', 'übernehmen'] },
  { key: 'rsvp-stil',    label: 'Stilpakete',           icon: Sparkles,      group: 'rsvp', rsvpDesign: true, kw: ['preset', 'stil', 'vorlage', 'theme'] },
  { key: 'rsvp-farben',  label: 'Farben',               icon: Palette,       group: 'rsvp', rsvpDesign: true, kw: ['farbe', 'akzent', 'hintergrund', 'muster', 'verlauf', 'harmonie'] },
  { key: 'rsvp-schrift', label: 'Schrift',              icon: Type,          group: 'rsvp', rsvpDesign: true, kw: ['schrift', 'font', 'überschrift', 'fließtext', 'größe', 'paarung'] },
  { key: 'rsvp-layout',  label: 'Layout & Form',        icon: LayoutGrid,    group: 'rsvp', rsvpDesign: true, kw: ['layout', 'karte', 'ecken', 'button', 'dichte', 'ornament', 'countdown', 'monogramm'] },
  { key: 'einladung',    label: 'Einladung',            icon: Mail,          group: 'rsvp',      kw: ['einladung', 'begrüßung', 'motiv'] },
  { key: 'bilder',       label: 'Bilder',               icon: ImageIcon,     group: 'rsvp',      kw: ['bild', 'titelbild', 'hintergrundfoto', 'foto', 'cover', 'zuschnitt', 'overlay', 'tönung', 'weichzeichnen', 'blur'] },
  { key: 'rsvp-formular',label: 'RSVP-Formular',        icon: ClipboardList, group: 'rsvp',      kw: ['rsvp', 'antwort', 'frist', 'menü', 'begleit', 'kontakt', 'telefon', 'einladungstext'] },
  { key: 'abschnitte',   label: 'Sichtbare Abschnitte', icon: Eye,           group: 'rsvp',      kw: ['abschnitt', 'sichtbar', 'ausblenden', 'dresscode', 'kinder', 'allergie', 'anreise', 'nachricht'] },
  // Allgemein.
  { key: 'code',         label: 'Sichern & Code',       icon: Code,          group: 'allgemein', kw: ['code', 'export', 'import', 'sichern', 'zurücksetzen', 'reset', 'standard'] },
]

export default function DesignStudioModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const router = useRouter()
  const [hist, setHist] = useState<{ past: Doc[]; present: Doc; future: Doc[] }>(
    { past: [], present: { s: DEFAULT_DISPLAY_SETTINGS, rsvp: EMPTY_RSVP }, future: [] })
  const baselineRef = useRef<string>('')
  const coalesce = useRef<{ key: string; t: number } | null>(null)
  const doc = hist.present
  const { s, rsvp } = doc

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [active, setActive] = useState<SectionKey>('app-stil')
  const [query, setQuery] = useState('')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('mobile')
  const [confirmClose, setConfirmClose] = useState(false)

  const [images, setImages] = useState<PreviewImages>({ coverUrl: null, bgPhotoUrl: null, motiveUrl: null })
  const [event, setEvent] = useState<{ coupleName: string; date: string | null }>({ coupleName: 'Anna & Max', date: null })
  const [busy, setBusy] = useState<{ cover?: boolean; bg?: boolean; motive?: boolean }>({})

  const dirty = useMemo(() => JSON.stringify(doc) !== baselineRef.current, [doc])

  // ── Laden ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    Promise.all([
      fetch(`/api/events/${eventId}/display-settings`).then(r => r.json()).catch(() => null),
      supabase.from('rsvp_settings').select('*').eq('event_id', eventId).maybeSingle(),
      fetch(`/api/rsvp/preview/${eventId}`).then(r => r.json()).catch(() => null),
    ]).then(([dj, rs, pv]) => {
      if (cancelled) return
      const loadedS = dj?.settings ? normalizeSettings(dj.settings) : DEFAULT_DISPLAY_SETTINGS
      const loadedRsvp = (rs?.data as RsvpSettings) ?? EMPTY_RSVP
      const next: Doc = { s: loadedS, rsvp: loadedRsvp }
      baselineRef.current = JSON.stringify(next)
      setHist({ past: [], present: next, future: [] })
      if (pv) {
        setImages({ coverUrl: pv.coverUrl ?? null, bgPhotoUrl: pv.bgPhotoUrl ?? null, motiveUrl: pv.motiveUrl ?? null })
        if (pv.event?.coupleName) setEvent({ coupleName: pv.event.coupleName, date: pv.event.date ?? null })
      }
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [eventId])

  // Body-Scroll sperren während offen.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // ── History + Mutationen ─────────────────────────────────────────────────────
  const commit = useCallback((next: Doc, coalesceKey?: string) => {
    setSaved(false)
    if (coalesceKey && coalesce.current && coalesce.current.key === coalesceKey && Date.now() - coalesce.current.t < 600) {
      coalesce.current.t = Date.now()
      setHist(h => ({ ...h, present: next }))
    } else {
      if (coalesceKey) coalesce.current = { key: coalesceKey, t: Date.now() }
      else coalesce.current = null
      setHist(h => ({ past: [...h.past, h.present].slice(-60), present: next, future: [] }))
    }
  }, [])

  const setS = useCallback((patch: Partial<DisplaySettings>, coalesceKey?: string) =>
    commit({ s: { ...doc.s, ...patch, preset: null }, rsvp: doc.rsvp }, coalesceKey), [doc, commit])
  // RSVP-Inhalte (Begrüßung, Motiv, customDesign-Snapshot) — ohne Preset-Reset.
  const setInvContent = useCallback((patch: Partial<DisplaySettings['invitation']>, coalesceKey?: string) =>
    commit({ s: { ...doc.s, invitation: { ...doc.s.invitation, ...patch } }, rsvp: doc.rsvp }, coalesceKey), [doc, commit])
  // RSVP-Stil-Overrides — setzt invitation.preset zurück (manuelle Änderung).
  const setInvStyle = useCallback((patch: Partial<DisplaySettings['invitation']>, coalesceKey?: string) =>
    commit({ s: { ...doc.s, invitation: { ...doc.s.invitation, ...patch, preset: null } }, rsvp: doc.rsvp }, coalesceKey), [doc, commit])
  const applyInvPreset = useCallback((key: string, partial: Partial<DisplaySettings>) =>
    commit({ s: { ...doc.s, invitation: { ...doc.s.invitation, ...partial, preset: key } }, rsvp: doc.rsvp }), [doc, commit])
  const setRsvp = useCallback((patch: Partial<RsvpSettings>, coalesceKey?: string) =>
    commit({ s: doc.s, rsvp: { ...doc.rsvp, ...patch } }, coalesceKey), [doc, commit])
  const applyPreset = useCallback((key: string, partial: Partial<DisplaySettings>) =>
    commit({ s: { ...doc.s, ...partial, preset: key }, rsvp: doc.rsvp }), [doc, commit])
  const replaceSettings = useCallback((next: DisplaySettings) =>
    commit({ s: next, rsvp: doc.rsvp }), [doc, commit])

  // Master-Schalter „Eigenes Design für die RSVP-Seite". An → Snapshot der
  // App-Stilwerte in die invitation-Overrides; Aus → Overrides bleiben inaktiv.
  const setCustomDesign = useCallback((on: boolean) => {
    if (on) {
      const g = doc.s
      setInvContent({
        customDesign: true,
        accent: g.accent, accent2: g.accent2, accentGradient: g.accentGradient,
        headingFont: g.headingFont, bodyFont: g.bodyFont, headingScale: g.headingScale,
        bgColor: g.bgColor, bgTexture: g.bgTexture, bgGradient: g.bgGradient,
        cornerStyle: g.cornerStyle, buttonStyle: g.buttonStyle, cardStyle: g.cardStyle,
        density: g.density, ornaments: g.ornaments, countdown: g.countdown, monogram: g.monogram, preset: g.preset,
      })
    } else {
      setInvContent({ customDesign: false })
    }
  }, [doc, setInvContent])

  const undo = () => { coalesce.current = null; setHist(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h); setSaved(false) }
  const redo = () => { coalesce.current = null; setHist(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h); setSaved(false) }

  function toggleSection(key: string, hide: boolean) {
    const next = new Set(doc.s.hiddenSections)
    if (hide) next.add(key); else next.delete(key)
    setS({ hiddenSections: Array.from(next) })
  }

  // ── Bild-Upload/Entfernen ────────────────────────────────────────────────────
  async function uploadTo(path: string, file: File): Promise<string | null> {
    const reqRes = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type }) })
    const { uploadUrl, key } = await reqRes.json()
    if (!uploadUrl) return null
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    return (key as string) ?? null
  }
  async function pickCover(file: File) {
    setBusy(b => ({ ...b, cover: true }))
    const blob = URL.createObjectURL(file)
    setImages(im => ({ ...im, coverUrl: blob }))
    try {
      const key = await uploadTo(`/api/events/${eventId}/cover`, file)
      if (key) await fetch(`/api/events/${eventId}/cover`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cover_image_r2_key: key }) })
    } finally { setBusy(b => ({ ...b, cover: false })) }
  }
  async function removeCover() {
    setBusy(b => ({ ...b, cover: true }))
    try { await fetch(`/api/events/${eventId}/cover`, { method: 'DELETE' }); setImages(im => ({ ...im, coverUrl: null })) }
    finally { setBusy(b => ({ ...b, cover: false })) }
  }
  async function pickBg(file: File) {
    setBusy(b => ({ ...b, bg: true }))
    const blob = URL.createObjectURL(file)
    setImages(im => ({ ...im, bgPhotoUrl: blob }))
    try { const key = await uploadTo(`/api/events/${eventId}/bg-photo`, file); if (key) setS({ bgPhotoR2Key: key }) }
    finally { setBusy(b => ({ ...b, bg: false })) }
  }
  async function removeBg() {
    setBusy(b => ({ ...b, bg: true }))
    try { await fetch(`/api/events/${eventId}/bg-photo`, { method: 'DELETE' }); setS({ bgPhotoR2Key: null }); setImages(im => ({ ...im, bgPhotoUrl: null })) }
    finally { setBusy(b => ({ ...b, bg: false })) }
  }
  async function pickMotive(file: File) {
    setBusy(b => ({ ...b, motive: true }))
    const blob = URL.createObjectURL(file)
    setImages(im => ({ ...im, motiveUrl: blob }))
    try { const key = await uploadTo(`/api/events/${eventId}/invitation-motive`, file); if (key) setInvContent({ motiveR2Key: key }) }
    finally { setBusy(b => ({ ...b, motive: false })) }
  }
  async function removeMotive() {
    setBusy(b => ({ ...b, motive: true }))
    try { await fetch(`/api/events/${eventId}/invitation-motive`, { method: 'DELETE' }); setInvContent({ motiveR2Key: null }); setImages(im => ({ ...im, motiveUrl: null })) }
    finally { setBusy(b => ({ ...b, motive: false })) }
  }

  // ── Speichern ────────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true); setSaved(false)
    try {
      // RSVP-Einstellungen werden im Hochzeitswebsite-Editor gespeichert; hier nur App-Anzeige.
      const dispRes = await fetch(`/api/events/${eventId}/display-settings`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: s }),
      })
      if (dispRes.ok) {
        const next: Doc = { s, rsvp }
        baselineRef.current = JSON.stringify(next)
        setHist(h => ({ ...h, present: next }))
        setSaved(true)
        router.refresh()
      }
    } finally { setSaving(false) }
  }

  function requestClose() { if (dirty) setConfirmClose(true); else onClose() }

  // Esc schließt (mit Schutz).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); requestClose() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const q = query.trim().toLowerCase()
  // RSVP-Bereiche sind in die Hochzeitswebsite umgezogen → hier ausblenden.
  const availableSections = SECTIONS.filter(sec => sec.group !== 'rsvp')
  const visibleSections = q
    ? availableSections.filter(sec => sec.label.toLowerCase().includes(q) || sec.kw.some(k => k.includes(q)))
    : availableSections

  const dateLabel = event.date
    ? new Date(event.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : 'Samstag, 12. Juli 2026'

  const fontHref = fontHrefFor(s.headingFont)

  // Vorschau-Modus automatisch nach Bereich: RSVP-Bereiche → RSVP-Seite,
  // sonst Portal-Menü („Anzeige").
  const activeGroup = SECTIONS.find(sec => sec.key === active)?.group ?? 'anzeige'
  const previewMode: 'rsvp' | 'anzeige' = activeGroup === 'rsvp' ? 'rsvp' : 'anzeige'

  // Stil-Adapter für App (global) und RSVP-Seite (invitation-Overrides).
  const appCtl: StyleCtl = { v: s, set: setS, applyPreset, preset: s.preset }
  const rsvpCtl: StyleCtl = { v: resolveRsvpSettings(s), set: setInvStyle, applyPreset: applyInvPreset, preset: s.invitation.preset }

  const overlay = (
    <div role="dialog" aria-modal="true" aria-label="Anzeige & RSVP gestalten"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(30,28,26,0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5vh 2vw' }}
      onMouseDown={e => { if (e.target === e.currentTarget) requestClose() }}>
      {fontHref && <link rel="stylesheet" href={fontHref} />}
      <style>{`
        @media (max-width: 900px) {
          .ds-dialog { height: 100dvh !important; width: 100% !important; border-radius: 0 !important; }
          .ds-header { flex-wrap: wrap; row-gap: 8px; }
          .ds-title { flex: 1 1 auto; min-width: 0; font-size: 1.05rem !important; overflow: hidden; text-overflow: ellipsis; }
          .ds-search { order: 3; flex: 1 1 100% !important; max-width: none !important; }
          .ds-header-actions { order: 4; flex: 1 1 100% !important; margin-left: 0 !important; justify-content: space-between !important; }
          .ds-close { order: 2; }
          .ds-main { flex-direction: column !important; overflow-y: auto; }
          .ds-sidebar { width: 100% !important; display: flex !important; flex-direction: row !important; overflow-x: auto; overflow-y: hidden;
            border-right: none !important; border-bottom: 1px solid var(--bp-rule); padding: 8px !important; gap: 6px; }
          .ds-sidebar > div { margin-bottom: 0 !important; display: flex; gap: 4px; flex-shrink: 0; }
          .ds-grouplabel { display: none !important; }
          .ds-sidebar button { white-space: nowrap; margin-bottom: 0 !important; }
          .ds-content { padding: 16px !important; }
          .ds-preview { width: 100% !important; border-left: none !important;
            border-top: 1px solid var(--bp-rule); max-height: 65vh; }
        }
      `}</style>
      <div className="ds-dialog" style={{ width: 'min(1280px, 100%)', height: '95vh', background: 'var(--bp-paper)', borderRadius: 16,
        boxShadow: '0 30px 80px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* ── Kopfleiste ── */}
        <header className="ds-header" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--bp-rule)', flexShrink: 0 }}>
          <h2 className="ds-title" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.4rem', fontWeight: 600, letterSpacing: '0.04em', margin: 0, color: 'var(--bp-ink)', whiteSpace: 'nowrap' }}>
            Anzeige &amp; RSVP gestalten
          </h2>
          <div className="ds-search" style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--bp-ink-3)' }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Einstellung suchen …"
              style={{ width: '100%', height: 36, padding: '0 10px 0 32px', borderRadius: 9, border: '1px solid var(--bp-rule)', background: 'var(--bp-ivory-2)', fontSize: 13, color: 'var(--bp-ink)', outline: 'none' }} />
          </div>
          <div className="ds-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconBtn title="Rückgängig (Strg+Z)" onClick={undo} disabled={!hist.past.length}><Undo2 size={16} /></IconBtn>
              <IconBtn title="Wiederholen (Strg+Y)" onClick={redo} disabled={!hist.future.length}><Redo2 size={16} /></IconBtn>
            </div>
            <span style={{ fontSize: 12, color: dirty ? 'var(--bp-gold-deep)' : 'var(--bp-ink-3)', minWidth: 96, whiteSpace: 'nowrap', textAlign: 'right' }}>
              {saving ? 'Speichert…' : saved ? 'Gespeichert' : dirty ? 'Nicht gespeichert' : 'Aktuell'}
            </span>
            <button type="button" className="bp-btn bp-btn-primary bp-btn-sm" onClick={save} disabled={saving || !dirty}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              {saving ? <Loader2 size={14} className="bp-spin" /> : saved ? <Check size={14} /> : null}
              Übernehmen
            </button>
          </div>
          <IconBtn className="ds-close" title="Schließen" onClick={requestClose}><X size={18} /></IconBtn>
        </header>

        {/* ── Hauptbereich: Sidebar | Inhalt | Vorschau ── */}
        <div className="ds-main" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Sidebar */}
          <nav className="ds-sidebar" style={{ width: 224, flexShrink: 0, borderRight: '1px solid var(--bp-rule)', padding: 10, overflowY: 'auto', background: 'var(--bp-ivory-2)' }}>
            {GROUPS.map(group => {
              const items = visibleSections.filter(sec => sec.group === group.key)
              if (!items.length) return null
              return (
                <div key={group.key} style={{ marginBottom: 12 }}>
                  <p className="ds-grouplabel" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--bp-ink-3)', margin: '4px 11px 6px' }}>
                    {group.label}
                  </p>
                  {items.map(sec => {
                    const Icon = sec.icon
                    const on = active === sec.key
                    return (
                      <button key={sec.key} type="button" onClick={() => setActive(sec.key)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 11px', marginBottom: 3,
                          borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 600 : 500,
                          color: on ? 'var(--bp-ink)' : 'var(--bp-ink-2)', background: on ? 'var(--bp-paper)' : 'transparent',
                          boxShadow: on ? 'var(--bp-shadow-card)' : 'none' }}>
                        <Icon size={16} /> {sec.label}
                      </button>
                    )
                  })}
                </div>
              )
            })}
            {!visibleSections.length && <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', padding: '8px 11px' }}>Keine Treffer.</p>}
          </nav>

          {/* Inhalt */}
          <div className="ds-content" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px 28px' }}>
            {loading
              ? <p style={{ color: 'var(--bp-ink-3)', fontSize: 14 }}>Lädt…</p>
              : (
                <div style={{ maxWidth: 640 }}>
                  {/* Anzeige (App) */}
                  {active === 'app-stil' && <PaneStilpakete ctl={appCtl} scope="app" />}
                  {active === 'app-farben' && <PaneFarben ctl={appCtl} full={false} />}
                  {active === 'app-schrift' && <PaneSchrift ctl={appCtl} full={false} />}
                  {active === 'app-layout' && <PaneLayout ctl={appCtl} full={false} />}
                  {/* RSVP */}
                  {active === 'rsvp-design' && <PaneRsvpDesign s={s} setCustomDesign={setCustomDesign} />}
                  {active === 'rsvp-stil' && <PaneStilpakete ctl={rsvpCtl} scope="rsvp" />}
                  {active === 'rsvp-farben' && <PaneFarben ctl={rsvpCtl} full />}
                  {active === 'rsvp-schrift' && <PaneSchrift ctl={rsvpCtl} full />}
                  {active === 'rsvp-layout' && <PaneLayout ctl={rsvpCtl} full />}
                  {active === 'einladung' && <PaneEinladung s={s} setInv={setInvContent} images={images} busy={busy} pickMotive={pickMotive} removeMotive={removeMotive} />}
                  {active === 'bilder' && <PaneBilder s={s} setS={setS} images={images} busy={busy}
                    pickCover={pickCover} removeCover={removeCover} pickBg={pickBg} removeBg={removeBg} />}
                  {active === 'rsvp-formular' && <PaneRsvp rsvp={rsvp} setRsvp={setRsvp} />}
                  {active === 'abschnitte' && <PaneAbschnitte s={s} toggleSection={toggleSection} />}
                  {active === 'code' && <PaneCode s={s} replaceSettings={replaceSettings} />}
                </div>
              )}
          </div>

          {/* Vorschau */}
          <aside className="ds-preview" style={{ width: 470, flexShrink: 0, borderLeft: '1px solid var(--bp-rule)', display: 'flex', flexDirection: 'column', background: 'var(--bp-ivory-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--bp-rule)' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--bp-ink-2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Eye size={14} /> Vorschau · {previewMode === 'rsvp' ? 'RSVP' : 'Menü'}
              </span>
              <div style={{ display: 'inline-flex', gap: 4 }}>
                <button type="button" onClick={() => setDevice('desktop')} title="Desktop"
                  style={{ ...chip, padding: 7, ...(device === 'desktop' ? chipActive : {}) }}><Monitor size={15} /></button>
                <button type="button" onClick={() => setDevice('mobile')} title="Mobil"
                  style={{ ...chip, padding: 7, ...(device === 'mobile' ? chipActive : {}) }}><Smartphone size={15} /></button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
              {!loading && (previewMode === 'rsvp'
                ? <DisplayPreview s={s} rsvp={rsvp} images={images} device={device} coupleName={event.coupleName || 'Anna & Max'} dateLabel={dateLabel} />
                : <AppMenuPreview s={s} device={device} coupleName={event.coupleName || 'Anna & Max'} />)}
            </div>
          </aside>
        </div>
      </div>

      {/* Schließen-Bestätigung */}
      {confirmClose && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setConfirmClose(false) }}>
          <div style={{ background: 'var(--bp-paper)', borderRadius: 14, padding: 24, width: 'min(420px, 92vw)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 600, color: 'var(--bp-ink)' }}>Ungespeicherte Änderungen</h3>
            <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--bp-ink-2)', lineHeight: 1.5 }}>
              Du hast Änderungen, die noch nicht übernommen wurden. Möchtest du sie speichern?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="bp-btn bp-btn-sm" onClick={() => onClose()} style={{ color: 'var(--bp-red)' }}>Verwerfen</button>
              <button type="button" className="bp-btn bp-btn-sm" onClick={() => setConfirmClose(false)}>Abbrechen</button>
              <button type="button" className="bp-btn bp-btn-primary bp-btn-sm" disabled={saving}
                onClick={async () => { await save(); onClose() }}>
                {saving ? <Loader2 size={14} className="bp-spin" /> : null} Speichern &amp; schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(overlay, document.body)
}

// ── Kopf-Icon-Button ────────────────────────────────────────────────────────────
function IconBtn({ children, onClick, title, disabled, className }: { children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean; className?: string }) {
  return (
    <button type="button" className={className} title={title} onClick={onClick} disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9,
        border: '1px solid var(--bp-rule)', background: '#fff', cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--bp-ink-3)' : 'var(--bp-ink-2)', opacity: disabled ? 0.5 : 1, flexShrink: 0 }}>
      {children}
    </button>
  )
}

// ════════════════════════════ PANES ════════════════════════════

function PaneStilpakete({ ctl, scope }: { ctl: StyleCtl; scope: 'app' | 'rsvp' }) {
  return (
    <div>
      <GroupTitle title="Stilpakete"
        hint={scope === 'app'
          ? 'Fertiger Look für die App (Farben, Schriften, Form) – in einem Klick gesetzt.'
          : 'Fertiger Look nur für die RSVP-Seite. Überschreibt deren Farben, Schriften und Form.'} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
        {THEME_PRESETS.map(p => {
          const merged = normalizeSettings({ ...ctl.v, ...p.settings })
          const on = ctl.preset === p.key
          return (
            <button key={p.key} type="button" onClick={() => ctl.applyPreset(p.key, p.settings)}
              style={{ textAlign: 'left', border: on ? '2px solid var(--bp-gold-deep)' : '1px solid var(--bp-rule)', borderRadius: 12,
                overflow: 'hidden', cursor: 'pointer', background: '#fff', padding: 0, boxShadow: on ? '0 4px 14px rgba(156,127,79,0.18)' : 'var(--bp-shadow-card)' }}>
              <PresetThumb s={merged} />
              <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--bp-ink)' }}>{p.label}</span>
                {on && <Check size={14} style={{ color: 'var(--bp-gold-deep)' }} />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Mini-Vorschau-Kachel eines Presets.
function PresetThumb({ s }: { s: DisplaySettings }) {
  const headingFamily = HEADING_FONTS[s.headingFont].family
  const acc2 = effectiveAccent2(s)
  return (
    <div style={{ height: 92, background: s.bgColor, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10 }}>
      <div style={{ fontFamily: headingFamily, fontSize: 19, fontWeight: 600, color: shade(s.accent, -0.15), lineHeight: 1 }}>Anna &amp; Max</div>
      <div style={{ display: 'flex', gap: 5 }}>
        <span style={{ width: 30, height: 9, borderRadius: s.buttonStyle === 'square' ? 2 : 999, background: s.accentGradient ? `linear-gradient(135deg, ${s.accent}, ${shade(s.accent, -0.2)})` : s.accent }} />
        <span style={{ width: 14, height: 9, borderRadius: 999, background: acc2 }} />
      </div>
    </div>
  )
}

function PaneFarben({ ctl, full }: { ctl: StyleCtl; full: boolean }) {
  const v = ctl.v
  const [showHarmony, setShowHarmony] = useState(false)
  const harmonies = useMemo(() => generateHarmonies(v.accent), [v.accent])
  return (
    <div>
      <GroupTitle title="Farben" hint="Akzentfarbe und Hintergrund. Der Harmonie-Generator schlägt passende Kombinationen aus deiner Akzentfarbe vor." />

      <Stack label="Akzentfarbe" help="Hauptfarbe für Buttons, Akzente und aktive Elemente.">
        <Swatches value={v.accent} presets={ACCENT_PRESETS} onChange={c => ctl.set({ accent: c }, 'accent')} />
      </Stack>

      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={() => setShowHarmony(x => !x)}
          style={{ ...chip, gap: 6 }}><Wand2 size={14} /> {showHarmony ? 'Harmonien ausblenden' : 'Passende Harmonien vorschlagen'}</button>
        {showHarmony && (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {harmonies.map((h, i) => (
              <button key={h.key} type="button" onClick={() => ctl.set({ accent: h.accent, accent2: h.accent2, bgColor: h.bgColor })}
                style={{ border: '1px solid var(--bp-rule)', borderRadius: 10, padding: 10, background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {h.swatches.map((c, j) => <span key={j} style={{ flex: 1, height: 22, borderRadius: 5, background: c, border: '1px solid rgba(0,0,0,0.08)' }} />)}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--bp-ink-2)' }}>{h.label}{i === 0 ? ' · empfohlen' : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Hr />
      <Row label="Akzent als Farbverlauf" help="Buttons erhalten statt einer Vollfarbe einen sanften Verlauf.">
        <Toggle checked={v.accentGradient} onChange={b => ctl.set({ accentGradient: b })} />
      </Row>
      {full && (
        <>
          <Hr />
          <Stack label="Zweite Akzentfarbe" help="Für Badges, Links und feine Details.">
            <Swatches value={v.accent2 ?? effectiveAccent2(v)} presets={ACCENT_PRESETS} onChange={c => ctl.set({ accent2: c }, 'accent2')} />
          </Stack>
        </>
      )}
      <Hr />
      <Stack label="Hintergrundfarbe" help="Grundfläche. Nur sehr helle Töne, damit Text gut lesbar bleibt.">
        <Swatches value={v.bgColor} presets={BG_COLOR_PRESETS} onChange={c => ctl.set({ bgColor: c }, 'bg')} allowCustom={false} />
      </Stack>
      <Hr />
      <Row label="Hintergrund-Muster" help="Dezente Textur über der Hintergrundfarbe.">
        <Segment value={v.bgTexture} onChange={t => ctl.set({ bgTexture: t })}
          options={[['none', 'Keine'], ['paper', 'Papier'], ['dots', 'Punkte'], ['floral', 'Floral'], ['marble', 'Marmor'], ['linen', 'Leinen'], ['watercolor', 'Aquarell']]} />
      </Row>
      {full && (
        <>
          <Hr />
          <Row label="Sanfter Farbverlauf-Hintergrund" help="Legt einen weichen Verlauf über die Hintergrundfarbe.">
            <Toggle checked={v.bgGradient} onChange={b => ctl.set({ bgGradient: b })} />
          </Row>
        </>
      )}
    </div>
  )
}

function PaneSchrift({ ctl, full }: { ctl: StyleCtl; full: boolean }) {
  const v = ctl.v
  return (
    <div>
      <GroupTitle title="Schrift" hint="Überschriften-Schrift und -Größe." />

      {full && (
        <>
          <Stack label="Schrift-Paarungen" help="Kuratierte Kombinationen aus Überschrift + Fließtext.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
              {FONT_PAIRINGS.map(fp => {
                const on = v.headingFont === fp.heading && v.bodyFont === fp.body
                return (
                  <button key={fp.key} type="button" onClick={() => ctl.set({ headingFont: fp.heading, bodyFont: fp.body })}
                    style={{ border: on ? '2px solid var(--bp-gold-deep)' : '1px solid var(--bp-rule)', borderRadius: 10, padding: '10px 12px', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontFamily: HEADING_FONTS[fp.heading].family, fontSize: 18, color: 'var(--bp-ink)', lineHeight: 1.1 }}>{fp.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--bp-ink-3)', marginTop: 3 }}>{fp.hint}</div>
                  </button>
                )
              })}
            </div>
          </Stack>
          <Hr />
        </>
      )}
      <Stack label="Schrift der Überschriften">
        <select className="bp-input" value={v.headingFont} onChange={e => ctl.set({ headingFont: e.target.value as HeadingFontKey })}>
          {(Object.keys(HEADING_FONTS) as HeadingFontKey[]).map(k => <option key={k} value={k}>{HEADING_FONTS[k].label}</option>)}
        </select>
      </Stack>
      {full && (
        <>
          <Hr />
          <Stack label="Schrift des Fließtexts">
            <select className="bp-input" value={v.bodyFont} onChange={e => ctl.set({ bodyFont: e.target.value as BodyFontKey })}>
              {(Object.keys(BODY_FONTS) as BodyFontKey[]).map(k => <option key={k} value={k}>{BODY_FONTS[k].label}</option>)}
            </select>
          </Stack>
        </>
      )}
      <Hr />
      <Row label="Größe der Überschriften" help="Skaliert alle Überschriften gemeinsam.">
        <Segment value={v.headingScale} onChange={x => ctl.set({ headingScale: x })}
          options={[['kompakt', 'Kompakt'], ['standard', 'Standard'], ['gross', 'Groß']]} />
      </Row>
    </div>
  )
}

function PaneLayout({ ctl, full }: { ctl: StyleCtl; full: boolean }) {
  const v = ctl.v
  return (
    <div>
      <GroupTitle title={full ? 'Layout & Form' : 'Form & Ecken'}
        hint={full ? 'Karten, Ecken, Buttons, Abstände und Ornamente der RSVP-Seite.' : 'Eckenform und Button-Form der App.'} />
      <Row label="Form (Ecken)" help="Verspielt = runde Ecken, Elegant = kantig."><Segment value={v.cornerStyle} onChange={x => ctl.set({ cornerStyle: x })} options={[['soft', 'Verspielt'], ['elegant', 'Elegant']]} /></Row>
      <Hr />
      <Row label="Button-Stil"><Segment value={v.buttonStyle} onChange={x => ctl.set({ buttonStyle: x })} options={[['pill', 'Rund'], ['square', 'Eckig']]} /></Row>
      {full && (
        <>
          <Hr />
          <Row label="Karten-Stil" help="Wie Karten/Boxen wirken: mit Rahmen, mit Schatten oder flach."><Segment value={v.cardStyle} onChange={x => ctl.set({ cardStyle: x })} options={[['border', 'Rahmen'], ['shadow', 'Schatten'], ['flat', 'Flach']]} /></Row>
          <Hr />
          <Row label="Abstände (Dichte)" help="Wie luftig Inhalte gesetzt werden."><Segment value={v.density} onChange={x => ctl.set({ density: x })} options={[['kompakt', 'Kompakt'], ['standard', 'Standard'], ['luftig', 'Luftig']]} /></Row>
          <Hr />
          <Stack label="Monogramm / Initialen" help="Kleine Wortmarke über dem Paarnamen. Leer = Standard.">
            <input className="bp-input" value={v.monogram} maxLength={24} placeholder="z. B. A & M" onChange={e => ctl.set({ monogram: e.target.value }, 'monogram')} />
          </Stack>
          <Hr />
          <Row label="Dezente Ornamente & Trennlinien"><Toggle checked={v.ornaments} onChange={b => ctl.set({ ornaments: b })} /></Row>
          <Hr />
          <Row label="Countdown zum Termin anzeigen"><Toggle checked={v.countdown} onChange={b => ctl.set({ countdown: b })} /></Row>
        </>
      )}
    </div>
  )
}

function PaneBilder({ s, setS, images, busy, pickCover, removeCover, pickBg, removeBg }: {
  s: DisplaySettings; setS: (p: Partial<DisplaySettings>, k?: string) => void; images: PreviewImages
  busy: { cover?: boolean; bg?: boolean }; pickCover: (f: File) => void; removeCover: () => void; pickBg: (f: File) => void; removeBg: () => void
}) {
  return (
    <div>
      <GroupTitle title="Bilder" hint="Titelbild und Ganzseiten-Hintergrund. Ziehe das Bild im Rahmen, um den Ausschnitt zu wählen, und zoome bei Bedarf."
        onReset={() => setS(resetSectionPatch('bilder'))} />

      <Stack label="Titelbild (Hero)" help="Großflächiger Kopf der RSVP-Seite. Wird über dem Paarnamen angezeigt.">
        <ImagePositioner url={images.coverUrl} focus={s.coverFocus} onFocusChange={f => setS({ coverFocus: f }, 'coverFocus')}
          onPick={pickCover} onRemove={removeCover} busy={busy.cover} aspect={16 / 9} uploadLabel="Titelbild hochladen" />
      </Stack>

      <Hr />
      <Stack label="Hintergrundfoto (ganze Seite)" help="Liegt hinter dem gesamten Inhalt. Mit Weichzeichnung und Tönung bleibt der Text gut lesbar.">
        <ImagePositioner url={images.bgPhotoUrl} focus={s.bgPhotoFocus} onFocusChange={f => setS({ bgPhotoFocus: f }, 'bgFocus')}
          onPick={pickBg} onRemove={removeBg} busy={busy.bg} aspect={16 / 10} uploadLabel="Hintergrundfoto hochladen" />
      </Stack>

      {images.bgPhotoUrl && (
        <>
          <div style={{ marginTop: 16 }}>
            <Row label="Weichzeichnung" help="Wie stark das Hintergrundfoto unscharf gezeichnet wird (0 = scharf).">
              <Slider value={s.bgPhotoBlur} min={0} max={30} onChange={v => setS({ bgPhotoBlur: v }, 'blur')} suffix="px" />
            </Row>
          </div>
          <Hr />
          <Row label="Tönung / Overlay" help="Helle Überblendung in Hintergrundfarbe über dem Foto. Höher = ruhiger, besser lesbar.">
            <Slider value={s.bgPhotoOverlay} min={0} max={90} onChange={v => setS({ bgPhotoOverlay: v }, 'overlay')} suffix="%" />
          </Row>
        </>
      )}
    </div>
  )
}

// Master-Schalter: eigenes Design für die RSVP-Seite ein/aus.
function PaneRsvpDesign({ s, setCustomDesign }: { s: DisplaySettings; setCustomDesign: (on: boolean) => void }) {
  const on = s.invitation.customDesign
  return (
    <div>
      <GroupTitle title="Design der RSVP-Seite" hint="Bestimmt, ob die RSVP-/Einladungsseite ein eigenes Design hat oder das Design der App übernimmt." />
      <Row label="Eigenes Design für die RSVP-Seite"
        help="An: Die RSVP-Seite hat ein komplett eigenes Design (Farben, Schrift, Layout) – einstellbar in den Bereichen darunter. Aus: Sie übernimmt das Design der App.">
        <Toggle checked={on} onChange={setCustomDesign} />
      </Row>
      <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--bp-ivory-2)', border: '1px solid var(--bp-rule)' }}>
        <p style={{ fontSize: 13, color: 'var(--bp-ink-2)', margin: 0, lineHeight: 1.5 }}>
          {on
            ? 'Die RSVP-Seite nutzt ihr eigenes Design. Die Bereiche „Stilpakete“, „Farben“, „Schrift“ und „Layout & Form“ unter RSVP wirken ausschließlich auf die RSVP-/Einladungsseite – nicht auf die App.'
            : 'Die RSVP-Seite übernimmt aktuell das Design der App. Aktiviere den Schalter, um sie davon unabhängig zu gestalten.'}
        </p>
      </div>
    </div>
  )
}

function PaneEinladung({ s, setInv, images, busy, pickMotive, removeMotive }: {
  s: DisplaySettings; setInv: (p: Partial<DisplaySettings['invitation']>, k?: string) => void; images: PreviewImages
  busy: { motive?: boolean }; pickMotive: (f: File) => void; removeMotive: () => void
}) {
  return (
    <div>
      <GroupTitle title="Einladung" hint="Begrüßung und Motiv der RSVP-/Einladungsseite." />
      <Stack label="Begrüßung – Überschrift">
        <input className="bp-input" value={s.invitation.greetingTitle} maxLength={120} placeholder="z. B. Wir heiraten!" onChange={e => setInv({ greetingTitle: e.target.value }, 'gt')} />
      </Stack>
      <Hr />
      <Stack label="Begrüßung – Untertitel">
        <textarea className="bp-textarea" rows={2} style={{ minHeight: 64 }} value={s.invitation.greetingSubtitle} maxLength={240}
          placeholder="z. B. Feiert mit uns den schönsten Tag unseres Lebens." onChange={e => setInv({ greetingSubtitle: e.target.value }, 'gs')} />
      </Stack>
      <Hr />
      <Stack label="Einladungs-Motiv" help="Hintergrundbild der Einladungsseite. Ziehen zum Positionieren, Zoom über den Regler.">
        <ImagePositioner url={images.motiveUrl} focus={s.invitation.motiveFocus} onFocusChange={f => setInv({ motiveFocus: f }, 'motiveFocus')}
          onPick={pickMotive} onRemove={removeMotive} busy={busy.motive} aspect={3 / 4} uploadLabel="Motiv hochladen" />
      </Stack>
    </div>
  )
}

function PaneRsvp({ rsvp, setRsvp }: { rsvp: RsvpSettings; setRsvp: (p: Partial<RsvpSettings>, k?: string) => void }) {
  return (
    <div>
      <GroupTitle title="RSVP-Formular" hint="Einladungstext, Antwortfrist und Formularoptionen für die Antwortseite eurer Gäste." />
      <Stack label="Einladungstext" help="Wird als Einleitung auf der RSVP-Seite gezeigt. {{Name}} wird durch den Gastnamen ersetzt.">
        <textarea className="bp-textarea" rows={5} value={rsvp.invitation_text ?? ''} onChange={e => setRsvp({ invitation_text: e.target.value }, 'itext')}
          placeholder="Liebe/r {{Name}}, wir freuen uns auf deine Antwort." />
      </Stack>
      <Hr />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Stack label="RSVP-Frist" help="Bis wann sollen Gäste antworten?">
          <input className="bp-input" type="date" value={rsvp.rsvp_deadline ?? ''} onChange={e => setRsvp({ rsvp_deadline: e.target.value || null })} />
        </Stack>
        <Stack label="Kontaktnummer (bei Fragen)">
          <input className="bp-input" type="tel" value={rsvp.phone_contact ?? ''} placeholder="+49 123 456789" onChange={e => setRsvp({ phone_contact: e.target.value }, 'phone')} />
        </Stack>
      </div>
      <Hr />
      <Row label="Menüwahl im Formular anzeigen" help="Gäste wählen ihr Gericht direkt im RSVP-Formular."><Toggle checked={rsvp.show_meal_choice} onChange={v => setRsvp({ show_meal_choice: v })} /></Row>
      <Hr />
      <Row label="Begleitperson-Option anzeigen" help="Gäste können angeben, ob sie eine Begleitung mitbringen."><Toggle checked={rsvp.show_plus_one} onChange={v => setRsvp({ show_plus_one: v })} /></Row>
    </div>
  )
}

function PaneAbschnitte({ s, toggleSection }: { s: DisplaySettings; toggleSection: (k: string, hide: boolean) => void }) {
  return (
    <div>
      <GroupTitle title="Sichtbare Abschnitte" hint="Lege fest, welche Abschnitte eure Gäste auf der RSVP-Seite sehen. Ausgeschaltete Abschnitte werden ausgeblendet." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {RSVP_SECTIONS.map((sec, i) => (
          <React.Fragment key={sec.key}>
            {i > 0 && <Hr />}
            <Row label={sec.label}>
              <Toggle checked={!s.hiddenSections.includes(sec.key)} onChange={v => toggleSection(sec.key, !v)} />
            </Row>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

function PaneCode({ s, replaceSettings }: { s: DisplaySettings; replaceSettings: (n: DisplaySettings) => void }) {
  const [copied, setCopied] = useState(false)
  const [importVal, setImportVal] = useState('')
  const [importErr, setImportErr] = useState(false)
  const code = useMemo(() => encodeStyleCode(s), [s])

  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  function doImport() {
    const decoded = decodeStyleCode(importVal)
    if (!decoded) { setImportErr(true); return }
    setImportErr(false)
    // Bild-Keys des aktuellen Events beibehalten (Code enthält keine Bilder).
    replaceSettings({ ...decoded, bgPhotoR2Key: s.bgPhotoR2Key, invitation: { ...decoded.invitation, motiveR2Key: s.invitation.motiveR2Key, motiveFocus: s.invitation.motiveFocus }, coverFocus: s.coverFocus, bgPhotoFocus: s.bgPhotoFocus })
    setImportVal('')
  }
  return (
    <div>
      <GroupTitle title="Sichern & Code" hint="Sichere deine Gestaltung als Code oder übertrage sie. Bilder sind nicht enthalten." />
      <Stack label="Stil-Code exportieren" help="Kopiere diesen Code zum Sichern oder um die Gestaltung später wiederherzustellen.">
        <textarea className="bp-textarea" readOnly value={code} rows={3} style={{ fontFamily: 'monospace', fontSize: 11.5 }} onFocus={e => e.currentTarget.select()} />
        <button type="button" className="bp-btn bp-btn-sm" onClick={copy} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Kopiert' : 'Code kopieren'}
        </button>
      </Stack>
      <Hr />
      <Stack label="Stil-Code importieren" help="Füge einen zuvor exportierten Code ein, um die Gestaltung zu übernehmen.">
        <textarea className="bp-textarea" value={importVal} rows={3} placeholder="FOREVR1:…" style={{ fontFamily: 'monospace', fontSize: 11.5 }}
          onChange={e => { setImportVal(e.target.value); setImportErr(false) }} />
        {importErr && <p style={{ color: 'var(--bp-red)', fontSize: 12, margin: '6px 0 0' }}>Code konnte nicht gelesen werden.</p>}
        <button type="button" className="bp-btn bp-btn-sm" onClick={doImport} disabled={!importVal.trim()} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ClipboardPaste size={14} /> Code übernehmen
        </button>
      </Stack>
      <Hr />
      <Stack label="Alles zurücksetzen" help="Setzt sämtliche Anzeige-Einstellungen auf den Auslieferungszustand zurück (Bilder bleiben erhalten).">
        <button type="button" className="bp-btn bp-btn-sm" onClick={() => replaceSettings({ ...DEFAULT_DISPLAY_SETTINGS, bgPhotoR2Key: s.bgPhotoR2Key, coverFocus: { ...DEFAULT_FOCUS }, bgPhotoFocus: { ...DEFAULT_FOCUS }, invitation: { ...DEFAULT_DISPLAY_SETTINGS.invitation, motiveR2Key: s.invitation.motiveR2Key } })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--bp-red)' }}>
          <RotateCcw size={14} /> Auf Standard zurücksetzen
        </button>
      </Stack>
    </div>
  )
}
