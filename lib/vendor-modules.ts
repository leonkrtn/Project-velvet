import {
  MessageSquare, Calendar, MapPin, Users, Grid2X2,
  UtensilsCrossed, Camera, Music2, Flower2, FileText,
  type LucideIcon,
} from 'lucide-react'

export interface ModuleDef {
  key:          string
  label:        string
  icon:         LucideIcon
  required?:    boolean
  readonlyKey?: string
}

export const ALL_MODULES: ModuleDef[] = [
  { key: 'mod_chat',       label: 'Kommunikation',      icon: MessageSquare, required: true },
  { key: 'mod_timeline',   label: 'Regieplan',           icon: Calendar,       readonlyKey: 'mod_timeline_read' },
  { key: 'mod_location',   label: 'Veranstaltungsort',   icon: MapPin,         readonlyKey: 'mod_location_read' },
  { key: 'mod_guests',     label: 'Gästeliste',          icon: Users,          readonlyKey: 'mod_guests_read' },
  { key: 'mod_seating',    label: 'Tischordnung',        icon: Grid2X2,        readonlyKey: 'mod_seating_read' },
  { key: 'mod_catering',   label: 'Catering',            icon: UtensilsCrossed, readonlyKey: 'mod_catering_read' },
  { key: 'mod_media',      label: 'Medien & Aufnahmen',  icon: Camera,         readonlyKey: 'mod_media_read' },
  { key: 'mod_music',      label: 'Musik',               icon: Music2,         readonlyKey: 'mod_music_read' },
  { key: 'mod_decor',      label: 'Dekoration',          icon: Flower2,        readonlyKey: 'mod_decor_read' },
  { key: 'mod_files',      label: 'Dokumente',           icon: FileText,       readonlyKey: 'mod_files_read' },
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
  'Konditorei':            ['mod_chat', 'mod_timeline', 'mod_location'],
  'Hairstylist / Make-up': ['mod_chat', 'mod_timeline', 'mod_location'],
  'Trauungsredner':        ['mod_chat', 'mod_timeline', 'mod_location', 'mod_guests'],
  'Location':              ['mod_chat', 'mod_timeline', 'mod_location', 'mod_guests', 'mod_catering', 'mod_seating'],
  'Andere':                ['mod_chat'],
}
