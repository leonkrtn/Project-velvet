'use client'
// lib/event-context.tsx
// Datenstrategie:
//  1. Nicht authentifiziert ODER kein Supabase → Demo-Modus (SEED_EVENT)
//  2. Authentifiziert + Supabase konfiguriert → Supabase als primäre Quelle
//  3. localStorage als schneller Cache / Offline-Fallback
//
// Alle DB-Imports sind DYNAMISCH (lazy), damit kein Server-only-Code
// in den SSR-Bundle kommt.

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { loadEvent, saveEvent, SEED_EVENT, type Event } from '@/lib/store'

type Ctx = {
  event: Event | null
  updateEvent: (e: Event) => void
  isDemo: boolean
  isSyncing: boolean
  syncError: string | null
}

const EventContext = createContext<Ctx>({
  event: null,
  updateEvent: () => {},
  isDemo: true,
  isSyncing: false,
  syncError: null,
})

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return Boolean(url && url !== 'your-supabase-url' && url.startsWith('https://'))
}

// Lazy-Imports — nur client-seitig geladen, nie im SSR-Bundle
async function getDB() {
  return import('@/lib/db/events')
}
async function getSupabase() {
  return import('@/lib/supabase/client')
}

export function EventProvider({ children }: { children: React.ReactNode }) {
  const [event, setEvent] = useState<Event | null>(null)
  const [isDemo, setIsDemo] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const syncInProgress = useRef(false)
  const dbInitialized = useRef(false)
  const isDemoRef = useRef(true)
  useEffect(() => { isDemoRef.current = isDemo }, [isDemo])

  async function ensureTablesExist() {
    if (dbInitialized.current) return
    try {
      await fetch('/api/init-db', { method: 'POST' })
      dbInitialized.current = true
    } catch { /* nicht fatal */ }
  }

  async function loadFromSupabase(userId: string): Promise<Event | null> {
    try {
      await ensureTablesExist()
      const { fetchEventFromDB, upsertEventToDB, createNewEvent } = await getDB()
      let dbEvent = await fetchEventFromDB(userId)

      if (!dbEvent) {
        const lsEvent = loadEvent()
        if (lsEvent.id !== 'evt-demo') {
          await upsertEventToDB(lsEvent, userId)
        } else {
          await createNewEvent(userId)
        }
        dbEvent = await fetchEventFromDB(userId)
      }

      return dbEvent
    } catch (err) {
      console.error('[EventContext] Supabase load failed:', err)
      setSyncError('Verbindung zur Datenbank fehlgeschlagen. Lokale Daten werden verwendet.')
      return null
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setEvent(SEED_EVENT)
      setIsDemo(true)
      return
    }

    getSupabase().then(async ({ createClient }) => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        const lsEvent = loadEvent()
        setEvent(lsEvent.id === 'evt-demo' ? SEED_EVENT : lsEvent)
        setIsDemo(true)
        return
      }

      setIsDemo(false)
      setIsSyncing(true)
      const dbEvent = await loadFromSupabase(session.user.id)
      if (dbEvent) {
        setEvent(dbEvent)
        saveEvent(dbEvent)
      } else {
        const lsEvent = loadEvent()
        setEvent(lsEvent.id === 'evt-demo' ? SEED_EVENT : lsEvent)
      }
      setIsSyncing(false)

      supabase.auth.onAuthStateChange(async (authEvent, newSession) => {
        if (authEvent === 'SIGNED_IN' && newSession) {
          setIsDemo(false)
          setIsSyncing(true)
          const dbEvent = await loadFromSupabase(newSession.user.id)
          if (dbEvent) { setEvent(dbEvent); saveEvent(dbEvent) }
          setIsSyncing(false)
        } else if (authEvent === 'SIGNED_OUT') {
          setIsDemo(true)
          setEvent(SEED_EVENT)
        }
      })
    }).catch(() => {
      setEvent(SEED_EVENT)
      setIsDemo(true)
    })

    const reload = () => { if (isDemoRef.current) setEvent(loadEvent()) }
    window.addEventListener('velvet-saved', reload)
    window.addEventListener('storage', reload)
    return () => {
      window.removeEventListener('velvet-saved', reload)
      window.removeEventListener('storage', reload)
    }
  }, [])

  const updateEvent = useCallback(async (e: Event) => {
    setEvent(e)
    saveEvent(e)

    if (isDemoRef.current || !isSupabaseConfigured()) return
    if (syncInProgress.current) return
    syncInProgress.current = true

    try {
      const { createClient } = await getSupabase()
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { upsertEventToDB } = await getDB()
      await upsertEventToDB(e, session.user.id)
      setSyncError(null)
    } catch (err) {
      console.error('[EventContext] Sync fehlgeschlagen:', err)
      setSyncError('Daten konnten nicht synchronisiert werden.')
    } finally {
      syncInProgress.current = false
    }
  }, [])

  return (
    <EventContext.Provider value={{ event, updateEvent, isDemo, isSyncing, syncError }}>
      {children}
    </EventContext.Provider>
  )
}

export function useEvent() { return useContext(EventContext) }
