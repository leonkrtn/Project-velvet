'use client'

import { useEffect } from 'react'

// Selbstheilung bei „veralteter Tab nach neuem Deployment".
//
// Bei jedem Deployment ändern sich die Dateinamen der Next.js/Webpack-Chunks
// (inkl. des GLOBALEN webpack-runtime-Chunks). Ein Browser, der die Seite noch
// aus dem vorherigen Deployment geladen hat, fordert dann einen Chunk-Namen an,
// den es nicht mehr gibt → der Server liefert die 404-HTML-Seite statt JS →
// wegen `X-Content-Type-Options: nosniff` verweigert der Browser die Ausführung
// („Refused to execute … as script"). Weil der webpack-Runtime-Chunk global ist,
// bricht dadurch JEDE Seite (auch /login) gleichzeitig.
//
// Dieser Guard erkennt genau diesen Fall und lädt die Seite EINMAL neu — dann
// holt der Browser frisches HTML mit den passenden neuen Chunks. Ein
// sessionStorage-Marker mit Zeitstempel verhindert eine Reload-Schleife, falls
// der Fehler doch eine andere Ursache hat.
export default function ChunkReloadGuard() {
  useEffect(() => {
    const KEY = 'fv-chunk-reload-at'
    const COOLDOWN_MS = 20_000

    const reloadOnce = () => {
      let last = 0
      try { last = Number(sessionStorage.getItem(KEY)) || 0 } catch { /* ignore */ }
      // In den letzten 20 s bereits neu geladen → nicht erneut (Schleifenschutz).
      if (Date.now() - last < COOLDOWN_MS) return
      try { sessionStorage.setItem(KEY, String(Date.now())) } catch { /* ignore */ }
      // Harter Neuladen; erzwingt frisches HTML + passende Chunks.
      window.location.reload()
    }

    const looksLikeChunkError = (msg?: string | null) => {
      if (!msg) return false
      return (
        /ChunkLoadError/i.test(msg) ||
        /Loading chunk [\w-]+ failed/i.test(msg) ||
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Importing a module script failed/i.test(msg) ||
        /error loading dynamically imported module/i.test(msg)
      )
    }

    // 1) Fehlgeschlagene <script>/<link>-Ressourcen (u. a. der „Refused to
    //    execute … script"-Fall) feuern ein Fehler-Event in der Capture-Phase.
    const onErrorCapture = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const url =
        (target as HTMLScriptElement).src ||
        (target as HTMLLinkElement).href ||
        ''
      if (typeof url === 'string' && url.includes('/_next/static/')) {
        reloadOnce()
      }
    }

    // 2) Dynamische Imports (Code-Splitting) werfen ChunkLoadError als
    //    unhandledrejection oder als globales Fehler-Event.
    const onError = (e: ErrorEvent) => {
      if (looksLikeChunkError(e.message) || looksLikeChunkError(e.error?.message)) {
        reloadOnce()
      }
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason
      const msg = typeof reason === 'string' ? reason : reason?.message
      if (looksLikeChunkError(msg) || reason?.name === 'ChunkLoadError') {
        reloadOnce()
      }
    }

    window.addEventListener('error', onErrorCapture, true)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onErrorCapture, true)
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
