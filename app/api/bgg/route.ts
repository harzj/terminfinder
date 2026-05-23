import { NextRequest, NextResponse } from 'next/server'

function getBggToken(): string | null {
  // Keep BGG_API_KEY as backward-compatible fallback, but prefer the new token name.
  const token = process.env.BGG_API_TOKEN?.trim() || process.env.BGG_API_KEY?.trim()
  return token || null
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function parseSearchXml(xml: string): Array<{ id: number; name: string; year?: number; thumbnail_url: string | null }> {
  const results: Array<{ id: number; name: string; year?: number; thumbnail_url: string | null }> = []
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
      thumbnail_url: null,
    })
  }
  return results.slice(0, 20)
}

function parseThingXmlMany(xml: string): Array<{ id: number; thumbnail_url: string | null }> {
  const results: Array<{ id: number; thumbnail_url: string | null }> = []
  const itemRegex = /<item\b([^>]*)>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(xml)) !== null) {
    const attrs = match[1]
    const block = match[2]
    const idMatch = /\bid="(\d+)"/.exec(attrs)
    if (!idMatch) continue
    const thumbMatch = /<thumbnail>\s*([^<\s][^<]*)\s*<\/thumbnail>/.exec(block)
    const thumbnailRaw = thumbMatch ? thumbMatch[1].trim() : null
    const thumbnail_url = thumbnailRaw ? (thumbnailRaw.startsWith('//') ? `https:${thumbnailRaw}` : thumbnailRaw) : null
    results.push({ id: parseInt(idMatch[1], 10), thumbnail_url })
  }
  return results
}

function parseCollectionXml(xml: string): Array<{ id: number; name: string; thumbnail_url: string | null }> {
  const results: Array<{ id: number; name: string; thumbnail_url: string | null }> = []
  const itemRegex = /<item\b([^>]*)>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(xml)) !== null) {
    const attrs = match[1]
    const block = match[2]
    if (!attrs.includes('subtype="boardgame"')) continue
    const idMatch = /\bobjectid="(\d+)"/.exec(attrs)
    if (!idMatch) continue
    const id = parseInt(idMatch[1], 10)
    const nameMatch = /<name\b[^>]*>([\s\S]*?)<\/name>/.exec(block)
    if (!nameMatch) continue
    const name = decodeEntities(nameMatch[1].trim())
    const thumbMatch = /<thumbnail>\s*([^<\s][^<]*?)\s*<\/thumbnail>/.exec(block)
    let thumbnail_url: string | null = null
    if (thumbMatch) {
      const t = thumbMatch[1].trim()
      thumbnail_url = t.startsWith('//') ? `https:${t}` : t
    }
    results.push({ id, name, thumbnail_url })
  }
  return results
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
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Terminfinder/1.0)',
      },
      body: JSON.stringify({ credentials: { username, password } }),
      signal,
    })
    if (!res.ok) return null

    // Node 18+ undici fetch: use getSetCookie() – headers.get('set-cookie') is unreliable
    let rawCookies: string[]
    if (typeof (res.headers as any).getSetCookie === 'function') {
      rawCookies = (res.headers as any).getSetCookie() as string[]
    } else {
      const raw = res.headers.get('set-cookie') ?? ''
      // Split on cookie boundaries (commas before "name=")
      rawCookies = raw ? raw.split(/,\s*(?=[A-Za-z_][^=]+=)/) : []
    }

    if (rawCookies.length === 0) return null
    const cookieStr = rawCookies.map((c: string) => c.split(';')[0].trim()).filter(Boolean).join('; ')
    return cookieStr || null
  } catch {
    return null
  }
}

async function bggFetch(url: string, signal: AbortSignal, cookies?: string): Promise<Response> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; Terminfinder/1.0)',
    'Accept': 'application/xml,text/xml,*/*',
  }
  const token = getBggToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (cookies) headers['Cookie'] = cookies
  return fetch(url, { signal, headers })
}

async function bggFetchWithRetry(
  url: string,
  signal: AbortSignal,
  options?: {
    cookies?: string
    retries?: number
    retryDelayMs?: number
    retryStatuses?: number[]
    allowAuthRetry?: boolean
  }
): Promise<{ response: Response; cookies?: string }> {
  const retries = options?.retries ?? 0
  const retryDelayMs = options?.retryDelayMs ?? 5000
  const retryStatuses = options?.retryStatuses ?? [202, 500, 503]
  const allowAuthRetry = options?.allowAuthRetry ?? true

  let cookies = options?.cookies

  for (let attempt = 0; attempt <= retries; attempt++) {
    let response = await bggFetch(url, signal, cookies)

    if ((response.status === 401 || response.status === 403) && allowAuthRetry && !cookies) {
      const authenticatedCookies = await getBggCookies(signal)
      if (authenticatedCookies) {
        cookies = authenticatedCookies
        response = await bggFetch(url, signal, cookies)
      }
    }

    if (!retryStatuses.includes(response.status) || attempt === retries) {
      return { response, cookies }
    }

    await wait(retryDelayMs)
  }

  throw new Error('unreachable')
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  const id = request.nextUrl.searchParams.get('id')
  const action = request.nextUrl.searchParams.get('action')
  const username = request.nextUrl.searchParams.get('username')

  // Collection endpoint: fetch a user's owned BGG collection
  if (action === 'collection') {
    if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const url = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&excludesubtype=boardgameexpansion`

      // BGG may queue/throttle collection requests.
      const { response: bggRes } = await bggFetchWithRetry(url, controller.signal, {
        retries: 5,
        retryDelayMs: 5000,
        retryStatuses: [202, 500, 503],
      })

      if (bggRes.status === 202) {
        return NextResponse.json({ error: 'bgg_timeout' }, { status: 503 })
      }

      if (!bggRes.ok) {
        return NextResponse.json({ error: `BGG error ${bggRes.status}` }, { status: 502 })
      }

      const xml = await bggRes.text()
      const items = parseCollectionXml(xml)
      return NextResponse.json(items)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return NextResponse.json({ error: 'bgg_timeout' }, { status: 503 })
      }
      return NextResponse.json({ error: 'BGG API error' }, { status: 502 })
    } finally {
      clearTimeout(timeout)
    }
  }

  if (!q && !id) {
    return NextResponse.json({ error: 'Missing parameter' }, { status: 400 })
  }

  // Validate id parameter
  let numericId: number | null = null
  if (id) {
    numericId = parseInt(id, 10)
    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const url = q
      ? `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(q)}&type=boardgame`
      : `https://boardgamegeek.com/xmlapi2/thing?id=${numericId}&type=boardgame`

    const { response: bggRes } = await bggFetchWithRetry(url, controller.signal, {
      retries: 2,
      retryDelayMs: 5000,
      retryStatuses: [202, 500, 503],
    })

    if (bggRes.status === 202) {
      return NextResponse.json({ error: 'BGG still processing' }, { status: 503 })
    }

    if (!bggRes.ok) {
      return NextResponse.json({ error: `BGG error ${bggRes.status}` }, { status: 502 })
    }

    const xml = await bggRes.text()
    if (q) {
      const searchResults = parseSearchXml(xml)
      if (searchResults.length === 0) return NextResponse.json(searchResults)

      const ids = searchResults.map(result => result.id).join(',')
      const thingUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${ids}&type=boardgame`

      try {
        const { response: thingRes } = await bggFetchWithRetry(thingUrl, controller.signal, {
          retries: 1,
          retryDelayMs: 5000,
          retryStatuses: [202, 500, 503],
        })

        if (thingRes.ok) {
          const thingXml = await thingRes.text()
          const thumbnailMap = new Map(parseThingXmlMany(thingXml).map(item => [item.id, item.thumbnail_url]))
          return NextResponse.json(
            searchResults.map(result => ({
              ...result,
              thumbnail_url: thumbnailMap.get(result.id) ?? null,
            }))
          )
        }
      } catch {
        // Fall back to plain search results when thumbnail enrichment fails.
      }

      return NextResponse.json(searchResults)
    }

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
