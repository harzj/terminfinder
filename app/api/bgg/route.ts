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
  // Match each boardgame item block
  const itemRegex = /<item\s[^>]*type="boardgame"[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(xml)) !== null) {
    const id = parseInt(match[1], 10)
    const block = match[2]
    const primaryName = /name[^>]+type="primary"[^>]+value="([^"]+)"/.exec(block)
    if (!primaryName) continue
    const yearMatch = /yearpublished[^>]+value="(\d+)"/.exec(block)
    results.push({
      id,
      name: decodeEntities(primaryName[1]),
      year: yearMatch ? parseInt(yearMatch[1], 10) : undefined,
    })
  }
  return results.slice(0, 20)
}

function parseThingXml(xml: string): { id: number; name: string; thumbnail: string | null } | null {
  const idMatch = /<item\s[^>]*id="(\d+)"/.exec(xml)
  if (!idMatch) return null
  const nameMatch = /<name[^>]+type="primary"[^>]+value="([^"]+)"/.exec(xml)
  const thumbMatch = /<thumbnail>\s*([^<\s][^<]*)\s*<\/thumbnail>/.exec(xml)
  return {
    id: parseInt(idMatch[1], 10),
    name: nameMatch ? decodeEntities(nameMatch[1]) : '',
    thumbnail: thumbMatch ? thumbMatch[1].trim() : null,
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  const id = request.nextUrl.searchParams.get('id')

  if (!q && !id) {
    return NextResponse.json({ error: 'Missing parameter' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    if (q) {
      const bggRes = await fetch(
        `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(q)}&type=boardgame`,
        { signal: controller.signal }
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
      { signal: controller.signal }
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
