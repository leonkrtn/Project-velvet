'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  type ConsentState, type OptionalCategory,
  readConsent, writeConsent, defaultConsent,
  CONSENT_CHANGE_EVENT, CONSENT_OPEN_EVENT,
} from '@/lib/consent/consent'

interface ConsentContextValue {
  /** Aktuelle Wahl; null = noch nicht entschieden (Banner zeigen). */
  consent: ConsentState | null
  /** true, sobald aus localStorage hydratisiert (verhindert SSR-Flackern). */
  ready: boolean
  decided: boolean
  settingsOpen: boolean
  has: (cat: OptionalCategory) => boolean
  acceptAll: () => void
  rejectAll: () => void
  save: (choices: { statistics: boolean; externalMedia: boolean }) => void
  grant: (cat: OptionalCategory) => void
  openSettings: () => void
  closeSettings: () => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null)
  const [ready, setReady] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    setConsent(readConsent())
    setReady(true)
    // Multi-Tab-Sync + Reaktion auf Änderungen aus anderen Instanzen.
    const onChange = () => setConsent(readConsent())
    const onOpen = () => setSettingsOpen(true)
    window.addEventListener(CONSENT_CHANGE_EVENT, onChange)
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(CONSENT_CHANGE_EVENT, onChange)
      window.removeEventListener(CONSENT_OPEN_EVENT, onOpen)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const persist = useCallback((state: ConsentState) => {
    writeConsent(state)
    setConsent(state)
  }, [])

  const acceptAll = useCallback(() => { persist(defaultConsent(true)); setSettingsOpen(false) }, [persist])
  const rejectAll = useCallback(() => { persist(defaultConsent(false)); setSettingsOpen(false) }, [persist])
  const save = useCallback((c: { statistics: boolean; externalMedia: boolean }) => {
    persist({ ...c, version: defaultConsent(false).version, timestamp: Date.now() })
    setSettingsOpen(false)
  }, [persist])
  const grant = useCallback((cat: OptionalCategory) => {
    const base = consent ?? defaultConsent(false)
    persist({ ...base, [cat]: true, timestamp: Date.now() })
  }, [consent, persist])

  const has = useCallback((cat: OptionalCategory) => !!consent?.[cat], [consent])

  const value: ConsentContextValue = {
    consent, ready, decided: consent !== null, settingsOpen,
    has, acceptAll, rejectAll, save, grant,
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
  }

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) {
    // Fallback, falls außerhalb des Providers benutzt: nichts einwilligen.
    return {
      consent: null, ready: false, decided: false, settingsOpen: false,
      has: () => false, acceptAll: () => {}, rejectAll: () => {}, save: () => {}, grant: () => {},
      openSettings: () => {}, closeSettings: () => {},
    }
  }
  return ctx
}
