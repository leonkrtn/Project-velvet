// Markenfarbe (dienstleister_profiles.brand_color) als scoped CSS-Variablen-
// Override. Wird auf einem Wrapper-Element gesetzt (NICHT :root), damit die
// Akzentfarbe nur das jeweilige Vendor-Profil einfärbt und andere Anbieter /
// der Rest der App unberührt bleiben. Helle/dunkle Töne via shade() aus
// lib/display-settings.ts (bestehendes Muster aus buildThemeCss).

import type React from 'react'
import { shade } from '@/lib/display-settings'

const HEX = /^#[0-9a-fA-F]{6}$/

export function isBrandColor(v: string | null | undefined): v is string {
  return !!v && HEX.test(v)
}

/**
 * Brautpaar-Theme-Akzente (Detailseite + Vorschau). Überschreibt --bp-gold und
 * die abgeleiteten Töne. Gibt {} zurück, wenn keine valide Farbe vorliegt.
 */
export function brandGoldVars(color: string | null | undefined): React.CSSProperties {
  if (!isBrandColor(color)) return {}
  const vars: Record<string, string> = {
    '--bp-gold': color,
    '--bp-gold-deep': shade(color, -0.18),
    '--bp-gold-pale': shade(color, 0.82),
    '--bp-gold-mist': shade(color, 0.7),
    '--bp-rule-gold': shade(color, 0.5),
  }
  return vars as React.CSSProperties
}

/**
 * Vendor-Dashboard-Akzent (Berichte). Überschreibt --accent + --accent-light.
 */
export function brandAccentVars(color: string | null | undefined): React.CSSProperties {
  if (!isBrandColor(color)) return {}
  const vars: Record<string, string> = {
    '--accent': color,
    '--accent-light': shade(color, 0.9),
  }
  return vars as React.CSSProperties
}
