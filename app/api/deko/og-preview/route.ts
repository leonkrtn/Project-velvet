import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Velvet/1.0)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error('Fetch failed')
    const html = await res.text()

    const get = (prop: string) => {
      const m = html.match(new RegExp(`<meta[^>]*(?:property|name)="${prop}"[^>]*content="([^"]*)"`, 'i'))
        ?? html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*(?:property|name)="${prop}"`, 'i'))
      return m?.[1] ?? null
    }

    const title = get('og:title') ?? get('twitter:title') ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null
    const description = get('og:description') ?? get('twitter:description') ?? get('description') ?? null
    const image = get('og:image') ?? get('twitter:image') ?? null
    const domain = new URL(url).hostname.replace('www.', '')

    return NextResponse.json({ title, description, image, domain })
  } catch {
    return NextResponse.json({ title: null, description: null, image: null, domain: null })
  }
}
