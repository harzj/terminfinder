import { NextRequest, NextResponse } from 'next/server'

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function parseSearchXml(xml: string): Array<{ id: number; name: string; year?: number }> {
  const results: Array<{ id: number; name: string; year?: number }> = []
  const itemRegex = /<item\b([^>]*)>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(xml)) !== null) {
    const attrs = match[1]
    const block = match[2]
    if (!attrs.includes('type="boardgame"')) continue
    const idMatch = /\bid="(\d+)"/.exec(attrs)
    if (!idMatch) continue
    const id = parseInt(idMatch[1], 10)

    // Find primary name (handles any attribute order)
    const nameRe = /<name\b([^>]*?)\/?>/ .source + '|' + /<name\b([^>]*?)>/.source
    let primaryName: string | null = null
    const nameBlockRe = /<name\b([^>]*?)\s*\/?>/g
    let nm: RegExpExecArray | null
    while ((nm = nameBlockRe.exec(block)) !== null) {
      const a = nm[1]
      if (!a.includes('type="primary"')) continue
      const v = /\bvalue="([^"]+)"/.exec(a)
      if (v) { primaryName = v[1]; break }
    }
    if (!primaryName) continue

    const yearMatch = /\byearpublished\b[^>]*\bvalue="(\d+)"/.exec(block)
    results.push({
      id,
      name: decodeEntities(primaryName),
      year: yearMatch ? parseInt(yearMatch[1], 10) : undefined,
    })
  }
  return results.slice(0, 20)
}

function parseThingXml(xml: string): { id: number; name: string; thumbnail: string | null } | null {
  const idMatch = /\bid="(\d+)"/.exec(xml)
  if (!idMatch) return null
  // Find primary name (any attribute order)
  const nameRe = /<name\b([^>]*?)\s*\/?>/g
  let nm: RegExpExecArray | null
  let name = ''
  while ((nm = nameRe.exec(xml)) !== null) {
    if (!nm[1].includes('type="primary"')) continue
    const v = /\bvalue="([^"]+)"/.exec(nm[1])
    if (v) { name = decodeEntities(v[1]); break }
  }
  const thumbMatch = /<thumbnail>\s*([^<\s][^<]*)\s*<\/thumbnail>/.exec(xml)
  return {
    id: parseInt(idMatch[1], 10),
    name,
    thumbnail: thumbMatch ? thumbMatch[1].trim() : null,
  }
}

/** Authenticate with BGG and return session cookies, or null if credentials missing/invalid. */
async function getBggCookies(signal: AbortSignal): Promise<string | null> {
  const username = process.env.BGG_USERNAME
  const password = process.env.BGG_PASSWORD
  if (!username || !password) return null

  try {
    const res = await fetch('https://boardgamegeek.com/login/api/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: { username, password } }),
      signal,
    })
    if (!res.ok) return null

    // Collect all Set-Cookie values
    const raw = res.headers.get('set-cookie')
    if (!raw) return null
    // Each cookie is separated by comma (but values can contain commas too).
    // Split on boundaries like ", cookieName=" to be safe.
    const parts = raw.split(/,\s*(?=[A-Za-z_][^=]+=)/)
    return parts.map(c => c.split(';')[0].trim()).filter(Boolean).join('; ')
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  const id = request.nextUrl.searchParams.get('id')

  if (!q && !id) {
    return NextResponse.json({ error: 'Missing parameter' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    // BGG API requires authentication – login first if credentials are set
    const cookies = await getBggCookies(controller.signal)
    if (!cookies) {
      return NextResponse.json({ error: 'bgg_no_credentials' }, { status: 503 })
    }
    const headers: Record<string, string> = { Cookie: cookies }

    if (q) {
      const bggRes = await fetch(
        `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(q)}&type=boardgame`,
        { signal: controller.signal, headers }
      )
      if (!bggRes.ok) return NextResponse.json({ error: 'BGG error' }, { status: 502 })
      const xml = await bggRes.text()
      return NextResponse.json(parseSearchXml(xml))
    }

    // id-Zweig: nur numerische IDs erlaubt
    const numericId = parseInt(id!, 10)
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const bggRes = await fetch(
      `https://boardgamegeek.com/xmlapi2/thing?id=${numericId}&type=boardgame`,
      { signal: controller.signal, headers }
    )
    if (!bggRes.ok) return NextResponse.json({ error: 'BGG error' }, { status: 502 })
    const xml = await bggRes.text()
    const result = parseThingXml(xml)
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'BGG API timeout' }, { status: 504 })
    }
    return NextResponse.json({ error: 'BGG API error' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
