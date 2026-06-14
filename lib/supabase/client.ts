import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Während Build/Prerender (Server, kein window) ohne gesetzte Env-Variablen
  // Platzhalter verwenden, statt hart zu werfen — der Client wird in diesem
  // Pfad nie für echte Requests genutzt. Im Browser bleibt es strikt, damit
  // echte Fehlkonfiguration sichtbar wird.
  if ((!url || !key) && typeof window === 'undefined') {
    return createBrowserClient(url || 'http://localhost:54321', key || 'placeholder-anon-key')
  }

  return createBrowserClient(url!, key!)
}
