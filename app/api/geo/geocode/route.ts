import { NextRequest, NextResponse } from 'next/server'

// In-memory cache: city string → {lat, lng} | null
const cache = new Map<string, { lat: number; lng: number } | null>()

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 })

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
