'use client'

import { useState } from 'react'
import { CheckSquare, NotebookPen } from 'lucide-react'
import BrautpaarAufgaben from '../aufgaben/BrautpaarAufgaben'
import BrautpaarNotizen from '../notizen/BrautpaarNotizen'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Note = any

type Tab = 'aufgaben' | 'notizen'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'aufgaben', label: 'Aufgaben', icon: <CheckSquare size={15} /> },
  { key: 'notizen',  label: 'Notizen',  icon: <NotebookPen size={15} /> },
]

interface Props {
  eventId: string
  userId: string
  initialTasks: Task[]
  initialNotes: Note[]
  weddingDate: string | null
  initialTab: Tab
}

export default function AufgabenNotizenClient({ eventId, userId, initialTasks, initialNotes, weddingDate, initialTab }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Aufgaben &amp; Notizen</h1>
      </div>

      <div className="bp-toggle" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className="bp-toggle-option"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ minHeight: 480 }}>
        {activeTab === 'aufgaben' && (
          <BrautpaarAufgaben
            eventId={eventId}
            userId={userId}
            initialTasks={initialTasks}
            weddingDate={weddingDate}
            embedded
          />
        )}
        {activeTab === 'notizen' && (
          <BrautpaarNotizen eventId={eventId} initialNotes={initialNotes} embedded />
        )}
      </div>
    </div>
  )
}
