// Client-Helfer zum Zählen von Anbieter-Interaktionen (fire-and-forget).
// Blockiert nie die UI und ignoriert Fehler.

export type VendorTrackType = 'profile_view' | 'contact_email' | 'contact_phone' | 'website' | 'social'

export function trackVendorEvent(vendorId: string, type: VendorTrackType, meta?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !vendorId) return
  try {
    const body = JSON.stringify({ vendorId, type, meta })
    // keepalive: zählt auch, wenn der Klick zu einer Navigation (mailto/tel) führt.
    fetch('/api/marketplace/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* ignore */
  }
}
