'use client'
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { v4 as uuid } from 'uuid'
import { CheckCircle, XCircle, ChevronLeft, MapPin, Clock, Shirt, Hotel, Gift, Heart, Ban, ListMusic, ExternalLink } from 'lucide-react'
import type {
  Event, Guest, MealChoice, AllergyTag, TransportMode, AltersKategorie,
} from '@/lib/store'
import { Button, MealPicker, AllergyPicker, Textarea, Toast, Card, SectionTitle, Input } from '@/components/ui'

type Step = 'intro'|'rsvp'|'details'|'hotel'|'geschenke'|'confirmation'

interface WishlistItem {
  id: string
  title: string
  description: string | null
  price: number | null
  priority: 'hoch' | 'mittel' | 'niedrig'
  link: string | null
  is_money_wish: boolean
  money_target: number | null
  status: 'verfuegbar' | 'vergeben'
  is_claimed_by_me: boolean
  total_contributed: number
  my_contribution: number
}

const PRIORITY_COLOR: Record<string, string> = {
  hoch: 'var(--red, #c4717a)',
  mittel: 'var(--gold, #b8943e)',
  niedrig: 'var(--green, #3d7a56)',
}

interface CompanionDraft {
  id: string
  name: string
  ageCategory: AltersKategorie
  trinkAlkohol: boolean | undefined
  meal: MealChoice | undefined
  allergies: AllergyTag[]
  allergyCustom: string
}

const AGE_CATS: { value: AltersKategorie; label: string }[] = [
  { value: 'erwachsen', label: 'Erwachsen' },
  { value: '13-17',     label: '13–17 Jahre' },
  { value: '6-12',      label: '6–12 Jahre' },
  { value: '0-6',       label: '0–6 Jahre' },
]

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function blankCompanion(): CompanionDraft {
  return { id: uuid(), name: '', ageCategory: 'erwachsen', trinkAlkohol: undefined, meal: undefined, allergies: [], allergyCustom: '' }
}

export default function RSVPPage() {
  const params = useParams()
  const token  = params?.token as string

  const [event, setEvent] = useState<Event | null>(null)
  const [guest, setGuest] = useState<Guest | null>(null)
  const [isFrozen, setIsFrozen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [step,  setStep]  = useState<Step>('intro')
  const [toast, setToast] = useState<string | null>(null)

  // RSVP step state
  const [attending,    setAttending]    = useState<boolean | null>(null)
  const [trinkAlkohol, setTrinkAlkohol] = useState<boolean | undefined>()
  const [companions,   setCompanions]   = useState<CompanionDraft[]>([])
  const [message,      setMessage]      = useState('')

  // Details step
  const [meal,         setMeal]         = useState<MealChoice | undefined>()
  const [allergies,    setAllergies]    = useState<AllergyTag[]>([])
  const [allergyCustom,setAllergyCustom]= useState('')

  // Arrival
  const [arrivalDate,  setArrivalDate]  = useState('')
  const [arrivalTime,  setArrivalTime]  = useState('')
  const [transport,    setTransport]    = useState<TransportMode | ''>('')

  // Hotel
  const [hotelRoomId,  setHotelRoomId]  = useState('')

  // Geschenke
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [contributeAmounts, setContributeAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/rsvp/${encodeURIComponent(token)}`, { cache: 'no-store' })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Einladung nicht gefunden' }))
          if (!cancelled) setLoadError(err.error ?? 'Einladung nicht gefunden')
          return
        }
        const data = await res.json()
        if (cancelled) return
        const ev = data.event
        const g  = data.guest
        setEvent({
          id: ev.id,
          coupleName: ev.coupleName ?? '',
          date: ev.date ?? '',
          venue: ev.venue ?? '',
          venueAddress: ev.venueAddress ?? '',
          dresscode: ev.dresscode ?? '',
          childrenAllowed: ev.childrenAllowed,
          childrenNote: ev.childrenNote ?? undefined,
          mealOptions: ev.mealOptions ?? ['fleisch','fisch','vegetarisch','vegan'],
          maxBegleitpersonen: ev.maxBegleitpersonen ?? 2,
          hotels: ev.hotels ?? [],
          guests: [], subEvents: [], seatingTables: [], budget: [],
          vendors: [], tasks: [], reminders: [], timeline: [],
          dekoWishes: [], guestPhotos: [],
        } as unknown as Event)
        setIsFrozen(!!ev.isFrozen)
        setGuest({
          id: g.id, name: g.name, email: g.email ?? '', token: g.token,
          status: g.status,
          trinkAlkohol: g.trinkAlkohol ?? undefined,
          meal: g.meal ?? undefined,
          allergies: g.allergies ?? [],
          allergyCustom: g.allergyCustom ?? undefined,
          arrivalDate: g.arrivalDate ?? undefined,
          arrivalTime: g.arrivalTime ?? undefined,
          transport: g.transport ?? undefined,
          hotelRoomId: g.hotelRoomId ?? undefined,
          message: g.message ?? undefined,
          respondedAt: g.respondedAt ?? undefined,
          begleitpersonen: g.begleitpersonen ?? [],
        } as Guest)
        setWishlist(data.wishlist ?? [])
        if (g.status !== 'eingeladen' && g.status !== 'angelegt') {
          setAttending(g.status === 'zugesagt')
          setTrinkAlkohol(g.trinkAlkohol ?? undefined)
          setMeal(g.meal ?? undefined)
          setAllergies(g.allergies ?? [])
          setAllergyCustom(g.allergyCustom ?? '')
          setArrivalDate(g.arrivalDate ?? '')
          setArrivalTime(g.arrivalTime ?? '')
          setTransport((g.transport ?? '') as TransportMode)
          setHotelRoomId(g.hotelRoomId ?? '')
          setMessage(g.message ?? '')
          setCompanions((g.begleitpersonen ?? []).map((bp: any) => ({
            id: bp.id,
            name: bp.name,
            ageCategory: bp.ageCategory,
            trinkAlkohol: bp.trinkAlkohol ?? undefined,
            meal: bp.meal ?? undefined,
            allergies: bp.allergies ?? [],
            allergyCustom: bp.allergyCustom ?? '',
          })))
        }
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message ?? 'Netzwerkfehler')
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  if (!event || !guest) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--bg)', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: 'var(--gold)' }}>Velvet.</span>
      <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>
        {loadError ?? 'Einladung wird geladen…'}
      </p>
    </div>
  )

  const allRooms = (event?.hotels ?? []).flatMap(h => h.rooms)

  const setCompanionCount = (count: number) => {
    setCompanions(prev => {
      if (count > prev.length) {
        return [...prev, ...Array.from({ length: count - prev.length }, blankCompanion)]
      }
      return prev.slice(0, count)
    })
  }

  const updateCompanion = (idx: number, patch: Partial<CompanionDraft>) => {
    setCompanions(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }

  const save = async () => {
    if (!event || !guest || saving) return
    if (isFrozen) {
      setToast('Das Event ist gesperrt — Änderungen nicht mehr möglich.')
      return
    }
    setSaving(true)

    const payload = {
      attending: attending === true,
      trinkAlkohol: attending ? trinkAlkohol ?? null : null,
      meal: attending ? meal ?? null : null,
      allergies: attending ? allergies : [],
      allergyCustom: attending ? allergyCustom : null,
      begleitpersonen: attending
        ? companions.map(c => ({
            id: c.id,
            name: c.name,
            ageCategory: c.ageCategory,
            trinkAlkohol: c.ageCategory === 'erwachsen' ? c.trinkAlkohol ?? null : null,
            meal: c.meal ?? null,
            allergies: c.allergies,
            allergyCustom: c.allergyCustom,
          }))
        : [],
      arrivalDate: attending ? arrivalDate : null,
      arrivalTime: attending ? arrivalTime : null,
      transport: attending ? (transport || null) : null,
      hotelRoomId: attending ? (hotelRoomId && hotelRoomId !== 'none' ? hotelRoomId : null) : null,
      message,
    }

    try {
      const res = await fetch(`/api/rsvp/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast(data.error ?? 'Speichern fehlgeschlagen')
        setSaving(false)
        return
      }

      const g = data.guest
      const updatedGuest: Guest = {
        ...guest,
        status: g.status,
        trinkAlkohol: g.trinkAlkohol ?? undefined,
        meal: g.meal ?? undefined,
        allergies: g.allergies ?? [],
        allergyCustom: g.allergyCustom ?? '',
        arrivalDate: g.arrivalDate ?? undefined,
        arrivalTime: g.arrivalTime ?? undefined,
        transport: g.transport ?? undefined,
        hotelRoomId: g.hotelRoomId ?? undefined,
        message: g.message ?? '',
        respondedAt: g.respondedAt ?? new Date().toISOString(),
        begleitpersonen: g.begleitpersonen ?? [],
      }

      // Hotel-Room-Delta lokal reflektieren für sofortige UI-Konsistenz
      const prev = guest.hotelRoomId && guest.hotelRoomId !== 'none' ? guest.hotelRoomId : null
      const next = g.hotelRoomId && g.hotelRoomId !== 'none' ? g.hotelRoomId : null
      const updatedHotels = (event.hotels ?? []).map(h => ({
        ...h,
        rooms: h.rooms.map(r => {
          if (prev === next) return r
          if (r.id === prev) return { ...r, bookedRooms: Math.max(0, r.bookedRooms - 1) }
          if (r.id === next) return { ...r, bookedRooms: r.bookedRooms + 1 }
          return r
        }),
      }))

      setEvent({ ...event, hotels: updatedHotels })
      setGuest(updatedGuest)
      setStep(attending ? 'geschenke' : 'confirmation')
    } catch (err: any) {
      setToast(err?.message ?? 'Netzwerkfehler')
    } finally {
      setSaving(false)
    }
  }

  const progressSteps: Step[] = attending === false
    ? ['intro', 'rsvp', 'confirmation']
    : ['intro', 'rsvp', 'details', 'hotel', 'geschenke', 'confirmation']
  const progress = progressSteps.indexOf(step) / (progressSteps.length - 1) * 100

  const optBtn = (active: boolean): React.CSSProperties => ({
    padding: '16px 18px', borderRadius: 'var(--r-md)', fontFamily: 'inherit',
    border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
    background: active ? 'var(--gold-pale)' : 'var(--surface)',
    display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left',
    transition: 'all 0.15s', color: active ? 'var(--gold)' : 'var(--grey4)', width: '100%',
  })

  const yesNoBtn = (val: boolean, current: boolean | undefined): React.CSSProperties => ({
    flex: 1, padding: '11px', borderRadius: 'var(--r-sm)', fontFamily: 'inherit',
    border: `1.5px solid ${current === val ? 'var(--gold)' : 'var(--border)'}`,
    background: current === val ? 'var(--gold-pale)' : 'var(--surface)',
    color: current === val ? 'var(--gold)' : 'var(--grey4)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
  })

  const maxComp = event.maxBegleitpersonen ?? 2

  // details disabled if no meal for guest or any companion without meal
  const detailsOk = !!meal && companions.every(c => !!c.meal)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', paddingBottom: 40 }}>
      {/* Top bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '14px 20px', paddingTop: 'calc(14px + env(safe-area-inset-top))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: step !== 'intro' && step !== 'confirmation' ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {step !== 'intro' && step !== 'confirmation' && (
                <button onClick={() => {
                  const prev: Record<Step, Step> = { intro: 'intro', rsvp: 'intro', details: 'rsvp', hotel: 'details', geschenke: 'hotel', confirmation: attending ? 'geschenke' : 'rsvp' }
                  setStep(prev[step])
                }} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-light)', display: 'flex' }}>
                  <ChevronLeft size={20} />
                </button>
              )}
              <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: 'var(--gold)' }}>Velvet.</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{event.coupleName}</span>
          </div>
          {step !== 'intro' && step !== 'confirmation' && (
            <div style={{ height: 2, background: 'var(--black3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--gold)', borderRadius: 2, transition: 'width 0.4s ease' }} />
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px' }}>

        {/* ──────────── INTRO ──────────── */}
        {step === 'intro' && (
          <div style={{ animation: 'fadeUp 0.5s ease' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '32px 24px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(201,168,76,0.04)' }} />
              <div style={{ height: 1, background: 'linear-gradient(to right,var(--gold),transparent)', marginBottom: 20, opacity: 0.4 }} />
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--gold)', marginBottom: 10 }}>Herzliche Einladung</p>
              <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 400, color: 'var(--text)', lineHeight: 1.2, marginBottom: 8 }}>{event.coupleName}</h1>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontStyle: 'italic', color: 'var(--text-light)', marginBottom: 0 }}>
                Liebe/r <strong style={{ fontStyle: 'normal', color: 'var(--text)' }}>{guest.name.split(' ')[0]}</strong>, wir freuen uns auf deine Antwort.
              </p>
            </div>

            <Card style={{ marginBottom: 14 }}>
              {[
                { icon: <Clock size={13} color="var(--gold)" />,  label: 'Datum',     value: fmtDate(event.date) },
                { icon: <MapPin size={13} color="var(--gold)" />, label: 'Ort',       value: `${event.venue}, ${event.venueAddress}` },
                { icon: <Shirt size={13} color="var(--gold)" />,  label: 'Dresscode', value: event.dresscode },
                { icon: <Hotel size={13} color="var(--gold)" />,  label: 'Hotel',     value: (event.hotels ?? []).map(h => h.name).filter(Boolean).join(', ') || undefined },
                { icon: <span style={{ fontSize: 13 }}>👶</span>, label: 'Kinder',
                  value: (event as any).childrenAllowed === false
                    ? ((event as any).childrenNote || 'Wir feiern ohne Kinder')
                    : ((event as any).childrenNote || 'Kinder herzlich willkommen') },
              ].filter(x => x.value).map(item => (
                <div key={item.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ marginTop: 1, flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 2 }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-mid)' }}>{item.value}</p>
                  </div>
                </div>
              ))}
            </Card>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)', marginBottom: 5 }}>Lieber telefonisch antworten?</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 8 }}>Ruf uns gerne an — wir nehmen deine Antwort auch persönlich entgegen:</p>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 500, color: 'var(--gold)' }}>1234 567 78910</p>
            </div>

            {event.childrenAllowed !== undefined && (
              <div style={{ background: event.childrenAllowed ? 'var(--green-pale)' : 'var(--red-pale)', border: `1px solid ${event.childrenAllowed ? 'rgba(61,122,86,0.2)' : 'rgba(160,64,64,0.15)'}`, borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: event.childrenAllowed ? 'var(--green)' : 'var(--red)', marginBottom: event.childrenNote ? 4 : 0 }}>
                  {event.childrenAllowed ? 'Kinder herzlich willkommen' : 'Erwachsenenfeier — ohne Kinder'}
                </p>
                {event.childrenNote && <p style={{ fontSize: 12, color: 'var(--text-light)' }}>{event.childrenNote}</p>}
              </div>
            )}

            {guest.status !== 'eingeladen' && (
              <div style={{ background: 'var(--gold-pale)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 14, border: '1px solid rgba(201,168,76,0.2)', fontSize: 13, color: 'var(--gold)' }}>
                Du hast bereits geantwortet. Du kannst deine Antwort hier ändern.
              </div>
            )}

            <Button fullWidth size="lg" variant="gold" onClick={() => setStep('rsvp')}>Jetzt antworten</Button>
          </div>
        )}

        {/* ──────────── RSVP ──────────── */}
        {step === 'rsvp' && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 400, color: 'var(--text)', marginBottom: 6 }}>Kannst du kommen?</h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>{event.coupleName} · {new Date(event.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

            {/* Yes / No */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { v: true,  icon: <CheckCircle size={20} />, title: 'Ja, ich bin dabei!',  sub: 'Ich freue mich auf diesen besonderen Tag.' },
                { v: false, icon: <XCircle size={20} />,     title: 'Leider nicht',         sub: 'Ich kann leider nicht teilnehmen.' },
              ].map(opt => (
                <button key={String(opt.v)} onClick={() => setAttending(opt.v)} data-sel={attending === opt.v ? '' : undefined} style={optBtn(attending === opt.v)}>
                  {opt.icon}
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{opt.title}</p>
                    <p style={{ fontSize: 12, opacity: 0.65, fontWeight: 400 }}>{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>

            {attending && (
              <>
                {/* Alcohol — main guest */}
                <Card style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Trinkst du Alkohol?</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setTrinkAlkohol(true)}  data-sel={trinkAlkohol === true  ? '' : undefined} style={yesNoBtn(true,  trinkAlkohol)}>Ja, gerne</button>
                    <button onClick={() => setTrinkAlkohol(false)} data-sel={trinkAlkohol === false ? '' : undefined} style={yesNoBtn(false, trinkAlkohol)}>Nein, danke</button>
                  </div>
                </Card>

                {/* Companion count */}
                <Card style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                    Wie viele Personen bringst du mit?
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Array.from({ length: maxComp + 1 }, (_, i) => (
                      <button key={i} onClick={() => setCompanionCount(i)} data-sel={companions.length === i ? '' : undefined} style={{
                        width: 48, height: 48, borderRadius: 'var(--r-sm)', fontFamily: 'inherit',
                        border: `1.5px solid ${companions.length === i ? 'var(--gold)' : 'var(--border)'}`,
                        background: companions.length === i ? 'var(--gold-pale)' : 'var(--surface)',
                        color: companions.length === i ? 'var(--gold)' : 'var(--grey4)',
                        fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        {i}
                      </button>
                    ))}
                  </div>

                  {/* Companion details */}
                  {companions.map((c, idx) => (
                    <div key={c.id} style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 12 }}>
                        Begleitperson {idx + 1}
                      </p>
                      {/* Name */}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)', marginBottom: 6 }}>Name</label>
                        <input value={c.name} onChange={e => updateCompanion(idx, { name: e.target.value })}
                          placeholder="Vorname Nachname"
                          style={{ width: '100%', padding: '10px 13px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      {/* Age */}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)', marginBottom: 6 }}>Altersgruppe</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {AGE_CATS.map(a => (
                            <button key={a.value} onClick={() => updateCompanion(idx, { ageCategory: a.value })} data-sel={c.ageCategory === a.value ? '' : undefined} style={{
                              padding: '7px 12px', borderRadius: 8, fontFamily: 'inherit',
                              border: `1.5px solid ${c.ageCategory === a.value ? 'var(--gold)' : 'var(--border)'}`,
                              background: c.ageCategory === a.value ? 'var(--gold-pale)' : 'var(--surface)',
                              color: c.ageCategory === a.value ? 'var(--gold)' : 'var(--grey4)',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                            }}>
                              {a.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Alcohol — only for adults */}
                      {c.ageCategory === 'erwachsen' && (
                        <div>
                          <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)', marginBottom: 6 }}>
                            Trinkt {c.name || 'diese Person'} Alkohol?
                          </label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => updateCompanion(idx, { trinkAlkohol: true })}  data-sel={c.trinkAlkohol === true  ? '' : undefined} style={yesNoBtn(true,  c.trinkAlkohol)}>Ja, gerne</button>
                            <button onClick={() => updateCompanion(idx, { trinkAlkohol: false })} data-sel={c.trinkAlkohol === false ? '' : undefined} style={yesNoBtn(false, c.trinkAlkohol)}>Nein, danke</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              </>
            )}

            <Textarea label="Nachricht (optional)" value={message} onChange={setMessage} placeholder="Herzliche Glückwünsche …" />

            <Button fullWidth size="lg" variant="gold" disabled={attending === null || saving || isFrozen}
              onClick={() => { if (attending === false) { save() } else { setStep('details') } }}>
              {saving ? 'Wird gespeichert…' : attending === false ? 'Absage senden' : 'Weiter'}
            </Button>
          </div>
        )}

        {/* ──────────── DETAILS ──────────── */}
        {step === 'details' && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 400, color: 'var(--text)', marginBottom: 6 }}>Deine Details</h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>Damit wir alles perfekt vorbereiten können.</p>

            <Card style={{ marginBottom: 10 }}>
              <MealPicker label="Deine Menüwahl" value={meal} onChange={setMeal} options={event.mealOptions as MealChoice[]} />
            </Card>

            {companions.map((c, idx) => (
              <Card key={c.id} style={{ marginBottom: 10 }}>
                <MealPicker
                  label={`Menüwahl: ${c.name || `Begleitperson ${idx + 1}`}`}
                  value={c.meal}
                  onChange={v => updateCompanion(idx, { meal: v })}
                  options={event.mealOptions as MealChoice[]}
                />
              </Card>
            ))}

            <Card style={{ marginBottom: 10 }}>
              <AllergyPicker label="Deine Allergien" tags={allergies} onTagsChange={setAllergies} custom={allergyCustom} onCustomChange={setAllergyCustom} />
            </Card>

            {companions.map((c, idx) => (
              <Card key={`allergy-${c.id}`} style={{ marginBottom: 10 }}>
                <AllergyPicker
                  label={`Allergien: ${c.name || `Begleitperson ${idx + 1}`}`}
                  tags={c.allergies}
                  onTagsChange={v => updateCompanion(idx, { allergies: v })}
                  custom={c.allergyCustom}
                  onCustomChange={v => updateCompanion(idx, { allergyCustom: v })}
                />
              </Card>
            ))}

            <Card style={{ marginBottom: 20 }}>
              <SectionTitle>Anreise</SectionTitle>
              <Input label="Ankunftsdatum" type="date" value={arrivalDate} onChange={setArrivalDate} />
              <Input label="Ungefähre Uhrzeit" type="time" value={arrivalTime} onChange={setArrivalTime} />
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)', marginBottom: 8 }}>Transportmittel</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {[{ v: 'auto', l: 'Auto' }, { v: 'bahn', l: 'Bahn' }, { v: 'flugzeug', l: 'Flug' }, { v: 'andere', l: 'Andere' }].map(opt => (
                    <button key={opt.v} type="button" onClick={() => setTransport(opt.v as TransportMode)} data-sel={transport === opt.v ? '' : undefined} style={{
                      padding: '9px 6px', borderRadius: 'var(--r-sm)', fontFamily: 'inherit',
                      border: `1.5px solid ${transport === opt.v ? 'var(--gold)' : 'var(--border)'}`,
                      background: transport === opt.v ? 'var(--gold-pale)' : 'var(--surface)',
                      color: transport === opt.v ? 'var(--gold)' : 'var(--grey4)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <Button fullWidth size="lg" variant="gold" disabled={!detailsOk} onClick={() => setStep('hotel')}>Weiter</Button>
          </div>
        )}

        {/* ──────────── HOTEL ──────────── */}
        {step === 'hotel' && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 400, color: 'var(--text)', marginBottom: 6 }}>Hotelzimmer</h2>
            <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 20, lineHeight: 1.5 }}>Möchtet ihr ein Zimmer reservieren?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <button onClick={() => setHotelRoomId('none')} data-sel={hotelRoomId === 'none' ? '' : undefined} style={{
                padding: '16px 18px', borderRadius: 'var(--r-md)', fontFamily: 'inherit',
                border: `1.5px solid ${hotelRoomId === 'none' ? 'var(--gold)' : 'var(--border)'}`,
                background: hotelRoomId === 'none' ? 'var(--gold-pale)' : 'var(--surface)',
                display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left',
                color: hotelRoomId === 'none' ? 'var(--gold)' : 'var(--grey4)', width: '100%',
              }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${hotelRoomId === 'none' ? 'var(--gold)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {hotelRoomId === 'none' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)' }} />}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Kein Zimmer benötigt</p>
                  <p style={{ fontSize: 11, opacity: 0.65, fontWeight: 400 }}>Ich reise täglich an oder habe selbst gebucht.</p>
                </div>
              </button>

              {(event.hotels ?? []).map(hotel => (
                <div key={hotel.id}>
                  {(event.hotels ?? []).length > 1 && (
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', margin: '10px 0 8px' }}>{hotel.name}</p>
                  )}
                  {hotel.rooms.map(room => {
                    const avail  = room.totalRooms - room.bookedRooms
                    const full   = avail === 0
                    const active = hotelRoomId === room.id
                    return (
                      <button key={room.id} onClick={() => !full && setHotelRoomId(active ? '' : room.id)} disabled={full} data-sel={active ? '' : undefined} style={{
                        padding: '16px 18px', borderRadius: 'var(--r-md)', fontFamily: 'inherit',
                        border: `1.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                        background: active ? 'var(--gold-pale)' : 'var(--surface)',
                        display: 'flex', alignItems: 'center', gap: 14,
                        cursor: full ? 'not-allowed' : 'pointer', opacity: full ? 0.4 : 1,
                        textAlign: 'left', color: active ? 'var(--gold)' : 'var(--grey4)', width: '100%', marginBottom: 8,
                      }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${active ? 'var(--gold)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)' }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{room.type}</p>
                          <p style={{ fontSize: 11, opacity: 0.65, fontWeight: 400 }}>€ {room.pricePerNight} / Nacht · {full ? 'Ausgebucht' : `${avail} verfügbar`}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <Button fullWidth size="lg" variant="gold" disabled={!hotelRoomId || saving || isFrozen} onClick={save}>
              {saving ? 'Wird gespeichert…' : 'Antwort absenden'}
            </Button>
          </div>
        )}

        {/* ──────────── GESCHENKE ──────────── */}
        {step === 'geschenke' && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 400, color: 'var(--text)', marginBottom: 6 }}>Geschenkliste</h2>
            <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 24, lineHeight: 1.5 }}>
              Schau dir die Wünsche an — alles freiwillig, du kannst auch ohne Auswahl weitergehen.
            </p>

            {wishlist.length === 0 && (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: '32px 24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, marginBottom: 20 }}>
                Noch keine Wünsche hinterlegt.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {wishlist.map(wish => {
                const isClaimed  = wish.status === 'vergeben'
                const isMine     = wish.is_claimed_by_me
                const pct        = wish.money_target ? Math.min(100, (wish.total_contributed / wish.money_target) * 100) : 0
                const fullyFunded = wish.money_target ? wish.total_contributed >= wish.money_target : false

                async function claimGift() {
                  const res = await fetch(`/api/rsvp/${encodeURIComponent(token)}/geschenk`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'claim', wish_id: wish.id }),
                  })
                  if (res.ok) {
                    setWishlist(prev => prev.map(w => w.id === wish.id ? { ...w, status: 'vergeben', is_claimed_by_me: true } : w))
                  } else {
                    const d = await res.json().catch(() => ({}))
                    setToast(d.error ?? 'Leider schon vergeben')
                  }
                }

                async function unclaimGift() {
                  const res = await fetch(`/api/rsvp/${encodeURIComponent(token)}/geschenk`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'unclaim', wish_id: wish.id }),
                  })
                  if (res.ok) {
                    setWishlist(prev => prev.map(w => w.id === wish.id ? { ...w, status: 'verfuegbar', is_claimed_by_me: false } : w))
                  }
                }

                async function contributeToGift() {
                  const amt = parseFloat(contributeAmounts[wish.id] ?? '')
                  if (isNaN(amt) || amt <= 0) return
                  const res = await fetch(`/api/rsvp/${encodeURIComponent(token)}/geschenk`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'contribute', wish_id: wish.id, amount: amt }),
                  })
                  if (res.ok) {
                    setWishlist(prev => prev.map(w => {
                      if (w.id !== wish.id) return w
                      const prev_contrib = w.my_contribution
                      const new_total = w.total_contributed - prev_contrib + amt
                      return { ...w, total_contributed: new_total, my_contribution: amt }
                    }))
                    setContributeAmounts(prev => ({ ...prev, [wish.id]: '' }))
                    setToast('Beitrag gespeichert!')
                  } else {
                    const d = await res.json().catch(() => ({}))
                    setToast(d.error ?? 'Fehler beim Speichern')
                  }
                }

                return (
                  <div key={wish.id} style={{
                    background: 'var(--surface)', borderRadius: 'var(--r-md)', border: `1px solid ${isClaimed && !wish.is_money_wish ? 'rgba(61,122,86,0.3)' : 'var(--border)'}`,
                    padding: '16px 18px', opacity: isClaimed && !isMine && !wish.is_money_wish ? 0.5 : 1,
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {wish.is_money_wish
                          ? <Heart size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                          : <Gift size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />}
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{wish.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                        {wish.is_money_wish && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(201,168,76,0.12)', color: 'var(--gold)' }}>Geldwunsch</span>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,0,0,0.04)', color: PRIORITY_COLOR[wish.priority] }}>
                          {{ hoch: 'Hoch', mittel: 'Mittel', niedrig: 'Niedrig' }[wish.priority]}
                        </span>
                      </div>
                    </div>

                    {wish.description && (
                      <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8, lineHeight: 1.5 }}>{wish.description}</p>
                    )}

                    {wish.price && !wish.is_money_wish && (
                      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>ca. € {wish.price.toFixed(2)}</p>
                    )}

                    {wish.link && (
                      <a href={wish.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--gold)', textDecoration: 'none', marginBottom: 10 }}>
                        <ExternalLink size={11} /> Link ansehen
                      </a>
                    )}

                    {/* Money wish progress */}
                    {wish.is_money_wish && wish.money_target && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                          <span>€ {wish.total_contributed.toFixed(2)} gesammelt</span>
                          <span>Ziel: € {wish.money_target.toFixed(2)}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--black3)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: fullyFunded ? 'var(--green, #3d7a56)' : 'var(--gold)', borderRadius: 4, transition: 'width 0.4s' }} />
                        </div>
                        {wish.my_contribution > 0 && (
                          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Dein Beitrag: € {wish.my_contribution.toFixed(2)}</p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {wish.is_money_wish ? (
                      !fullyFunded && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-dim)' }}>€</span>
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={contributeAmounts[wish.id] ?? ''}
                              onChange={e => setContributeAmounts(prev => ({ ...prev, [wish.id]: e.target.value }))}
                              placeholder={wish.my_contribution > 0 ? wish.my_contribution.toFixed(2) : 'Betrag'}
                              style={{ width: '100%', padding: '9px 10px 9px 26px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                          <button onClick={contributeToGift} disabled={!contributeAmounts[wish.id] || parseFloat(contributeAmounts[wish.id] ?? '') <= 0} style={{
                            padding: '9px 16px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 8,
                            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                            opacity: !contributeAmounts[wish.id] || parseFloat(contributeAmounts[wish.id] ?? '') <= 0 ? 0.5 : 1,
                          }}>
                            {wish.my_contribution > 0 ? 'Aktualisieren' : 'Beitragen'}
                          </button>
                        </div>
                      )
                    ) : isClaimed && isMine ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green, #3d7a56)' }}>✓ Du bringst dieses Geschenk</span>
                        <button onClick={unclaimGift} style={{ fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                          Rückgängig
                        </button>
                      </div>
                    ) : isClaimed && !isMine ? (
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Bereits vergeben</span>
                    ) : (
                      <button onClick={claimGift} style={{
                        width: '100%', padding: '10px', background: 'transparent', border: '1.5px solid var(--gold)',
                        borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--gold)', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
                      }}>
                        Ich bringe dieses Geschenk
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <Button fullWidth size="lg" variant="gold" onClick={() => setStep('confirmation')}>
              Weiter
            </Button>
          </div>
        )}

        {/* ──────────── CONFIRMATION ──────────── */}
        {step === 'confirmation' && (
          <div style={{ animation: 'fadeUp 0.5s ease', textAlign: 'center', paddingTop: 40 }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: attending ? 'var(--gold-pale)' : 'var(--black3)', border: `1px solid ${attending ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: attending ? 'var(--gold)' : 'var(--grey3)' }}>
              {attending ? <CheckCircle size={28} /> : <XCircle size={28} />}
            </div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 400, color: 'var(--text)', marginBottom: 8 }}>
              {attending ? 'Danke für deine Zusage!' : 'Schade, dass du nicht kommen kannst.'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 28, lineHeight: 1.6 }}>
              {attending
                ? `Wir freuen uns auf dich am ${new Date(event.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} in ${event.venue}.`
                : `${event.coupleName} wurden informiert.`}
            </p>

            {attending && (
              <Card style={{ textAlign: 'left', marginBottom: 20 }}>
                <SectionTitle>Deine Angaben</SectionTitle>
                {meal && <Row label="Menü" value={{ fleisch: 'Fleisch', fisch: 'Fisch', vegetarisch: 'Vegetarisch', vegan: 'Vegan' }[meal]} />}
                {trinkAlkohol !== undefined && <Row label="Alkohol" value={trinkAlkohol ? 'Ja' : 'Nein'} />}
                {companions.length > 0 && (
                  <Row label="Begleitpersonen" value={companions.map(c => c.name || '—').join(', ')} />
                )}
                {hotelRoomId && hotelRoomId !== 'none' && <Row label="Hotel" value={allRooms.find(r => r.id === hotelRoomId)?.type ?? '—'} />}
                {hotelRoomId === 'none' && <Row label="Hotel" value="Kein Zimmer" />}
                {arrivalDate && <Row label="Ankunft" value={`${new Date(arrivalDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}${arrivalTime ? ` · ${arrivalTime}` : ''}`} />}
              </Card>
            )}

            <Button fullWidth variant="secondary" onClick={() => setStep('rsvp')}>Antwort ändern</Button>
          </div>
        )}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes slideUp{from{transform:translate(-50%,16px);opacity:0}to{transform:translate(-50%,0);opacity:1}}`}</style>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, gap: 12, marginBottom: 8 }}>
      <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-mid)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
