'use client'

import { useState } from 'react'
import { CheckSquare, NotebookPen } from 'lucide-react'
import OrganizerTodoList from '../uebersicht/OrganizerTodoList'
import VeranstalterNotizen from './VeranstalterNotizen'

interface Todo {
  id: string
  title: string
  done: boolean
}

type Tab = 'aufgaben' | 'notizen'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'aufgaben', label: 'Aufgaben', icon: <CheckSquare size={15} /> },
  { key: 'notizen',  label: 'Notizen',  icon: <NotebookPen size={15} /> },
]

interface Props {
  eventId: string
  organizerId: string
  initialTodos: Todo[]
  initialTab: Tab
}

export default function AufgabenNotizenClient({ eventId, organizerId, initialTodos, initialTab }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', margin: '0 0 6px' }}>
        Aufgaben &amp; Notizen
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        Eigene To-Dos und Notizen zu diesem Event an einem Ort.
      </p>

      {/* Segmented tab switcher */}
      <div style={{
        display: 'inline-flex', gap: 4, padding: 4, marginBottom: 24,
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px',
                borderRadius: 7, border: 'none', cursor: 'pointer',
                background: active ? 'var(--surface)' : 'transparent',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 14, fontWeight: active ? 600 : 450, fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </div>

      <div style={{ minHeight: 420 }}>
        {activeTab === 'aufgaben' && (
          <OrganizerTodoList eventId={eventId} organizerId={organizerId} initialTodos={initialTodos} />
        )}
        {activeTab === 'notizen' && (
          <VeranstalterNotizen eventId={eventId} />
        )}
      </div>
    </div>
  )
}
