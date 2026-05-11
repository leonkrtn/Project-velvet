'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Check, Trash2, ChevronDown, ChevronRight } from 'lucide-react'

interface Task {
  id: string
  event_id: string
  title: string
  done: boolean
  phase: string | null
  sort_order: number
  created_by: string | null
  created_at: string
  done_at: string | null
}

const PHASES = [
  { key: '12m', label: '12+ Monate vorher', months: 12 },
  { key: '6m',  label: '6–12 Monate vorher', months: 6 },
  { key: '3m',  label: '3–6 Monate vorher',  months: 3 },
  { key: '1m',  label: '1–3 Monate vorher',  months: 1 },
  { key: '1w',  label: '1–4 Wochen vorher',  months: 0 },
  { key: 'day', label: 'Am Hochzeitstag',     months: -1 },
  { key: 'after', label: 'Nach der Hochzeit', months: -2 },
  { key: null,  label: 'Allgemein',           months: 999 },
]

function getActivePhase(weddingDate: string | null): string | null {
  if (!weddingDate) return null
  const msLeft = new Date(weddingDate).getTime() - Date.now()
  const daysLeft = msLeft / 86400000
  if (daysLeft < 0) return 'after'
  if (daysLeft < 1) return 'day'
  if (daysLeft < 7) return '1w'
  const monthsLeft = daysLeft / 30
  if (monthsLeft < 1)  return '1m'
  if (monthsLeft < 3)  return '1m'
  if (monthsLeft < 6)  return '3m'
  if (monthsLeft < 12) return '6m'
  return '12m'
}

function TaskItem({ task, onUpdate, onDelete }: {
  task: Task
  onUpdate: (t: Task) => void
  onDelete: () => void
}) {
  const [saving, setSaving] = useState(false)

  async function toggleDone() {
    setSaving(true)
    const supabase = createClient()
    const done_at = !task.done ? new Date().toISOString() : null
    const { error } = await supabase
      .from('brautpaar_tasks')
      .update({ done: !task.done, done_at })
      .eq('id', task.id)
    setSaving(false)
    if (!error) onUpdate({ ...task, done: !task.done, done_at })
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.75rem 1rem',
      borderBottom: '1px solid var(--bp-rule)',
      opacity: saving ? 0.6 : 1,
      transition: 'opacity 0.15s',
    }}>
      <button
        onClick={toggleDone}
        disabled={saving}
        style={{
          width: 22, height: 22, borderRadius: 6, border: '1.5px solid',
          borderColor: task.done ? 'var(--bp-gold)' : 'var(--bp-rule)',
          background: task.done ? 'var(--bp-gold)' : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          transition: 'all 0.15s',
        }}
      >
        {task.done && <Check size={13} color="#fff" strokeWidth={2.5} />}
      </button>
      <span style={{
        flex: 1, fontSize: '0.9375rem',
        color: task.done ? 'var(--bp-ink-3)' : 'var(--bp-ink)',
        textDecoration: task.done ? 'line-through' : 'none',
        fontFamily: 'DM Sans, sans-serif',
      }}>
        {task.title}
      </span>
      <button
        className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon"
        onClick={onDelete}
        style={{ opacity: 0.5 }}
        title="Aufgabe löschen"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function PhaseSection({ phaseKey, label, tasks, eventId, userId, onUpdate, onDelete, onAdded, activePhase }: {
  phaseKey: string | null
  label: string
  tasks: Task[]
  eventId: string
  userId: string
  onUpdate: (t: Task) => void
  onDelete: (id: string) => void
  onAdded: (t: Task) => void
  activePhase: string | null
}) {
  const [open, setOpen] = useState(phaseKey === activePhase || tasks.some(t => !t.done))
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const done = tasks.filter(t => t.done).length
  const isActive = phaseKey === activePhase

  async function addTask() {
    if (!newTitle.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('brautpaar_tasks')
      .insert({
        event_id: eventId,
        title: newTitle.trim(),
        phase: phaseKey,
        done: false,
        sort_order: tasks.length,
        created_by: userId,
      })
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      onAdded(data as Task)
      setNewTitle('')
      setAdding(false)
    }
  }

  return (
    <div className="bp-card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {open ? <ChevronDown size={16} style={{ color: 'var(--bp-ink-3)', flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: 'var(--bp-ink-3)', flexShrink: 0 }} />}
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 400, fontSize: '0.9375rem', color: 'var(--bp-ink)', flex: 1 }}>
          {label}
        </span>
        {isActive && (
          <span className="bp-badge bp-badge-gold" style={{ fontSize: '0.6875rem' }}>Aktuell</span>
        )}
        <span style={{ fontSize: '0.8125rem', color: 'var(--bp-ink-3)' }}>{done}/{tasks.length}</span>
      </button>

      {open && (
        <>
          {tasks.length === 0 && !adding && (
            <div style={{ padding: '1rem 1.25rem 0.5rem', color: 'var(--bp-ink-3)', fontSize: '0.875rem' }}>
              Noch keine Aufgaben in dieser Phase.
            </div>
          )}
          {tasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onUpdate={onUpdate}
              onDelete={() => onDelete(task.id)}
            />
          ))}
          <div style={{ padding: '0.75rem 1rem', borderTop: tasks.length > 0 ? '1px solid var(--bp-rule)' : 'none' }}>
            {adding ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="bp-input"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Aufgabe beschreiben…"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setAdding(false) }}
                  style={{ flex: 1 }}
                />
                <button className="bp-btn bp-btn-primary bp-btn-sm" onClick={addTask} disabled={saving || !newTitle.trim()}>
                  {saving ? '…' : 'OK'}
                </button>
                <button className="bp-btn bp-btn-ghost bp-btn-sm" onClick={() => { setAdding(false); setNewTitle('') }}>
                  ✕
                </button>
              </div>
            ) : (
              <button
                className="bp-btn bp-btn-ghost bp-btn-sm"
                onClick={() => setAdding(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--bp-gold-deep)' }}
              >
                <Plus size={14} /> Aufgabe hinzufügen
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

interface Props {
  eventId: string
  userId: string
  initialTasks: Task[]
  weddingDate: string | null
}

export default function BrautpaarAufgaben({ eventId, userId, initialTasks, weddingDate }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const activePhase = getActivePhase(weddingDate)

  async function deleteTask(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('brautpaar_tasks').delete().eq('id', id)
    if (!error) setTasks(prev => prev.filter(t => t.id !== id))
  }

  const totalDone = tasks.filter(t => t.done).length

  return (
    <div className="bp-page">
      <div className="bp-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 className="bp-page-title">Aufgaben</h1>
          <p className="bp-page-subtitle">
            {totalDone} von {tasks.length} erledigt
          </p>
        </div>
      </div>

      {PHASES.map(phase => {
        const phaseTasks = tasks.filter(t => (t.phase ?? null) === phase.key)
        return (
          <PhaseSection
            key={String(phase.key)}
            phaseKey={phase.key}
            label={phase.label}
            tasks={phaseTasks}
            eventId={eventId}
            userId={userId}
            onUpdate={updated => setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))}
            onDelete={deleteTask}
            onAdded={t => setTasks(prev => [...prev, t])}
            activePhase={activePhase}
          />
        )
      })}
    </div>
  )
}
