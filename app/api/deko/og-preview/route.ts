import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'dns/promises'
import net from 'net'

export const runtime = 'nodejs'

const EMPTY = { title: null, description: null, image: null, domain: null }

// Prüft, ob eine IP-Adresse in einem privaten/internen/reservierten Bereich liegt.
// Verhindert SSRF gegen Loopback, RFC1918, Link-Local (inkl. Cloud-Metadata
// 169.254.169.254), CGNAT sowie IPv6-Loopback/ULA/Link-Local.
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number)
    if (p[0] === 10) return true
    if (p[0] === 127) return true
    if (p[0] === 0) return true
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true
    if (p[0] === 192 && p[1] === 168) return true
    if (p[0] === 169 && p[1] === 254) return true // link-local + Cloud-Metadata
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true // CGNAT
    return false
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase()
    if (v === '::1' || v === '::') return true
    if (v.startsWith('fe80')) return true // link-local
    if (v.startsWith('fc') || v.startsWith('fd')) return true // unique local
    // IPv4-mapped (::ffff:a.b.c.d) auf die enthaltene IPv4 prüfen
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateIp(mapped[1])
    return false
  }
  return true // unbekanntes Format → blockieren
}

// Validiert eine URL: nur http(s), Host darf nicht auf eine private IP auflösen.
async function assertSafeUrl(raw: string): Promise<URL | null> {
  let u: URL
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const host = u.hostname
  // Direkt als IP angegeben?
  if (net.isIP(host)) return isPrivateIp(host) ? null : u
  try {
    const records = await lookup(host, { all: true })
    if (records.length === 0) return null
    if (records.some(r => isPrivateIp(r.address))) return null
  } catch {
    return null
  }
  return u
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('url')
  if (!target) return NextResponse.json({ error: 'No URL' }, { status: 400 })

  // Sicheres Fetch mit manueller Redirect-Behandlung — jede Weiterleitung wird
  // erneut gegen private IP-Bereiche validiert (verhindert Redirect-SSRF).
  let current = target
  let res: Response | null = null
  try {
    for (let hop = 0; hop < 4; hop++) {
      const safe = await assertSafeUrl(current)
      if (!safe) return NextResponse.json(EMPTY)
      const r = await fetch(safe.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Forevr/1.0)' },
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      })
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location')
        if (!loc) return NextResponse.json(EMPTY)
        current = new URL(loc, safe).toString()
        continue
      }
      res = r
      break
    }
    if (!res || !res.ok) return NextResponse.json(EMPTY)
    const html = await res.text()

    const get = (prop: string) => {
      const m = html.match(new RegExp(`<meta[^>]*(?:property|name)="${prop}"[^>]*content="([^"]*)"`, 'i'))
        ?? html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*(?:property|name)="${prop}"`, 'i'))
      return m?.[1] ?? null
    }

    const title = get('og:title') ?? get('twitter:title') ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null
    const description = get('og:description') ?? get('twitter:description') ?? get('description') ?? null
    const image = get('og:image') ?? get('twitter:image') ?? null
    const domain = new URL(current).hostname.replace('www.', '')

    return NextResponse.json({ title, description, image, domain })
  } catch {
    return NextResponse.json(EMPTY)
  }
}
