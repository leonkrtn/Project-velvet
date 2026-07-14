import { Info, LayoutGrid, Music } from 'lucide-react'

// Gemeinsame Icon-Zuordnung für Module, die in mehreren Portalen (Veranstalter
// + Brautpaar) auftauchen. Behebt die im UX-Audit dokumentierte Abweichung
// (Allgemein: Settings vs. Info, Sitzplan: Grid2X2 vs. LayoutGrid, Musik:
// Music2 vs. Music) — beide Sidebars importieren ab jetzt von hier.
export const NavIconAllgemein = Info
export const NavIconSitzplan = LayoutGrid
export const NavIconMusik = Music
