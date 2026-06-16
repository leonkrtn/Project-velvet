// „Angemeldet bleiben" — App-seitige Durchsetzung der Login-Persistenz.
//
// Hintergrund: @supabase/ssr schreibt das Auth-Cookie fest mit 400 Tagen
// Laufzeit (der eigene cookieOptions.maxAge wird beim Schreiben überschrieben).
// Eine echte „nur diese Sitzung" / „30 Tage"-Wahl muss daher von der App
// durchgesetzt werden. Das geschieht jetzt über zwei eigene Cookies, die die
// Middleware bei jedem Request server-seitig auswertet (siehe middleware.ts):
//
//   • fv_pref  (persistent) — die getroffene Wahl:
//        'r:<expiry-ms>'  → 30 Tage angemeldet bleiben (absolute Frist)
//        's'              → nur die aktuelle Browser-Sitzung
//   • fv_alive (Session-Cookie, ohne max-age) — Marker der laufenden
//        Browser-Sitzung. Wird vom Browser beim Schließen automatisch gelöscht;
//        sein Fehlen signalisiert der Middleware das Ende der Sitzung.
//
// Die Middleware ist die Quelle der Wahrheit: Sie loggt aus, wenn die 30-Tage-
// Frist abgelaufen ist ('r') oder die Browser-Sitzung beendet wurde ('s').
// Ohne fv_pref (Alt-Sessions, andere Login-Wege) bleibt das Standardverhalten
// unverändert — es wird nichts erzwungen.

export const REMEMBER_DAYS = 30

const PREF = 'fv_pref'
const ALIVE = 'fv_alive'
const DAY_SECONDS = 24 * 60 * 60
// Das Präferenz-Cookie überlebt die 30-Tage-Frist bewusst, damit die Middleware
// den Ablauf noch erkennen und aktiv ausloggen kann (statt es einfach verfallen
// zu lassen, während das 400-Tage-Supabase-Cookie weiterlebt).
const PREF_MAX_AGE = 60 * DAY_SECONDS

// Beim Login die gewählte Persistenz als Cookies festhalten.
export function setLoginPersistence(remember: boolean) {
  try {
    if (remember) {
      const expiry = Date.now() + REMEMBER_DAYS * DAY_SECONDS * 1000
      document.cookie = `${PREF}=r:${expiry}; path=/; max-age=${PREF_MAX_AGE}; samesite=lax`
    } else {
      document.cookie = `${PREF}=s; path=/; max-age=${PREF_MAX_AGE}; samesite=lax`
    }
    // Session-Marker ohne max-age → wird beim Schließen des Browsers gelöscht.
    document.cookie = `${ALIVE}=1; path=/; samesite=lax`
  } catch {
    /* document/cookies nicht verfügbar */
  }
}

// Präferenz-Cookies entfernen (z. B. bei manuellem Logout).
export function clearPersistence() {
  try {
    document.cookie = `${PREF}=; path=/; max-age=0`
    document.cookie = `${ALIVE}=; path=/; max-age=0`
  } catch {
    /* ignore */
  }
}
