import { NextRequest } from 'next/server'

// SSRF protection: block private/loopback IP ranges
function isPrivateUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  // Loopback, link-local, private ranges
  return (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^::1$/.test(host) ||
    /^fc00:/i.test(host) ||
    /^fe80:/i.test(host)
  )
}

export async function POST(req: NextRequest) {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const rawUrl = (body.url ?? '').trim()
  if (!rawUrl) return new Response('Missing url', { status: 400 })

  // Allow webcal:// by converting to https
  const normalized = rawUrl.replace(/^webcal:\/\//i, 'https://')

  let parsedUrl: URL
  try {
    parsedUrl = new URL(normalized)
  } catch {
    return new Response('Invalid URL', { status: 400 })
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return new Response('Only http/https/webcal URLs are allowed', { status: 400 })
  }

  if (isPrivateUrl(parsedUrl)) {
    return new Response('Private URLs are not allowed', { status: 400 })
  }

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: { 'User-Agent': 'Terminfinder-CalendarImport/1.0' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      return new Response(`Remote returned ${response.status}`, { status: 502 })
    }

    const text = await response.text()

    // Basic validation: must look like an ICS file
    if (!text.includes('BEGIN:VCALENDAR')) {
      return new Response('URL does not appear to be an ICS/iCal file', { status: 422 })
    }

    return new Response(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return new Response('Timeout fetching URL', { status: 504 })
    }
    return new Response('Failed to fetch URL', { status: 502 })
  }
}
