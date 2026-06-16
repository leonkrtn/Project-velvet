// Design-Studio-Helfer: Schrift-Paarungen, Farb-Harmonie-Generator und
// Stil-Code (Export/Import). Baut auf lib/display-settings.ts auf.

import {
  DEFAULT_DISPLAY_SETTINGS, normalizeSettings, isLightColor,
  type DisplaySettings, type HeadingFontKey, type BodyFontKey,
} from './display-settings'

// ── Schrift-Paarungen (kuratierte Überschrift + Fließtext) ──────────────────────
export interface FontPairing {
  key: string
  label: string
  hint: string
  heading: HeadingFontKey
  body: BodyFontKey
}

export const FONT_PAIRINGS: FontPairing[] = [
  { key: 'klassisch',   label: 'Klassisch elegant',  hint: 'Cormorant · System',     heading: 'cormorant', body: 'system' },
  { key: 'modern',      label: 'Modern & klar',      hint: 'Montserrat · Inter',     heading: 'sans',      body: 'inter' },
  { key: 'romantisch',  label: 'Romantisch',         hint: 'Great Vibes · Lora',     heading: 'script',    body: 'lora' },
  { key: 'editorial',   label: 'Editorial',          hint: 'Playfair · Lora',        heading: 'playfair',  body: 'lora' },
  { key: 'zeitgemaess', label: 'Zeitgemäß',          hint: 'DM Serif · DM Sans',     heading: 'dmserif',   body: 'dmsans' },
  { key: 'freundlich',  label: 'Weich & freundlich', hint: 'DM Serif · Nunito',      heading: 'dmserif',   body: 'nunito' },
]

// ── HSL-Konvertierung ───────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return '#' + c(r) + c(g) + c(b)
}
export function hexToHsl(hex: string): [number, number, number] {
  let [r, g, b] = hexToRgb(hex)
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h /= 6
  }
  return [h * 360, s * 100, l * 100]
}
export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

// ── Farb-Harmonie-Generator ─────────────────────────────────────────────────────
export interface Harmony {
  key: string
  label: string
  accent: string    // ggf. leicht angepasste Akzentfarbe
  accent2: string   // passende Zweitfarbe
  bgColor: string   // helle, abgestimmte Hintergrundfarbe (immer „light")
  swatches: string[] // 3 Farbtupfer für die Vorschau
}

// Erzeugt eine helle, dezente Hintergrundfarbe zum gegebenen Farbton.
function lightBgForHue(h: number): string {
  const hex = hslToHex(h, 30, 96)
  return isLightColor(hex) ? hex : hslToHex(h, 22, 97)
}

// Liefert stimmige Paletten aus einer Akzentfarbe (Komplementär, Analog, …).
export function generateHarmonies(accent: string): Harmony[] {
  const [h, s, l] = hexToHsl(accent)
  const baseSat = Math.max(28, Math.min(70, s))
  const baseLit = Math.max(32, Math.min(58, l))
  const base = hslToHex(h, baseSat, baseLit)

  const mk = (key: string, label: string, accent2: string, bgHue: number): Harmony => ({
    key, label, accent: base, accent2,
    bgColor: lightBgForHue(bgHue),
    swatches: [base, accent2, lightBgForHue(bgHue)],
  })

  return [
    mk('analog',        'Analog',        hslToHex(h + 30, baseSat, baseLit - 6), h - 30),
    mk('komplementaer', 'Komplementär',  hslToHex(h + 180, baseSat - 6, baseLit - 4), h),
    mk('triade',        'Triade',        hslToHex(h + 120, baseSat - 8, baseLit - 4), h + 240),
    mk('monochrom',     'Monochrom',     hslToHex(h, baseSat + 8, Math.max(22, baseLit - 22)), h),
    mk('warmkalt',      'Warm/Kühl',     hslToHex(h + 210, baseSat - 4, baseLit - 6), h + 20),
  ]
}

// ── Stil-Code (Export / Import) ─────────────────────────────────────────────────
// Kompakter, kopierbarer Code der gesamten Gestaltung (Base64 von JSON).
const STYLE_CODE_PREFIX = 'FOREVR1:'

function toBase64(str: string): string {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)))
  return Buffer.from(str, 'utf-8').toString('base64')
}
function fromBase64(b64: string): string {
  if (typeof atob === 'function') return decodeURIComponent(escape(atob(b64)))
  return Buffer.from(b64, 'base64').toString('utf-8')
}

export function encodeStyleCode(s: DisplaySettings): string {
  // Bild-Keys NICHT exportieren — sie sind event-spezifisch.
  const exportable: DisplaySettings = {
    ...s,
    bgPhotoR2Key: null,
    invitation: { ...s.invitation, motiveR2Key: null },
  }
  return STYLE_CODE_PREFIX + toBase64(JSON.stringify(exportable))
}

export function decodeStyleCode(code: string): DisplaySettings | null {
  try {
    const trimmed = code.trim()
    const body = trimmed.startsWith(STYLE_CODE_PREFIX) ? trimmed.slice(STYLE_CODE_PREFIX.length) : trimmed
    const json = JSON.parse(fromBase64(body))
    return normalizeSettings(json)
  } catch {
    return null
  }
}

// Setzt eine ganze Sektion auf die Standardwerte zurück (gibt ein Patch zurück).
export function resetSectionPatch(section: string): Partial<DisplaySettings> {
  const d = DEFAULT_DISPLAY_SETTINGS
  switch (section) {
    case 'farben':   return { accent: d.accent, accent2: d.accent2, accentGradient: d.accentGradient, bgColor: d.bgColor, bgTexture: d.bgTexture, bgGradient: d.bgGradient }
    case 'schrift':  return { headingFont: d.headingFont, bodyFont: d.bodyFont, headingScale: d.headingScale }
    case 'layout':   return { cornerStyle: d.cornerStyle, buttonStyle: d.buttonStyle, cardStyle: d.cardStyle, density: d.density, ornaments: d.ornaments, countdown: d.countdown, monogram: d.monogram }
    case 'bilder':   return { bgPhotoBlur: d.bgPhotoBlur, bgPhotoOverlay: d.bgPhotoOverlay, bgPhotoFocus: { ...d.bgPhotoFocus }, coverFocus: { ...d.coverFocus } }
    case 'rsvp':     return { hiddenSections: [...d.hiddenSections] }
    default:         return {}
  }
}
