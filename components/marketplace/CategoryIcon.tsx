'use client'

import {
  Camera, Video, UtensilsCrossed, Disc3, Music2, Flower2, Building2,
  CakeSlice, Palette, Sparkles, ClipboardList, Store, type LucideIcon,
} from 'lucide-react'

// Lucide-Icon je Marktplatz-Kategorie (keine Emojis).
const ICONS: Record<string, LucideIcon> = {
  fotograf: Camera,
  videograf: Video,
  catering: UtensilsCrossed,
  dj_musik: Disc3,
  band: Music2,
  floristik: Flower2,
  location: Building2,
  konditorei: CakeSlice,
  deko: Palette,
  hair_makeup: Sparkles,
  planer: ClipboardList,
  sonstiges: Store,
}

export default function CategoryIcon({ category, size = 16, color }: { category: string; size?: number; color?: string }) {
  const Icon = ICONS[category] ?? Store
  return <Icon size={size} color={color} />
}
