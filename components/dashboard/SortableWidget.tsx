'use client'
import React from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'

export type WidgetId = 'countdown'|'rsvp'|'budget'|'tasks'|'seating'|'vendors'|'reminders'|'sub-events'|'arrival'|'timeline'|'deko'

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
      <circle cx="2.5" cy="2" r="1.5"/>
      <circle cx="7.5" cy="2" r="1.5"/>
      <circle cx="2.5" cy="7" r="1.5"/>
      <circle cx="7.5" cy="7" r="1.5"/>
      <circle cx="2.5" cy="12" r="1.5"/>
      <circle cx="7.5" cy="12" r="1.5"/>
    </svg>
  )
}

export function SortableWidget({id, children}: {id: string; children: React.ReactNode}) {
  const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({id})
  const isTimeline = id === 'timeline'
  return (
    <div
      ref={setNodeRef}
      data-widget-id={id}
      className="widget-card"
      style={{
        transform: transform ? CSS.Transform.toString({...transform, scaleX:1, scaleY:1}) : undefined,
        transition: transition ?? 'transform 220ms cubic-bezier(0.25,0.46,0.45,0.94)',
        opacity: isDragging ? 0 : 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        ...(isTimeline ? {gridRow: 'span 2'} : {}),
      }}
    >
      <div style={{flex:1, display:'flex', flexDirection:'column'}}>{children}</div>
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        aria-label="Widget verschieben"
        style={{
          position: 'absolute', bottom: 8, right: 10, zIndex: 10,
          background: 'none', border: 'none', cursor: 'grab', padding: '4px 8px',
          color: 'var(--text-dim)', opacity: 0,
          display: 'flex', touchAction: 'none', borderRadius: 6,
          transition: 'opacity 0.15s',
        }}
        className="widget-drag-handle"
      >
        <GripIcon/>
      </button>
    </div>
  )
}
