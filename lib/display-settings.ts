// Anzeigeeinstellungen — gemeinsame Typen, Defaults & Theme-Erzeugung.
// Wird im Brautpaar-Portal und auf den Gast-Seiten angewendet.

export interface DisplaySettings {
  accent: string            // HEX, z. B. '#B89968'
  accentGradient: boolean   // Akzent als Farbverlauf
  headingFont: HeadingFontKey
  headingScale: 'kompakt' | 'standard' | 'gross'
  bgTexture: 'none' | 'paper' | 'dots' | 'floral'
  cornerStyle: 'soft' | 'elegant'   // rund/verspielt ↔ kantig/elegant
  buttonStyle: 'pill' | 'square'
  monogram: string          // '' = Standard-Wordmark (FOREVR)
  preset: string | null
}

export type HeadingFontKey = 'cormorant' | 'playfair' | 'dmserif' | 'script' | 'sans'

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  accent: '#B89968',
  accentGradient: false,
  headingFont: 'cormorant',
  headingScale: 'standard',
  bgTexture: 'none',
  cornerStyle: 'soft',
  buttonStyle: 'pill',
  monogram: '',
  preset: null,
}

export const HEADING_FONTS: Record<HeadingFontKey, { label: string; family: string; href: string | null }> = {
  cormorant: { label: 'Cormorant (elegant)', family: "'Cormorant Garamond', Georgia, serif", href: null },
  playfair:  { label: 'Playfair Display (klassisch)', family: "'Playfair Display', Georgia, serif", href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap' },
  dmserif:   { label: 'DM Serif (modern)', family: "'DM Serif Display', Georgia, serif", href: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap' },
  script:    { label: 'Great Vibes (Script)', family: "'Great Vibes', cursive", href: 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap' },
  sans:      { label: 'Montserrat (clean)', family: "'Montserrat', system-ui, sans-serif", href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&display=swap' },
}

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
  { key: 'klassisch_gold', label: 'Klassisch Gold', settings: { accent: '#B89968', headingFont: 'cormorant', headingScale: 'standard', bgTexture: 'paper',  cornerStyle: 'soft',    buttonStyle: 'pill',   accentGradient: false } },
  { key: 'boho',           label: 'Boho',           settings: { accent: '#C2724A', headingFont: 'dmserif',   headingScale: 'gross',    bgTexture: 'floral', cornerStyle: 'soft',    buttonStyle: 'pill',   accentGradient: false } },
  { key: 'modern',         label: 'Modern Minimal', settings: { accent: '#2E3A59', headingFont: 'sans',      headingScale: 'standard', bgTexture: 'none',   cornerStyle: 'elegant', buttonStyle: 'square', accentGradient: false } },
  { key: 'romantisch',     label: 'Romantisch Rosé',settings: { accent: '#C98B9B', headingFont: 'script',    headingScale: 'gross',    bgTexture: 'none',   cornerStyle: 'soft',    buttonStyle: 'pill',   accentGradient: true  } },
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
  const cornerStyle = s.cornerStyle === 'elegant' ? 'elegant' : 'soft'
  const buttonStyle = s.buttonStyle === 'square' ? 'square' : 'pill'
  const monogram = typeof s.monogram === 'string' ? s.monogram.slice(0, 24) : ''
  return {
    accent,
    accentGradient: s.accentGradient === true,
    headingFont,
    headingScale,
    bgTexture,
    cornerStyle,
    buttonStyle,
    monogram,
    preset: typeof s.preset === 'string' ? s.preset : null,
  }
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

const TEXTURES: Record<DisplaySettings['bgTexture'], string> = {
  none: 'none',
  dots: 'radial-gradient(rgba(0,0,0,0.045) 1px, transparent 1px)',
  paper: 'linear-gradient(rgba(0,0,0,0.015), rgba(0,0,0,0.015))',
  floral: 'radial-gradient(circle at 20% 20%, rgba(0,0,0,0.03) 0 2px, transparent 3px), radial-gradient(circle at 70% 60%, rgba(0,0,0,0.025) 0 3px, transparent 4px)',
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
  const texture = TEXTURES[s.bgTexture]

  let css = `.bp-display-root{`
    + `--bp-gold:${s.accent};--bp-gold-deep:${deep};--bp-gold-pale:${pale};--bp-gold-mist:${shade(s.accent, 0.7)};--gold:${s.accent};--gold-pale:${pale};`
    + `--bp-rule-gold:${shade(s.accent, 0.5)};`
    + `--bp-font-heading:${family};--bp-heading-scale:${scale};`
    + `--bp-r-sm:${corner.sm};--bp-r-md:${corner.md};--bp-r-lg:${corner.lg};--bp-r-pill:${pill};`
    + `}`
  if (texture !== 'none') {
    css += `.bp-display-root{background-image:${texture};background-size:${s.bgTexture === 'dots' ? '18px 18px' : 'auto'};background-attachment:fixed;}`
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
