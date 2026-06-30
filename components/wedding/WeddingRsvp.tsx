'use client'
// components/wedding/WeddingRsvp.tsx
// Öffentlicher RSVP-Ablauf der Hochzeitswebsite (im Template-Look).
// Einstieg: "Schon angemeldet?" → Code eingeben ODER neu (Name + E-Mail).
// Danach: themed RSVP-Formular (nutzt die bestehende /api/rsvp/[token]-API).
// Nach dem Absenden: persönlicher Code/Link + Foto-Upload, Wunschliste, Musikwunsch.
import React, { useEffect, useMemo, useState } from 'react'
import { Check, Loader, ArrowLeft, Plus, X, Music, Gift } from 'lucide-react'
import RsvpPhotos from '@/components/rsvp/RsvpPhotos'

type Step = 'choice' | 'code' | 'newguest' | 'loading' | 'form' | 'done'
type Meal = 'fleisch' | 'fisch' | 'vegetarisch' | 'vegan'
type Transport = 'auto' | 'bahn' | 'flugzeug' | 'andere'

interface Companion { name: string; ageCategory: string; meal: Meal | '' }

interface HotelRoom { id: string; type: string; totalRooms: number; bookedRooms: number; pricePerNight: number }
interface Hotel { id: string; name: string; address: string | null; rooms: HotelRoom[] }

interface RsvpData {
  event: {
    coupleName: string
    mealOptions: string[]
    maxBegleitpersonen: number
    isFrozen: boolean
    isDeadlinePassed: boolean
    rsvpShowMusikwunsch: boolean
    rsvpShowGeschenke: boolean
    rsvpShowBegleitpersonen: boolean
    rsvpShowMenu: boolean
    rsvpShowHotel: boolean
    hotels: Hotel[]
  }
  guest: any
  wishlist: any[]
}

const MEAL_LABEL: Record<string, string> = { fleisch: 'Fleisch', fisch: 'Fisch', vegetarisch: 'Vegetarisch', vegan: 'Vegan' }

// Manche Gäste mussten bisher zweimal absenden: Der erste Request lief gelegentlich
// in einen transienten Fehler (Cold-Start/Edge), der zweite Klick ging dann durch.
// fetchWithRetry wiederholt einen fehlgeschlagenen Request einmal automatisch, sodass
// ein einzelner Klick zuverlässig speichert.
async function fetchWithRetry(input: string, init?: RequestInit, retries = 1): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init)
      // Transiente Fehler (Server/Edge-Auth/Timeout) → kurz warten und erneut versuchen.
      if ((res.status >= 500 || res.status === 401 || res.status === 408) && attempt < retries) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
        continue
      }
      return res
    } catch (e) {
      lastErr = e
      if (attempt < retries) { await new Promise(r => setTimeout(r, 400 * (attempt + 1))); continue }
      throw e
    }
  }
  throw lastErr
}

export default function WeddingRsvp({ slug }: { slug: string }) {
  const [step, setStep] = useState<Step>('choice')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Einstieg
  const [code, setCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [personalCode, setPersonalCode] = useState<string | null>(null)

  // RSVP-Token + geladene Daten
  const [token, setToken] = useState<string | null>(null)
  const [data, setData] = useState<RsvpData | null>(null)

  // Formularzustand
  const [attending, setAttending] = useState<boolean | null>(null)
  const [meal, setMeal] = useState<Meal | ''>('')
  const [alcohol, setAlcohol] = useState<boolean | null>(null)
  const [allergies, setAllergies] = useState('')
  const [message, setMessage] = useState('')
  const [companions, setCompanions] = useState<Companion[]>([])
  const [arrivalDate, setArrivalDate] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [transport, setTransport] = useState<Transport | ''>('')
  const [hotelRoomId, setHotelRoomId] = useState('')

  // Persönlicher Deep-Link aus der Gästeliste: /wedding/[slug]/rsvp?code=XXXX
  // → Code vorbefüllen und direkt einlösen.
  useEffect(() => {
    const c = (new URLSearchParams(window.location.search).get('code') || '').toUpperCase().trim()
    if (!/^[A-Z0-9]{4}$/.test(c)) return
    setCode(c)
    ;(async () => {
      setBusy(true); setError(null)
      try {
        const res = await fetch(`/api/wedding/public/${slug}/rsvp/lookup`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: c }),
        })
        const d = await res.json()
        if (res.ok) await loadForm(d.token, c)
        else { setError(d.error ?? 'Code ungültig'); setStep('code') }
      } catch { setStep('code') } finally { setBusy(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadForm(tk: string, presetCode?: string) {
    setStep('loading'); setError(null)
    try {
      const res = await fetchWithRetry(`/api/rsvp/${tk}`)
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Konnte Anmeldung nicht laden')
      setToken(tk)
      setData(d)
      if (presetCode) setPersonalCode(presetCode)
      // Vorbefüllung aus bestehender Antwort
      const g = d.guest
      setAttending(g.status === 'zugesagt' ? true : g.status === 'abgesagt' ? false : null)
      setMeal((g.meal as Meal) ?? '')
      setAlcohol(typeof g.trinkAlkohol === 'boolean' ? g.trinkAlkohol : null)
      setAllergies(g.allergyCustom ?? '')
      setMessage(g.message ?? '')
      setCompanions((g.begleitpersonen ?? []).map((b: any) => ({
        name: b.name ?? '', ageCategory: b.ageCategory ?? 'erwachsen', meal: (b.meal as Meal) ?? '',
      })))
      setArrivalDate(g.arrivalDate ?? '')
      setArrivalTime(g.arrivalTime ? String(g.arrivalTime).slice(11, 16) : '')
      setTransport((g.transport as Transport) ?? '')
      setHotelRoomId(g.hotelRoomId ?? '')
      setStep('form')
    } catch (e: any) {
      setError(e.message); setStep(personalCode ? 'done' : 'choice')
    }
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/wedding/public/${slug}/rsvp/lookup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Code ungültig')
      await loadForm(d.token, code.trim().toUpperCase())
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  async function handleNewGuest(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/wedding/public/${slug}/rsvp/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Anmeldung fehlgeschlagen')
      await loadForm(d.token, d.code)
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  function addCompanion() {
    const max = data?.event.maxBegleitpersonen ?? 0
    if (companions.length >= max) return
    setCompanions(c => [...c, { name: '', ageCategory: 'erwachsen', meal: '' }])
  }

  async function submitRsvp(e?: React.FormEvent) {
    e?.preventDefault()
    if (attending === null) { setError('Bitte wähle Zusage oder Absage.'); return }
    setBusy(true); setError(null)
    try {
      const payload: any = {
        attending,
        trinkAlkohol: attending ? alcohol : null,
        meal: attending ? (meal || null) : null,
        allergies: [],
        allergyCustom: attending ? (allergies || null) : null,
        message: message || null,
        arrivalDate: attending ? (arrivalDate || null) : null,
        arrivalTime: attending && arrivalDate && arrivalTime ? `${arrivalDate}T${arrivalTime}:00` : null,
        transport: attending ? (transport || null) : null,
        hotelRoomId: attending ? (hotelRoomId || 'none') : 'none',
        begleitpersonen: attending
          ? companions.filter(c => c.name.trim()).map(c => ({
              name: c.name, ageCategory: c.ageCategory, meal: c.meal || null,
            }))
          : [],
      }
      const res = await fetchWithRetry(`/api/rsvp/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Speichern fehlgeschlagen')
      setData(prev => prev ? { ...prev, guest: { ...prev.guest, status: attending ? 'zugesagt' : 'abgesagt' } } : prev)
      setStep('done')
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <section className="wd-section wd-rsvp">
      {step === 'choice' && (
        <div className="wd-card">
          <h2 className="wd-h2 wd-center" style={{ fontSize: '1.6rem' }}>Hast du dich schon angemeldet?</h2>
          <p className="wd-body wd-center" style={{ marginBottom: '1.5rem' }}>
            Wenn du bereits einen persönlichen Code hast, gib ihn ein — sonst melde dich einfach neu an.
          </p>
          <div className="wd-choice">
            <button className="wd-choice-btn wd-choice-btn-lg" onClick={() => { setError(null); setStep('code') }}>
              Ja, ich habe einen Code
            </button>
            <button className="wd-choice-btn wd-choice-btn-lg" onClick={() => { setError(null); setStep('newguest') }}>
              Nein, neu anmelden
            </button>
          </div>
          {error && <p className="wd-error">{error}</p>}
        </div>
      )}

      {step === 'code' && (
        <form className="wd-card" onSubmit={handleCode}>
          <button type="button" className="wd-btn wd-btn-ghost" style={{ marginTop: 0, marginBottom: '1rem' }} onClick={() => setStep('choice')}>
            <ArrowLeft size={15} /> Zurück
          </button>
          <div className="wd-field">
            <label className="wd-label">Dein persönlicher Code</label>
            <input
              className="wd-input" value={code}
              onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="z.B. K7MQ" autoCapitalize="characters" autoComplete="off"
              style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.4rem' }}
            />
            <p className="wd-hint">4 Zeichen — du findest ihn in deiner Einladung oder Bestätigungs-E-Mail.</p>
          </div>
          {error && <p className="wd-error">{error}</p>}
          <button className="wd-btn wd-btn-block wd-btn-lg" disabled={busy || code.length !== 4}>
            {busy ? <Loader size={16} className="wd-spin" /> : 'Weiter'}
          </button>
        </form>
      )}

      {step === 'newguest' && (
        <form className="wd-card" onSubmit={handleNewGuest}>
          <button type="button" className="wd-btn wd-btn-ghost" style={{ marginTop: 0, marginBottom: '1rem' }} onClick={() => setStep('choice')}>
            <ArrowLeft size={15} /> Zurück
          </button>
          <div className="wd-field">
            <label className="wd-label">Dein Name</label>
            <input className="wd-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Vor- und Nachname" />
          </div>
          <div className="wd-field">
            <label className="wd-label">E-Mail</label>
            <input className="wd-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="du@beispiel.de" />
            <p className="wd-hint">An diese Adresse senden wir dir deinen persönlichen Link zum späteren Ändern.</p>
          </div>
          {error && <p className="wd-error">{error}</p>}
          <button className="wd-btn wd-btn-block wd-btn-lg" disabled={busy || newName.trim().length < 2}>
            {busy ? <Loader size={16} className="wd-spin" /> : 'Weiter zur Anmeldung'}
          </button>
        </form>
      )}

      {step === 'loading' && (
        <div className="wd-card wd-center"><Loader size={24} className="wd-spin" /><p className="wd-body" style={{ marginTop: '1rem' }}>Einen Moment…</p></div>
      )}

      {step === 'form' && data && (
        <RsvpForm
          data={data} attending={attending} setAttending={setAttending}
          meal={meal} setMeal={setMeal} alcohol={alcohol} setAlcohol={setAlcohol}
          allergies={allergies} setAllergies={setAllergies} message={message} setMessage={setMessage}
          companions={companions} setCompanions={setCompanions} addCompanion={addCompanion}
          arrivalDate={arrivalDate} setArrivalDate={setArrivalDate}
          arrivalTime={arrivalTime} setArrivalTime={setArrivalTime}
          transport={transport} setTransport={setTransport}
          hotelRoomId={hotelRoomId} setHotelRoomId={setHotelRoomId}
          busy={busy} error={error} onSubmit={submitRsvp}
        />
      )}

      {step === 'done' && (
        <DoneView
          slug={slug} token={token!} personalCode={personalCode} attending={attending}
          coupleName={data?.event.coupleName ?? ''}
          showMusic={!!data?.event.rsvpShowMusikwunsch && attending === true}
          showWishlist={!!data?.event.rsvpShowGeschenke && (data?.wishlist?.length ?? 0) > 0}
          wishlist={data?.wishlist ?? []}
        />
      )}
    </section>
  )
}

// ── Formular ────────────────────────────────────────────────────────────────
const TRANSPORT_LABEL: Record<string, string> = { auto: 'Auto', bahn: 'Bahn', flugzeug: 'Flugzeug', andere: 'Andere' }

function RsvpForm(p: any) {
  const ev = p.data.event
  const frozen = ev.isFrozen || ev.isDeadlinePassed
  const mealOptions: string[] = ev.mealOptions ?? []
  const hotels: Hotel[] = ev.hotels ?? []
  const showHotel = ev.rsvpShowHotel && hotels.length > 0
  const showCompanions = ev.rsvpShowBegleitpersonen && ev.maxBegleitpersonen > 0
  const [wstep, setWstep] = useState(0)

  // Dynamische Schrittfolge je nach Zu-/Absage und aktivierten Optionen.
  const steps = useMemo<string[]>(() => {
    if (p.attending === false) return ['attend', 'decline']
    if (p.attending === true) {
      const s = ['attend', 'details']
      if (showCompanions) s.push('companions')
      s.push('travel', 'message')
      return s
    }
    return ['attend']
  }, [p.attending, showCompanions])

  useEffect(() => { if (wstep > steps.length - 1) setWstep(steps.length - 1) }, [steps, wstep])
  const idx = Math.min(wstep, steps.length - 1)
  const cur = steps[idx]
  const isLast = idx === steps.length - 1
  const canAdvance = cur !== 'attend' || p.attending !== null

  const STEP_TITLE: Record<string, string> = {
    attend: 'Bist du dabei?', details: 'Deine Angaben', companions: 'Begleitung',
    travel: 'Anreise & Übernachtung', message: 'Fast geschafft', decline: 'Schade!',
  }

  return (
    <div className="wd-card wd-wizard">
      {frozen && (
        <p className="wd-error" style={{ marginBottom: '1rem' }}>
          Die Anmeldung ist geschlossen — Änderungen sind nicht mehr möglich.
        </p>
      )}

      {/* Fortschritt */}
      <div className="wd-wizard-head">
        <span className="wd-eyebrow" style={{ margin: 0 }}>Schritt {idx + 1} von {steps.length}</span>
        <div className="wd-steps" aria-hidden>
          {steps.map((_, i) => <span key={i} className={`wd-step-dot${i === idx ? ' active' : ''}${i < idx ? ' done' : ''}`} />)}
        </div>
      </div>
      <h3 className="wd-wizard-title">{STEP_TITLE[cur]}</h3>

      {/* ── Schritt: Teilnahme ── */}
      {cur === 'attend' && (
        <div className="wd-choice">
          <button type="button" className={`wd-choice-btn wd-choice-btn-lg${p.attending === true ? ' selected' : ''}`} onClick={() => p.setAttending(true)}>
            Ich komme
          </button>
          <button type="button" className={`wd-choice-btn wd-choice-btn-lg${p.attending === false ? ' selected' : ''}`} onClick={() => p.setAttending(false)}>
            Leider nicht
          </button>
        </div>
      )}

      {/* ── Schritt: Details ── */}
      {cur === 'details' && (
        <>
          {ev.rsvpShowMenu && mealOptions.length > 0 && (
            <div className="wd-field">
              <label className="wd-label">Menüwahl</label>
              <div className="wd-pillrow">
                {mealOptions.map(m => (
                  <button type="button" key={m} className={`wd-pill${p.meal === m ? ' selected' : ''}`} onClick={() => p.setMeal(m)}>
                    {MEAL_LABEL[m] ?? m}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="wd-field">
            <label className="wd-label">Trinkst du Alkohol?</label>
            <div className="wd-pillrow">
              <button type="button" className={`wd-pill${p.alcohol === true ? ' selected' : ''}`} onClick={() => p.setAlcohol(true)}>Ja</button>
              <button type="button" className={`wd-pill${p.alcohol === false ? ' selected' : ''}`} onClick={() => p.setAlcohol(false)}>Nein</button>
            </div>
          </div>
          <div className="wd-field">
            <label className="wd-label">Allergien / Unverträglichkeiten</label>
            <input className="wd-input" value={p.allergies} onChange={(e: any) => p.setAllergies(e.target.value.slice(0, 240))} placeholder="z.B. Nüsse, Laktose – oder leer lassen" />
          </div>
        </>
      )}

      {/* ── Schritt: Begleitung ── */}
      {cur === 'companions' && (
        <div className="wd-field">
          <label className="wd-label">Begleitung ({p.companions.length}/{ev.maxBegleitpersonen})</label>
          {p.companions.map((c: Companion, i: number) => (
            <div className="wd-companion" key={i}>
              <button type="button" className="wd-companion-remove" onClick={() => p.setCompanions((arr: Companion[]) => arr.filter((_, x) => x !== i))} aria-label="Entfernen"><X size={16} /></button>
              <div className="wd-field" style={{ marginBottom: '0.6rem' }}>
                <input className="wd-input" placeholder="Name der Begleitung" value={c.name}
                  onChange={(e: any) => p.setCompanions((arr: Companion[]) => arr.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))} />
              </div>
              {ev.rsvpShowMenu && mealOptions.length > 0 && (
                <div className="wd-pillrow">
                  {mealOptions.map(m => (
                    <button type="button" key={m} className={`wd-pill${c.meal === m ? ' selected' : ''}`}
                      onClick={() => p.setCompanions((arr: Companion[]) => arr.map((x, xi) => xi === i ? { ...x, meal: m as Meal } : x))}>
                      {MEAL_LABEL[m] ?? m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {p.companions.length < ev.maxBegleitpersonen && (
            <button type="button" className="wd-btn wd-btn-ghost" onClick={p.addCompanion}><Plus size={15} /> Begleitung hinzufügen</button>
          )}
          {p.companions.length === 0 && <p className="wd-hint">Du kannst diesen Schritt auch ohne Begleitung überspringen.</p>}
        </div>
      )}

      {/* ── Schritt: Anreise & Hotel ── */}
      {cur === 'travel' && (
        <>
          <div className="wd-field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="wd-label">Anreise (Datum)</label>
              <input className="wd-input" type="date" value={p.arrivalDate} onChange={(e: any) => p.setArrivalDate(e.target.value)} />
            </div>
            <div>
              <label className="wd-label">Uhrzeit</label>
              <input className="wd-input" type="time" value={p.arrivalTime} onChange={(e: any) => p.setArrivalTime(e.target.value)} />
            </div>
          </div>
          <div className="wd-field">
            <label className="wd-label">Anreise mit</label>
            <div className="wd-pillrow">
              {(['auto', 'bahn', 'flugzeug', 'andere'] as const).map(t => (
                <button type="button" key={t} className={`wd-pill${p.transport === t ? ' selected' : ''}`} onClick={() => p.setTransport(p.transport === t ? '' : t)}>
                  {TRANSPORT_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          {showHotel && (
            <div className="wd-field">
              <label className="wd-label">Übernachtung</label>
              <button type="button" className={`wd-hotel-room${!p.hotelRoomId ? ' selected' : ''}`} onClick={() => p.setHotelRoomId('')}>
                <span>Keine Übernachtung benötigt</span>
              </button>
              {hotels.map(h => (
                <div key={h.id} className="wd-hotel">
                  <div className="wd-hotel-name">{h.name}{h.address ? <span className="wd-hint"> · {h.address}</span> : null}</div>
                  {h.rooms.map(r => {
                    const left = (r.totalRooms ?? 0) - (r.bookedRooms ?? 0)
                    const sel = p.hotelRoomId === r.id
                    const full = left <= 0 && !sel
                    return (
                      <button type="button" key={r.id} disabled={full}
                        className={`wd-hotel-room${sel ? ' selected' : ''}`}
                        onClick={() => p.setHotelRoomId(r.id)}>
                        <span>{r.type}</span>
                        <span className="wd-hotel-meta">
                          {r.pricePerNight ? `${r.pricePerNight} €/Nacht` : ''}{r.pricePerNight ? ' · ' : ''}{full ? 'ausgebucht' : `${left} frei`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Schritt: Nachricht / Absenden ── */}
      {(cur === 'message' || cur === 'decline') && (
        <div className="wd-field">
          {cur === 'decline' && <p className="wd-body" style={{ marginTop: 0 }}>Schade, dass du nicht dabei sein kannst. Magst du dem Brautpaar etwas hinterlassen?</p>}
          <label className="wd-label">Nachricht an das Brautpaar (optional)</label>
          <textarea className="wd-textarea" value={p.message} onChange={(e: any) => p.setMessage(e.target.value.slice(0, 1000))} placeholder="Eure Worte…" />
        </div>
      )}

      {p.error && <p className="wd-error">{p.error}</p>}

      {/* Navigation */}
      <div className="wd-wizard-nav">
        {idx > 0 && (
          <button type="button" className="wd-btn wd-btn-ghost" onClick={() => setWstep(s => Math.max(0, s - 1))} disabled={p.busy}>
            <ArrowLeft size={15} /> Zurück
          </button>
        )}
        {!isLast ? (
          <button type="button" className="wd-btn wd-btn-lg" style={{ marginLeft: 'auto' }} disabled={!canAdvance} onClick={() => setWstep(s => Math.min(steps.length - 1, s + 1))}>
            Weiter
          </button>
        ) : (
          <button type="button" className="wd-btn wd-btn-lg" style={{ marginLeft: 'auto' }} disabled={p.busy || frozen} onClick={() => p.onSubmit()}>
            {p.busy ? <Loader size={16} className="wd-spin" /> : 'Anmeldung absenden'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Bestätigung + Extras ──────────────────────────────────────────────────────
function DoneView(p: {
  slug: string; token: string; personalCode: string | null; attending: boolean | null
  coupleName: string; showMusic: boolean; showWishlist: boolean; wishlist: any[]
}) {
  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/wedding/${p.slug}/rsvp${p.personalCode ? `?code=${p.personalCode}` : ''}`
    : ''
  return (
    <div className="wd-card">
      <div className="wd-center">
        <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: '50%', background: 'var(--wd-accent)', color: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
          <Check size={28} />
        </div>
        <h2 className="wd-h2" style={{ fontSize: '1.7rem' }}>
          {p.attending ? 'Wir freuen uns auf dich!' : 'Schade, aber danke für die Rückmeldung'}
        </h2>
        <p className="wd-body">Deine Anmeldung wurde gespeichert.</p>
      </div>

      {p.personalCode && (
        <div className="wd-code-box">
          <div className="wd-label" style={{ marginBottom: '0.5rem' }}>Dein persönlicher Code</div>
          <div className="wd-code-value">{p.personalCode}</div>
          <p className="wd-hint" style={{ marginTop: '0.75rem' }}>
            Mit diesem Code kannst du jederzeit unter <strong>{link}</strong> deine Angaben ändern,
            Fotos hochladen und die Wunschliste ansehen. Eine Bestätigung per E-Mail folgt.
          </p>
        </div>
      )}

      {p.showMusic && (
        <>
          <div className="wd-divider-soft" />
          <MusicWish token={p.token} />
        </>
      )}

      {p.attending && (
        <>
          <div className="wd-divider-soft" />
          <h3 className="wd-extras-title">Fotos teilen</h3>
          <RsvpPhotos token={p.token} />
        </>
      )}

      {p.showWishlist && (
        <>
          <div className="wd-divider-soft" />
          <Wishlist token={p.token} wishlist={p.wishlist} />
        </>
      )}
    </div>
  )
}

function MusicWish({ token }: { token: string }) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [sent, setSent] = useState<{ title: string; artist: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !artist.trim()) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/rsvp/${token}/musik`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songTitle: title, songArtist: artist }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Fehler')
      setSent(prev => [...prev, { title: title.trim(), artist: artist.trim() }])
      setTitle(''); setArtist('')
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <h3 className="wd-extras-title">
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Music size={20} />
          Musikwunsch
        </span>
      </h3>
      <p className="wd-body" style={{ marginBottom: '1.5rem', marginTop: '-0.25rem' }}>
        Welche Songs dürfen auf keinen Fall fehlen? Gebt dem DJ eure Lieblingssongs mit.
      </p>

      {sent.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {sent.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.65rem 0.875rem',
              background: 'color-mix(in srgb, var(--wd-accent) 8%, var(--wd-bg))',
              borderRadius: 'var(--wd-radius)',
              border: '1px solid color-mix(in srgb, var(--wd-accent) 20%, transparent)',
            }}>
              <Check size={15} style={{ color: 'var(--wd-accent)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.9rem', color: 'var(--wd-ink)' }}>
                <strong>{s.title}</strong>
                <span style={{ color: 'var(--wd-ink-soft)', margin: '0 0.3rem' }}>–</span>
                {s.artist}
              </span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="wd-field" style={{ margin: 0 }}>
            <label className="wd-label">Songtitel</label>
            <input
              className="wd-input"
              placeholder="z.B. Can't Help Falling in Love"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div className="wd-field" style={{ margin: 0 }}>
            <label className="wd-label">Interpret</label>
            <input
              className="wd-input"
              placeholder="z.B. Elvis Presley"
              value={artist}
              onChange={e => setArtist(e.target.value)}
            />
          </div>
        </div>
        {err && <p className="wd-error">{err}</p>}
        <button
          className="wd-btn"
          style={{ marginTop: 0, alignSelf: 'flex-start' }}
          disabled={busy || !title.trim() || !artist.trim()}
        >
          {busy ? <Loader size={15} className="wd-spin" /> : <><Music size={15} /> Wunsch senden</>}
        </button>
      </form>
    </div>
  )
}

function Wishlist({ token, wishlist }: { token: string; wishlist: any[] }) {
  const [items, setItems] = useState(wishlist)
  return (
    <div>
      <h3 className="wd-extras-title"><Gift size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />Wunschliste</h3>
      <p className="wd-body" style={{ marginTop: '-0.25rem', marginBottom: '1.25rem' }}>
        Such dir aus, wie du dich beteiligen möchtest: einen Wunsch ganz übernehmen oder dich
        mit einem Betrag deiner Wahl an einem Geldwunsch beteiligen.
      </p>
      {items.map(w => (
        <WishlistItem
          key={w.id} token={token} wish={w}
          onChange={updated => setItems(arr => arr.map(x => x.id === updated.id ? updated : x))}
        />
      ))}
    </div>
  )
}

function WishlistItem({ token, wish, onChange }: { token: string; wish: any; onChange: (w: any) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState<string>(wish.my_contribution ? String(wish.my_contribution) : '')

  async function post(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true); setError(null)
    try {
      const res = await fetchWithRetry(`/api/rsvp/${token}/geschenk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, wish_id: wish.id }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Aktion fehlgeschlagen')
        return false
      }
      return true
    } catch {
      setError('Netzwerkfehler — bitte erneut versuchen')
      return false
    } finally { setBusy(false) }
  }

  async function claim(action: 'claim' | 'unclaim') {
    if (await post({ action })) {
      onChange({ ...wish, status: action === 'claim' ? 'vergeben' : 'verfuegbar', is_claimed_by_me: action === 'claim' })
    }
  }

  async function contribute() {
    const value = Math.round(Number(amount.replace(',', '.')))
    if (!Number.isFinite(value) || value <= 0) { setError('Bitte gib einen gültigen Betrag ein.'); return }
    if (await post({ action: 'contribute', amount: value })) {
      const prevMine = wish.my_contribution ?? 0
      const nextTotal = (wish.total_contributed ?? 0) - prevMine + value
      onChange({ ...wish, my_contribution: value, total_contributed: nextTotal })
    }
  }

  const taken = wish.status === 'vergeben' && !wish.is_claimed_by_me
  const target = Number(wish.money_target) || 0
  const collected = Number(wish.total_contributed) || 0
  const pct = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0

  return (
    <div className="wd-companion" style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        {wish.imageUrl && (
          <img
            src={wish.imageUrl}
            alt={wish.title}
            style={{
              width: 64, height: 64, borderRadius: 10, objectFit: 'cover',
              flexShrink: 0, border: '1px solid var(--wd-border, rgba(0,0,0,0.08))',
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>{wish.title}</strong>
          {wish.description && <div className="wd-hint">{wish.description}</div>}
          {!wish.is_money_wish && wish.price ? <div className="wd-hint">{wish.price} €</div> : null}
          {wish.link && (
            <a href={wish.link} target="_blank" rel="noopener noreferrer" className="wd-hint" style={{ color: 'var(--wd-accent)', textDecoration: 'underline' }}>
              Ansehen
            </a>
          )}
        </div>
        {!wish.is_money_wish && (
          wish.is_claimed_by_me
            ? <button className="wd-btn wd-btn-ghost" disabled={busy} onClick={() => claim('unclaim')} style={{ marginTop: 0, flexShrink: 0 }}>Freigeben</button>
            : <button className="wd-btn" disabled={taken || busy} onClick={() => claim('claim')} style={{ marginTop: 0, flexShrink: 0 }}>{taken ? 'Vergeben' : 'Übernehmen'}</button>
        )}
      </div>

      {/* Geldwunsch: anteilig beitragen */}
      {wish.is_money_wish && (
        <div style={{ marginTop: '0.75rem' }}>
          {target > 0 && (
            <>
              <div style={{ height: 8, borderRadius: 999, background: 'color-mix(in srgb, var(--wd-accent) 14%, transparent)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--wd-accent)', transition: 'width 0.3s' }} />
              </div>
              <div className="wd-hint" style={{ marginTop: '0.4rem' }}>
                {collected} € von {target} € gesammelt{pct >= 100 ? ' — Ziel erreicht!' : ''}
              </div>
            </>
          )}
          {wish.my_contribution > 0 && (
            <div className="wd-hint" style={{ marginTop: '0.25rem' }}>Dein bisheriger Beitrag: <strong>{wish.my_contribution} €</strong></div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', alignItems: 'center' }}>
            <input
              className="wd-input" type="number" min={1} inputMode="numeric"
              placeholder="Betrag in €" value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ maxWidth: 140 }}
            />
            <button className="wd-btn" disabled={busy} onClick={contribute} style={{ marginTop: 0, flexShrink: 0 }}>
              {busy ? <Loader size={15} className="wd-spin" /> : (wish.my_contribution > 0 ? 'Beitrag ändern' : 'Beitragen')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="wd-error" style={{ marginBottom: 0 }}>{error}</p>}
    </div>
  )
}
