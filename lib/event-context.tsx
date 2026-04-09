'use client'
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { loadEvent, saveEvent, type Event } from '@/lib/store'

type Ctx = {
  event: Event | null
  updateEvent: (e: Event) => void
}

const EventContext = createContext<Ctx>({ event: null, updateEvent: () => {} })

export function EventProvider({ children }: { children: React.ReactNode }) {
  const [event, setEvent] = useState<Event | null>(null)
  useEffect(() => {
    setEvent(loadEvent())
    const reload = () => setEvent(loadEvent())
    window.addEventListener('velvet-saved', reload)
    window.addEventListener('storage', reload)
    return () => {
      window.removeEventListener('velvet-saved', reload)
      window.removeEventListener('storage', reload)
    }
  }, [])
  const updateEvent = useCallback((e: Event) => { setEvent(e); saveEvent(e) }, [])
  return <EventContext.Provider value={{ event, updateEvent }}>{children}</EventContext.Provider>
}

export function useEvent() { return useContext(EventContext) }
