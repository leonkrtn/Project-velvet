// Robustes Abmelden — Safari-tauglich.
//
// Problem: `supabase.auth.signOut()` ruft per Default mit globalem Scope den
// Server an, um Refresh-Tokens zu widerrufen. In Safari (Intelligent Tracking
// Prevention) kann dieser Request haengen, wodurch eine danach folgende
// Navigation nie ausgefuehrt wird — der Abmelde-Button wirkt „kaputt".
//
// Loesung:
//   • scope: 'local' → loescht nur die lokale Session (Cookies), kein
//     blockierender Netzwerk-Revoke.
//   • Promise.race mit Timeout → es wird in jedem Fall navigiert.
//   • clearPersistence() → entfernt die App-eigenen fv_pref/fv_alive-Cookies.
//   • window.location.href → harte Navigation, damit die Middleware mit
//     geleerten Cookies neu laeuft (zuverlaessiger als router.push).
import { createClient } from '@/lib/supabase/client'
import { clearPersistence } from '@/lib/auth-persistence'

export async function performLogout(redirectTo = '/login') {
  clearPersistence()
  try {
    const supabase = createClient()
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise(resolve => setTimeout(resolve, 1500)),
    ])
  } catch {
    /* ignore — wir navigieren ohnehin gleich weg */
  }
  if (typeof window !== 'undefined') window.location.href = redirectTo
}
