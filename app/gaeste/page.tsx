'use client'
import React, { useState, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { type Guest, type GuestStatus } from "@/lib/store"
import { useEvent } from "@/lib/event-context"
import { PageShell, Card, SectionTitle, Badge, Avatar, Button, Toast } from '@/components/ui'
import { UserPlus, Mail, Copy, Check, Trash2, ChevronDown, ChevronUp, FileText } from 'lucide-react'

type View = 'gaeste' | 'einladungen'

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', fontSize: 14, color: 'var(--text)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 9, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.12em',
  color: 'var(--text-dim)', marginBottom: 7,
}

export default function GaestePage() {
  const [view, setView] = useState<View>('gaeste')
  const [toast, setToast] = useState<string | null>(null)

  // Anlegen
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [address, setAddress] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  // Einladen
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [customMsg, setCustomMsg] = useState('')
  const [copiedId, setCopiedId]   = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Gäste-Liste
  const [expanded, setExpanded] = useState<string | null>(null)

  const { event, updateEvent } = useEvent()
  if (!event) return null

  /* ── Computed ──────────────────────────────────────────────────── */
  const zugesagt  = event.guests.filter(g => g.status === 'zugesagt')
  const abgesagt  = event.guests.filter(g => g.status === 'abgesagt')
  const eingeladen = event.guests.filter(g => g.status === 'eingeladen')
  const angelegt   = event.guests.filter(g => g.status === 'angelegt')
  const offeneEinladungen = eingeladen.length + angelegt.length

  /* ── Actions ───────────────────────────────────────────────────── */
  const addGuest = () => {
    if (!event || !name.trim()) return
    const g: Guest = {
      id: uuid(), name: name.trim(), email: email.trim(),
      token: uuid(), status: 'angelegt',
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      begleitpersonen: [], allergies: [],
    }
    updateEvent({ ...event, guests: [...event.guests, g] })
    setName(''); setEmail(''); setPhone(''); setAddress('')
    setToast(`${g.name} angelegt`)
    setTimeout(() => nameRef.current?.focus(), 50)
  }

  const handleKey = (field: 'name' | 'email' | 'phone' | 'address', e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const order = ['name', 'email', 'phone', 'address']
    const idx = order.indexOf(field)
    if (idx < order.length - 1) {
      document.getElementById(`gf-${order[idx + 1]}`)?.focus()
    } else {
      addGuest()
    }
  }

  const base    = typeof window !== 'undefined' ? window.location.origin : 'https://velvet.app'
  const rsvpUrl = (t: string) => `${base}/rsvp/${t}`

  const mailText = (g: Guest) =>
`Liebe/r ${g.name.split(' ')[0]},

wir laden dich herzlich zur Hochzeit von ${event.coupleName} ein!

Datum: ${new Date(event.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
Ort: ${event.venue}, ${event.venueAddress}
Dresscode: ${event.dresscode}

Bitte melde dich über deinen persönlichen Link an:
${rsvpUrl(g.token)}${customMsg ? `\n\n${customMsg}` : ''}

Wir freuen uns sehr auf dich!
Herzliche Grüße,
${event.coupleName}`

  const toggleSelect = (id: string) => setSelected(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const markInvited = () => {
    if (!event || selected.size === 0) return
    updateEvent({
      ...event,
      guests: event.guests.map(g =>
        selected.has(g.id) && g.status === 'angelegt'
          ? { ...g, status: 'eingeladen' as GuestStatus }
          : g
      ),
    })
    setToast(`${selected.size} Gast${selected.size > 1 ? 'e' : ''} als eingeladen markiert`)
    setSelected(new Set())
  }

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
      setToast('Kopiert')
    } catch {}
  }

  const letterHtml = (g: Guest) => `
    <div style="font-family:Georgia,serif;background:#fff;padding:48px 40px;max-width:600px;margin:0 auto">
      <div style="text-align:center;border-bottom:1px solid #E8E8E8;padding-bottom:24px;margin-bottom:28px">
        <p style="font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#C9A84C;margin:0 0 8px">Velvet</p>
        <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#0A0A0A;margin:0 0 6px">${event.coupleName}</h2>
        <p style="font-size:13px;color:#6B6B6B;margin:0">${new Date(event.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <p style="font-size:15px;color:#1C1C1C;margin:0 0 16px">Liebe/r ${g.name.split(' ')[0]},</p>
      <p style="font-size:13px;color:#3D3D4E;line-height:1.75;margin:0 0 20px">wir freuen uns von Herzen, dich zu unserem Hochzeitsfest einzuladen.</p>
      <div style="background:#F7F3EE;border-radius:10px;padding:16px 18px;margin-bottom:20px">
        ${[['Datum', new Date(event.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })], ['Ort', `${event.venue}, ${event.venueAddress}`], ['Dresscode', event.dresscode], ['Hotel', event.hotelName]].map(([k, v]) => `
          <div style="display:flex;gap:12px;margin-bottom:10px">
            <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9A9A9A;min-width:72px;padding-top:2px">${k}</span>
            <span style="font-size:12px;color:#3D3D4E">${v}</span>
          </div>`).join('')}
      </div>
      <p style="font-size:13px;color:#3D3D4E;line-height:1.7;margin:0 0 14px">Bitte melde dich über deinen persönlichen Link an:</p>
      <div style="background:#EAF2EE;border-radius:10px;padding:14px 16px;margin-bottom:20px">
        <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#7C9E8A;margin:0 0 6px">Dein Link</p>
        <p style="font-size:12px;color:#7C9E8A;word-break:break-all;margin:0">${rsvpUrl(g.token)}</p>
      </div>
      <p style="font-family:Georgia,serif;font-size:15px;color:#1C1C1C;margin:28px 0 0">Wir freuen uns auf dich!<br/><em>${event.coupleName}</em></p>
    </div>`

  const printLetters = () => {
    if (selected.size === 0) return
    const guests = angelegt.filter(g => selected.has(g.id))
    const win = window.open('', '_blank')
    if (win) {
      const pages = guests.map((g, i) =>
        `${letterHtml(g)}${i < guests.length - 1 ? '<div style="page-break-after:always"></div>' : ''}`
      ).join('')
      win.document.write(`<!DOCTYPE html><html><head><title>Einladungen</title><style>@media print{body{margin:0}}</style></head><body>${pages}</body></html>`)
      win.document.close()
      win.focus()
      win.print()
    }
    markInvited()
  }

  const deleteGuest = (id: string) => {
    if (!event) return
    updateEvent({ ...event, guests: event.guests.filter(g => g.id !== id) })
    if (expanded === id) setExpanded(null)
    setToast('Gast entfernt')
  }

  const MEAL_LABELS: Record<string, string> = { fleisch: 'Fleisch', fisch: 'Fisch', vegetarisch: 'Vegetarisch', vegan: 'Vegan' }

  /* ════════════════════════════════════════════════════════════════ */
  return (
    <PageShell title="Gäste" back="/dashboard">

      {/* ── View-Toggle ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 4 }}>
        <button onClick={() => setView('gaeste')} style={{
          flex: 1, padding: '9px 4px', borderRadius: 10,
          background: view === 'gaeste' ? 'var(--gold-pale)' : 'none',
          border: `1.5px solid ${view === 'gaeste' ? 'rgba(201,168,76,0.3)' : 'transparent'}`,
          color: view === 'gaeste' ? 'var(--gold)' : 'var(--text-dim)',
          fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.15s',
        }}>
          Gäste
          {zugesagt.length > 0 && (
            <span style={{ marginLeft: 5, background: 'var(--gold)', color: '#fff', borderRadius: 100, padding: '1px 6px', fontSize: 10 }}>
              {zugesagt.length}
            </span>
          )}
        </button>
        <button onClick={() => setView('einladungen')} style={{
          flex: 1, padding: '9px 4px', borderRadius: 10,
          background: view === 'einladungen' ? 'var(--gold-pale)' : 'none',
          border: `1.5px solid ${view === 'einladungen' ? 'rgba(201,168,76,0.3)' : 'transparent'}`,
          color: view === 'einladungen' ? 'var(--gold)' : 'var(--text-dim)',
          fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.15s',
        }}>
          Einladungen
          {offeneEinladungen > 0 && (
            <span style={{ marginLeft: 5, background: view === 'einladungen' ? 'var(--gold)' : 'var(--text-dim)', color: '#fff', borderRadius: 100, padding: '1px 6px', fontSize: 10 }}>
              {offeneEinladungen}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════ VIEW: GÄSTE ════════════════════════ */}
      {view === 'gaeste' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>

          {/* Stats-Row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <StatChip label="Zugesagt" value={zugesagt.length} accent />
            <StatChip label="Abgesagt" value={abgesagt.length} />
            <div style={{ flex: 1 }} />
            {offeneEinladungen > 0 && (
              <button onClick={() => setView('einladungen')} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--gold-pale)', border: '1.5px solid rgba(201,168,76,0.3)',
                borderRadius: 'var(--r-md)', padding: '7px 12px',
                fontSize: 12, fontWeight: 700, color: 'var(--gold)',
                cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>
                {offeneEinladungen} offen → Einladungen
              </button>
            )}
          </div>

          {/* Zugesagte Gäste */}
          {zugesagt.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '28px 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>Noch keine Zusagen erhalten.</p>
              <button onClick={() => setView('einladungen')} style={{
                background: 'none', border: 'none', color: 'var(--gold)',
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              }}>
                Gäste einladen →
              </button>
            </Card>
          ) : (
            <>
              <SectionTitle>Zugesagt ({zugesagt.length})</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 24 }}>
                {zugesagt.map(g => (
                  <GuestRow key={g.id} g={g} expanded={expanded} setExpanded={setExpanded} deleteGuest={deleteGuest} MEAL_LABELS={MEAL_LABELS} />
                ))}
              </div>
            </>
          )}

          {/* Abgesagte Gäste */}
          {abgesagt.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', marginBottom: 16 }} />
              <SectionTitle>Abgesagt ({abgesagt.length})</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {abgesagt.map(g => (
                  <GuestRow key={g.id} g={g} expanded={expanded} setExpanded={setExpanded} deleteGuest={deleteGuest} MEAL_LABELS={MEAL_LABELS} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════ VIEW: EINLADUNGEN ══════════════════ */}
      {view === 'einladungen' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>

          {/* ── Ohne Rückmeldung ─────────────────────────────────── */}
          {eingeladen.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionTitle>Eingeladen · Ohne Rückmeldung ({eingeladen.length})</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {eingeladen.map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                    <Avatar name={g.name} size={34} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{g.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{g.email || 'Keine E-Mail'}{g.phone ? ` · ${g.phone}` : ''}</p>
                    </div>
                    <Badge variant="gold" label="Eingeladen" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Noch einzuladen ──────────────────────────────────── */}
          {angelegt.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionTitle>Noch einzuladen ({angelegt.length})</SectionTitle>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <button onClick={() => {
                  if (selected.size === angelegt.length) setSelected(new Set())
                  else setSelected(new Set(angelegt.map(g => g.id)))
                }} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--gold)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  {selected.size === angelegt.length ? 'Auswahl aufheben' : 'Alle auswählen'}
                </button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Persönliche Ergänzung (optional)</label>
                <input value={customMsg} onChange={e => setCustomMsg(e.target.value)}
                  placeholder="z.B. Wir freuen uns besonders auf dich!"
                  style={fieldStyle} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
                {angelegt.map(g => {
                  const isSel    = selected.has(g.id)
                  const showPrev = previewId === g.id
                  return (
                    <div key={g.id} style={{ background: 'var(--surface)', border: `1.5px solid ${isSel ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }} onClick={() => toggleSelect(g.id)}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSel ? 'var(--gold)' : 'var(--border)'}`, background: isSel ? 'var(--gold-pale)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                          {isSel && <Check size={12} color="var(--gold)" />}
                        </div>
                        <Avatar name={g.name} size={34} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{g.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{g.email || 'Keine E-Mail'}{g.phone ? ` · ${g.phone}` : ''}</p>
                        </div>
                        {g.email && (
                          <button onClick={e => { e.stopPropagation(); setPreviewId(showPrev ? null : g.id) }}
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <Mail size={11} />{showPrev ? '—' : 'Mail'}
                          </button>
                        )}
                      </div>
                      {showPrev && g.email && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', background: 'var(--bg)' }}>
                          <pre style={{ fontFamily: 'inherit', fontSize: 11, color: 'var(--text-light)', whiteSpace: 'pre-wrap', lineHeight: 1.7, background: 'var(--surface)', borderRadius: 8, padding: '12px', maxHeight: 200, overflowY: 'auto', marginBottom: 10 }}>
                            {mailText(g)}
                          </pre>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <a href={`mailto:${g.email}?subject=${encodeURIComponent(`Einladung zur Hochzeit von ${event.coupleName}`)}&body=${encodeURIComponent(mailText(g))}`} style={{ flex: 1, textDecoration: 'none' }}>
                              <button style={{ width: '100%', padding: '9px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <Mail size={13} /> Mail öffnen
                              </button>
                            </a>
                            <button onClick={() => copy(mailText(g), g.id)} style={{ padding: '9px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                              {copiedId === g.id ? <Check size={13} color="var(--gold)" /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" disabled={selected.size === 0} onClick={printLetters}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                    <FileText size={14} /> Brief drucken
                  </span>
                </Button>
                <Button fullWidth variant="gold" disabled={selected.size === 0} onClick={markInvited}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center' }}>
                    <Mail size={14} />
                    {selected.size > 0 ? `${selected.size} einladen` : 'Gäste auswählen'}
                  </span>
                </Button>
              </div>
            </div>
          )}

          {/* ── Neuen Gast anlegen ───────────────────────────────── */}
          <div style={{ borderTop: eingeladen.length > 0 || angelegt.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: eingeladen.length > 0 || angelegt.length > 0 ? 20 : 0 }}>
            <SectionTitle>Neuen Gast anlegen</SectionTitle>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
              Mit <kbd style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 6px', fontSize: 11 }}>Enter</kbd> springst du zum nächsten Feld — am Ende wird der Gast automatisch gespeichert.
            </p>
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle} htmlFor="gf-name">Name *</label>
                  <input id="gf-name" ref={nameRef} value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => handleKey('name', e)} placeholder="Vorname Nachname"
                    style={{ ...fieldStyle, borderColor: name ? 'var(--gold)' : 'var(--border)' }} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="gf-email">E-Mail</label>
                  <input id="gf-email" value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => handleKey('email', e)} placeholder="gast@beispiel.de" type="email"
                    style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="gf-phone">Telefon</label>
                  <input id="gf-phone" value={phone} onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => handleKey('phone', e)} placeholder="+49 123 456 789" type="tel"
                    style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="gf-address">Adresse</label>
                  <input id="gf-address" value={address} onChange={e => setAddress(e.target.value)}
                    onKeyDown={e => handleKey('address', e)} placeholder="Musterstraße 1, 12345 Musterstadt"
                    style={fieldStyle} />
                </div>
                <Button fullWidth variant="gold" onClick={addGuest} disabled={!name.trim()}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center' }}>
                    <UserPlus size={15} /> Speichern &amp; nächsten erfassen
                  </span>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </PageShell>
  )
}

function StatChip({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? 'var(--gold-pale)' : 'var(--surface)',
      border: `1px solid ${accent ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
      borderRadius: 'var(--r-md)', padding: '8px 14px', textAlign: 'center', minWidth: 64,
    }}>
      <p style={{ fontSize: 20, fontWeight: 700, color: accent ? 'var(--gold)' : 'var(--text)', lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginTop: 3 }}>{label}</p>
    </div>
  )
}

function GuestRow({ g, expanded, setExpanded, deleteGuest, MEAL_LABELS }: {
  g: Guest
  expanded: string | null
  setExpanded: (id: string | null) => void
  deleteGuest: (id: string) => void
  MEAL_LABELS: Record<string, string>
}) {
  const isExp = expanded === g.id
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }} onClick={() => setExpanded(isExp ? null : g.id)}>
        <Avatar name={g.name} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{g.name}</p>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[g.email, g.phone].filter(Boolean).join(' · ') || 'Keine Kontaktdaten'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isExp ? <ChevronUp size={14} color="var(--text-dim)" /> : <ChevronDown size={14} color="var(--text-dim)" />}
        </div>
      </div>
      {isExp && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px', background: 'var(--bg)' }}>
          {g.address && <InfoRow label="Adresse" value={g.address} />}
          {g.trinkAlkohol !== undefined && <InfoRow label="Alkohol" value={g.trinkAlkohol ? 'Ja' : 'Nein'} />}
          {g.meal && <InfoRow label="Menü" value={MEAL_LABELS[g.meal]} />}
          {g.begleitpersonen.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 5 }}>
                Begleitpersonen ({g.begleitpersonen.length})
              </p>
              {g.begleitpersonen.map(bp => (
                <div key={bp.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-mid)' }}>{bp.name}</p>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>·</span>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{bp.ageCategory}</p>
                </div>
              ))}
            </div>
          )}
          {g.message && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 4 }}>Nachricht</p>
              <p style={{ fontSize: 12, color: 'var(--text-mid)', fontStyle: 'italic' }}>„{g.message}"</p>
            </div>
          )}
          <button onClick={() => deleteGuest(g.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(160,64,64,0.3)', borderRadius: 8, padding: '7px 12px', fontSize: 11, color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Trash2 size={12} /> Gast entfernen
          </button>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 12, color: 'var(--text-mid)' }}>{value}</p>
    </div>
  )
}
