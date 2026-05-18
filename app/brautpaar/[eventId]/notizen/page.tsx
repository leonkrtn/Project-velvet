'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Check, Square, CheckSquare, FileText, List, Tag, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type NoteType = 'text' | 'checklist'

interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

interface Note {
  id: string
  event_id: string
  category: string
  title: string
  content: string
  note_type: NoteType
  checklist_items: ChecklistItem[]
  sort_order: number
  created_at: string
  updated_at: string
}

// ── Default categories ────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = ['Allgemein', 'Zeremonie', 'Feier', 'Dienstleister', 'Persönlich', 'To-Do']

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: 'var(--bp-ink-3)', marginBottom: 4, display: 'block',
}

// ── Note editor ───────────────────────────────────────────────────────────────

function NoteEditor({
  note, onUpdate, onDelete,
}: {
  note: Note
  onUpdate: (id: string, patch: Partial<Note>) => void
  onDelete: (id: string) => void
}) {
  const supabase = createClient()
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const [title,     setTitle]     = useState(note.title)
  const [content,   setContent]   = useState(note.content)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note.checklist_items)
  const [newItem,   setNewItem]   = useState('')
  const [delConfirm, setDelConfirm] = useState(false)

  function scheduleSave(patch: Partial<Note>) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('brautpaar_notes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', note.id)
        .select()
        .single()
      if (data) onUpdate(note.id, data as Note)
    }, 400)
  }

  function handleTitle(v: string) {
    setTitle(v)
    scheduleSave({ title: v })
    onUpdate(note.id, { title: v })
  }

  function handleContent(v: string) {
    setContent(v)
    scheduleSave({ content: v })
  }

  function toggleItem(id: string) {
    const next = checklist.map(i => i.id === id ? { ...i, done: !i.done } : i)
    setChecklist(next)
    scheduleSave({ checklist_items: next as unknown as ChecklistItem[] })
  }

  function addItem() {
    if (!newItem.trim()) return
    const next = [...checklist, { id: uuid(), text: newItem.trim(), done: false }]
    setChecklist(next)
    setNewItem('')
    scheduleSave({ checklist_items: next as unknown as ChecklistItem[] })
  }

  function deleteItem(id: string) {
    const next = checklist.filter(i => i.id !== id)
    setChecklist(next)
    scheduleSave({ checklist_items: next as unknown as ChecklistItem[] })
  }

  async function del() {
    await supabase.from('brautpaar_notes').delete().eq('id', note.id)
    onDelete(note.id)
  }

  const doneCount = checklist.filter(i => i.done).length

  return (
    <div style={{
      background: '#fff', border: '1px solid var(--bp-rule)', borderRadius: 12,
      padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--bp-ink-3)', flexShrink: 0 }}>
          {note.note_type === 'checklist' ? <List size={15} /> : <FileText size={15} />}
        </span>
        <input
          value={title}
          onChange={e => handleTitle(e.target.value)}
          placeholder="Titel…"
          style={{
            flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit',
            fontSize: 15, fontWeight: 600, color: 'var(--bp-ink-1)', background: 'transparent',
          }}
        />
        <button
          onClick={() => setDelConfirm(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: delConfirm ? '#FF3B30' : 'var(--bp-ink-3)', padding: 4 }}
        >
          <Trash2 size={13} />
        </button>
        {delConfirm && (
          <button
            onClick={del}
            style={{ padding: '4px 10px', background: '#FF3B30', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            Löschen
          </button>
        )}
      </div>

      <div style={{ height: 1, background: 'var(--bp-rule)' }} />

      {/* Content */}
      {note.note_type === 'text' ? (
        <textarea
          value={content}
          onChange={e => handleContent(e.target.value)}
          placeholder="Notiz eingeben…"
          rows={5}
          style={{
            width: '100%', border: 'none', outline: 'none', resize: 'vertical',
            fontFamily: 'inherit', fontSize: 14, lineHeight: 1.65, color: 'var(--bp-ink-1)',
            background: 'transparent', boxSizing: 'border-box',
          }}
        />
      ) : (
        <div>
          {checklist.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--bp-ink-3)', marginBottom: 8, fontStyle: 'italic' }}>
              Noch keine Einträge.
            </p>
          )}
          {note.note_type === 'checklist' && checklist.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--bp-ink-3)', marginBottom: 10 }}>
              {doneCount} / {checklist.length} erledigt
            </div>
          )}
          {checklist.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <button
                onClick={() => toggleItem(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 1, flexShrink: 0, color: item.done ? 'var(--bp-gold)' : 'var(--bp-ink-3)' }}
              >
                {item.done ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <span style={{
                fontSize: 14, lineHeight: 1.5, color: item.done ? 'var(--bp-ink-3)' : 'var(--bp-ink-1)',
                textDecoration: item.done ? 'line-through' : 'none', flex: 1,
              }}>
                {item.text}
              </span>
              <button
                onClick={() => deleteItem(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bp-ink-3)', padding: 2, flexShrink: 0 }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          {/* Add item */}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="Eintrag hinzufügen…"
              style={{
                flex: 1, border: '1px dashed var(--bp-rule)', borderRadius: 6,
                padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                background: 'transparent',
              }}
            />
            <button
              onClick={addItem}
              style={{
                padding: '6px 10px', background: 'var(--bp-gold)', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
              }}
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NotizenPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const supabase = createClient()
  const [notes,          setNotes]          = useState<Note[]>([])
  const [loading,        setLoading]        = useState(true)
  const [activeCategory, setActiveCategory] = useState('Alle')
  const [categories,     setCategories]     = useState<string[]>(['Alle', ...DEFAULT_CATEGORIES])
  const [adding,         setAdding]         = useState(false)
  const [newTitle,       setNewTitle]       = useState('')
  const [newType,        setNewType]        = useState<NoteType>('text')
  const [newCategory,    setNewCategory]    = useState('Allgemein')

  useEffect(() => {
    supabase
      .from('brautpaar_notes')
      .select('*')
      .eq('event_id', eventId)
      .order('category')
      .order('sort_order')
      .order('created_at')
      .then(({ data }) => {
        const loaded = (data ?? []) as Note[]
        setNotes(loaded)
        const cats = ['Alle', ...Array.from(new Set([...DEFAULT_CATEGORIES, ...loaded.map(n => n.category)]))]
        setCategories(cats)
        setLoading(false)
      })
  }, [eventId])

  async function addNote() {
    setAdding(false)
    const { data } = await supabase
      .from('brautpaar_notes')
      .insert({
        event_id: eventId,
        title: newTitle.trim() || (newType === 'checklist' ? 'Checkliste' : 'Neue Notiz'),
        category: newCategory,
        note_type: newType,
        content: '',
        checklist_items: [],
        sort_order: notes.length,
      })
      .select()
      .single()
    if (data) {
      setNotes(prev => [...prev, data as Note])
      if (!categories.includes(newCategory)) {
        setCategories(prev => [...prev, newCategory])
      }
      setActiveCategory(newCategory)
    }
    setNewTitle('')
    setNewType('text')
  }

  function updateNote(id: string, patch: Partial<Note>) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))
  }

  function deleteNote(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const filtered = activeCategory === 'Alle'
    ? notes
    : notes.filter(n => n.category === activeCategory)

  if (loading) {
    return (
      <div className="bp-page">
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {[120, 90, 100].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 32, width: w, borderRadius: 8 }} />
          ))}
        </div>
        {[1, 2].map(i => (
          <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12, marginBottom: 12 }} />
        ))}
      </div>
    )
  }

  return (
    <div className="bp-page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', margin: '0 0 4px', color: 'var(--bp-ink-1)' }}>Notizen</h1>
          <p style={{ fontSize: 14, color: 'var(--bp-ink-3)', margin: 0 }}>
            {notes.length === 0 ? 'Noch keine Notizen' : `${notes.length} Notiz${notes.length !== 1 ? 'en' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
            background: 'var(--bp-gold)', color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          <Plus size={14} /> Neue Notiz
        </button>
      </div>

      {/* New note form */}
      {adding && (
        <div style={{
          background: '#fff', border: '1.5px solid var(--bp-gold)', borderRadius: 12,
          padding: '18px 20px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <p style={{ ...labelSt, marginBottom: 0 }}>Neue Notiz erstellen</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelSt}>Titel</label>
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNote()}
                placeholder="Titel…"
                className="bp-input"
              />
            </div>
            <div>
              <label style={labelSt}>Kategorie</label>
              <input
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                list="bp-note-categories"
                placeholder="z.B. Zeremonie"
                className="bp-input"
              />
              <datalist id="bp-note-categories">
                {DEFAULT_CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div>
            <label style={labelSt}>Typ</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['text', 'checklist'] as NoteType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                    border: `1.5px solid ${newType === t ? 'var(--bp-gold)' : 'var(--bp-rule)'}`,
                    borderRadius: 7, background: newType === t ? 'var(--bp-gold-pale)' : 'transparent',
                    color: newType === t ? 'var(--bp-gold)' : 'var(--bp-ink-2)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: newType === t ? 600 : 400,
                  }}
                >
                  {t === 'text' ? <><FileText size={13} /> Freitext</> : <><List size={13} /> Checkliste</>}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={addNote}
              style={{ padding: '8px 18px', background: 'var(--bp-gold)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Erstellen
            </button>
            <button
              onClick={() => setAdding(false)}
              style={{ padding: '8px 14px', background: 'none', border: '1px solid var(--bp-rule)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {categories.map(cat => {
          const count = cat === 'Alle' ? notes.length : notes.filter(n => n.category === cat).length
          if (cat !== 'Alle' && count === 0) return null
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 20, border: '1px solid',
                borderColor: activeCategory === cat ? 'var(--bp-gold)' : 'var(--bp-rule)',
                background: activeCategory === cat ? 'var(--bp-gold-pale)' : 'transparent',
                color: activeCategory === cat ? 'var(--bp-gold)' : 'var(--bp-ink-2)',
                fontSize: 12, fontWeight: activeCategory === cat ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {cat !== 'Alle' && <Tag size={10} />}
              {cat}
              <span style={{ fontSize: 10, opacity: 0.7 }}>({count})</span>
            </button>
          )
        })}
      </div>

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px dashed var(--bp-rule)', borderRadius: 12,
          padding: '40px 24px', textAlign: 'center',
        }}>
          <FileText size={28} color="var(--bp-ink-3)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 14, color: 'var(--bp-ink-2)', marginBottom: 6 }}>
            {activeCategory === 'Alle' ? 'Noch keine Notizen angelegt.' : `Keine Notizen in „${activeCategory}".`}
          </p>
          <p style={{ fontSize: 12, color: 'var(--bp-ink-3)' }}>
            Klicke auf „Neue Notiz", um loszulegen.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(note => (
            <NoteEditor
              key={note.id}
              note={note}
              onUpdate={updateNote}
              onDelete={deleteNote}
            />
          ))}
        </div>
      )}
    </div>
  )
}
