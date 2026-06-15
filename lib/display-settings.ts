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
  accent2: string | null    // zweite Kontrast-/Akzentfarbe; null = aus Akzent abgeleitet
  accentGradient: boolean   // Akzent als Farbverlauf
  headingFont: HeadingFontKey
  bodyFont: BodyFontKey     // Schrift für Fließtext
  headingScale: 'kompakt' | 'standard' | 'gross'
  bgColor: string           // helle Pastell-/Weiß-Hintergrundfarbe
  bgTexture: BgTextureKey
  bgGradient: boolean       // sanfter Farbverlauf-Hintergrund statt einfarbig
  bgPhotoR2Key: string | null  // eigenes Ganzseiten-Hintergrundfoto (R2 key); null = keins
  bgPhotoBlur: number       // 0–30 px Weichzeichnung des Hintergrundfotos
  cornerStyle: 'soft' | 'elegant'   // rund/verspielt ↔ kantig/elegant
  buttonStyle: 'pill' | 'square'
  cardStyle: 'border' | 'shadow' | 'flat'  // Karten-Stil
  density: 'kompakt' | 'standard' | 'luftig'  // Abstands-Dichte
  ornaments: boolean        // dezente Ornamente / Trennlinien / Icon-Akzente
  countdown: boolean        // Countdown zum Termin auf der Intro-Seite
  monogram: string          // '' = Standard-Wordmark (FOREVR)
  hiddenSections: string[]  // ausgeblendete RSVP-Abschnitte (Keys s. RSVP_SECTIONS)
  texts: Partial<RsvpTexts> // anpassbare Texte (leer = Standard)
  preset: string | null
  invitation: InvitationSettings    // einladungsspezifische Overrides
}

export type HeadingFontKey = 'cormorant' | 'playfair' | 'dmserif' | 'script' | 'sans'
export type BodyFontKey = 'system' | 'inter' | 'lora' | 'nunito' | 'dmsans'
export type BgTextureKey = 'none' | 'paper' | 'dots' | 'floral' | 'marble' | 'linen' | 'watercolor'

// Frei anpassbare Texte der RSVP-/Einladungs-Seite.
export interface RsvpTexts {
  introEyebrow: string      // Kleine Zeile über dem Paarnamen
  rsvpTitle: string         // Überschrift Zusage/Absage-Schritt
  detailsTitle: string      // Überschrift Details-Schritt
  hotelTitle: string        // Überschrift Hotel-Schritt
  yesLabel: string          // Button „Ja, ich bin dabei"
  noLabel: string           // Button „Leider nicht"
  nextLabel: string         // Weiter-Button
  declineLabel: string      // Absage-Button
  thankYouAccept: string    // Danke-Überschrift bei Zusage
  thankYouDecline: string   // Überschrift bei Absage
}

export const RSVP_TEXT_DEFAULTS: RsvpTexts = {
  introEyebrow: 'Herzliche Einladung',
  rsvpTitle: 'Kannst du kommen?',
  detailsTitle: 'Deine Details',
  hotelTitle: 'Hotelzimmer',
  yesLabel: 'Ja, ich bin dabei!',
  noLabel: 'Leider nicht',
  nextLabel: 'Weiter',
  declineLabel: 'Absage senden',
  thankYouAccept: 'Danke für deine Zusage!',
  thankYouDecline: 'Schade, dass du nicht kommen kannst.',
}

// Ausblendbare RSVP-Abschnitte (zusätzlich zu den Feature-Toggles).
export const RSVP_SECTIONS: { key: string; label: string }[] = [
  { key: 'dresscode', label: 'Dresscode-Zeile' },
  { key: 'children',  label: 'Kinder-Hinweis' },
  { key: 'allergies', label: 'Allergien-Abfrage' },
  { key: 'arrival',   label: 'Anreise-Abschnitt' },
  { key: 'message',   label: 'Nachrichten-Feld' },
]

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  accent: '#B89968',
  accent2: null,
  accentGradient: false,
  headingFont: 'cormorant',
  bodyFont: 'system',
  headingScale: 'standard',
  bgColor: '#F8F8F6',
  bgTexture: 'none',
  bgGradient: false,
  bgPhotoR2Key: null,
  bgPhotoBlur: 6,
  cornerStyle: 'soft',
  buttonStyle: 'pill',
  cardStyle: 'border',
  density: 'standard',
  ornaments: true,
  countdown: false,
  monogram: '',
  hiddenSections: [],
  texts: {},
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

export const BODY_FONTS: Record<BodyFontKey, { label: string; family: string; href: string | null }> = {
  system: { label: 'System (Standard)', family: '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif', href: null },
  inter:  { label: 'Inter (modern)', family: "'Inter', system-ui, sans-serif", href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap' },
  dmsans: { label: 'DM Sans (clean)', family: "'DM Sans', system-ui, sans-serif", href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap' },
  lora:   { label: 'Lora (Serif)', family: "'Lora', Georgia, serif", href: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&display=swap' },
  nunito: { label: 'Nunito (weich)', family: "'Nunito', system-ui, sans-serif", href: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap' },
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
  { key: 'klassisch_gold', label: 'Klassisch Gold', settings: { accent: '#B89968', headingFont: 'cormorant', bodyFont: 'system', headingScale: 'standard', bgColor: '#F8F8F6', bgTexture: 'paper',  bgGradient: false, cornerStyle: 'soft',    buttonStyle: 'pill',   cardStyle: 'border', density: 'standard', ornaments: true,  accentGradient: false } },
  { key: 'boho',           label: 'Boho',           settings: { accent: '#C2724A', headingFont: 'dmserif',   bodyFont: 'nunito', headingScale: 'gross',    bgColor: '#FBF7F0', bgTexture: 'floral', bgGradient: false, cornerStyle: 'soft',    buttonStyle: 'pill',   cardStyle: 'flat',   density: 'luftig',   ornaments: true,  accentGradient: false } },
  { key: 'modern',         label: 'Modern Minimal', settings: { accent: '#2E3A59', headingFont: 'sans',      bodyFont: 'inter',  headingScale: 'standard', bgColor: '#FFFFFF', bgTexture: 'none',   bgGradient: false, cornerStyle: 'elegant', buttonStyle: 'square', cardStyle: 'shadow', density: 'standard', ornaments: false, accentGradient: false } },
  { key: 'romantisch',     label: 'Romantisch Rosé',settings: { accent: '#C98B9B', headingFont: 'script',    bodyFont: 'lora',   headingScale: 'gross',    bgColor: '#FBF1F1', bgTexture: 'none',   bgGradient: true,  cornerStyle: 'soft',    buttonStyle: 'pill',   cardStyle: 'shadow', density: 'luftig',   ornaments: true,  accentGradient: true  } },
  { key: 'greenery',       label: 'Greenery',       settings: { accent: '#5F7A6B', accent2: '#8DA68C', headingFont: 'cormorant', bodyFont: 'lora', headingScale: 'standard', bgColor: '#F1F5F0', bgTexture: 'floral', bgGradient: false, cornerStyle: 'soft', buttonStyle: 'pill', cardStyle: 'flat', density: 'standard', ornaments: true, accentGradient: false } },
  { key: 'vintage',        label: 'Vintage',        settings: { accent: '#7B2D3B', accent2: '#B89968', headingFont: 'playfair', bodyFont: 'lora', headingScale: 'gross', bgColor: '#FBF7F0', bgTexture: 'paper', bgGradient: false, cornerStyle: 'elegant', buttonStyle: 'square', cardStyle: 'border', density: 'standard', ornaments: true, accentGradient: false } },
  { key: 'blacktie',       label: 'Black Tie',      settings: { accent: '#2E3A59', accent2: '#B89968', headingFont: 'playfair', bodyFont: 'inter', headingScale: 'standard', bgColor: '#FFFFFF', bgTexture: 'none', bgGradient: false, cornerStyle: 'elegant', buttonStyle: 'square', cardStyle: 'shadow', density: 'luftig', ornaments: false, accentGradient: false } },
  { key: 'mediterran',     label: 'Mediterran',     settings: { accent: '#2E6E8E', accent2: '#C2724A', headingFont: 'dmserif', bodyFont: 'dmsans', headingScale: 'standard', bgColor: '#EFF4F8', bgTexture: 'linen', bgGradient: true, cornerStyle: 'soft', buttonStyle: 'pill', cardStyle: 'flat', density: 'standard', ornaments: true, accentGradient: false } },
  { key: 'lavendel_traum', label: 'Lavendel-Traum', settings: { accent: '#8A7AA8', accent2: '#C98B9B', headingFont: 'script', bodyFont: 'nunito', headingScale: 'gross', bgColor: '#F4F1F8', bgTexture: 'watercolor', bgGradient: true, cornerStyle: 'soft', buttonStyle: 'pill', cardStyle: 'shadow', density: 'luftig', ornaments: true, accentGradient: true } },
]

const HEADING_SCALE_MAP = { kompakt: 0.9, standard: 1, gross: 1.15 } as const
const CORNER_MAP = {
  soft:    { sm: '8px', md: '12px', lg: '16px' },
  elegant: { sm: '2px', md: '3px',  lg: '5px' },
} as const

// Validierung & Merge eingehender (ggf. unvollständiger) Settings.
export function normalizeSettings(raw: unknown): DisplaySettings {
  const s = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const hex6 = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
  const accent = hex6(s.accent) ? s.accent as string : DEFAULT_DISPLAY_SETTINGS.accent
  const accent2 = hex6(s.accent2) ? s.accent2 as string : null
  const headingFont = (typeof s.headingFont === 'string' && s.headingFont in HEADING_FONTS) ? s.headingFont as HeadingFontKey : DEFAULT_DISPLAY_SETTINGS.headingFont
  const bodyFont = (typeof s.bodyFont === 'string' && s.bodyFont in BODY_FONTS) ? s.bodyFont as BodyFontKey : DEFAULT_DISPLAY_SETTINGS.bodyFont
  const headingScale = (s.headingScale === 'kompakt' || s.headingScale === 'gross') ? s.headingScale : 'standard'
  const bgTexture = (['paper', 'dots', 'floral', 'marble', 'linen', 'watercolor'].includes(s.bgTexture as string)) ? s.bgTexture as BgTextureKey : 'none'
  // nur helle Hintergrundfarben zulassen (nah an Weiß)
  const bgColor = (typeof s.bgColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.bgColor) && isLightColor(s.bgColor)) ? s.bgColor : DEFAULT_DISPLAY_SETTINGS.bgColor
  const bgPhotoBlur = typeof s.bgPhotoBlur === 'number' && isFinite(s.bgPhotoBlur) ? Math.max(0, Math.min(30, Math.round(s.bgPhotoBlur))) : DEFAULT_DISPLAY_SETTINGS.bgPhotoBlur
  const cornerStyle = s.cornerStyle === 'elegant' ? 'elegant' : 'soft'
  const buttonStyle = s.buttonStyle === 'square' ? 'square' : 'pill'
  const cardStyle = (s.cardStyle === 'shadow' || s.cardStyle === 'flat') ? s.cardStyle : 'border'
  const density = (s.density === 'kompakt' || s.density === 'luftig') ? s.density : 'standard'
  const monogram = typeof s.monogram === 'string' ? s.monogram.slice(0, 24) : ''
  const hiddenSections = Array.isArray(s.hiddenSections)
    ? (s.hiddenSections as unknown[]).filter((k): k is string => typeof k === 'string' && RSVP_SECTIONS.some(sec => sec.key === k))
    : []
  const rawTexts = (s.texts && typeof s.texts === 'object') ? s.texts as Record<string, unknown> : {}
  const texts: Partial<RsvpTexts> = {}
  for (const key of Object.keys(RSVP_TEXT_DEFAULTS) as (keyof RsvpTexts)[]) {
    const v = rawTexts[key]
    if (typeof v === 'string' && v.trim()) texts[key] = v.slice(0, 280)
  }

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
    accent2,
    accentGradient: s.accentGradient === true,
    headingFont,
    bodyFont,
    headingScale,
    bgColor,
    bgTexture,
    bgGradient: s.bgGradient === true,
    bgPhotoR2Key: typeof s.bgPhotoR2Key === 'string' && s.bgPhotoR2Key ? s.bgPhotoR2Key : null,
    bgPhotoBlur,
    cornerStyle,
    buttonStyle,
    cardStyle,
    density,
    ornaments: s.ornaments !== false,
    countdown: s.countdown === true,
    monogram,
    hiddenSections,
    texts,
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
const MARBLE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23000' stroke-opacity='0.035' stroke-width='1'%3E%3Cpath d='M-10 30 Q40 10 70 40 T140 50'/%3E%3Cpath d='M-10 80 Q30 60 80 90 T150 80'/%3E%3Cpath d='M20 -10 Q40 40 20 90 T40 140'/%3E%3C/g%3E%3C/svg%3E\")"

// Liefert die Hintergrund-CSS-Werte für eine Textur (für gescoptes + inline-CSS).
export function textureStyle(key: DisplaySettings['bgTexture']): { image: string; size: string } {
  switch (key) {
    case 'dots':       return { image: 'radial-gradient(rgba(0,0,0,0.06) 1.2px, transparent 1.3px)', size: '16px 16px' }
    case 'paper':      return { image: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.018) 0 1px, transparent 1px 7px)', size: 'auto' }
    case 'floral':     return { image: FLORAL, size: '64px 64px' }
    case 'marble':     return { image: MARBLE, size: '120px 120px' }
    case 'linen':      return { image: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.022) 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, rgba(0,0,0,0.022) 0 1px, transparent 1px 4px)', size: 'auto' }
    case 'watercolor': return { image: 'radial-gradient(circle at 20% 25%, rgba(0,0,0,0.03), transparent 38%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.025), transparent 42%)', size: 'auto' }
    default:           return { image: 'none', size: 'auto' }
  }
}

// Effektive zweite Akzentfarbe (Fallback: aus Akzent abgeleitet).
export function effectiveAccent2(s: DisplaySettings): string {
  return s.accent2 ?? shade(s.accent, -0.3)
}

// Liefert den Wert eines anpassbaren Textes (Override oder Standard).
export function rsvpText(s: DisplaySettings, key: keyof RsvpTexts): string {
  const v = s.texts?.[key]
  return v && v.trim() ? v : RSVP_TEXT_DEFAULTS[key]
}

export function bodyFontHrefFor(key: BodyFontKey): string | null {
  return BODY_FONTS[key]?.href ?? null
}

const DENSITY_PAD = { kompakt: '13px', standard: '18px', luftig: '26px' } as const
const DENSITY_GAP = { kompakt: '10px', standard: '14px', luftig: '20px' } as const

/**
 * Gescoptes CSS (Klasse `.rsvp-root`) für die Gäste-/RSVP-Seite. Überschreibt
 * die Design-Tokens (Farben, Flächen, Radius, Schrift, Karten-Stil, Dichte)
 * für den gesamten RSVP-Teilbaum. Reiner String aus validierten Werten.
 */
export function buildRsvpThemeCss(input: DisplaySettings): string {
  const s = normalizeSettings(input)
  const accent = invitationAccent(s)
  const acc2 = effectiveAccent2(s)
  const deep = shade(accent, -0.18)
  const pale = shade(accent, 0.82)
  const corner = CORNER_MAP[s.cornerStyle]
  const btnRadius = s.buttonStyle === 'square' ? '8px' : '999px'
  const bodyFamily = BODY_FONTS[s.bodyFont].family
  const pad = DENSITY_PAD[s.density]
  const gap = DENSITY_GAP[s.density]

  // Karten-Stil → Flächen-, Rahmen- und Schatten-Tokens.
  let surface = '#FFFFFF', border = 'rgba(0,0,0,0.08)', shadow = 'none'
  if (s.cardStyle === 'shadow') { border = 'rgba(0,0,0,0.04)'; shadow = '0 6px 22px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)' }
  else if (s.cardStyle === 'flat') { surface = shade(s.bgColor, -0.035); border = 'transparent' }

  return `.rsvp-root{`
    + `--gold:${accent};--gold-deep:${deep};--gold-pale:${pale};--accent:${accent};--accent2:${acc2};`
    + `--bg:${s.bgColor};--surface:${surface};--surface2:${shade(s.bgColor, -0.03)};`
    + `--border:${border};--border2:${shade(border === 'transparent' ? s.bgColor : '#000000', 0.86)};`
    + `--ui-card-shadow:${shadow};--ui-card-pad:${pad};--ui-btn-radius:${btnRadius};--rsvp-gap:${gap};`
    + `--r-sm:${corner.sm};--r-md:${corner.md};--r-lg:${corner.lg};`
    + `font-family:${bodyFamily};`
    + `}`
    + `.rsvp-root .ui-card{box-shadow:var(--ui-card-shadow);}`
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
