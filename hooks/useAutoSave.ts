'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Options {
  /** Debounce in ms, bevor gespeichert wird (Standard 800). */
  delay?: number
  /** Auto-Save aktiv? (z. B. deaktivieren bei eingefrorenen Events) */
  enabled?: boolean
}

/**
 * Generischer Auto-Save-Hook.
 *
 * Beobachtet `value`, speichert nach `delay` ms ohne weitere Änderung und
 * meldet den Status ('idle' | 'saving' | 'saved' | 'error'). Bei Unmount wird
 * eine ausstehende Änderung best-effort sofort geflusht, damit nichts verloren
 * geht. `flush()` kann z. B. in onBlur aufgerufen werden, um sofort zu sichern.
 */
export function useAutoSave<T>(
  value: T,
  save: (value: T) => Promise<void> | void,
  opts: Options = {},
): { status: SaveStatus; flush: () => void } {
  const delay = opts.delay ?? 800
  const enabled = opts.enabled ?? true

  const [status, setStatus] = useState<SaveStatus>('idle')
  const lastSavedRef = useRef<string>(JSON.stringify(value))
  const firstRef = useRef(true)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const valueRef = useRef(value)
  const saveRef = useRef(save)
  valueRef.current = value
  saveRef.current = save

  const runSave = useCallback(async (serialized: string, v: T) => {
    setStatus('saving')
    try {
      await saveRef.current(v)
      lastSavedRef.current = serialized
      setStatus('saved')
      clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setStatus('idle'), 1600)
    } catch {
      setStatus('error')
    }
  }, [])

  const flush = useCallback(() => {
    const serialized = JSON.stringify(valueRef.current)
    if (serialized === lastSavedRef.current) return
    clearTimeout(debounceRef.current)
    void runSave(serialized, valueRef.current)
  }, [runSave])

  useEffect(() => {
    if (!enabled) return
    // Initialer Mount: nicht speichern, nur Baseline merken.
    if (firstRef.current) {
      firstRef.current = false
      lastSavedRef.current = JSON.stringify(value)
      return
    }
    const serialized = JSON.stringify(value)
    if (serialized === lastSavedRef.current) return

    setStatus('saving')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { void runSave(serialized, value) }, delay)
    return () => clearTimeout(debounceRef.current)
  }, [value, enabled, delay, runSave])

  // Bei Unmount ausstehende Änderung best-effort flushen ("nichts geht verloren").
  useEffect(() => () => {
    const serialized = JSON.stringify(valueRef.current)
    if (serialized !== lastSavedRef.current) {
      try { void saveRef.current(valueRef.current) } catch { /* best effort */ }
    }
    clearTimeout(savedTimerRef.current)
    clearTimeout(debounceRef.current)
  }, [])

  return { status, flush }
}
