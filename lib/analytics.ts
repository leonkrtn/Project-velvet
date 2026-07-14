'use client'

// Dünner Wrapper um Plausible (window.plausible), damit Tracking-Aufrufe im
// Code sauber lesbar sind und nirgends crashen, falls das Script (noch) nicht
// geladen ist (z. B. ohne Consent oder ohne konfigurierte Domain).
declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void
  }
}

export type AnalyticsEvent =
  | 'Signup gestartet'
  | 'Signup abgeschlossen'
  | 'Projekt erstellt'
  | 'Erste Aufgabe erstellt'
  | 'Partner eingeladen'

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined' || !window.plausible) return
  try {
    window.plausible(event, props ? { props } : undefined)
  } catch {
    // Tracking darf nie einen Nutzerflow unterbrechen.
  }
}
