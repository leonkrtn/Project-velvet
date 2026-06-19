// lib/wedding/templates.ts
// Registry der 6 Hochzeitswebsite-Templates. Jedes Template hat eigenes Layout UND eigenen Stil.
// Die CSS-Variablen werden im öffentlichen Layout als inline-Style am .wd-root gesetzt;
// layout-spezifische Regeln greifen über [data-template="<id>"] in wedding.css.

export type StoryLayout =
  | 'vertical-single'   // einseitige Mittellinie
  | 'vertical-zigzag'   // abwechselnd links/rechts
  | 'vertical-alt-card' // alternierende Karten mit Bild
  | 'curved'            // geschwungene vertikale Linie
  | 'horizontal'        // horizontaler Faden (scroll-snap)
  | 'center-spine'      // zentrale Linie, dramatisch

export interface WeddingTemplate {
  id: string
  name: string
  tagline: string
  /** Google-Font-Familien (müssen im Layout geladen werden). */
  fontHeading: string
  fontBody: string
  storyLayout: StoryLayout
  /** CSS-Custom-Properties für das Theme. */
  vars: Record<string, string>
  /** Vorschau-Farben für die Template-Auswahl. */
  swatch: string[]
}

export const TEMPLATES: WeddingTemplate[] = [
  {
    id: 'classic-elegance',
    name: 'Classic Elegance',
    tagline: 'Zeitlos, Serifen, Creme & Gold',
    fontHeading: "'Cormorant Garamond', serif",
    fontBody: "'DM Sans', sans-serif",
    storyLayout: 'vertical-single',
    swatch: ['#f7f2ea', '#b9975b', '#2c2622'],
    vars: {
      '--wd-bg': '#f7f2ea',
      '--wd-surface': '#ffffff',
      '--wd-ink': '#2c2622',
      '--wd-ink-soft': '#6b6258',
      '--wd-accent': '#b9975b',
      '--wd-accent-soft': '#e7dcc4',
      '--wd-line': '#e3d9c8',
      '--wd-radius': '4px',
      '--wd-hero-overlay': 'linear-gradient(180deg, rgba(20,16,12,0.34), rgba(20,16,12,0.58))',
      '--wd-heading-spacing': '0.06em',
      '--wd-heading-transform': 'none',
    },
  },
  {
    id: 'modern-minimal',
    name: 'Modern Minimal',
    tagline: 'Klar, Schwarz-Weiß, viel Weißraum',
    fontHeading: "'Montserrat', sans-serif",
    fontBody: "'DM Sans', sans-serif",
    storyLayout: 'vertical-zigzag',
    swatch: ['#ffffff', '#111111', '#9a9a9a'],
    vars: {
      '--wd-bg': '#ffffff',
      '--wd-surface': '#fafafa',
      '--wd-ink': '#111111',
      '--wd-ink-soft': '#6b6b6b',
      '--wd-accent': '#111111',
      '--wd-accent-soft': '#ededed',
      '--wd-line': '#e6e6e6',
      '--wd-radius': '0px',
      '--wd-hero-overlay': 'linear-gradient(180deg, rgba(0,0,0,0.32), rgba(0,0,0,0.56))',
      '--wd-heading-spacing': '0.22em',
      '--wd-heading-transform': 'uppercase',
    },
  },
  {
    id: 'botanic-sage',
    name: 'Botanic Sage',
    tagline: 'Salbeigrün, organisch, natürlich',
    fontHeading: "'Cormorant Garamond', serif",
    fontBody: "'DM Sans', sans-serif",
    storyLayout: 'vertical-alt-card',
    swatch: ['#f1f3ec', '#7e8c6a', '#374231'],
    vars: {
      '--wd-bg': '#f1f3ec',
      '--wd-surface': '#ffffff',
      '--wd-ink': '#2f3a29',
      '--wd-ink-soft': '#5e6a54',
      '--wd-accent': '#7e8c6a',
      '--wd-accent-soft': '#dde3d2',
      '--wd-line': '#d3dac6',
      '--wd-radius': '14px',
      '--wd-hero-overlay': 'linear-gradient(180deg, rgba(28,38,22,0.34), rgba(28,38,22,0.58))',
      '--wd-heading-spacing': '0.04em',
      '--wd-heading-transform': 'none',
    },
  },
  {
    id: 'blush-romance',
    name: 'Blush Romance',
    tagline: 'Zartrosa, weich, romantisch',
    fontHeading: "'Italiana', serif",
    fontBody: "'DM Sans', sans-serif",
    storyLayout: 'curved',
    swatch: ['#fbf1f1', '#c98b86', '#5a3a39'],
    vars: {
      '--wd-bg': '#fbf1f1',
      '--wd-surface': '#fffafa',
      '--wd-ink': '#4a3433',
      '--wd-ink-soft': '#8a6b6a',
      '--wd-accent': '#c98b86',
      '--wd-accent-soft': '#f3dad8',
      '--wd-line': '#efd9d8',
      '--wd-radius': '24px',
      '--wd-hero-overlay': 'linear-gradient(180deg, rgba(60,32,32,0.32), rgba(60,32,32,0.56))',
      '--wd-heading-spacing': '0.05em',
      '--wd-heading-transform': 'none',
    },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    tagline: 'Magazin-Stil, große Display-Serifen',
    fontHeading: "'Playfair Display', serif",
    fontBody: "'DM Sans', sans-serif",
    storyLayout: 'horizontal',
    swatch: ['#f4f1ec', '#1d1b18', '#a8743a'],
    vars: {
      '--wd-bg': '#f4f1ec',
      '--wd-surface': '#ffffff',
      '--wd-ink': '#1d1b18',
      '--wd-ink-soft': '#5c574f',
      '--wd-accent': '#a8743a',
      '--wd-accent-soft': '#e9dcc8',
      '--wd-line': '#ddd6c9',
      '--wd-radius': '2px',
      '--wd-hero-overlay': 'linear-gradient(120deg, rgba(20,18,15,0.62), rgba(20,18,15,0.32))',
      '--wd-heading-spacing': '0.01em',
      '--wd-heading-transform': 'none',
    },
  },
  {
    id: 'dark-luxe',
    name: 'Dark Luxe',
    tagline: 'Dunkel, golden, dramatisch',
    fontHeading: "'Cormorant Garamond', serif",
    fontBody: "'Montserrat', sans-serif",
    storyLayout: 'center-spine',
    swatch: ['#15130f', '#caa45a', '#f3ead6'],
    vars: {
      '--wd-bg': '#15130f',
      '--wd-surface': '#1f1c16',
      '--wd-ink': '#f3ead6',
      '--wd-ink-soft': '#b6ac98',
      '--wd-accent': '#caa45a',
      '--wd-accent-soft': '#3a3326',
      '--wd-line': '#3a342a',
      '--wd-radius': '6px',
      '--wd-hero-overlay': 'linear-gradient(180deg, rgba(0,0,0,0.4), rgba(0,0,0,0.65))',
      '--wd-heading-spacing': '0.12em',
      '--wd-heading-transform': 'none',
    },
  },
]

export const DEFAULT_TEMPLATE_ID = 'classic-elegance'

export function getTemplate(id: string | null | undefined): WeddingTemplate {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]
}

/** Inline-Style-Objekt mit allen Theme-Variablen + Schriftarten für das .wd-root. */
export function templateCssVars(id: string | null | undefined): Record<string, string> {
  const t = getTemplate(id)
  return {
    ...t.vars,
    '--wd-font-heading': t.fontHeading,
    '--wd-font-body': t.fontBody,
  }
}
