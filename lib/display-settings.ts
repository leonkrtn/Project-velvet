// Anzeigeeinstellungen — gemeinsame Typen, Defaults & Theme-Erzeugung.
// Wird im Brautpaar-Portal und auf den Gast-Seiten angewendet.

export interface InvitationSettings {
  greetingTitle: string         // '' = Standard (Paarname)
  greetingSubtitle: string      // '' = Standard
  motiveR2Key: string | null    // eigenes Einladungs-Motiv (R2 key); null = keins
  accent: string | null         // null = global erben
  headingFont: HeadingFontKey | null  // null = global erben
}

export interface DisplaySettings {
  accent: string            // HEX, z. B. '#B89968'
  accentGradient: boolean   // Akzent als Farbverlauf
  headingFont: HeadingFontKey
  headingScale: 'kompakt' | 'standard' | 'gross'
  bgColor: string           // helle Pastell-/Weiß-Hintergrundfarbe
  bgTexture: 'none' | 'paper' | 'dots' | 'floral'
  cornerStyle: 'soft' | 'elegant'   // rund/verspielt ↔ kantig/elegant
  buttonStyle: 'pill' | 'square'
  monogram: string          // '' = Standard-Wordmark (FOREVR)
  preset: string | null
  invitation: InvitationSettings    // einladungsspezifische Overrides
}

export type HeadingFontKey = 'cormorant' | 'playfair' | 'dmserif' | 'script' | 'sans'

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  accent: '#B89968',
  accentGradient: false,
  headingFont: 'cormorant',
  headingScale: 'standard',
  bgColor: '#F8F8F6',
  bgTexture: 'none',
  cornerStyle: 'soft',
  buttonStyle: 'pill',
  monogram: '',
  preset: null,
  invitation: { greetingTitle: '', greetingSubtitle: '', motiveR2Key: null, accent: null, headingFont: null },
}

export const HEADING_FONTS: Record<HeadingFontKey, { label: string; family: string; href: string | null }> = {
  cormorant: { label: 'Cormorant (elegant)', family: "'Cormorant Garamond', Georgia, serif", href: null },
  playfair:  { label: 'Playfair Display (klassisch)', family: "'Playfair Display', Georgia, serif", href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap' },
  dmserif:   { label: 'DM Serif (modern)', family: "'DM Serif Display', Georgia, serif", href: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap' },
  script:    { label: 'Great Vibes (Script)', family: "'Great Vibes', cursive", href: 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap' },
  sans:      { label: 'Montserrat (clean)', family: "'Montserrat', system-ui, sans-serif", href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&display=swap' },
}

// Helle Hintergrund-Presets (nah an Weiß)
export const BG_COLOR_PRESETS: { label: string; value: string }[] = [
  { label: 'Weiß',      value: '#FFFFFF' },
  { label: 'Elfenbein', value: '#F8F8F6' },
  { label: 'Creme',     value: '#FBF7F0' },
  { label: 'Rosé',      value: '#FBF1F1' },
  { label: 'Salbei',    value: '#F1F5F0' },
  { label: 'Himmel',    value: '#EFF4F8' },
  { label: 'Lavendel',  value: '#F4F1F8' },
  { label: 'Mint',      value: '#EFF7F3' },
]

export const ACCENT_PRESETS: { label: string; value: string }[] = [
  { label: 'Gold',       value: '#B89968' },
  { label: 'Rosé',       value: '#C98B9B' },
  { label: 'Salbei',     value: '#8DA68C' },
  { label: 'Bordeaux',   value: '#7B2D3B' },
  { label: 'Navy',       value: '#2E3A59' },
  { label: 'Terrakotta', value: '#C2724A' },
  { label: 'Eukalyptus', value: '#5F7A6B' },
  { label: 'Lavendel',   value: '#8A7AA8' },
]

export const THEME_PRESETS: { key: string; label: string; settings: Partial<DisplaySettings> }[] = [
  { key: 'klassisch_gold', label: 'Klassisch Gold', settings: { accent: '#B89968', headingFont: 'cormorant', headingScale: 'standard', bgColor: '#F8F8F6', bgTexture: 'paper',  cornerStyle: 'soft',    buttonStyle: 'pill',   accentGradient: false } },
  { key: 'boho',           label: 'Boho',           settings: { accent: '#C2724A', headingFont: 'dmserif',   headingScale: 'gross',    bgColor: '#FBF7F0', bgTexture: 'floral', cornerStyle: 'soft',    buttonStyle: 'pill',   accentGradient: false } },
  { key: 'modern',         label: 'Modern Minimal', settings: { accent: '#2E3A59', headingFont: 'sans',      headingScale: 'standard', bgColor: '#FFFFFF', bgTexture: 'none',   cornerStyle: 'elegant', buttonStyle: 'square', accentGradient: false } },
  { key: 'romantisch',     label: 'Romantisch Rosé',settings: { accent: '#C98B9B', headingFont: 'script',    headingScale: 'gross',    bgColor: '#FBF1F1', bgTexture: 'none',   cornerStyle: 'soft',    buttonStyle: 'pill',   accentGradient: true  } },
]

const HEADING_SCALE_MAP = { kompakt: 0.9, standard: 1, gross: 1.15 } as const
const CORNER_MAP = {
  soft:    { sm: '8px', md: '12px', lg: '16px' },
  elegant: { sm: '2px', md: '3px',  lg: '5px' },
} as const

// Validierung & Merge eingehender (ggf. unvollständiger) Settings.
export function normalizeSettings(raw: unknown): DisplaySettings {
  const s = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const accent = typeof s.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.accent) ? s.accent : DEFAULT_DISPLAY_SETTINGS.accent
  const headingFont = (typeof s.headingFont === 'string' && s.headingFont in HEADING_FONTS) ? s.headingFont as HeadingFontKey : DEFAULT_DISPLAY_SETTINGS.headingFont
  const headingScale = (s.headingScale === 'kompakt' || s.headingScale === 'gross') ? s.headingScale : 'standard'
  const bgTexture = (['paper', 'dots', 'floral'].includes(s.bgTexture as string)) ? s.bgTexture as DisplaySettings['bgTexture'] : 'none'
  // nur helle Hintergrundfarben zulassen (nah an Weiß)
  const bgColor = (typeof s.bgColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.bgColor) && isLightColor(s.bgColor)) ? s.bgColor : DEFAULT_DISPLAY_SETTINGS.bgColor
  const cornerStyle = s.cornerStyle === 'elegant' ? 'elegant' : 'soft'
  const buttonStyle = s.buttonStyle === 'square' ? 'square' : 'pill'
  const monogram = typeof s.monogram === 'string' ? s.monogram.slice(0, 24) : ''

  const inv = (s.invitation && typeof s.invitation === 'object') ? s.invitation as Record<string, unknown> : {}
  const invAccent = typeof inv.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(inv.accent) ? inv.accent : null
  const invFont = (typeof inv.headingFont === 'string' && inv.headingFont in HEADING_FONTS) ? inv.headingFont as HeadingFontKey : null
  const invitation: InvitationSettings = {
    greetingTitle: typeof inv.greetingTitle === 'string' ? inv.greetingTitle.slice(0, 120) : '',
    greetingSubtitle: typeof inv.greetingSubtitle === 'string' ? inv.greetingSubtitle.slice(0, 240) : '',
    motiveR2Key: typeof inv.motiveR2Key === 'string' && inv.motiveR2Key ? inv.motiveR2Key : null,
    accent: invAccent,
    headingFont: invFont,
  }

  return {
    accent,
    accentGradient: s.accentGradient === true,
    headingFont,
    headingScale,
    bgColor,
    bgTexture,
    cornerStyle,
    buttonStyle,
    monogram,
    preset: typeof s.preset === 'string' ? s.preset : null,
    invitation,
  }
}

// Effektives Gäste-/Einladungs-Theme: Invitation-Overrides auf globale Werte.
export function invitationAccent(s: DisplaySettings): string {
  return s.invitation.accent ?? s.accent
}
export function invitationFont(s: DisplaySettings): HeadingFontKey {
  return s.invitation.headingFont ?? s.headingFont
}

// ── Farb-Hilfen ───────────────────────────────────────────────────────────────
function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))) }
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')
}
export function shade(hex: string, amount: number): string {
  // amount < 0 dunkler, > 0 heller (0..1)
  const [r, g, b] = hexToRgb(hex)
  if (amount < 0) {
    const f = 1 + amount
    return rgbToHex(r * f, g * f, b * f)
  }
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}

// Helligkeit grob prüfen (nur sehr helle Farben als Hintergrund zulassen)
export function isLightColor(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex)
  // wahrgenommene Helligkeit
  return (0.299 * r + 0.587 * g + 0.114 * b) >= 222
}

const FLORAL = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Cg fill='none' stroke='%23000' stroke-opacity='0.05' stroke-width='1.1'%3E%3Cpath d='M32 10c4 8 4 16 0 24-4-8-4-16 0-24z'/%3E%3Cpath d='M14 44c6-2 12 0 16 6'/%3E%3Cpath d='M50 44c-6-2-12 0-16 6'/%3E%3Ccircle cx='32' cy='38' r='1.5'/%3E%3C/g%3E%3C/svg%3E\")"

// Liefert die Hintergrund-CSS-Werte für eine Textur (für gescoptes + inline-CSS).
export function textureStyle(key: DisplaySettings['bgTexture']): { image: string; size: string } {
  switch (key) {
    case 'dots':   return { image: 'radial-gradient(rgba(0,0,0,0.06) 1.2px, transparent 1.3px)', size: '16px 16px' }
    case 'paper':  return { image: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.018) 0 1px, transparent 1px 7px)', size: 'auto' }
    case 'floral': return { image: FLORAL, size: '64px 64px' }
    default:       return { image: 'none', size: 'auto' }
  }
}

/**
 * Erzeugt das gescopte CSS (Klasse `.bp-display-root`) für die gegebenen
 * Settings. Reiner String aus validierten Werten → sicher zu injizieren.
 */
export function buildThemeCss(input: DisplaySettings): string {
  const s = normalizeSettings(input)
  const deep = shade(s.accent, -0.18)
  const pale = shade(s.accent, 0.82)
  const scale = HEADING_SCALE_MAP[s.headingScale]
  const corner = CORNER_MAP[s.cornerStyle]
  const pill = s.buttonStyle === 'square' ? '8px' : '999px'
  const family = HEADING_FONTS[s.headingFont].family
  const tex = textureStyle(s.bgTexture)
  const ivory2 = shade(s.bgColor, -0.03)

  let css = `.bp-display-root{`
    + `--bp-gold:${s.accent};--bp-gold-deep:${deep};--bp-gold-pale:${pale};--bp-gold-mist:${shade(s.accent, 0.7)};--gold:${s.accent};--gold-pale:${pale};`
    + `--bp-rule-gold:${shade(s.accent, 0.5)};`
    + `--bp-ivory:${s.bgColor};--bp-ivory-2:${ivory2};--bp-surface-2:${ivory2};--bg:${s.bgColor};`
    + `--bp-font-heading:${family};--bp-heading-scale:${scale};`
    + `--bp-r-sm:${corner.sm};--bp-r-md:${corner.md};--bp-r-lg:${corner.lg};--bp-r-pill:${pill};`
    + `min-height:100dvh;background-color:${s.bgColor};`
    + `}`
  // Hintergrundfarbe + Muster über die ganze Fläche (auch hinter dem Inhalt).
  // .bp-shell trägt den sichtbaren Portal-Hintergrund → Textur dort anwenden.
  css += `.bp-display-root,.bp-display-root .bp-shell{background-color:${s.bgColor};}`
  if (tex.image !== 'none') {
    css += `.bp-display-root,.bp-display-root .bp-shell{background-image:${tex.image};background-size:${tex.size};background-attachment:fixed;background-position:center;}`
  }
  // Überschriften-Font + Skalierung
  css += `.bp-display-root .bp-mag-title,.bp-display-root .bp-font-heading,.bp-display-root .bp-mag-section-title,.bp-display-root .bp-mag-block-title{font-family:var(--bp-font-heading)!important;}`
  css += `.bp-display-root .bp-mag-title{font-size:calc(clamp(2.5rem,7vw,4.5rem)*${scale});}`
  css += `.bp-display-root .bp-mag-section-title{font-size:calc(1.75rem*${scale});}`
  css += `.bp-display-root .bp-mag-block-title{font-size:calc(1.375rem*${scale});}`
  css += `.bp-display-root .bp-page-title{font-size:calc(1.5rem*${scale});}`
  if (s.accentGradient) {
    css += `.bp-display-root .bp-btn-primary{background-image:linear-gradient(135deg,var(--bp-gold),var(--bp-gold-deep));border-color:transparent;color:#fff;}`
  }
  return css
}

export function fontHrefFor(key: HeadingFontKey): string | null {
  return HEADING_FONTS[key]?.href ?? null
}
