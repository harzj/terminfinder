import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/anmelden', '/registrieren', '/auth/callback']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Einladungs-Links sind öffentlich
  if (pathname.startsWith('/einladen/')) {
    return supabaseResponse
  }

  // Öffentlicher Kalender-Abo-Link (für externe Clients wie Google/Apple)
  if (pathname.startsWith('/api/calendar/')) {
    return supabaseResponse
  }

  // Öffentliche Routen – eingeloggte Nutzer zur Startseite weiterleiten
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    if (user) {
      return NextResponse.redirect(new URL('/verfuegbarkeit', request.url))
    }
    return supabaseResponse
  }

  // Alle anderen Routen – nicht eingeloggte Nutzer zum Login
  if (!user) {
    return NextResponse.redirect(new URL('/anmelden', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
