import { createBrowserClient } from '@supabase/ssr'

// ── Safari-Fix: navigator.locks-Deadlock vermeiden ───────────────────────────
// supabase-js serialisiert Auth-Aufrufe (signIn / getSession / signOut) per
// Default ueber die Web Locks API (navigator.locks). In Safari kann diese
// Sperre haengen bleiben (z. B. nach einem abgebrochenen Request oder ueber
// mehrere Tabs/Reloads) — dann kehren die Auth-Aufrufe NIE zurueck und der
// Login bleibt dauerhaft auf „Wird geladen …", der Logout reagiert nicht.
//
// Wir ersetzen die Sperre durch eine einfache, modulweite In-Memory-Kette pro
// Lock-Namen. Sie serialisiert innerhalb des Tabs ohne navigator.locks und
// kann nicht deadlocken (der Tail verschluckt Fehler, die Kette laeuft weiter).
const lockTails = new Map<string, Promise<unknown>>()
function memoryLock<R>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  const prev = lockTails.get(name) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  lockTails.set(name, run.then(() => {}, () => {}))
  return run
}

// ── „Angemeldet bleiben" clientseitig durchsetzen ────────────────────────────
// @supabase/ssr schreibt die sb-*-Auth-Cookies im Browser-Client OHNE max-age —
// also als Session-Cookies, die der Browser beim Schliessen loescht. Dadurch war
// man trotz „30 Tage angemeldet bleiben" nach dem Browser-Neustart abgemeldet:
// die Middleware stempelt die Cookies zwar server-seitig persistent nach, aber
// supabase-js ueberschreibt sie clientseitig beim naechsten Token-Refresh wieder
// als Session-Cookies — und dieser letzte Stand zaehlt beim Schliessen.
//
// Fix: dem Browser-Client eine explizite Cookie-Lebensdauer geben, abgeleitet aus
// der beim Login gesetzten Praeferenz (fv_pref, siehe lib/auth-persistence.ts):
//   • 'r:<expiry>' → persistente Cookies mit Restlaufzeit (bis zu 30 Tage)
//   • 's' / fehlt  → kein max-age → Session-Cookie (nur diese Sitzung)
const DEFAULT_REMEMBER_MAX_AGE = 30 * 24 * 60 * 60
function rememberCookieMaxAge(): number | undefined {
  if (typeof document === 'undefined') return undefined
  try {
    const match = document.cookie.match(/(?:^|;\s*)fv_pref=([^;]+)/)
    if (!match) return undefined
    const value = decodeURIComponent(match[1])
    if (!value.startsWith('r:')) return undefined   // 's' → Session-Cookie
    const expiry = Number(value.slice(2))
    if (!expiry) return DEFAULT_REMEMBER_MAX_AGE
    const seconds = Math.floor((expiry - Date.now()) / 1000)
    return seconds > 0 ? seconds : undefined
  } catch {
    return undefined
  }
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const maxAge = rememberCookieMaxAge()
  const options = {
    auth: { lock: memoryLock },
    // Nur setzen, wenn „angemeldet bleiben" gewaehlt wurde. Ohne cookieOptions
    // bleibt das Default-Verhalten (Session-Cookie) fuer „nur diese Sitzung".
    ...(maxAge ? { cookieOptions: { maxAge } } : {}),
  }

  // Während Build/Prerender (Server, kein window) ohne gesetzte Env-Variablen
  // Platzhalter verwenden, statt hart zu werfen — der Client wird in diesem
  // Pfad nie für echte Requests genutzt. Im Browser bleibt es strikt, damit
  // echte Fehlkonfiguration sichtbar wird.
  if ((!url || !key) && typeof window === 'undefined') {
    return createBrowserClient(url || 'http://localhost:54321', key || 'placeholder-anon-key', options)
  }

  return createBrowserClient(url!, key!, options)
}
