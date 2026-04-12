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
    // Always start with localStorage (fast, works offline, no auth required)
    setEvent(loadEvent())

    const reload = () => setEvent(loadEvent())
    window.addEventListener('velvet-saved', reload)
    window.addEventListener('storage', reload)

    // If Supabase is configured, try to sync in background
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl && supabaseUrl !== 'your-supabase-url' && supabaseUrl.startsWith('https://')) {
      import('@/lib/supabase/client').then(({ createClient }) => {
        const supabase = createClient()
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return  // no auth → pure localStorage mode
          // Future: fetch event from Supabase and merge with localStorage
          // For now, localStorage is authoritative until full migration is complete
        })
      }).catch(() => {
        // Supabase not configured or network error — stay in localStorage mode
      })
    }

    return () => {
      window.removeEventListener('velvet-saved', reload)
      window.removeEventListener('storage', reload)
    }
  }, [])

  const updateEvent = useCallback((e: Event) => {
    setEvent(e)
    saveEvent(e)

    // Background sync to Supabase if configured and authenticated
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl && supabaseUrl !== 'your-supabase-url' && supabaseUrl.startsWith('https://')) {
      import('@/lib/supabase/client').then(({ createClient }) => {
        const supabase = createClient()
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return  // no auth → localStorage only
          // Future: upsert event data to Supabase tables
          // Implemented when DB migration is complete
        })
      }).catch(() => {})
    }
  }, [])

  return <EventContext.Provider value={{ event, updateEvent }}>{children}</EventContext.Provider>
}

export function useEvent() { return useContext(EventContext) }
