// „Angemeldet bleiben" — App-seitige Durchsetzung der Login-Persistenz.
//
// Hintergrund: @supabase/ssr schreibt Auth-Cookies fest mit 400 Tagen Laufzeit
// (cookieOptions.maxAge wird im Browser ignoriert). Eine echte „nur diese
// Sitzung" / „30 Tage"-Wahl muss daher hier durchgesetzt werden:
//
//  • Haken gesetzt  → 30 Tage absolute Gültigkeit (danach automatischer Logout).
//  • Haken nicht gesetzt → nur aktuelle Browser-Sitzung (Logout nach Schließen
//    des Browsers; erkannt über sessionStorage-Marker + Aktivitäts-Zeitstempel).
//
// Ist keine Präferenz gesetzt (Alt-Sessions, andere Login-Wege), bleibt das
// bisherige Standardverhalten unverändert (kein erzwungener Logout).

const REMEMBER = 'forevr_auth_remember'   // localStorage: '1' = 30 Tage, '0' = nur Sitzung
const EXPIRY = 'forevr_auth_expiry'       // localStorage: ms-Zeitstempel (nur bei '1')
const ACTIVE = 'forevr_auth_active'       // localStorage: letzter Aktivitäts-Zeitstempel
const TAB = 'forevr_auth_tab'             // sessionStorage: Marker der laufenden Browser-Sitzung

export const REMEMBER_DAYS = 30
const THIRTY_DAYS_MS = REMEMBER_DAYS * 24 * 60 * 60 * 1000
// Toleranz, damit mehrere Tabs / kurze Reloads nicht als „Browser geschlossen" gelten.
const CLOSED_GRACE_MS = 30 * 60 * 1000

// Beim Login die gewählte Persistenz festhalten.
export function setLoginPersistence(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER, remember ? '1' : '0')
    if (remember) localStorage.setItem(EXPIRY, String(Date.now() + THIRTY_DAYS_MS))
    else localStorage.removeItem(EXPIRY)
    sessionStorage.setItem(TAB, '1')
    localStorage.setItem(ACTIVE, String(Date.now()))
  } catch { /* Storage nicht verfügbar */ }
}

// Aktivität markieren (hält die laufende Sitzung „lebendig").
export function markActive() {
  try {
    sessionStorage.setItem(TAB, '1')
    localStorage.setItem(ACTIVE, String(Date.now()))
  } catch { /* ignore */ }
}

export function clearPersistence() {
  try {
    localStorage.removeItem(REMEMBER)
    localStorage.removeItem(EXPIRY)
    localStorage.removeItem(ACTIVE)
    sessionStorage.removeItem(TAB)
  } catch { /* ignore */ }
}

// Prüft, ob die aktuelle Sitzung laut Präferenz beendet werden muss.
// 'expired' = 30-Tage-Frist abgelaufen, 'closed' = Browser-Sitzung war beendet.
export function sessionPolicyViolation(): 'expired' | 'closed' | null {
  try {
    const remember = localStorage.getItem(REMEMBER)
    if (remember === null) return null            // keine Präferenz → Standardverhalten
    if (remember === '1') {
      const exp = Number(localStorage.getItem(EXPIRY) || '0')
      return exp && Date.now() > exp ? 'expired' : null
    }
    // remember === '0' → nur aktuelle Browser-Sitzung
    if (sessionStorage.getItem(TAB)) return null  // dieser Tab gehört zur Sitzung
    const active = Number(localStorage.getItem(ACTIVE) || '0')
    if (active && Date.now() - active < CLOSED_GRACE_MS) {
      sessionStorage.setItem(TAB, '1')            // anderer Tab war eben aktiv → gleiche Sitzung
      return null
    }
    return 'closed'
  } catch {
    return null
  }
}
