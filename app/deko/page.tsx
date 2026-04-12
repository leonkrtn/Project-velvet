'use client'
import React, { useState, useRef } from 'react'
import { Check, Plus, Trash2, ImageIcon } from 'lucide-react'
import { saveEvent } from '@/lib/store'
import type { DekoSuggestion, DekoWish } from '@/lib/store'
import { useEvent } from '@/lib/event-context'
import { useFeatureEnabled, FeatureDisabledScreen } from '@/components/FeatureGate'
import { v4 as uuid } from 'uuid'

type Tab = 'vorschlaege' | 'wuensche'

function VorschlaegeTab() {
  const { event, updateEvent } = useEvent()
  if (!event) return null

  const suggestions: DekoSuggestion[] = event.organizer?.dekoSuggestions ?? []

  const toggle = (id: string) => {
    const current = suggestions.find(s => s.id === id)
    if (!current) return
    const newStatus = current.status === 'angenommen' ? 'vorschlag' : 'angenommen'
    const updated = {
      ...event,
      organizer: {
        ...event.organizer!,
        dekoSuggestions: suggestions.map(s =>
          s.id === id ? { ...s, status: newStatus as DekoSuggestion['status'] } : s
        ),
      },
    }
    updateEvent(updated); saveEvent(updated)
  }

  if (suggestions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim)' }}>
        <ImageIcon size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
        <p style={{ fontSize: 14 }}>Noch keine Deko-Vorschläge vom Veranstalter.</p>
      </div>
    )
  }

  const accepted = suggestions.filter(s => s.status === 'angenommen')

  return (
    <div>
      {accepted.length > 0 && (
        <div style={{ background: 'rgba(61,122,86,0.08)', border: '1px solid rgba(61,122,86,0.2)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>{accepted.length} Vorschlag{accepted.length !== 1 ? 'e' : ''} ausgewählt</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {suggestions.map(s => {
          const isSelected = s.status === 'angenommen'
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              style={{
                background: 'var(--surface)', border: `2px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                borderRadius: 'var(--r-md)', padding: 0, cursor: 'pointer',
                textAlign: 'left', fontFamily: 'inherit', overflow: 'hidden',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: isSelected ? '0 0 0 3px var(--gold-pale)' : 'none',
                position: 'relative',
              }}
            >
              {/* Image area */}
              {s.imageUrl ? (
                <img
                  src={s.imageUrl}
                  alt={s.title}
                  style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{
                  width: '100%', aspectRatio: '4/3',
                  background: isSelected ? 'var(--gold-pale)' : 'var(--bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ImageIcon size={28} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
                </div>
              )}

              {/* Check overlay */}
              {isSelected && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={13} style={{ color: '#fff' }} />
                </div>
              )}

              {/* Content */}
              <div style={{ padding: '10px 12px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{s.title}</p>
                {s.description && (
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>{s.description}</p>
                )}
                <p style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: isSelected ? 'var(--gold)' : 'var(--text-dim)' }}>
                  {isSelected ? '✓ Ausgewählt' : 'Auswählen'}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WuenscheTab() {
  const { event, updateEvent } = useEvent()
  if (!event) return null

  const wishes: DekoWish[] = event.dekoWishes ?? []
  const fileRef = useRef<HTMLInputElement>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', notes: '', imageUrl: '' })

  const readFile = (file: File) => {
    return new Promise<string>(res => {
      const reader = new FileReader()
      reader.onload = e => res(e.target?.result as string)
      reader.readAsDataURL(file)
    })
  }

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await readFile(file)
    setForm(f => ({ ...f, imageUrl: dataUrl }))
  }

  const save = () => {
    if (!form.title.trim()) return
    const newWish: DekoWish = { id: uuid(), title: form.title.trim(), notes: form.notes.trim(), imageUrl: form.imageUrl || undefined }
    const updated = { ...event, dekoWishes: [...wishes, newWish] }
    updateEvent(updated); saveEvent(updated)
    setForm({ title: '', notes: '', imageUrl: '' }); setShowForm(false)
  }

  const remove = (id: string) => {
    const updated = { ...event, dekoWishes: wishes.filter(w => w.id !== id) }
    updateEvent(updated); saveEvent(updated)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{wishes.length} Wunsch{wishes.length !== 1 ? 'e' : ''}</p>
        <button
          onClick={() => setShowForm(s => !s)}
          style={{ background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} /> Wunsch hinzufügen
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--gold-pale)', border: '1px solid var(--gold)', borderRadius: 'var(--r-md)', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)', marginBottom: 6 }}>Titel *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="z. B. Hängende Trockenblumen"
                style={{ width: '100%', padding: '10px 13px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)', marginBottom: 6 }}>Beschreibung / Notizen</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Farben, Stil, Inspiration …"
                rows={3}
                style={{ width: '100%', padding: '10px 13px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)', marginBottom: 6 }}>Bild (optional)</label>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
              {form.imageUrl ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={form.imageUrl} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                  <button
                    onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >×</button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ padding: '8px 14px', border: '1px dashed var(--border)', borderRadius: 'var(--r-sm)', background: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ImageIcon size={13} /> Bild hochladen
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setForm({ title: '', notes: '', imageUrl: '' }) }} style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={save} style={{ padding: '8px 16px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {wishes.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim)' }}>
          <p style={{ fontSize: 14 }}>Noch keine Wünsche eingetragen.</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Füge eigene Deko-Ideen und Inspirationen hinzu.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {wishes.map(w => (
          <div key={w.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {w.imageUrl && (
              <img src={w.imageUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{w.title}</p>
              {w.notes && <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.4 }}>{w.notes}</p>}
            </div>
            <button
              onClick={() => remove(w.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-dim)', flexShrink: 0 }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DekoPage() {
  const enabled = useFeatureEnabled('deko')
  const [tab, setTab] = useState<Tab>('vorschlaege')
  const { event } = useEvent()

  if (!event) return null
  if (!enabled) return <FeatureDisabledScreen />

  const suggestions = event.organizer?.dekoSuggestions ?? []
  const acceptedCount = suggestions.filter(s => s.status === 'angenommen').length
  const wishCount = (event.dekoWishes ?? []).length

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingBottom: 88 }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--heading-font)', fontSize: 26, fontWeight: 500, color: 'var(--text)', margin: '0 0 6px' }}>Dekoration</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>Wähle aus Vorschlägen oder füge eigene Wünsche hinzu.</p>
        </div>

        {/* Summary chips */}
        {(acceptedCount > 0 || wishCount > 0) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {acceptedCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(61,122,86,0.1)', color: 'var(--green)', padding: '4px 10px', borderRadius: 100 }}>
                ✓ {acceptedCount} Vorschlag{acceptedCount !== 1 ? 'e' : ''} gewählt
              </span>
            )}
            {wishCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--gold-pale)', color: 'var(--gold)', padding: '4px 10px', borderRadius: 100 }}>
                {wishCount} eigene{wishCount !== 1 ? '' : 'r'} Wunsch{wishCount !== 1 ? 'e' : ''}
              </span>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {([
            { id: 'vorschlaege', label: `Vorschläge (${suggestions.length})` },
            { id: 'wuensche',    label: `Meine Wünsche (${wishCount})` },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-sel={tab === t.id ? '' : undefined}
              style={{
                padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? 'var(--gold)' : 'var(--text-dim)',
                borderBottom: `2px solid ${tab === t.id ? 'var(--gold)' : 'transparent'}`,
                marginBottom: -1, transition: 'color 0.15s',
              }}
            >{t.label}</button>
          ))}
        </div>

        {tab === 'vorschlaege' && <VorschlaegeTab />}
        {tab === 'wuensche'    && <WuenscheTab />}
      </div>
    </div>
  )
}
