'use client'
import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────────

type NavId = 'uebersicht' | 'allgemein' | 'einladen' | 'vorschlaege' | 'mitglieder'

type EventData = {
  id: string
  title: string
  date: string | null
  venue: string | null
  venue_address: string | null
  dresscode: string | null
  children_allowed: boolean
  children_note: string | null
  meal_options: string[] | null
  max_begleitpersonen: number | null
  ceremony_start: string | null
}

type Member = {
  id: string
  user_id: string
  role: string
  profiles: { name: string } | null
}

type InviteCode = {
  id: string
  code: string
  role: string
  status: string
  expires_at: string
  used_at: string | null
}

type VendorSuggestion = {
  id: string
  name: string | null
  category: string | null
  description: string | null
  price_estimate: number
  contact_email: string | null
  contact_phone: string | null
  status: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return 'Kein Datum'
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch {
    return iso
  }
}

function fmtExpiry(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

// ── Style constants ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  fontSize: 14,
  border: '1px solid #D1D5DB',
  borderRadius: 8,
  background: '#fff',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  color: '#111827',
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#6B7280',
  marginBottom: 6,
}

// ── Toggle Switch ──────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, padding: 2,
        background: checked ? '#111827' : '#D1D5DB',
        border: 'none', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.2s',
        position: 'relative',
      }}
    >
      <span style={{
        display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2,
        left: checked ? 22 : 2,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function Skeleton({ height, width }: { height: number; width?: number | string }) {
  return (
    <div style={{
      height,
      width: width ?? '100%',
      borderRadius: 6,
      background: '#F3F4F6',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

// ── Section: Übersicht ─────────────────────────────────────────────────────

function UebersichtSection({
  event,
  members,
  inviteCodes,
  onNav,
}: {
  event: EventData
  members: Member[]
  inviteCodes: InviteCode[]
  onNav: (id: NavId) => void
}) {
  const unusedCodes = inviteCodes.filter(c => !c.used_at).length

  const statCards: { label: string; value: string | number }[] = [
    { label: 'Mitglieder', value: members.length },
    { label: 'Offene Einladungen', value: unusedCodes },
    { label: 'Event-Datum', value: fmtDate(event.date) },
  ]

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>
        {event.title}
      </h1>
      <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 28px' }}>
        {[fmtDate(event.date), event.venue].filter(Boolean).join(' · ')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {statCards.map(card => (
          <div
            key={card.label}
            style={{
              background: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: 10,
              padding: '16px 14px',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button
          onClick={() => onNav('allgemein')}
          style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 600,
            background: '#111827', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Event bearbeiten
        </button>
        <button
          onClick={() => onNav('einladen')}
          style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 600,
            background: 'none', color: '#374151',
            border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Einladen
        </button>
        <button
          onClick={() => onNav('mitglieder')}
          style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 600,
            background: 'none', color: '#374151',
            border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Mitglieder ansehen
        </button>
      </div>
    </div>
  )
}

// ── Section: Allgemein ─────────────────────────────────────────────────────

const ALL_MEALS = ['fleisch', 'fisch', 'vegetarisch', 'vegan'] as const

function AllgemeinSection({ event, eventId, onSaved }: { event: EventData; eventId: string; onSaved: (updated: EventData) => void }) {
  const supabase = createClient()

  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(event.date ?? '')
  const [ceremonyStart, setCeremonyStart] = useState(() => {
    if (!event.ceremony_start) return ''
    try { return new Date(event.ceremony_start).toTimeString().slice(0, 5) } catch { return '' }
  })
  const [venue, setVenue] = useState(event.venue ?? '')
  const [venueAddress, setVenueAddress] = useState(event.venue_address ?? '')
  const [dresscode, setDresscode] = useState(event.dresscode ?? '')
  const [childrenAllowed, setChildrenAllowed] = useState(event.children_allowed)
  const [childrenNote, setChildrenNote] = useState(event.children_note ?? '')
  const [maxBegleit, setMaxBegleit] = useState(event.max_begleitpersonen ?? 2)
  const [mealOptions, setMealOptions] = useState<string[]>(event.meal_options ?? ['fleisch', 'fisch', 'vegetarisch', 'vegan'])
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  function toggleMeal(meal: string) {
    setMealOptions(prev =>
      prev.includes(meal) ? prev.filter(m => m !== meal) : [...prev, meal]
    )
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    setSaveStatus('idle')
    try {
      const ceremonyStartFull = ceremonyStart && date
        ? `${date}T${ceremonyStart}:00`
        : null

      const { error } = await supabase
        .from('events')
        .update({
          title: title.trim(),
          date: date || null,
          ceremony_start: ceremonyStartFull,
          venue: venue.trim() || null,
          venue_address: venueAddress.trim() || null,
          dresscode: dresscode.trim() || null,
          children_allowed: childrenAllowed,
          children_note: childrenNote.trim() || null,
          max_begleitpersonen: maxBegleit,
          meal_options: mealOptions,
        })
        .eq('id', eventId)

      if (error) throw error

      setSaveStatus('success')
      onSaved({
        ...event,
        title: title.trim(),
        date: date || null,
        ceremony_start: ceremonyStartFull,
        venue: venue.trim() || null,
        venue_address: venueAddress.trim() || null,
        dresscode: dresscode.trim() || null,
        children_allowed: childrenAllowed,
        children_note: childrenNote.trim() || null,
        max_begleitpersonen: maxBegleit,
        meal_options: mealOptions,
      })
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = '#111827'
  }
  const blur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = '#D1D5DB'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: 0 }}>Allgemeine Einstellungen</h2>

      <div>
        <label style={labelStyle}>Eventname *</label>
        <input
          style={inputStyle} value={title}
          onChange={e => setTitle(e.target.value)}
          onFocus={focus} onBlur={blur}
          placeholder="z.B. Hochzeit Max & Anna"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Datum</label>
          <input
            type="date" style={inputStyle} value={date}
            onChange={e => setDate(e.target.value)}
            onFocus={focus} onBlur={blur}
          />
        </div>
        <div>
          <label style={labelStyle}>Uhrzeit Zeremonie</label>
          <input
            type="time" style={inputStyle} value={ceremonyStart}
            onChange={e => setCeremonyStart(e.target.value)}
            onFocus={focus} onBlur={blur}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Location Name</label>
        <input
          style={inputStyle} value={venue}
          onChange={e => setVenue(e.target.value)}
          onFocus={focus} onBlur={blur}
          placeholder="Schloss Lichtenberg"
        />
      </div>

      <div>
        <label style={labelStyle}>Location Adresse</label>
        <input
          style={inputStyle} value={venueAddress}
          onChange={e => setVenueAddress(e.target.value)}
          onFocus={focus} onBlur={blur}
          placeholder="Musterstraße 1, 12345 Musterstadt"
        />
      </div>

      <div>
        <label style={labelStyle}>Dresscode</label>
        <input
          style={inputStyle} value={dresscode}
          onChange={e => setDresscode(e.target.value)}
          onFocus={focus} onBlur={blur}
          placeholder="Festlich, Cocktailkleid etc."
        />
      </div>

      <div>
        <label style={labelStyle}>Kinder erlaubt</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ToggleSwitch checked={childrenAllowed} onChange={setChildrenAllowed} />
          <span style={{ fontSize: 13, color: '#374151' }}>{childrenAllowed ? 'Ja' : 'Nein'}</span>
        </div>
        {childrenAllowed && (
          <input
            style={{ ...inputStyle, marginTop: 10 }}
            value={childrenNote}
            onChange={e => setChildrenNote(e.target.value)}
            onFocus={focus} onBlur={blur}
            placeholder="Hinweis zu Kindern (optional)"
          />
        )}
      </div>

      <div>
        <label style={labelStyle}>Max. Begleitpersonen</label>
        <input
          type="number" min={0} style={{ ...inputStyle, maxWidth: 100 }}
          value={maxBegleit}
          onChange={e => setMaxBegleit(Math.max(0, parseInt(e.target.value) || 0))}
          onFocus={focus} onBlur={blur}
        />
      </div>

      <div>
        <label style={labelStyle}>Menü-Optionen</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ALL_MEALS.map(meal => {
            const active = mealOptions.includes(meal)
            return (
              <button
                key={meal} type="button"
                onClick={() => toggleMeal(meal)}
                style={{
                  padding: '8px 16px', borderRadius: 100, cursor: 'pointer',
                  border: `1.5px solid ${active ? '#111827' : '#D1D5DB'}`,
                  background: active ? '#111827' : 'none',
                  color: active ? '#fff' : '#374151',
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  textTransform: 'capitalize', transition: 'all 0.15s',
                }}
              >
                {meal}
              </button>
            )
          })}
        </div>
      </div>

      {saveStatus === 'success' && (
        <p style={{ fontSize: 13, color: '#166534', background: '#dcfce7', padding: '10px 14px', borderRadius: 8, margin: 0 }}>
          Gespeichert!
        </p>
      )}
      {saveStatus === 'error' && (
        <p style={{ fontSize: 13, color: '#991b1b', background: '#fee2e2', padding: '10px 14px', borderRadius: 8, margin: 0 }}>
          {saveError}
        </p>
      )}

      <div>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          style={{
            padding: '11px 24px', fontSize: 14, fontWeight: 600,
            background: '#111827', color: '#fff',
            border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Wird gespeichert …' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

// ── Section: Einladen ──────────────────────────────────────────────────────

const DIENSTLEISTER_CATEGORIES = [
  'Fotograf', 'Videograf', 'Catering', 'Floristik', 'Musik', 'DJ', 'Sonstiges',
] as const

function EinladenSection({ eventId, inviteCodes, onCodesRefresh }: {
  eventId: string
  inviteCodes: InviteCode[]
  onCodesRefresh: () => void
}) {
  const [bpLoading, setBpLoading] = useState(false)
  const [bpCode, setBpCode] = useState<string | null>(null)
  const [bpError, setBpError] = useState('')
  const [bpCopied, setBpCopied] = useState(false)

  const [dlName, setDlName] = useState('')
  const [dlCategory, setDlCategory] = useState<string>('Fotograf')
  const [dlEmail, setDlEmail] = useState('')
  const [dlLoading, setDlLoading] = useState(false)
  const [dlCode, setDlCode] = useState<string | null>(null)
  const [dlError, setDlError] = useState('')
  const [dlCopied, setDlCopied] = useState(false)

  const brautpaarCodes = inviteCodes.filter(c => c.role === 'brautpaar')
  const dienstleisterCodes = inviteCodes.filter(c => c.role === 'dienstleister')

  async function createBrautpaarInvite() {
    setBpLoading(true)
    setBpError('')
    setBpCode(null)
    try {
      const res = await fetch('/api/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, targetRole: 'brautpaar' }),
      })
      const json = await res.json() as { code?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Fehler beim Erstellen')
      if (!json.code) throw new Error('Kein Code zurückgegeben')
      setBpCode(json.code)
      onCodesRefresh()
    } catch (err: unknown) {
      setBpError(err instanceof Error ? err.message : 'Fehler beim Erstellen')
    } finally {
      setBpLoading(false)
    }
  }

  async function createDienstleisterInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!dlName.trim()) return
    setDlLoading(true)
    setDlError('')
    setDlCode(null)
    try {
      const res = await fetch('/api/invite/dienstleister', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, name: dlName.trim(), category: dlCategory, email: dlEmail.trim() || undefined }),
      })
      const json = await res.json() as { code?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Fehler beim Erstellen')
      if (!json.code) throw new Error('Kein Code zurückgegeben')
      setDlCode(json.code)
      setDlName('')
      setDlEmail('')
      onCodesRefresh()
    } catch (err: unknown) {
      setDlError(err instanceof Error ? err.message : 'Fehler beim Erstellen')
    } finally {
      setDlLoading(false)
    }
  }

  function copyToClipboard(code: string, onCopied: () => void) {
    const url = `${window.location.origin}/signup?code=${code}`
    navigator.clipboard.writeText(url).then(onCopied)
  }

  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = '#111827'
  }
  const blur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = '#D1D5DB'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Brautpaar */}
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Brautpaar einladen</h2>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
          Erstelle einen Einladungslink für das Brautpaar.
        </p>

        <button
          onClick={createBrautpaarInvite}
          disabled={bpLoading}
          style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 600,
            background: '#111827', color: '#fff',
            border: 'none', borderRadius: 8, cursor: bpLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: bpLoading ? 0.6 : 1, marginBottom: 12,
          }}
        >
          {bpLoading ? 'Wird erstellt …' : 'Einladungslink erstellen'}
        </button>

        {bpError && (
          <p style={{ fontSize: 13, color: '#991b1b', background: '#fee2e2', padding: '10px 14px', borderRadius: 8, margin: '0 0 12px' }}>
            {bpError}
          </p>
        )}

        {bpCode && (
          <div style={{ background: '#F8F8F8', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Einladungslink</p>
            <code style={{ fontSize: 12, color: '#111827', wordBreak: 'break-all', display: 'block', marginBottom: 10 }}>
              {window.location.origin}/signup?code={bpCode}
            </code>
            <button
              onClick={() => { copyToClipboard(bpCode, () => { setBpCopied(true); setTimeout(() => setBpCopied(false), 2000) }) }}
              style={{
                padding: '7px 14px', fontSize: 12, fontWeight: 600,
                background: 'none', color: '#374151',
                border: '1px solid #D1D5DB', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {bpCopied ? 'Kopiert!' : 'Kopieren'}
            </button>
          </div>
        )}

        {brautpaarCodes.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Vorhandene Codes
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {brautpaarCodes.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 7 }}>
                  <code style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.code.slice(0, 18)}…
                  </code>
                  <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>Bis {fmtExpiry(c.expires_at)}</span>
                  {c.status === 'verwendet' || c.used_at ? (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                      Angenommen
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#F3F4F6', color: '#6B7280', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                      Offen
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dienstleister */}
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Dienstleister einladen</h2>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
          Erstelle einen personalisierten Link für einen Dienstleister.
        </p>

        <form onSubmit={createDienstleisterInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              required style={inputStyle} value={dlName}
              onChange={e => setDlName(e.target.value)}
              onFocus={focus} onBlur={blur}
              placeholder="Studio Lichtblick"
            />
          </div>
          <div>
            <label style={labelStyle}>Kategorie</label>
            <select
              style={inputStyle} value={dlCategory}
              onChange={e => setDlCategory(e.target.value)}
              onFocus={focus} onBlur={blur}
            >
              {DIENSTLEISTER_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>E-Mail (optional)</label>
            <input
              type="email" style={inputStyle} value={dlEmail}
              onChange={e => setDlEmail(e.target.value)}
              onFocus={focus} onBlur={blur}
              placeholder="kontakt@example.de"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={dlLoading || !dlName.trim()}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: 600,
                background: '#111827', color: '#fff',
                border: 'none', borderRadius: 8, cursor: dlLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', opacity: dlLoading ? 0.6 : 1,
              }}
            >
              {dlLoading ? 'Wird erstellt …' : 'Einladungslink erstellen'}
            </button>
          </div>
        </form>

        {dlError && (
          <p style={{ fontSize: 13, color: '#991b1b', background: '#fee2e2', padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>
            {dlError}
          </p>
        )}

        {dlCode && (
          <div style={{ background: '#F8F8F8', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Einladungslink</p>
            <code style={{ fontSize: 12, color: '#111827', wordBreak: 'break-all', display: 'block', marginBottom: 10 }}>
              {window.location.origin}/signup?code={dlCode}
            </code>
            <button
              onClick={() => { copyToClipboard(dlCode, () => { setDlCopied(true); setTimeout(() => setDlCopied(false), 2000) }) }}
              style={{
                padding: '7px 14px', fontSize: 12, fontWeight: 600,
                background: 'none', color: '#374151',
                border: '1px solid #D1D5DB', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {dlCopied ? 'Kopiert!' : 'Kopieren'}
            </button>
          </div>
        )}

        {dienstleisterCodes.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Vorhandene Codes
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dienstleisterCodes.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 7 }}>
                  <code style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.code.slice(0, 18)}…
                  </code>
                  <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>Bis {fmtExpiry(c.expires_at)}</span>
                  {c.status === 'verwendet' || c.used_at ? (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                      Angenommen
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#F3F4F6', color: '#6B7280', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                      Offen
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section: Mitglieder ────────────────────────────────────────────────────

function MitgliederSection({ members }: { members: Member[] }) {
  function roleBadgeStyle(role: string): React.CSSProperties {
    if (role === 'veranstalter') return { background: '#111827', color: '#fff' }
    if (role === 'brautpaar') return { background: '#6B7280', color: '#fff' }
    return { background: '#E5E7EB', color: '#374151' }
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Mitglieder</h2>
      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>{members.length} Mitglied{members.length !== 1 ? 'er' : ''}</p>

      {members.length === 0 ? (
        <p style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', padding: '32px 0' }}>
          Noch keine Mitglieder. Lade Personen über den Reiter &quot;Einladen&quot; ein.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map(m => (
            <div
              key={m.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', background: '#fff',
                border: '1px solid #E5E7EB', borderRadius: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>
                  {m.profiles?.name ?? 'Unbekannt'}
                </p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.user_id.slice(0, 16)}…
                </p>
              </div>
              <span style={{
                ...roleBadgeStyle(m.role),
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', padding: '3px 10px', borderRadius: 20,
                flexShrink: 0,
              }}>
                {m.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Vorschläge Section ─────────────────────────────────────────────────────

const VENDOR_CATEGORIES = ['Fotograf','Videograf','Catering','Floristik','Musik','DJ','Sonstiges'] as const

function VorschlaegeSection({ eventId }: { eventId: string }) {
  const supabase = createClient()
  const [vendors, setVendors] = useState<VendorSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'Fotograf', description: '', price_estimate: '', contact_email: '', contact_phone: '' })
  const [formError, setFormError] = useState('')

  useEffect(() => { loadVendors() }, [])

  async function loadVendors() {
    setLoading(true)
    const { data } = await supabase
      .from('organizer_vendor_suggestions')
      .select('id, name, category, description, price_estimate, contact_email, contact_phone, status')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
    setVendors((data ?? []) as VendorSuggestion[])
    setLoading(false)
  }

  async function addVendor(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Name erforderlich.'); return }
    setSaving(true); setFormError('')
    const { error } = await supabase.from('organizer_vendor_suggestions').insert({
      event_id: eventId,
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      price_estimate: Number(form.price_estimate) || 0,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
    })
    if (error) { setFormError(error.message); setSaving(false); return }
    setForm({ name: '', category: 'Fotograf', description: '', price_estimate: '', contact_email: '', contact_phone: '' })
    setShowForm(false)
    await loadVendors()
    setSaving(false)
  }

  async function deleteVendor(id: string) {
    await supabase.from('organizer_vendor_suggestions').delete().eq('id', id)
    setVendors(v => v.filter(x => x.id !== id))
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('organizer_vendor_suggestions').update({ status }).eq('id', id)
    setVendors(v => v.map(x => x.id === id ? { ...x, status } : x))
  }

  const statusColor = (s: string) => s === 'angenommen' ? '#166534' : s === 'abgelehnt' ? '#991b1b' : '#6B7280'
  const statusBg = (s: string) => s === 'angenommen' ? '#dcfce7' : s === 'abgelehnt' ? '#fee2e2' : '#F3F4F6'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>Dienstleister-Vorschläge</h2>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Vorschläge für das Brautpaar sichtbar</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, background: '#111827', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + Hinzufügen
        </button>
      </div>

      {showForm && (
        <form onSubmit={addVendor} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Studio Lichtblick" onFocus={e => { e.target.style.borderColor = '#111827' }} onBlur={e => { e.target.style.borderColor = '#D1D5DB' }} />
            </div>
            <div>
              <label style={labelStyle}>Kategorie</label>
              <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>E-Mail</label>
              <input style={inputStyle} type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="kontakt@example.de" onFocus={e => { e.target.style.borderColor = '#111827' }} onBlur={e => { e.target.style.borderColor = '#D1D5DB' }} />
            </div>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input style={inputStyle} value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="+49 …" onFocus={e => { e.target.style.borderColor = '#111827' }} onBlur={e => { e.target.style.borderColor = '#D1D5DB' }} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Geschätzte Kosten (€)</label>
            <input style={{ ...inputStyle, maxWidth: 180 }} type="number" min={0} value={form.price_estimate} onChange={e => setForm(f => ({ ...f, price_estimate: e.target.value }))} placeholder="0" onFocus={e => { e.target.style.borderColor = '#111827' }} onBlur={e => { e.target.style.borderColor = '#D1D5DB' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Beschreibung</label>
            <textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Kurze Beschreibung …" onFocus={e => { e.target.style.borderColor = '#111827' }} onBlur={e => { e.target.style.borderColor = '#D1D5DB' }} />
          </div>
          {formError && <p style={{ fontSize: 13, color: '#991b1b', marginBottom: 10 }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 14px', border: '1px solid #D1D5DB', borderRadius: 7, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Abbrechen</button>
            <button type="submit" disabled={saving} style={{ padding: '8px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Wird gespeichert …' : 'Speichern'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ height: 80, background: '#F3F4F6', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : vendors.length === 0 && !showForm ? (
        <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '40px 0' }}>Noch keine Vorschläge. Klicke auf "+ Hinzufügen".</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {vendors.map(v => (
            <div key={v.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{v.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, background: '#F3F4F6', color: '#6B7280', padding: '2px 8px', borderRadius: 20 }}>{v.category}</span>
                  </div>
                  {v.description && <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 4px' }}>{v.description}</p>}
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#9CA3AF' }}>
                    {v.price_estimate > 0 && <span>{v.price_estimate.toLocaleString('de-DE')} €</span>}
                    {v.contact_email && <span>{v.contact_email}</span>}
                    {v.contact_phone && <span>{v.contact_phone}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <select
                    value={v.status}
                    onChange={e => updateStatus(v.id, e.target.value)}
                    style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, border: 'none', background: statusBg(v.status), color: statusColor(v.status), cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <option value="vorschlag">Vorschlag</option>
                    <option value="angenommen">Angenommen</option>
                    <option value="abgelehnt">Abgelehnt</option>
                  </select>
                  <button onClick={() => deleteVendor(v.id)} style={{ padding: '4px 8px', border: '1px solid #FEE2E2', borderRadius: 6, background: 'none', cursor: 'pointer', fontSize: 11, color: '#991b1b', fontFamily: 'inherit' }}>
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

function DashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventId = searchParams.get('event') ?? ''
  const supabase = createClient()

  const [activeNav, setActiveNav] = useState<NavId>('uebersicht')
  const [event, setEvent] = useState<EventData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState('')

  useEffect(() => {
    if (!eventId) {
      router.push('/veranstalter/events')
      return
    }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  async function loadAll() {
    setLoading(true)
    setAccessError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [eventRes, membersRes, codesRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, title, date, venue, venue_address, dresscode, children_allowed, children_note, meal_options, max_begleitpersonen, ceremony_start')
          .eq('id', eventId)
          .single(),
        supabase
          .from('event_members')
          .select('id, user_id, role, profiles(name)')
          .eq('event_id', eventId),
        supabase
          .from('invite_codes')
          .select('id, code, role, status, expires_at, used_at')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false }),
      ])

      if (eventRes.error || !eventRes.data) {
        setAccessError('Event nicht gefunden oder kein Zugriff.')
        return
      }

      setEvent(eventRes.data as EventData)
      setMembers((membersRes.data ?? []) as unknown as Member[])
      setInviteCodes((codesRes.data ?? []) as InviteCode[])
    } catch (err: unknown) {
      setAccessError(err instanceof Error ? err.message : 'Fehler beim Laden.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshCodes() {
    const { data } = await supabase
      .from('invite_codes')
      .select('id, code, role, status, expires_at, used_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
    if (data) setInviteCodes(data as InviteCode[])
  }

  const navItems: { id: NavId; label: string }[] = [
    { id: 'uebersicht',  label: 'Übersicht' },
    { id: 'allgemein',   label: 'Allgemein' },
    { id: 'einladen',    label: 'Einladen' },
    { id: 'vorschlaege', label: 'Vorschläge' },
    { id: 'mitglieder',  label: 'Mitglieder' },
  ]

  // ── Layout ──

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#F8F8F8' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @media (min-width: 640px) {
          .dash-layout { flex-direction: row !important; }
          .dash-sidebar { width: 220px !important; min-width: 220px !important; flex-shrink: 0; border-right: 1px solid #E5E7EB !important; border-bottom: none !important; overflow-y: auto !important; overflow-x: visible !important; display: flex !important; flex-direction: column !important; position: sticky !important; top: 0 !important; height: 100dvh !important; }
          .dash-sidebar-nav { flex-direction: column !important; gap: 2px !important; overflow-x: visible !important; padding: 0 !important; }
          .dash-content { flex: 1; overflow: auto; }
        }
      `}</style>

      <div className="dash-layout" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100dvh' }}>

        {/* Sidebar */}
        <div
          className="dash-sidebar"
          style={{
            background: '#F8F8F8',
            borderBottom: '1px solid #E5E7EB',
            padding: '0',
          }}
        >
          {/* Sidebar header (desktop only visible via CSS) */}
          <div style={{ padding: '20px 16px 12px' }}>
            <button
              onClick={() => router.push('/veranstalter/events')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, color: '#6B7280', padding: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Alle Events
            </button>
            {!loading && event && (
              <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '12px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {event.title}
              </p>
            )}
          </div>

          <nav
            className="dash-sidebar-nav"
            style={{
              display: 'flex', flexDirection: 'row', gap: 2,
              overflowX: 'auto', padding: '4px 8px 8px',
            }}
          >
            {navItems.map(item => {
              const active = activeNav === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '9px 12px', borderRadius: 7,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 14, fontWeight: active ? 600 : 400,
                    background: active ? '#E5E7EB' : 'none',
                    color: active ? '#111827' : '#6B7280',
                    transition: 'all 0.12s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="dash-content" style={{ flex: 1, padding: '28px 20px 64px' }}>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
              <Skeleton height={28} width={240} />
              <Skeleton height={16} width={180} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <Skeleton height={72} />
                <Skeleton height={72} />
                <Skeleton height={72} />
              </div>
              <Skeleton height={40} width={160} />
            </div>
          ) : accessError ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', textAlign: 'center' }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Kein Zugriff</p>
                <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 20 }}>{accessError}</p>
                <button
                  onClick={() => router.push('/veranstalter/events')}
                  style={{
                    padding: '10px 18px', fontSize: 13, fontWeight: 600,
                    background: '#111827', color: '#fff',
                    border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Zurück zu Meine Events
                </button>
              </div>
            </div>
          ) : event ? (
            <div style={{ maxWidth: 600 }}>
              {activeNav === 'uebersicht' && (
                <UebersichtSection
                  event={event}
                  members={members}
                  inviteCodes={inviteCodes}
                  onNav={setActiveNav}
                />
              )}
              {activeNav === 'allgemein' && (
                <AllgemeinSection
                  event={event}
                  eventId={eventId}
                  onSaved={setEvent}
                />
              )}
              {activeNav === 'einladen' && (
                <EinladenSection
                  eventId={eventId}
                  inviteCodes={inviteCodes}
                  onCodesRefresh={refreshCodes}
                />
              )}
              {activeNav === 'vorschlaege' && (
                <VorschlaegeSection eventId={eventId} />
              )}
              {activeNav === 'mitglieder' && (
                <MitgliederSection members={members} />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function VeranstalterDashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  )
}
