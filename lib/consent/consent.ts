// Cookie-/Consent-Kernlogik (DSGVO/ePrivacy).
//
// Kategorien:
//  • necessary     — immer aktiv, keine Einwilligung nötig (Login/Session:
//                    Supabase sb-*, fv_pref/fv_alive, Consent-Speicher selbst).
//  • statistics    — Vercel Speed Insights (Reichweiten-/Performance-Messung).
//  • externalMedia — Drittanbieter-Embeds (Google Maps, YouTube, Spotify,
//                    Apple Music). Werden erst nach Einwilligung geladen.
//
// Die Wahl wird versioniert in localStorage gespeichert. Bei Erhöhung von
// CONSENT_VERSION (z. B. neue Kategorie/neuer Dienst) wird erneut gefragt.

export type OptionalCategory = 'statistics' | 'externalMedia'

export interface ConsentState {
  statistics: boolean
  externalMedia: boolean
  version: number
  timestamp: number
}

export const CONSENT_VERSION = 1
export const CONSENT_KEY = 'forevr_cookie_consent_v1'
/** Fenster-Event bei jeder Änderung (damit gegatete Komponenten reagieren). */
export const CONSENT_CHANGE_EVENT = 'forevr-consent-change'
/** Fenster-Event zum Öffnen der Einstellungen (z. B. aus dem Footer). */
export const CONSENT_OPEN_EVENT = 'forevr-open-cookie-settings'

export const CATEGORY_LABELS: Record<OptionalCategory, { title: string; desc: string }> = {
  statistics: {
    title: 'Statistik',
    desc: 'Anonyme Reichweiten- und Performance-Messung (Vercel Speed Insights), um die Website zu verbessern. Ohne diese Einwilligung findet keine Messung statt.',
  },
  externalMedia: {
    title: 'Externe Medien',
    desc: 'Inhalte von Drittanbietern wie Google Maps, YouTube, Spotify und Apple Music. Beim Laden werden Daten an diese Anbieter übertragen, die dabei Cookies setzen können.',
  },
}

export function defaultConsent(granted: boolean): ConsentState {
  return { statistics: granted, externalMedia: granted, version: CONSENT_VERSION, timestamp: Date.now() }
}

/** Liest die gespeicherte Wahl. `null` = noch keine gültige Entscheidung. */
export function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ConsentState>
    if (parsed.version !== CONSENT_VERSION) return null // veraltet → erneut fragen
    return {
      statistics: !!parsed.statistics,
      externalMedia: !!parsed.externalMedia,
      version: CONSENT_VERSION,
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
    }
  } catch {
    return null
  }
}

export function writeConsent(state: ConsentState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(state))
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: state }))
  } catch {
    /* Speicher nicht verfügbar (Privatmodus o. ä.) */
  }
}
