import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'

// In-memory cache: city string → {lat, lng} | null
const cache = new Map<string, { lat: number; lng: number } | null>()

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 })

  // Der Endpoint proxyt Anfragen an Nominatim (OSM). Ohne Limit ließe er sich
  // als offener Geocoding-Proxy missbrauchen und würde die OSM-Nutzungsrichtlinie
  // verletzen (IP-Sperre droht). Cache-Treffer werden vorher bedient und zählen
  // nicht gegen das Limit.
  if (!cache.has(q)) {
    const rl = rateLimit(clientIp(req), {
      name: 'geo-geocode', limit: 30, windowMs: 60_000, blockMs: 5 * 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Zu viele Anfragen.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
      )
    }
  }

  if (cache.has(q)) {
    const hit = cache.get(q)!
    return NextResponse.json(hit ?? { error: 'Not found' }, hit ? { status: 200 } : { status: 404 })
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=de,at,ch&format=json&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Forevr-Marktplatz/1.0 (contact@forevr.de)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      cache.set(q, null)
      return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 })
    }
    const data = await res.json() as { lat: string; lon: string }[]
    if (!data.length) {
      cache.set(q, null)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    cache.set(q, result)
    return NextResponse.json(result)
  } catch {
    cache.set(q, null)
    return NextResponse.json({ error: 'Geocoding error' }, { status: 502 })
  }
}
