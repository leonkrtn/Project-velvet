// lib/store.ts — Velvet complete data model

export type MealChoice   = 'fleisch' | 'fisch' | 'vegetarisch' | 'vegan'
export type AllergyTag   = 'Gluten' | 'Laktose' | 'Nüsse' | 'Fisch' | 'Soja' | 'Halal' | 'Kosher' | 'Ei'
export type TransportMode = 'auto' | 'bahn' | 'flugzeug' | 'andere'
export type GuestStatus = 'angelegt' | 'eingeladen' | 'zugesagt' | 'abgesagt'
export type AltersKategorie = 'erwachsen' | '13-17' | '6-12' | '0-6'

export interface Begleitperson {
  id: string
  name: string
  ageCategory: AltersKategorie
  trinkAlkohol?: boolean
  meal?: MealChoice
  allergies: AllergyTag[]
  allergyCustom?: string
}

export interface Guest {
  id: string; name: string; email: string; token: string; status: GuestStatus
  phone?: string; address?: string
  trinkAlkohol?: boolean
  begleitpersonen: Begleitperson[]
  meal?: MealChoice
  allergies: AllergyTag[]; allergyCustom?: string
  arrivalDate?: string; arrivalTime?: string; transport?: TransportMode
  hotelRoomId?: string
  message?: string; respondedAt?: string
  subEventIds?: string[]
}

// ── Hotel ──────────────────────────────────────────────────────────────────
export interface HotelRoom {
  id: string; type: string; totalRooms: number; bookedRooms: number; pricePerNight: number
}

export interface Hotel {
  id: string; name: string; address: string; rooms: HotelRoom[]
}

// ── Sub-Event ─────────────────────────────────────────────────────────────
export interface SubEvent {
  id: string; name: string; date: string; time?: string
  venue: string; description?: string; guestIds: string[]
}

// ── Timeline ───────────────────────────────────────────────────────────────
export interface TimelineEntry { time: string; title: string; location: string }

// ── Seating ────────────────────────────────────────────────────────────────
export interface SeatingTable {
  id: string; name: string; capacity: number; guestIds: string[]
  x?: number; y?: number          // center position in METERS within the room
  tableLength?: number            // meters (length, or diameter for round)
  tableWidth?: number             // meters (width/depth, ignored for round)
  rotation?: number               // degrees
  shape?: 'rectangular' | 'round'
}

// ── Budget ─────────────────────────────────────────────────────────────────
export type PaymentStatus = 'offen' | 'anzahlung' | 'bezahlt'
export type BudgetCategory =
  | 'Location' | 'Catering' | 'Musik' | 'Fotografie' | 'Floristik'
  | 'Kleidung' | 'Ringe' | 'Transport' | 'Papeterie' | 'Sonstiges'

export interface BudgetItem {
  id: string; category: BudgetCategory; description: string
  planned: number; actual: number; status: PaymentStatus; notes?: string
}

// ── Vendors ────────────────────────────────────────────────────────────────
export type VendorCategory =
  | 'Fotograf' | 'Videograf' | 'Catering' | 'Floristik' | 'Musik / Band'
  | 'DJ' | 'Location' | 'Hochzeitsplaner' | 'Transport' | 'Konditorei' | 'Sonstiges'
export type VendorStatus = 'angefragt' | 'bestätigt' | 'abgesagt'

export interface Vendor {
  id: string; name: string; category: VendorCategory; status: VendorStatus
  contactName?: string; phone?: string; email?: string
  price?: number; notes?: string
}

// ── Tasks ──────────────────────────────────────────────────────────────────
export type TaskPhase = '12+ Monate' | '6–12 Monate' | '3–6 Monate' | '1–3 Monate' | 'Letzte Woche' | 'Hochzeitstag'

export interface Task {
  id: string; title: string; phase: TaskPhase; done: boolean; notes?: string
}

// ── Reminders ──────────────────────────────────────────────────────────────
export type ReminderType = 'rsvp-followup' | 'deadline' | 'payment'

export interface Reminder {
  id: string; type: ReminderType; title: string
  targetDate?: string; sent: boolean; notes?: string
}

// ── Catering Plan ─────────────────────────────────────────────────────────
export interface CateringPlan {
  serviceStyle:            'klassisch' | 'buffet' | 'family' | 'foodtruck' | 'live' | ''
  locationHasKitchen:      boolean
  midnightSnack:           boolean
  midnightSnackNote:       string
  drinksBilling:           'pauschale' | 'einzeln'
  drinksSelection:         string[]   // 'wein'|'bier'|'softdrinks'|'cocktails'|'longdrinks'
  champagneFingerFood:     boolean
  champagneFingerFoodNote: string
  serviceStaff:            boolean
  equipmentNeeded:         string[]   // 'geschirr'|'glaeser'|'tischdecken'|'buffettische'|'deko'
  budgetPerPerson:         number
  budgetIncludesDrinks:    boolean
  cateringNotes:           string
}

// ── Organizer / Veranstalter ───────────────────────────────────────────────

export type FeatureKey =
  | 'budget' | 'vendors' | 'tasks' | 'reminders'
  | 'seating' | 'catering' | 'sub-events' | 'invite' | 'deko' | 'gaeste-fotos'
  | 'messaging'

export const DEFAULT_FEATURE_TOGGLES: Record<FeatureKey, boolean> = {
  budget: true, vendors: true, tasks: true, reminders: true,
  seating: true, catering: true, 'sub-events': true, invite: true,
  deko: true, 'gaeste-fotos': true, messaging: false,
}

// ── Deko ──────────────────────────────────────────────────────────────────
export interface DekoWish {
  id: string
  title: string
  notes: string
  imageUrl?: string
}

// ── Gäste-Fotos ───────────────────────────────────────────────────────────
export interface GuestPhoto {
  id: string
  uploaderName: string
  dataUrl: string  // base64 in localStorage-Modus, Storage URL in Supabase-Modus
  uploadedAt: string
}

export interface OrganizerSettings {
  featureToggles: Record<FeatureKey, boolean>
  locationImages: string[]
}

// ── Main Event ─────────────────────────────────────────────────────────────
export interface Event {
  id: string; coupleName: string; date: string
  venue: string; venueAddress: string; dresscode: string
  childrenAllowed: boolean; childrenNote?: string
  hotels: Hotel[]
  // legacy fields kept for migration only
  hotelName?: string; hotelAddress?: string; hotelRooms?: HotelRoom[]
  mealOptions: MealChoice[]
  timeline: TimelineEntry[]; guests: Guest[]
  subEvents: SubEvent[]; seatingTables: SeatingTable[]
  budget: BudgetItem[]; vendors: Vendor[]; tasks: Task[]
  reminders: Reminder[]; createdAt: string
  onboardingComplete: boolean
  maxBegleitpersonen: number
  roomLength?: number   // meters, default 12
  roomWidth?: number    // meters, default 8
  catering?: CateringPlan
  // Locked catering fields (set when organizer suggestion is accepted)
  cateringLockedFields?: Partial<Record<keyof CateringPlan, boolean>>
  organizer?: OrganizerSettings
  dekoWishes: DekoWish[]
  guestPhotos: GuestPhoto[]
  dataFreezeAt?: string  // ISO timestamp; set = data frozen (read-only)
}

// ── Seed ───────────────────────────────────────────────────────────────────

const SEED_GUESTS: Guest[] = [
  {
    id:'g1', name:'Marie Koch', email:'marie.koch@example.com', token:'tok-marie',
    status:'zugesagt', trinkAlkohol:true,
    begleitpersonen:[],
    meal:'fleisch', allergies:['Laktose'], allergyCustom:'',
    arrivalDate:'2026-06-13', arrivalTime:'15:00', transport:'bahn',
    hotelRoomId:'room1', message:'Wir freuen uns riesig!', respondedAt:'2026-03-10T09:22:00Z',
  },
  {
    id:'g2', name:'Bernd Huber', email:'bernd.huber@example.com', token:'tok-bernd',
    status:'zugesagt', trinkAlkohol:true,
    begleitpersonen:[{
      id:'bp-g2', name:'Sandra Huber', ageCategory:'erwachsen',
      trinkAlkohol:false, meal:'vegan', allergies:['Soja'], allergyCustom:'',
    }],
    meal:'fisch', allergies:['Nüsse'], allergyCustom:'',
    arrivalDate:'2026-06-13', arrivalTime:'18:00', transport:'auto',
    hotelRoomId:'room1', message:'', respondedAt:'2026-03-12T14:05:00Z',
  },
  {
    id:'g3', name:'Lena Müller', email:'lena.mueller@example.com', token:'tok-lena',
    status:'zugesagt', trinkAlkohol:false,
    begleitpersonen:[],
    meal:'vegetarisch', allergies:['Gluten','Laktose'], allergyCustom:'Karotten',
    arrivalDate:'2026-06-14', arrivalTime:'10:00', transport:'flugzeug',
    hotelRoomId:'none', message:'Herzlichen Glückwunsch!', respondedAt:'2026-03-15T11:30:00Z',
  },
  {
    id:'g4', name:'Anna Schulz', email:'anna.schulz@example.com', token:'tok-anna',
    status:'eingeladen', begleitpersonen:[], allergies:[],
  },
  {
    id:'g5', name:'Frank Kaiser', email:'frank.kaiser@example.com', token:'tok-frank',
    status:'abgesagt', begleitpersonen:[], allergies:[],
    message:'Leider kann ich nicht kommen.', respondedAt:'2026-03-18T08:00:00Z',
  },
]

const SEED_BUDGET: BudgetItem[] = [
  { id:'b1', category:'Location',    description:'Schloss Neuhof — Miete & Service', planned:8000,  actual:8000,  status:'bezahlt'   },
  { id:'b2', category:'Catering',    description:'Menü & Getränke (90 Personen)',    planned:12000, actual:6000,  status:'anzahlung' },
  { id:'b3', category:'Fotografie',  description:'Foto & Video Duo',                 planned:3500,  actual:1000,  status:'anzahlung' },
  { id:'b4', category:'Floristik',   description:'Tischdeko, Brautstrauß, Gestecke', planned:2200,  actual:0,     status:'offen'     },
  { id:'b5', category:'Musik',        description:'Jazzband Sektempfang + DJ Abend',  planned:2800,  actual:800,   status:'anzahlung' },
  { id:'b6', category:'Papeterie',   description:'Einladungen, Menükarten, Schilder', planned:600,  actual:600,   status:'bezahlt'   },
  { id:'b7', category:'Transport',   description:'Oldtimer für Brautpaar',            planned:500,   actual:0,     status:'offen'     },
  { id:'b8', category:'Kleidung',    description:'Brautkleid, Anzug, Schuhe',         planned:4000,  actual:4200,  status:'bezahlt'   },
]

const SEED_VENDORS: Vendor[] = [
  { id:'v1', name:'Schloss Neuhof',       category:'Location',       status:'bestätigt', contactName:'Frau Weber',    phone:'06221 12345', email:'events@neuhof.de',          price:8000 },
  { id:'v2', name:'Küche & Kunst GmbH',   category:'Catering',       status:'bestätigt', contactName:'Herr Becker',   phone:'06221 98765', email:'info@kuechekunst.de',       price:12000 },
  { id:'v3', name:'Studio Lichtblick',    category:'Fotograf',       status:'bestätigt', contactName:'Jana Richter',  phone:'0173 4567890', email:'jana@lichtblick.photo',    price:3500 },
  { id:'v4', name:'Floral Dreams',        category:'Floristik',      status:'angefragt', contactName:'Maria Santos',  phone:'06221 55443', email:'info@floraldreams.de',      price:2200 },
  { id:'v5', name:'Blue Note Jazz Trio',  category:'Musik / Band',   status:'bestätigt', contactName:'Klaus Müller',  phone:'0152 9876543', email:'bluenote@mail.de',         price:1800 },
  { id:'v6', name:'DJ Schneider',         category:'DJ',             status:'bestätigt', contactName:'Tim Schneider', phone:'0171 1234567', email:'dj@schneider-events.de',   price:1000 },
]

const SEED_TASKS: Task[] = [
  // 12+
  { id:'t1',  phase:'12+ Monate', title:'Location besichtigen & buchen',         done:true  },
  { id:'t2',  phase:'12+ Monate', title:'Grobes Budget festlegen',               done:true  },
  { id:'t3',  phase:'12+ Monate', title:'Standesamttermin reservieren',          done:true  },
  { id:'t4',  phase:'12+ Monate', title:'Brautkleid / Anzug erste Anprobe',      done:false },
  // 6–12
  { id:'t5',  phase:'6–12 Monate', title:'Fotograf buchen',                      done:true  },
  { id:'t6',  phase:'6–12 Monate', title:'Catering auswählen & Probe-Menü',      done:true  },
  { id:'t7',  phase:'6–12 Monate', title:'Einladungen gestalten & versenden',    done:false },
  { id:'t8',  phase:'6–12 Monate', title:'Floristik anfragen',                   done:false },
  // 3–6
  { id:'t9',  phase:'3–6 Monate', title:'RSVP-Deadline setzen & nachfassen',     done:false },
  { id:'t10', phase:'3–6 Monate', title:'Sitzplan erstellen',                    done:false },
  { id:'t11', phase:'3–6 Monate', title:'Menüliste an Caterer übergeben',        done:false },
  { id:'t12', phase:'3–6 Monate', title:'Musik / Playlist abstimmen',            done:false },
  // 1–3
  { id:'t13', phase:'1–3 Monate', title:'Standesamtliche Unterlagen einreichen', done:false },
  { id:'t14', phase:'1–3 Monate', title:'Finale Anprobe Kleidung',               done:false },
  { id:'t15', phase:'1–3 Monate', title:'Ringe abholen',                         done:false },
  { id:'t16', phase:'1–3 Monate', title:'Ablaufplan an alle Dienstleister',      done:false },
  // Letzte Woche
  { id:'t17', phase:'Letzte Woche', title:'Sitzplan ans Servicepersonal',        done:false },
  { id:'t18', phase:'Letzte Woche', title:'Menükarten drucken',                  done:false },
  { id:'t19', phase:'Letzte Woche', title:'Persönliche Eheversprechen fertig',   done:false },
  // Hochzeitstag
  { id:'t20', phase:'Hochzeitstag', title:'Brautstrauß vom Floristen abholen',   done:false },
  { id:'t21', phase:'Hochzeitstag', title:'Ringe einpacken',                     done:false },
]

const SEED_REMINDERS: Reminder[] = [
  { id:'r1', type:'rsvp-followup', title:'RSVP-Erinnerung an Anna Schulz',          sent:false },
  { id:'r2', type:'payment',       title:'Restzahlung Catering fällig',    targetDate:'2026-05-01', sent:false },
  { id:'r3', type:'deadline',      title:'Sitzplan an Location schicken',  targetDate:'2026-06-07', sent:false },
  { id:'r4', type:'payment',       title:'Restzahlung Fotograf fällig',    targetDate:'2026-06-01', sent:false },
]

const SEED_SUB_EVENTS: SubEvent[] = [
  { id:'se1', name:'Polterabend',    date:'2026-06-12', time:'19:00', venue:'Garten der Schwiegereltern', description:'Gemütlicher Abend mit Familie und engsten Freunden.', guestIds:['g1','g2','g3'] },
  { id:'se2', name:'Standesamt',     date:'2026-06-14', time:'11:00', venue:'Rathaus Heidelberg, Saal 3',  description:'Offizielle Trauung. Nur engste Familie.',              guestIds:['g1','g3']      },
  { id:'se3', name:'Kirchliche Trauung & Feier', date:'2026-06-14', time:'14:00', venue:'Schloss Neuhof', description:'Hauptfeier mit allen Gästen.',                       guestIds:['g1','g2','g3','g4','g5'] },
  { id:'se4', name:'Brunch am Folgetag', date:'2026-06-15', time:'10:30', venue:'Hotel Neuhof, Terrasse', description:'Entspannter Brunch für übernachtende Gäste.',        guestIds:['g1','g2','g3'] },
]

const SEED_SEATING: SeatingTable[] = [
  { id:'tbl1', name:'Familie',    capacity:8, guestIds:['g1','g3'], x:3.0, y:2.5, tableLength:2.0, tableWidth:0.8, rotation:0,  shape:'rectangular' },
  { id:'tbl2', name:'Freunde',    capacity:8, guestIds:['g2'],      x:7.0, y:2.5, tableLength:2.0, tableWidth:0.8, rotation:0,  shape:'rectangular' },
  { id:'tbl3', name:'Ehrentisch', capacity:6, guestIds:[],          x:5.0, y:5.5, tableLength:1.4, tableWidth:1.4, rotation:0,  shape:'round'        },
]

const SEED_ORGANIZER: OrganizerSettings = {
  featureToggles: { ...DEFAULT_FEATURE_TOGGLES },
  locationImages: [],
}

export const SEED_EVENT: Event = {
  id:'evt-demo', coupleName:'Julia & Thomas', date:'2026-06-14',
  venue:'Schloss Neuhof', venueAddress:'Schlossweg 1, 69115 Heidelberg',
  dresscode:'Festlich — Gartenparty',
  roomLength: 12, roomWidth: 8,
  childrenAllowed: true, childrenNote:'Kinder ab 6 Jahren herzlich willkommen',
  mealOptions: ['fleisch','fisch','vegetarisch','vegan'],
  hotels:[],
  timeline:[
    { time:'11:00', title:'Standesamt',   location:'Rathaus Heidelberg'       },
    { time:'13:00', title:'Sektempfang',  location:'Schlosspark · Terrasse'   },
    { time:'15:00', title:'Menü & Reden', location:'Festsaal · Schloss Neuhof'},
    { time:'20:00', title:'Party & Band', location:'Bis open end'             },
  ],
  guests:SEED_GUESTS, subEvents:SEED_SUB_EVENTS,
  seatingTables:SEED_SEATING, budget:SEED_BUDGET,
  vendors:[], tasks:SEED_TASKS, reminders:SEED_REMINDERS,
  createdAt:'2026-02-01T10:00:00Z',
  onboardingComplete: true,
  maxBegleitpersonen: 2,
  organizer: SEED_ORGANIZER,
  dekoWishes: [],
  guestPhotos: [],
}

// ── Storage ────────────────────────────────────────────────────────────────
const KEY = 'velvet_event_v3'

export function loadEvent(): Event {
  if (typeof window === 'undefined') return SEED_EVENT
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Event
      // migrations
      p.guests = p.guests.map(g => {
        const statusMap: Record<string, GuestStatus> = {
          pending: 'eingeladen', confirmed: 'zugesagt', declined: 'abgesagt',
        }
        const newStatus: GuestStatus = (statusMap[(g as any).status] ?? (g as any).status) as GuestStatus

        const bp: Begleitperson[] = (g as any).begleitpersonen ?? (
          (g as any).plusOne && (g as any).plusOneName
            ? [{
                id: 'bp-migrated-' + g.id,
                name: (g as any).plusOneName,
                ageCategory: 'erwachsen' as AltersKategorie,
                meal: (g as any).plusOneMeal,
                allergies: (g as any).plusOneAllergies ?? [],
                allergyCustom: (g as any).plusOneAllergyCustom,
              }]
            : []
        )

        return {
          subEventIds: [],
          ...g,
          status: newStatus,
          begleitpersonen: bp,
        }
      })
      p.maxBegleitpersonen = (p as any).maxBegleitpersonen ?? 1
      p.subEvents     = p.subEvents     ?? SEED_SUB_EVENTS
      p.seatingTables = (p.seatingTables ?? SEED_SEATING).map((t, i) => {
        // Old format: no 'shape' field → had abstract px-based dimensions, reset everything
        const isOldFormat = !('shape' in t)
        if (isOldFormat) {
          return {
            ...t,
            x: 2 + (i % 3) * 3.5,
            y: 2.5 + Math.floor(i / 3) * 3.5,
            tableLength: 2.0,
            tableWidth:  0.8,
            rotation:    0,
            shape:       'rectangular' as const,
          }
        }
        return {
          tableLength: 2.0,
          tableWidth:  0.8,
          rotation:    0,
          shape:       'rectangular' as const,
          ...t,
          x: t.x ?? 2 + (i % 3) * 3.5,
          y: t.y ?? 2.5,
        }
      })
      p.budget        = p.budget        ?? SEED_BUDGET
      p.vendors       = p.vendors       ?? []
      p.tasks         = p.tasks         ?? SEED_TASKS
      p.reminders     = p.reminders     ?? SEED_REMINDERS
      p.childrenAllowed    = p.childrenAllowed    ?? true
      p.mealOptions        = p.mealOptions        ?? ['fleisch','fisch','vegetarisch','vegan']
      p.onboardingComplete = p.onboardingComplete ?? true
      if (!p.organizer) {
        p.organizer = SEED_ORGANIZER
      } else {
        p.organizer.featureToggles = { ...DEFAULT_FEATURE_TOGGLES, ...p.organizer.featureToggles }
        if (!p.organizer.locationImages) p.organizer.locationImages = []
      }
      p.dekoWishes  = p.dekoWishes   ?? []
      p.guestPhotos = p.guestPhotos  ?? []
      // migrate legacy single-hotel fields → hotels array
      if (!p.hotels) {
        p.hotels = [{
          id: 'hotel1',
          name: p.hotelName ?? '',
          address: p.hotelAddress ?? '',
          rooms: p.hotelRooms ?? [],
        }]
      }
      return p
    }
  } catch {}
  saveEvent(SEED_EVENT)
  return SEED_EVENT
}

export function saveEvent(e: Event): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(e))
}

export function resetEvent(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(SEED_EVENT))
}

export function getGuestByToken(e: Event, token: string): Guest | undefined {
  return e.guests.find(g => g.token === token)
}

// ── Stats ──────────────────────────────────────────────────────────────────
export function getStats(event: Event) {
  const confirmed = event.guests.filter(g => g.status === 'zugesagt')
  const pending   = event.guests.filter(g => g.status === 'eingeladen')
  const declined  = event.guests.filter(g => g.status === 'abgesagt')
  const totalAttending = confirmed.reduce((a, g) => a + 1 + g.begleitpersonen.length, 0)

  const meals = { fleisch:0, fisch:0, vegetarisch:0, vegan:0 }
  confirmed.forEach(g => {
    if (g.meal) meals[g.meal]++
    g.begleitpersonen.forEach(bp => { if (bp.meal) meals[bp.meal]++ })
  })

  const allergyCounts: Record<string,number> = {}
  const addA = (t: string) => { if (t.trim()) allergyCounts[t.trim()] = (allergyCounts[t.trim()]||0)+1 }
  confirmed.forEach(g => {
    g.allergies.forEach(addA)
    g.allergyCustom?.split(',').forEach(addA)
    g.begleitpersonen.forEach(bp => {
      bp.allergies.forEach(addA)
      bp.allergyCustom?.split(',').forEach(addA)
    })
  })

  const arrivalDays: Record<string,number> = {}
  confirmed.forEach(g => {
    if (g.arrivalDate) arrivalDays[g.arrivalDate] = (arrivalDays[g.arrivalDate]||0)+1
  })

  const hotelBooked = confirmed.filter(g => g.hotelRoomId && g.hotelRoomId !== 'none').length

  // budget
  const budgetPlanned = event.budget.reduce((a,b) => a+b.planned, 0)
  const budgetActual  = event.budget.reduce((a,b) => a+b.actual, 0)

  // tasks
  const tasksDone  = event.tasks.filter(t => t.done).length
  const tasksTotal = event.tasks.length

  return {
    confirmed:confirmed.length, pending:pending.length, declined:declined.length,
    totalAttending, meals, allergyCounts, arrivalDays, hotelBooked,
    rsvpRate: event.guests.length > 0
      ? Math.round((confirmed.length+declined.length)/event.guests.length*100) : 0,
    budgetPlanned, budgetActual, tasksDone, tasksTotal,
  }
}

// ── Empty event for fresh onboarding ────────────────────────────────────────
export function createEmptyEvent(): Event {
  return {
    id: 'evt-' + Math.random().toString(36).slice(2,9),
    coupleName: '', date: '', venue: '', venueAddress: '',
    dresscode: '', childrenAllowed: true, childrenNote: '',
    hotels: [],
    mealOptions: ['fleisch','fisch','vegetarisch','vegan'],
    timeline: [], guests: [], subEvents: [], seatingTables: [],
    budget: [], vendors: [],
    tasks: SEED_TASKS.map(t => ({ ...t, done: false })),
    reminders: [], createdAt: new Date().toISOString(),
    onboardingComplete: false,
    maxBegleitpersonen: 1,
    dekoWishes: [],
    guestPhotos: [],
  }
}
