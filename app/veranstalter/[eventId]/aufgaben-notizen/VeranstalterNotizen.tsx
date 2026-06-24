'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { runOptimistic, runOptimisticInsert, tempId } from '@/lib/optimistic'
import { Plus, Trash2, Square, CheckSquare, FileText, List, Tag, X } from 'lucide-react'

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

const DEFAULT_CATEGORIES = ['Allgemein', 'Zeremonie', 'Feier', 'Dienstleister', 'Organisation', 'To-Do']

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

const inputSt: React.CSSProperties = {
  width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 7,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
}

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4, display: 'block',
}

// ── Note editor ───────────────────────────────────────────────────────────────

function NoteEditor({
  note, onUpdate, onDelete,
}: {
  note: Note
  onUpdate: (id: string, patch: Partial<Note>) => void
  onDelete: (note: Note) => void
}) {
  const supabase = createClient()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [title,     setTitle]     = useState(note.title)
  const [content,   setContent]   = useState(note.content)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note.checklist_items)
  const [newItem,   setNewItem]   = useState('')
  const [delConfirm, setDelConfirm] = useState(false)

  function scheduleSave(patch: Partial<Note>) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from('brautpaar_notes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', note.id)
        .select()
        .single()
      if (error) { console.error('Notiz speichern fehlgeschlagen', error); return }
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

  function saveChecklist(prev: ChecklistItem[], next: ChecklistItem[]) {
    clearTimeout(saveTimer.current)
    runOptimistic({
      apply: () => setChecklist(next),
      rollback: () => setChecklist(prev),
      commit: () => supabase
        .from('brautpaar_notes')
        .update({ checklist_items: next as unknown as ChecklistItem[], updated_at: new Date().toISOString() })
        .eq('id', note.id),
      onError: (e) => console.error('Checkliste speichern fehlgeschlagen', e),
    })
  }

  function toggleItem(id: string) {
    saveChecklist(checklist, checklist.map(i => i.id === id ? { ...i, done: !i.done } : i))
  }

  function addItem() {
    if (!newItem.trim()) return
    const next = [...checklist, { id: uuid(), text: newItem.trim(), done: false }]
    setNewItem('')
    saveChecklist(checklist, next)
  }

  function deleteItem(id: string) {
    saveChecklist(checklist, checklist.filter(i => i.id !== id))
  }

  const doneCount = checklist.filter(i => i.done).length

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-sm)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex' }}>
          {note.note_type === 'checklist' ? <List size={15} /> : <FileText size={15} />}
        </span>
        <input
          value={title}
          onChange={e => handleTitle(e.target.value)}
          placeholder="Titel…"
          style={{
            flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit',
            fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', background: 'transparent',
          }}
        />
        <button
          onClick={() => setDelConfirm(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: delConfirm ? '#FF3B30' : 'var(--text-tertiary)', padding: 4, display: 'flex' }}
        >
          <Trash2 size={13} />
        </button>
        {delConfirm && (
          <button
            onClick={() => onDelete(note)}
            style={{ padding: '4px 10px', background: '#FF3B30', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            Löschen
          </button>
        )}
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      {note.note_type === 'text' ? (
        <textarea
          value={content}
          onChange={e => handleContent(e.target.value)}
          placeholder="Notiz eingeben…"
          rows={5}
          style={{
            width: '100%', border: 'none', outline: 'none', resize: 'vertical',
            fontFamily: 'inherit', fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)',
            background: 'transparent', boxSizing: 'border-box',
          }}
        />
      ) : (
        <div>
          {checklist.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8, fontStyle: 'italic' }}>
              Noch keine Einträge.
            </p>
          )}
          {checklist.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
              {doneCount} / {checklist.length} erledigt
            </div>
          )}
          {checklist.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <button
                onClick={() => toggleItem(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 1, flexShrink: 0, color: item.done ? '#34C759' : 'var(--text-tertiary)', display: 'flex' }}
              >
                {item.done ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <span style={{
                fontSize: 14, lineHeight: 1.5, color: item.done ? 'var(--text-tertiary)' : 'var(--text-primary)',
                textDecoration: item.done ? 'line-through' : 'none', flex: 1,
              }}>
                {item.text}
              </span>
              <button
                onClick={() => deleteItem(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, flexShrink: 0, display: 'flex' }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="Eintrag hinzufügen…"
              style={{ ...inputSt, border: '1px dashed var(--border)', background: 'transparent' }}
            />
            <button
              onClick={addItem}
              style={{
                padding: '6px 10px', background: 'var(--surface)', color: 'var(--accent)',
                border: '1px solid var(--accent)', borderRadius: 6, cursor: 'pointer', flexShrink: 0, display: 'flex',
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

// ── Main component ────────────────────────────────────────────────────────────

export default function VeranstalterNotizen({ eventId }: { eventId: string }) {
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
        setCategories(['Alle', ...Array.from(new Set([...DEFAULT_CATEGORIES, ...loaded.map(n => n.category)]))])
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  async function addNote() {
    setAdding(false)
    const title = newTitle.trim() || (newType === 'checklist' ? 'Checkliste' : 'Neue Notiz')
    const type = newType
    const category = newCategory
    const sortOrder = notes.length
    const placeholderId = tempId()
    const now = new Date().toISOString()

    setNewTitle('')
    setNewType('text')

    await runOptimisticInsert<Note>({
      apply: () => {
        const placeholder: Note = {
          id: placeholderId, event_id: eventId, category, title, content: '',
          note_type: type, checklist_items: [], sort_order: sortOrder, created_at: now, updated_at: now,
        }
        setNotes(prev => [...prev, placeholder])
        if (!categories.includes(category)) setCategories(prev => [...prev, category])
        setActiveCategory(category)
      },
      commit: async () => {
        const { data, error } = await supabase
          .from('brautpaar_notes')
          .insert({
            event_id: eventId, title, category, note_type: type,
            content: '', checklist_items: [], sort_order: sortOrder,
          })
          .select()
          .single()
        if (error || !data) throw error ?? new Error('Insert lieferte keine Daten')
        return data as Note
      },
      reconcile: (saved) => setNotes(prev => prev.map(n => n.id === placeholderId ? saved : n)),
      rollback: () => setNotes(prev => prev.filter(n => n.id !== placeholderId)),
      onError: (e) => console.error('Notiz anlegen fehlgeschlagen', e),
    })
  }

  function updateNote(id: string, patch: Partial<Note>) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))
  }

  function deleteNote(note: Note) {
    const prev = notes
    runOptimistic({
      apply: () => setNotes(cur => cur.filter(n => n.id !== note.id)),
      rollback: () => setNotes(prev),
      commit: () => supabase.from('brautpaar_notes').delete().eq('id', note.id),
      onError: (e) => console.error('Notiz löschen fehlgeschlagen', e),
    })
  }

  const filtered = activeCategory === 'Alle' ? notes : notes.filter(n => n.category === activeCategory)

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2].map(i => (
          <div key={i} style={{ height: 140, borderRadius: 'var(--radius)', background: 'var(--surface)', border: '1px solid var(--border)' }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 16 }}>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {notes.length === 0 ? 'Noch keine Notizen' : `${notes.length} Notiz${notes.length !== 1 ? 'en' : ''}`}
        </span>
        <button
          onClick={() => setAdding(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
          }}
        >
          <Plus size={14} /> Neue Notiz
        </button>
      </div>

      {/* New note form */}
      {adding && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
          padding: '18px 20px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <p style={{ ...labelSt, marginBottom: 0 }}>Neue Notiz erstellen</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelSt}>Titel</label>
              <input
                autoFocus value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNote()}
                placeholder="Titel…" style={inputSt}
              />
            </div>
            <div>
              <label style={labelSt}>Kategorie</label>
              <input
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                list="vt-note-categories" placeholder="z.B. Organisation" style={inputSt}
              />
              <datalist id="vt-note-categories">
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
                    border: `1px solid ${newType === t ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 7, background: newType === t ? 'var(--accent)' : 'transparent',
                    color: newType === t ? '#fff' : 'var(--text-secondary)',
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
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600 }}
            >
              Erstellen
            </button>
            <button
              onClick={() => setAdding(false)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 13 }}
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
          const active = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#fff' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit',
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
          background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
          padding: '40px 24px', textAlign: 'center',
        }}>
          <FileText size={28} color="var(--text-tertiary)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {activeCategory === 'Alle' ? 'Noch keine Notizen angelegt.' : `Keine Notizen in „${activeCategory}".`}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Klicke auf &quot;Neue Notiz&quot;, um loszulegen.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(note => (
            <NoteEditor key={note.id} note={note} onUpdate={updateNote} onDelete={deleteNote} />
          ))}
        </div>
      )}
    </div>
  )
}
