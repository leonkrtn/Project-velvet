'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Todo {
  id: string
  title: string
  done: boolean
}

interface Props {
  eventId: string
  organizerId: string
  initialTodos: Todo[]
}

export default function OrganizerTodoList({ eventId, organizerId, initialTodos }: Props) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos)
  const [input, setInput] = useState('')
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  async function addTodo() {
    const title = input.trim()
    if (!title) return
    setInput('')
    const { data, error } = await supabase
      .from('organizer_todos')
      .insert({ event_id: eventId, organizer_id: organizerId, title })
      .select('id, title, done')
      .single()
    if (!error && data) setTodos(prev => [...prev, data])
  }

  async function toggleTodo(id: string, done: boolean) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done } : t))
    await supabase.from('organizer_todos').update({ done }).eq('id', id)
  }

  async function deleteTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id))
    await supabase.from('organizer_todos').delete().eq('id', id)
  }

  const open = todos.filter(t => !t.done)
  const done = todos.filter(t => t.done)

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.1px' }}>
          Meine To-Dos
        </span>
        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, background: open.length > 0 ? '#FF9500' : '#34C759', color: 'white', padding: '1px 7px', borderRadius: 20 }}>
          {open.length} offen
        </span>
      </div>

      <div style={{ padding: '12px 22px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()}
          placeholder="Neue Aufgabe..."
          style={{
            flex: 1, fontSize: 13, padding: '7px 10px',
            borderRadius: 7, border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <button
          onClick={addTodo}
          disabled={!input.trim()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 7,
            background: input.trim() ? 'var(--accent)' : 'var(--border)',
            border: 'none', cursor: input.trim() ? 'pointer' : 'default',
            color: 'white', flexShrink: 0,
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {open.length === 0 && done.length === 0 && (
          <div style={{ padding: '18px 22px', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Keine Aufgaben — füge oben eine hinzu.
          </div>
        )}
        {open.map(todo => (
          <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
        ))}
        {done.length > 0 && open.length > 0 && (
          <div style={{ height: 1, background: 'rgba(0,0,0,0.05)', margin: '4px 0' }} />
        )}
        {done.map(todo => (
          <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
        ))}
      </div>
    </div>
  )
}

function TodoRow({ todo, onToggle, onDelete }: {
  todo: Todo
  onToggle: (id: string, done: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 22px', borderTop: '1px solid rgba(0,0,0,0.04)',
    }}>
      <button
        onClick={() => onToggle(todo.id, !todo.done)}
        style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
          border: todo.done ? 'none' : '1.5px solid #C7C7CC',
          background: todo.done ? '#34C759' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {todo.done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span style={{
        flex: 1, fontSize: 13, color: todo.done ? 'var(--text-tertiary)' : 'var(--text-primary)',
        textDecoration: todo.done ? 'line-through' : 'none',
      }}>
        {todo.title}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-tertiary)', padding: 2, display: 'flex', alignItems: 'center',
          opacity: 0.5,
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
