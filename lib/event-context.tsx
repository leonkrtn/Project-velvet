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
import type { UserRole, TrauzeugePermissions } from '@/lib/types/roles'

type Ctx = {
  event: Event | null
  updateEvent: (e: Event) => void
  switchEvent: (eventId: string) => Promise<void>
  isDemo: boolean
  isSyncing: boolean
  syncError: string | null
  hasLoaded: boolean
  // Role & permissions
  currentRole: UserRole | null
  currentUserId: string | null
  trauzeugePerm: TrauzeugePermissions | null
  isVeranstalter: boolean
  isBrautpaar: boolean
  isEventFrozen: boolean
}

const EventContext = createContext<Ctx>({
  event: null,
  updateEvent: () => {},
  switchEvent: async () => {},
  isDemo: true,
  isSyncing: false,
  syncError: null,
  hasLoaded: false,
  currentRole: null,
  currentUserId: null,
  trauzeugePerm: null,
  isVeranstalter: false,
  isBrautpaar: false,
  isEventFrozen: false,
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
  const [hasLoaded, setHasLoaded] = useState(false)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [trauzeugePerm, setTrauzeugePerm] = useState<TrauzeugePermissions | null>(null)

  const syncInProgress = useRef(false)
  const dbInitialized = useRef(false)
  const isDemoRef = useRef(true)
  useEffect(() => { isDemoRef.current = isDemo }, [isDemo])

  // Derived state
  const isVeranstalter = currentRole === 'veranstalter'
  const isBrautpaar = currentRole === 'brautpaar'
  const isEventFrozen = Boolean(
    event?.dataFreezeAt && new Date(event.dataFreezeAt) <= new Date()
  )

  async function ensureTablesExist() {
    if (dbInitialized.current) return
    try {
      await fetch('/api/init-db', { method: 'POST' })
      dbInitialized.current = true
    } catch { /* nicht fatal */ }
  }

  async function loadRoleAndPermissions(userId: string, eventId: string) {
    try {
      const { fetchUserRole, fetchTrauzeugePermissions } = await getDB()
      const role = await fetchUserRole(eventId, userId)
      setCurrentRole(role)
      if (role === 'trauzeuge') {
        const perms = await fetchTrauzeugePermissions(eventId, userId)
        setTrauzeugePerm(perms)
      } else {
        setTrauzeugePerm(null)
      }
    } catch (err) {
      console.error('[EventContext] Role load failed:', err)
    }
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
      setHasLoaded(true)
      return
    }

    getSupabase().then(async ({ createClient }) => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        const lsEvent = loadEvent()
        setEvent(lsEvent.id === 'evt-demo' ? SEED_EVENT : lsEvent)
        setIsDemo(true)
        setHasLoaded(true)
        return
      }

      setCurrentUserId(session.user.id)
      setIsDemo(false)
      setIsSyncing(true)
      const dbEvent = await loadFromSupabase(session.user.id)
      if (dbEvent) {
        setEvent(dbEvent)
        saveEvent(dbEvent)
        await loadRoleAndPermissions(session.user.id, dbEvent.id)
      } else {
        const lsEvent = loadEvent()
        setEvent(lsEvent.id === 'evt-demo' ? SEED_EVENT : lsEvent)
      }
      setIsSyncing(false)
      setHasLoaded(true)

      supabase.auth.onAuthStateChange(async (authEvent, newSession) => {
        if (authEvent === 'SIGNED_IN' && newSession) {
          setCurrentUserId(newSession.user.id)
          setIsDemo(false)
          setIsSyncing(true)
          const dbEvent = await loadFromSupabase(newSession.user.id)
          if (dbEvent) {
            setEvent(dbEvent)
            saveEvent(dbEvent)
            await loadRoleAndPermissions(newSession.user.id, dbEvent.id)
          }
          setIsSyncing(false)
          setHasLoaded(true)
        } else if (authEvent === 'SIGNED_OUT') {
          setIsDemo(true)
          setCurrentUserId(null)
          setCurrentRole(null)
          setTrauzeugePerm(null)
          setEvent(SEED_EVENT)
        }
      })
    }).catch(() => {
      setEvent(SEED_EVENT)
      setIsDemo(true)
      setHasLoaded(true)
    })

    const reload = () => { if (isDemoRef.current) setEvent(loadEvent()) }
    window.addEventListener('velvet-saved', reload)
    window.addEventListener('storage', reload)
    return () => {
      window.removeEventListener('velvet-saved', reload)
      window.removeEventListener('storage', reload)
    }
  }, [])

  const switchEvent = useCallback(async (eventId: string) => {
    if (!currentUserId) return
    try {
      const { fetchEventFromDB } = await getDB()
      const dbEvent = await fetchEventFromDB(currentUserId, eventId)
      if (dbEvent) {
        setEvent(dbEvent)
        saveEvent(dbEvent)
        await loadRoleAndPermissions(currentUserId, dbEvent.id)
      }
    } catch (err) {
      console.error('[EventContext] switchEvent failed:', err)
    }
  }, [currentUserId])

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
    <EventContext.Provider value={{
      event, updateEvent, switchEvent, isDemo, isSyncing, syncError, hasLoaded,
      currentRole, currentUserId, trauzeugePerm,
      isVeranstalter, isBrautpaar, isEventFrozen,
    }}>
      {children}
    </EventContext.Provider>
  )
}

export function useEvent() { return useContext(EventContext) }
