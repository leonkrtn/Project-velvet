// lib/rate-limit.ts — Server-only in-memory rate limiting.
// Schützt unauthentifizierte/öffentliche Endpoints vor Brute-Force,
// Enumeration und Spam. Bewusst in-memory (pro Server-Instanz): einfach,
// ohne externe Abhängigkeit. Für mehrere Instanzen ggf. später durch einen
// geteilten Store (Redis/Upstash) ersetzen.
import 'server-only'

interface Bucket {
  count: number
  windowStart: number
  blockedUntil: number
}

interface RateLimitOptions {
  /** Eindeutiger Namespace pro Endpoint (verhindert Kollisionen). */
  name: string
  /** Erlaubte Anfragen pro Zeitfenster. */
  limit: number
  /** Länge des Zeitfensters in ms. */
  windowMs: number
  /** Sperrdauer nach Überschreitung in ms (Default: windowMs). */
  blockMs?: number
}

// Ein Map pro Prozess; Keys = `${name}:${identifier}`.
const store = new Map<string, Bucket>()

// Periodisches Aufräumen abgelaufener Einträge (verhindert unbegrenztes Wachstum).
let lastSweep = 0
function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  store.forEach((b, key) => {
    if (b.blockedUntil < now && now - b.windowStart > 3_600_000) store.delete(key)
  })
}

export interface RateLimitResult {
  allowed: boolean
  /** Verbleibende Sekunden bis zur Entsperrung (nur wenn blockiert). */
  retryAfter: number
}

/**
 * Registriert einen Versuch und meldet, ob er erlaubt ist.
 * Zählt jeden Aufruf; bei Überschreitung wird der Identifier für blockMs gesperrt.
 */
export function rateLimit(identifier: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  sweep(now)
  const blockMs = opts.blockMs ?? opts.windowMs
  const key = `${opts.name}:${identifier}`
  const b = store.get(key)

  if (b && b.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((b.blockedUntil - now) / 1000) }
  }

  if (!b || now - b.windowStart > opts.windowMs) {
    store.set(key, { count: 1, windowStart: now, blockedUntil: 0 })
    return { allowed: true, retryAfter: 0 }
  }

  b.count += 1
  if (b.count > opts.limit) {
    b.blockedUntil = now + blockMs
    return { allowed: false, retryAfter: Math.ceil(blockMs / 1000) }
  }
  return { allowed: true, retryAfter: 0 }
}

/** Bester verfügbarer Client-Identifier aus den Request-Headern. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}
