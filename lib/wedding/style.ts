// lib/wedding/style.ts
// Individualisierungs-Ebene ÜBER den Templates: kuratierte Paletten, getrennte Schriften,
// Texturen, Ecken/Buttons, Ornamente und Story-Anpassungen (Layout/Linie/Marker).
// Overrides sind partiell — leere Werte folgen dem Template.
import { getTemplate, type WeddingTemplate, type StoryLayout } from './templates'

export interface WeddingStyle {
  fontHeading?: string  // Key aus HEADING_FONTS
  fontBody?: string     // Key aus BODY_FONTS
  palette?: string      // Key aus PALETTES
  texture?: string      // Key aus TEXTURES
  radius?: string       // 'sharp' | 'soft' | 'round'
  button?: string       // 'solid' | 'outline'
  ornament?: string     // 'diamond' | 'line' | 'dot' | 'none'
  storyAlign?: string   // 'alternating' | 'left' | 'center' | 'horizontal'
  storyLine?: string    // 'solid' | 'dashed' | 'dotted' | 'rope' | 'footsteps'
  storyMarker?: string  // 'icon' | 'dot' | 'number'
}

// ── Schriften (kuratiert) ────────────────────────────────────────────────────
export interface FontOption { key: string; label: string; stack: string }
export const HEADING_FONTS: FontOption[] = [
  { key: 'cormorant', label: 'Cormorant', stack: "'Cormorant Garamond', serif" },
  { key: 'playfair', label: 'Playfair Display', stack: "'Playfair Display', serif" },
  { key: 'ebgaramond', label: 'EB Garamond', stack: "'EB Garamond', serif" },
  { key: 'cinzel', label: 'Cinzel', stack: "'Cinzel', serif" },
  { key: 'italiana', label: 'Italiana', stack: "'Italiana', serif" },
  { key: 'marcellus', label: 'Marcellus', stack: "'Marcellus', serif" },
  { key: 'tenor', label: 'Tenor Sans', stack: "'Tenor Sans', sans-serif" },
  { key: 'greatvibes', label: 'Great Vibes (Script)', stack: "'Great Vibes', cursive" },
]
export const BODY_FONTS: FontOption[] = [
  { key: 'dmsans', label: 'DM Sans', stack: "'DM Sans', sans-serif" },
  { key: 'montserrat', label: 'Montserrat', stack: "'Montserrat', sans-serif" },
  { key: 'lato', label: 'Lato', stack: "'Lato', sans-serif" },
  { key: 'mulish', label: 'Mulish', stack: "'Mulish', sans-serif" },
  { key: 'ebgaramond', label: 'EB Garamond', stack: "'EB Garamond', serif" },
  { key: 'marcellus', label: 'Marcellus', stack: "'Marcellus', sans-serif" },
]

// Alle Familien einmalig laden (eine Anfrage) — deckt jede Auswahl ab.
export const ALL_FONTS_HREF =
  'https://fonts.googleapis.com/css2?' + [
    'Cormorant+Garamond:wght@400;500;600',
    'Playfair+Display:wght@500;600;700',
    'EB+Garamond:wght@400;500;600',
    'Cinzel:wght@400;500;600',
    'Italiana',
    'Marcellus',
    'Tenor+Sans',
    'Great+Vibes',
    'DM+Sans:wght@400;500;600',
    'Montserrat:wght@400;500;600',
    'Lato:wght@400;700',
    'Mulish:wght@400;500;600',
  ].map(f => 'family=' + f).join('&') + '&display=swap'

// ── Farbpaletten (kuratiert) ─────────────────────────────────────────────────
export interface Palette { key: string; label: string; swatch: string[]; vars: Record<string, string> }
export const PALETTES: Palette[] = [
  { key: 'cream-gold', label: 'Creme & Gold', swatch: ['#f7f2ea', '#b9975b', '#2c2622'], vars: {
    '--wd-bg': '#f7f2ea', '--wd-surface': '#ffffff', '--wd-ink': '#2c2622', '--wd-ink-soft': '#6b6258',
    '--wd-accent': '#b9975b', '--wd-accent-soft': '#e7dcc4', '--wd-line': '#e3d9c8',
    '--wd-hero-overlay': 'linear-gradient(180deg, rgba(20,16,12,0.34), rgba(20,16,12,0.58))' } },
  { key: 'blush', label: 'Blush & Roségold', swatch: ['#fbf1f1', '#c98b86', '#5a3a39'], vars: {
    '--wd-bg': '#fbf1f1', '--wd-surface': '#fffafa', '--wd-ink': '#4a3433', '--wd-ink-soft': '#8a6b6a',
    '--wd-accent': '#c98b86', '--wd-accent-soft': '#f3dad8', '--wd-line': '#efd9d8',
    '--wd-hero-overlay': 'linear-gradient(180deg, rgba(60,32,32,0.32), rgba(60,32,32,0.56))' } },
  { key: 'sage', label: 'Salbeigrün', swatch: ['#f1f3ec', '#7e8c6a', '#2f3a29'], vars: {
    '--wd-bg': '#f1f3ec', '--wd-surface': '#ffffff', '--wd-ink': '#2f3a29', '--wd-ink-soft': '#5e6a54',
    '--wd-accent': '#7e8c6a', '--wd-accent-soft': '#dde3d2', '--wd-line': '#d3dac6',
    '--wd-hero-overlay': 'linear-gradient(180deg, rgba(28,38,22,0.34), rgba(28,38,22,0.58))' } },
  { key: 'mono', label: 'Schwarz & Weiß', swatch: ['#ffffff', '#111111', '#9a9a9a'], vars: {
    '--wd-bg': '#ffffff', '--wd-surface': '#fafafa', '--wd-ink': '#111111', '--wd-ink-soft': '#6b6b6b',
    '--wd-accent': '#111111', '--wd-accent-soft': '#ededed', '--wd-line': '#e6e6e6',
    '--wd-hero-overlay': 'linear-gradient(180deg, rgba(0,0,0,0.32), rgba(0,0,0,0.56))' } },
  { key: 'dark-gold', label: 'Dunkel & Gold', swatch: ['#15130f', '#caa45a', '#f3ead6'], vars: {
    '--wd-bg': '#15130f', '--wd-surface': '#1f1c16', '--wd-ink': '#f3ead6', '--wd-ink-soft': '#b6ac98',
    '--wd-accent': '#caa45a', '--wd-accent-soft': '#3a3326', '--wd-line': '#3a342a',
    '--wd-hero-overlay': 'linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.66))' } },
  { key: 'dusty-blue', label: 'Staubblau', swatch: ['#eef1f4', '#6b8299', '#2b3642'], vars: {
    '--wd-bg': '#eef1f4', '--wd-surface': '#ffffff', '--wd-ink': '#2b3642', '--wd-ink-soft': '#5b6b78',
    '--wd-accent': '#6b8299', '--wd-accent-soft': '#d6dee6', '--wd-line': '#d3dae1',
    '--wd-hero-overlay': 'linear-gradient(180deg, rgba(20,28,36,0.34), rgba(20,28,36,0.58))' } },
  { key: 'terracotta', label: 'Terrakotta', swatch: ['#f6efe7', '#bd6b4c', '#43302a'], vars: {
    '--wd-bg': '#f6efe7', '--wd-surface': '#fffaf4', '--wd-ink': '#43302a', '--wd-ink-soft': '#7a6155',
    '--wd-accent': '#bd6b4c', '--wd-accent-soft': '#eed8c9', '--wd-line': '#e6d6c8',
    '--wd-hero-overlay': 'linear-gradient(180deg, rgba(50,30,22,0.34), rgba(50,30,22,0.58))' } },
  { key: 'mauve', label: 'Mauve & Flieder', swatch: ['#f3eef4', '#9b7a9e', '#3e2f40'], vars: {
    '--wd-bg': '#f3eef4', '--wd-surface': '#fffafd', '--wd-ink': '#3e2f40', '--wd-ink-soft': '#6f5d72',
    '--wd-accent': '#9b7a9e', '--wd-accent-soft': '#e4d8e6', '--wd-line': '#e0d4e2',
    '--wd-hero-overlay': 'linear-gradient(180deg, rgba(40,28,42,0.34), rgba(40,28,42,0.58))' } },
]

// ── Optionslisten für die UI ─────────────────────────────────────────────────
export const TEXTURES = [
  { key: 'none', label: 'Keine' },
  { key: 'linen', label: 'Leinen' },
  { key: 'dots', label: 'Punkte' },
  { key: 'paper', label: 'Papier' },
]
export const RADII = [
  { key: 'sharp', label: 'Eckig', px: '2px' },
  { key: 'soft', label: 'Weich', px: '12px' },
  { key: 'round', label: 'Rund', px: '22px' },
]
export const BUTTON_STYLES = [
  { key: 'solid', label: 'Gefüllt' },
  { key: 'outline', label: 'Outline' },
]
export const ORNAMENTS = [
  { key: 'diamond', label: 'Diamant' },
  { key: 'line', label: 'Linie' },
  { key: 'dot', label: 'Punkt' },
  { key: 'none', label: 'Ohne' },
]
export const STORY_ALIGNS = [
  { key: 'alternating', label: 'Abwechselnd' },
  { key: 'left', label: 'Linksbündig' },
  { key: 'center', label: 'Zentriert' },
  { key: 'horizontal', label: 'Horizontal' },
]
export const STORY_LINES = [
  { key: 'solid', label: 'Durchgezogen' },
  { key: 'dashed', label: 'Gestrichelt' },
  { key: 'dotted', label: 'Gepunktet' },
  { key: 'rope', label: 'Seil' },
  { key: 'footsteps', label: 'Trittspuren' },
]
export const STORY_MARKERS = [
  { key: 'icon', label: 'Icon im Kreis' },
  { key: 'dot', label: 'Punkt' },
  { key: 'number', label: 'Nummer' },
]

function layoutToAlign(layout: StoryLayout): string {
  switch (layout) {
    case 'vertical-single': return 'left'
    case 'horizontal': return 'horizontal'
    case 'center-spine': return 'center'
    default: return 'alternating'
  }
}
function templateOrnament(id: string): string {
  if (id === 'modern-minimal') return 'line'
  if (id === 'blush-romance' || id === 'botanic-sage') return 'dot'
  return 'diamond'
}

export interface ResolvedStyle {
  templateId: string
  vars: Record<string, string>
  data: { texture: string; radius: string; button: string; ornament: string }
  story: { align: string; line: string; marker: string }
}

/** Effektiven Stil aus Template + Overrides berechnen. */
export function resolveStyle(templateId: string | null | undefined, style: WeddingStyle | undefined): ResolvedStyle {
  const t: WeddingTemplate = getTemplate(templateId)
  const s = style ?? {}
  const vars: Record<string, string> = { ...t.vars }

  // Palette überschreibt Farben
  if (s.palette) {
    const pal = PALETTES.find(p => p.key === s.palette)
    if (pal) Object.assign(vars, pal.vars)
  }
  // Schriften
  const heading = s.fontHeading ? HEADING_FONTS.find(f => f.key === s.fontHeading)?.stack : undefined
  const body = s.fontBody ? BODY_FONTS.find(f => f.key === s.fontBody)?.stack : undefined
  vars['--wd-font-heading'] = heading ?? t.fontHeading
  vars['--wd-font-body'] = body ?? t.fontBody
  // Eckenradius
  if (s.radius) {
    const r = RADII.find(x => x.key === s.radius)
    if (r) vars['--wd-radius'] = r.px
  }

  return {
    templateId: t.id,
    vars,
    data: {
      texture: s.texture ?? 'none',
      radius: s.radius ?? '',
      button: s.button ?? 'solid',
      ornament: s.ornament ?? templateOrnament(t.id),
    },
    story: {
      align: s.storyAlign ?? layoutToAlign(t.storyLayout),
      line: s.storyLine ?? 'solid',
      marker: s.storyMarker ?? 'icon',
    },
  }
}
