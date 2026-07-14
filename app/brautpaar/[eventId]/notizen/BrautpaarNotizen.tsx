'use client'

import React, { useState, useRef } from 'react'
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
      // Live-Text-Felder werden bewusst nicht zurückgerollt (würde aktuelle
      // Tastatureingaben überschreiben) — nur Fehler protokollieren.
      if (error) {
        console.error('Notiz speichern fehlgeschlagen', error)
        return
      }
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

  // Speichert eine neue Checklist-Liste optimistisch (Snapshot-Rollback bei Fehler).
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
    const prev = checklist
    const next = checklist.map(i => i.id === id ? { ...i, done: !i.done } : i)
    saveChecklist(prev, next)
  }

  function addItem() {
    if (!newItem.trim()) return
    const prev = checklist
    const next = [...checklist, { id: uuid(), text: newItem.trim(), done: false }]
    setNewItem('')
    saveChecklist(prev, next)
  }

  function deleteItem(id: string) {
    const prev = checklist
    const next = checklist.filter(i => i.id !== id)
    saveChecklist(prev, next)
  }

  function del() {
    onDelete(note)
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
            fontSize: 15, fontWeight: 600, color: 'var(--bp-ink)', background: 'transparent',
          }}
        />
        <button
          onClick={() => setDelConfirm(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: delConfirm ? 'var(--bp-red)' : 'var(--bp-ink-3)', padding: 4 }}
        >
          <Trash2 size={13} />
        </button>
        {delConfirm && (
          <button
            onClick={del}
            style={{ padding: '4px 10px', background: 'var(--bp-red)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
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
            fontFamily: 'inherit', fontSize: 14, lineHeight: 1.65, color: 'var(--bp-ink)',
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
                fontSize: 14, lineHeight: 1.5, color: item.done ? 'var(--bp-ink-3)' : 'var(--bp-ink)',
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
                padding: '6px 10px', background: '#fff', color: 'var(--bp-gold)',
                border: '1px solid var(--bp-gold)', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
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

interface Props {
  eventId: string
  initialNotes: Note[]
  /** Eingebettet im kombinierten „Aufgaben & Notizen"-Tab: ohne eigenen Seiten-Header */
  embedded?: boolean
}

export default function BrautpaarNotizen({ eventId, initialNotes, embedded = false }: Props) {
  const supabase = createClient()
  const [notes,          setNotes]          = useState<Note[]>(initialNotes)
  const [activeCategory, setActiveCategory] = useState('Alle')
  const [categories,     setCategories]     = useState<string[]>(
    ['Alle', ...Array.from(new Set([...DEFAULT_CATEGORIES, ...initialNotes.map(n => n.category)]))]
  )
  const [adding,         setAdding]         = useState(false)
  const [newTitle,       setNewTitle]       = useState('')
  const [newType,        setNewType]        = useState<NoteType>('text')
  const [newCategory,    setNewCategory]    = useState('Allgemein')

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
          id: placeholderId,
          event_id: eventId,
          category,
          title,
          content: '',
          note_type: type,
          checklist_items: [],
          sort_order: sortOrder,
          created_at: now,
          updated_at: now,
        }
        setNotes(prev => [...prev, placeholder])
        if (!categories.includes(category)) {
          setCategories(prev => [...prev, category])
        }
        setActiveCategory(category)
      },
      commit: async () => {
        const { data, error } = await supabase
          .from('brautpaar_notes')
          .insert({
            event_id: eventId,
            title,
            category,
            note_type: type,
            content: '',
            checklist_items: [],
            sort_order: sortOrder,
          })
          .select()
          .single()
        if (error || !data) throw error ?? new Error('Insert lieferte keine Daten')
        return data as Note
      },
      reconcile: (saved) => {
        setNotes(prev => prev.map(n => n.id === placeholderId ? saved : n))
      },
      rollback: () => {
        setNotes(prev => prev.filter(n => n.id !== placeholderId))
      },
      onError: (e) => console.error('Notiz anlegen fehlgeschlagen', e),
    })
  }

  const [loadingWelcome, setLoadingWelcome] = useState(false)

  async function loadWelcomeChecklist() {
    if (loadingWelcome) return
    setLoadingWelcome(true)
    const now = new Date().toISOString()
    const items: ChecklistItem[] = ['Traurede', 'Ringe', 'Musikwahl'].map(text => ({ id: uuid(), text, done: false }))
    const placeholderId = tempId()
    await runOptimisticInsert<Note>({
      apply: () => {
        const placeholder: Note = {
          id: placeholderId, event_id: eventId, category: 'Zeremonie', title: 'Willkommens-Checkliste',
          content: '', note_type: 'checklist', checklist_items: items, sort_order: notes.length,
          created_at: now, updated_at: now,
        }
        setNotes(prev => [...prev, placeholder])
        setActiveCategory('Zeremonie')
      },
      commit: async () => {
        const { data, error } = await supabase
          .from('brautpaar_notes')
          .insert({
            event_id: eventId, title: 'Willkommens-Checkliste', category: 'Zeremonie',
            note_type: 'checklist', content: '', checklist_items: items, sort_order: notes.length,
          })
          .select()
          .single()
        if (error || !data) throw error ?? new Error('Insert fehlgeschlagen')
        return data as Note
      },
      reconcile: (saved) => setNotes(prev => prev.map(n => n.id === placeholderId ? saved : n)),
      rollback: () => setNotes(prev => prev.filter(n => n.id !== placeholderId)),
      onError: (e) => console.error('Willkommens-Checkliste anlegen fehlgeschlagen', e),
    })
    setLoadingWelcome(false)
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

  const filtered = activeCategory === 'Alle'
    ? notes
    : notes.filter(n => n.category === activeCategory)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          {!embedded && <h1 className="bp-page-title">Notizen</h1>}
          <p className="bp-page-subtitle" style={embedded ? { margin: 0 } : undefined}>
            {notes.length === 0 ? 'Noch keine Notizen' : `${notes.length} Notiz${notes.length !== 1 ? 'en' : ''}`}
          </p>
        </div>
        <button onClick={() => setAdding(v => !v)} className="bp-btn bp-btn-primary" style={{ flexShrink: 0 }}>
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
          <div className="bp-grid-2" style={{ gap: 12 }}>
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
            <button onClick={addNote} className="bp-btn bp-btn-primary bp-btn-sm">
              Erstellen
            </button>
            <button onClick={() => setAdding(false)} className="bp-btn bp-btn-secondary bp-btn-sm">
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
            Klicke auf &quot;Neue Notiz&quot;, um loszulegen.
          </p>
          {notes.length === 0 && (
            <button className="bp-btn bp-btn-secondary bp-btn-sm" style={{ marginTop: 10 }} onClick={loadWelcomeChecklist} disabled={loadingWelcome}>
              {loadingWelcome ? 'Lädt…' : 'Willkommens-Checkliste anlegen'}
            </button>
          )}
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
