'use client'
// components/wedding/WeddingRsvp.tsx
// Öffentlicher RSVP-Ablauf der Hochzeitswebsite (im Template-Look).
// Einstieg: "Schon angemeldet?" → Code eingeben ODER neu (Name + E-Mail).
// Danach: themed RSVP-Formular (nutzt die bestehende /api/rsvp/[token]-API).
// Nach dem Absenden: persönlicher Code/Link + Foto-Upload, Wunschliste, Musikwunsch.
import React, { useState } from 'react'
import { Check, Loader, ArrowLeft, Plus, X, Music, Gift } from 'lucide-react'
import RsvpPhotos from '@/components/rsvp/RsvpPhotos'

type Step = 'choice' | 'code' | 'newguest' | 'loading' | 'form' | 'done'
type Meal = 'fleisch' | 'fisch' | 'vegetarisch' | 'vegan'

interface Companion { name: string; ageCategory: string; meal: Meal | '' }

interface RsvpData {
  event: {
    coupleName: string
    mealOptions: string[]
    maxBegleitpersonen: number
    isFrozen: boolean
    isDeadlinePassed: boolean
    showMenu?: boolean
    rsvpShowMusikwunsch: boolean
    rsvpShowGeschenke: boolean
    rsvpShowBegleitpersonen: boolean
    rsvpShowMenu: boolean
  }
  guest: any
  wishlist: any[]
}

const MEAL_LABEL: Record<string, string> = { fleisch: 'Fleisch', fisch: 'Fisch', vegetarisch: 'Vegetarisch', vegan: 'Vegan' }

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

  async function loadForm(tk: string, presetCode?: string) {
    setStep('loading'); setError(null)
    try {
      const res = await fetch(`/api/rsvp/${tk}`)
      const d = await res.json()
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

  async function submitRsvp(e: React.FormEvent) {
    e.preventDefault()
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
        begleitpersonen: attending
          ? companions.filter(c => c.name.trim()).map(c => ({
              name: c.name, ageCategory: c.ageCategory, meal: c.meal || null,
            }))
          : [],
      }
      const res = await fetch(`/api/rsvp/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
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
function RsvpForm(p: any) {
  const ev = p.data.event
  const frozen = ev.isFrozen || ev.isDeadlinePassed
  const mealOptions: string[] = ev.mealOptions ?? []
  return (
    <form className="wd-card" onSubmit={p.onSubmit}>
      {frozen && (
        <p className="wd-error" style={{ marginBottom: '1rem' }}>
          Die Anmeldung ist geschlossen — Änderungen sind nicht mehr möglich.
        </p>
      )}
      <div className="wd-field">
        <label className="wd-label">Bist du dabei?</label>
        <div className="wd-choice">
          <button type="button" className={`wd-choice-btn wd-choice-btn-lg${p.attending === true ? ' selected' : ''}`} onClick={() => p.setAttending(true)}>
            Ich komme
          </button>
          <button type="button" className={`wd-choice-btn wd-choice-btn-lg${p.attending === false ? ' selected' : ''}`} onClick={() => p.setAttending(false)}>
            Leider nicht
          </button>
        </div>
      </div>

      {p.attending === true && (
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

          {ev.rsvpShowBegleitpersonen && ev.maxBegleitpersonen > 0 && (
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
            </div>
          )}
        </>
      )}

      <div className="wd-field">
        <label className="wd-label">Nachricht an das Brautpaar (optional)</label>
        <textarea className="wd-textarea" value={p.message} onChange={(e: any) => p.setMessage(e.target.value.slice(0, 1000))} placeholder="Eure Worte…" />
      </div>

      {p.error && <p className="wd-error">{p.error}</p>}
      <button className="wd-btn wd-btn-block wd-btn-lg" disabled={p.busy || frozen}>
        {p.busy ? <Loader size={16} className="wd-spin" /> : 'Anmeldung absenden'}
      </button>
    </form>
  )
}

// ── Bestätigung + Extras ──────────────────────────────────────────────────────
function DoneView(p: {
  slug: string; token: string; personalCode: string | null; attending: boolean | null
  coupleName: string; showMusic: boolean; showWishlist: boolean; wishlist: any[]
}) {
  const link = typeof window !== 'undefined' ? `${window.location.origin}/wedding/${p.slug}/rsvp` : ''
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

      {p.attending && (
        <>
          <div className="wd-divider-soft" />
          <h3 className="wd-extras-title">Fotos teilen</h3>
          <RsvpPhotos token={p.token} />
        </>
      )}

      {p.showMusic && (
        <>
          <div className="wd-divider-soft" />
          <MusicWish token={p.token} />
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
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/rsvp/${token}/musik`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songTitle: title, songArtist: artist }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Fehler')
      setSent(true); setTitle(''); setArtist('')
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit}>
      <h3 className="wd-extras-title"><Music size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />Musikwunsch</h3>
      {sent && <p className="wd-body" style={{ color: 'var(--wd-accent)' }}>Danke, dein Wunsch ist notiert! Noch einen?</p>}
      <div className="wd-field"><input className="wd-input" placeholder="Songtitel" value={title} onChange={e => setTitle(e.target.value)} /></div>
      <div className="wd-field"><input className="wd-input" placeholder="Interpret" value={artist} onChange={e => setArtist(e.target.value)} /></div>
      {err && <p className="wd-error">{err}</p>}
      <button className="wd-btn" disabled={busy || !title.trim() || !artist.trim()}>{busy ? '…' : 'Wunsch senden'}</button>
    </form>
  )
}

function Wishlist({ token, wishlist }: { token: string; wishlist: any[] }) {
  const [items, setItems] = useState(wishlist)
  const [busyId, setBusyId] = useState<string | null>(null)
  async function act(wish: any, action: 'claim' | 'unclaim') {
    setBusyId(wish.id)
    try {
      const res = await fetch(`/api/rsvp/${token}/geschenk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, wish_id: wish.id }),
      })
      if (res.ok) {
        setItems(arr => arr.map(w => w.id === wish.id
          ? { ...w, status: action === 'claim' ? 'vergeben' : 'verfuegbar', is_claimed_by_me: action === 'claim' }
          : w))
      }
    } finally { setBusyId(null) }
  }
  return (
    <div>
      <h3 className="wd-extras-title"><Gift size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />Wunschliste</h3>
      {items.map(w => {
        const taken = w.status === 'vergeben' && !w.is_claimed_by_me
        return (
          <div key={w.id} className="wd-companion" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div>
              <strong>{w.title}</strong>
              {w.description && <div className="wd-hint">{w.description}</div>}
              {w.price && <div className="wd-hint">{w.price} €</div>}
            </div>
            {!w.is_money_wish && (
              w.is_claimed_by_me
                ? <button className="wd-btn wd-btn-ghost" disabled={busyId === w.id} onClick={() => act(w, 'unclaim')} style={{ marginTop: 0 }}>Freigeben</button>
                : <button className="wd-btn" disabled={taken || busyId === w.id} onClick={() => act(w, 'claim')} style={{ marginTop: 0 }}>{taken ? 'Vergeben' : 'Übernehmen'}</button>
            )}
          </div>
        )
      })}
    </div>
  )
}
