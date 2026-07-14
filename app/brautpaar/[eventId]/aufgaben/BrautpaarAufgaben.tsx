'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { runOptimistic, runOptimisticInsert, tempId } from '@/lib/optimistic'
import { Plus, Check, Trash2, ChevronDown, ChevronRight, X, ListChecks } from 'lucide-react'

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

// Klassische Hochzeits-Checkliste je Phase — wird per Button einmalig als
// Vorschlag geladen (analog zum "Standard-Sortiment laden"-Muster in der
// Getränkeplanung), nicht automatisch, damit Nutzer bewusst entscheiden.
const SEED_TASKS: Record<string, string[]> = {
  '12m': ['Budget grob festlegen', 'Gästeliste-Entwurf erstellen', 'Location besichtigen & buchen', 'Hochzeitsdatum fixieren'],
  '6m': ['Standesamt/Trauredner:in organisieren', 'Fotograf:in & Video buchen', 'Brautkleid/Anzug aussuchen', 'Catering anfragen'],
  '3m': ['Einladungen verschicken', 'Musik/DJ oder Band buchen', 'Ringe aussuchen', 'Hotelzimmer für Gäste reservieren'],
  '1m': ['Trauzeugenreden abstimmen', 'Sitzplan erstellen', 'Ablaufplan mit Dienstleistern abstimmen', 'Letzte Anprobe'],
  '1w': ['Finale Gästezahl an Location/Catering melden', 'Notfallkontakte & Ablaufplan verteilen', 'Deko & Give-aways vorbereiten'],
  day: ['Ringe, Papiere & Dokumente dabei', 'Zeitplan mit Trauzeugen durchgehen'],
  after: ['Danksagungen verschicken', 'Namensänderung erledigen', 'Fotos vom Fotografen abholen'],
}

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

function TaskItem({ task, onToggle, onDelete }: {
  task: Task
  onToggle: () => void
  onDelete: () => void
}) {
  const [delConfirm, setDelConfirm] = useState(false)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.75rem 1rem',
      borderBottom: '1px solid var(--bp-rule)',
      transition: 'opacity 0.15s',
    }}>
      <button
        onClick={onToggle}
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
      {delConfirm && (
        <button
          className="bp-btn bp-btn-danger bp-btn-sm"
          onClick={() => { setDelConfirm(false); onDelete() }}
        >
          Löschen
        </button>
      )}
      <button
        className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon"
        onClick={() => setDelConfirm(v => !v)}
        style={{ opacity: delConfirm ? 1 : 0.5, color: delConfirm ? 'var(--bp-red)' : undefined }}
        title={delConfirm ? 'Löschen abbrechen' : 'Aufgabe löschen'}
      >
        {delConfirm ? <X size={14} /> : <Trash2 size={14} />}
      </button>
    </div>
  )
}

function PhaseSection({ phaseKey, label, tasks, onToggle, onDelete, onAdd, activePhase, tourAnchor }: {
  phaseKey: string | null
  label: string
  tasks: Task[]
  onToggle: (t: Task) => void
  onDelete: (id: string) => void
  onAdd: (phaseKey: string | null, title: string, sortOrder: number) => void
  activePhase: string | null
  tourAnchor?: boolean
}) {
  const [open, setOpen] = useState(phaseKey === activePhase || tasks.some(t => !t.done))
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const done = tasks.filter(t => t.done).length
  const isActive = phaseKey === activePhase

  function addTask() {
    const title = newTitle.trim()
    if (!title) return
    onAdd(phaseKey, title, tasks.length)
    setNewTitle('')
    setAdding(false)
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
              onToggle={() => onToggle(task)}
              onDelete={() => onDelete(task.id)}
            />
          ))}
          <div style={{ padding: '0.75rem 1rem', borderTop: tasks.length > 0 ? '1px solid var(--bp-rule)' : 'none' }}>
            {adding ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  data-tour="bp-task-title"
                  className="bp-input"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Aufgabe beschreiben…"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setAdding(false) }}
                  style={{ flex: 1 }}
                />
                <button data-tour="bp-task-submit" className="bp-btn bp-btn-primary bp-btn-sm" onClick={addTask} disabled={!newTitle.trim()}>
                  OK
                </button>
                <button
                  className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon"
                  onClick={() => { setAdding(false); setNewTitle('') }}
                  aria-label="Abbrechen"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                data-tour={tourAnchor ? 'bp-add-task' : undefined}
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
  /** Eingebettet im kombinierten „Aufgaben & Notizen"-Tab: ohne eigenen Seiten-Header */
  embedded?: boolean
}

export default function BrautpaarAufgaben({ eventId, userId, initialTasks, weddingDate, embedded = false }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const activePhase = getActivePhase(weddingDate)
  const supabase = createClient()

  async function toggleTask(task: Task) {
    const snapshot = tasks
    const done = !task.done
    const done_at = done ? new Date().toISOString() : null
    await runOptimistic({
      apply: () => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done, done_at } : t)),
      rollback: () => setTasks(snapshot),
      commit: () => supabase.from('brautpaar_tasks').update({ done, done_at }).eq('id', task.id),
      onError: e => console.error('toggleTask failed', e),
    })
  }

  async function addTask(phaseKey: string | null, title: string, sortOrder: number) {
    const placeholderId = tempId()
    const placeholder: Task = {
      id: placeholderId,
      event_id: eventId,
      title,
      done: false,
      phase: phaseKey,
      sort_order: sortOrder,
      created_by: userId,
      created_at: new Date().toISOString(),
      done_at: null,
    }
    await runOptimisticInsert<Task>({
      apply: () => setTasks(prev => [...prev, placeholder]),
      commit: async () => {
        const { data, error } = await supabase
          .from('brautpaar_tasks')
          .insert({
            event_id: eventId,
            title,
            phase: phaseKey,
            done: false,
            sort_order: sortOrder,
            created_by: userId,
          })
          .select()
          .single()
        if (error || !data) throw error ?? new Error('Insert failed')
        return data as Task
      },
      reconcile: real => setTasks(prev => prev.map(t => t.id === placeholderId ? real : t)),
      rollback: () => setTasks(prev => prev.filter(t => t.id !== placeholderId)),
      onError: e => console.error('addTask failed', e),
    })
  }

  async function deleteTask(id: string) {
    const snapshot = tasks
    await runOptimistic({
      apply: () => setTasks(prev => prev.filter(t => t.id !== id)),
      rollback: () => setTasks(snapshot),
      commit: () => supabase.from('brautpaar_tasks').delete().eq('id', id),
      onError: e => console.error('deleteTask failed', e),
    })
  }

  const [loadingSeed, setLoadingSeed] = useState(false)

  async function loadSeedTasks() {
    if (loadingSeed) return
    setLoadingSeed(true)
    const inserts: Array<{ event_id: string; title: string; phase: string | null; done: boolean; sort_order: number; created_by: string }> = []
    Object.entries(SEED_TASKS).forEach(([phaseKey, titles]) => {
      titles.forEach((title, i) => {
        inserts.push({ event_id: eventId, title, phase: phaseKey, done: false, sort_order: i, created_by: userId })
      })
    })
    const tmpIds = inserts.map(() => tempId())
    const placeholders: Task[] = inserts.map((row, i) => ({
      id: tmpIds[i], event_id: row.event_id, title: row.title, done: false, phase: row.phase,
      sort_order: row.sort_order, created_by: row.created_by, created_at: new Date().toISOString(), done_at: null,
    }))
    await runOptimisticInsert<Task[]>({
      apply: () => setTasks(prev => [...prev, ...placeholders]),
      commit: async () => {
        const { data, error } = await supabase.from('brautpaar_tasks').insert(inserts).select()
        if (error || !data) throw error ?? new Error('Insert failed')
        return data as Task[]
      },
      reconcile: real => setTasks(prev => {
        const tmpSet = new Set(tmpIds)
        return [...prev.filter(t => !tmpSet.has(t.id)), ...real]
      }),
      rollback: () => setTasks(prev => {
        const tmpSet = new Set(tmpIds)
        return prev.filter(t => !tmpSet.has(t.id))
      }),
      onError: e => console.error('Standard-Checkliste laden fehlgeschlagen', e),
    })
    setLoadingSeed(false)
  }

  const totalDone = tasks.filter(t => t.done).length

  const phases = (
    <>
      {PHASES.map(phase => {
        const phaseTasks = tasks.filter(t => (t.phase ?? null) === phase.key)
        return (
          <PhaseSection
            key={String(phase.key)}
            phaseKey={phase.key}
            label={phase.label}
            tasks={phaseTasks}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onAdd={addTask}
            activePhase={activePhase}
            tourAnchor={phase.key === activePhase}
          />
        )
      })}
    </>
  )

  const seedBanner = tasks.length === 0 && (
    <div className="bp-card" style={{ padding: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      <ListChecks size={20} style={{ color: 'var(--bp-gold-deep)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>Noch keine Aufgaben angelegt</p>
        <p className="bp-caption" style={{ margin: '2px 0 0' }}>
          Ladet die klassische Hochzeits-Checkliste als Vorschlag — ihr könnt jeden Punkt später anpassen oder löschen.
        </p>
      </div>
      <button className="bp-btn bp-btn-primary bp-btn-sm" onClick={loadSeedTasks} disabled={loadingSeed}>
        {loadingSeed ? 'Lädt…' : 'Standard-Checkliste laden'}
      </button>
    </div>
  )

  if (embedded) {
    return (
      <div>
        <p className="bp-page-subtitle" style={{ marginBottom: '1.25rem' }}>
          {totalDone} von {tasks.length} erledigt
        </p>
        {seedBanner}
        {phases}
      </div>
    )
  }

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

      {seedBanner}
      {phases}
    </div>
  )
}
