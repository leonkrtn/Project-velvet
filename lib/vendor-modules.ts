import {
  MessageSquare, Calendar, MapPin, Users, Grid2X2,
  UtensilsCrossed, Cake, Camera, Music2, Flower2, FileText, Lightbulb,
  type LucideIcon,
} from 'lucide-react'

export interface ModuleDef {
  key:         string
  label:       string
  icon:        LucideIcon
  required?:   boolean
  readonlyKey?: string
}

export const ALL_MODULES: ModuleDef[] = [
  { key: 'mod_chat',       label: 'Kommunikation',      icon: MessageSquare, required: true },
  { key: 'mod_timeline',   label: 'Regieplan',           icon: Calendar },
  { key: 'mod_location',   label: 'Veranstaltungsort',   icon: MapPin },
  { key: 'mod_guests',     label: 'Gästeliste',          icon: Users },
  { key: 'mod_seating',    label: 'Tischordnung',        icon: Grid2X2 },
  { key: 'mod_catering',   label: 'Catering',            icon: UtensilsCrossed },
  { key: 'mod_patisserie', label: 'Patisserie',          icon: Cake },
  { key: 'mod_media',      label: 'Medien & Aufnahmen',  icon: Camera },
  { key: 'mod_music',      label: 'Musik',               icon: Music2 },
  { key: 'mod_decor',      label: 'Dekoration',          icon: Flower2 },
  { key: 'mod_files',      label: 'Dokumente',           icon: FileText },
  { key: 'mod_proposals',  label: 'Vorschläge',          icon: Lightbulb, readonlyKey: 'mod_proposals_read' },
]

export const MODULE_MAP: Record<string, ModuleDef> = Object.fromEntries(
  ALL_MODULES.map(m => [m.key, m])
)

export const ROLE_MODULE_DEFAULTS: Record<string, string[]> = {
  'Fotograf':              ['mod_chat', 'mod_timeline', 'mod_location', 'mod_guests', 'mod_seating', 'mod_media'],
  'Videograf':             ['mod_chat', 'mod_timeline', 'mod_location', 'mod_guests', 'mod_seating', 'mod_media', 'mod_music'],
  'Caterer':               ['mod_chat', 'mod_timeline', 'mod_location', 'mod_guests', 'mod_catering'],
  'Floristin':             ['mod_chat', 'mod_timeline', 'mod_location', 'mod_decor'],
  'Band / DJ':             ['mod_chat', 'mod_timeline', 'mod_location', 'mod_music'],
  'Konditorei':            ['mod_chat', 'mod_timeline', 'mod_location', 'mod_patisserie'],
  'Hairstylist / Make-up': ['mod_chat', 'mod_timeline', 'mod_location'],
  'Trauungsredner':        ['mod_chat', 'mod_timeline', 'mod_location', 'mod_guests'],
  'Location':              ['mod_chat', 'mod_timeline', 'mod_location', 'mod_guests', 'mod_catering', 'mod_seating'],
  'Andere':                ['mod_chat'],
}
