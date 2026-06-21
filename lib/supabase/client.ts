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

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const options = { auth: { lock: memoryLock } }

  // Während Build/Prerender (Server, kein window) ohne gesetzte Env-Variablen
  // Platzhalter verwenden, statt hart zu werfen — der Client wird in diesem
  // Pfad nie für echte Requests genutzt. Im Browser bleibt es strikt, damit
  // echte Fehlkonfiguration sichtbar wird.
  if ((!url || !key) && typeof window === 'undefined') {
    return createBrowserClient(url || 'http://localhost:54321', key || 'placeholder-anon-key', options)
  }

  return createBrowserClient(url!, key!, options)
}
