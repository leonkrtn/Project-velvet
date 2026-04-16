import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/auth/callback', '/join']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'your-supabase-url') {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Layer 1: public routes — no auth required
  const isPublic =
    PUBLIC_ROUTES.some(r => pathname === r) ||
    pathname.startsWith('/rsvp/') ||
    pathname.startsWith('/api/')
  if (isPublic) return supabaseResponse

  // Layer 2: must be logged in
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Layer 3: /veranstalter/* organizer check
  // Requires custom_access_token_hook registered in Supabase Dashboard
  // (Authentication → Hooks → Custom Access Token → public.custom_access_token_hook).
  // Without the hook, app_metadata.is_approved_organizer is never set and all
  // organizers would be blocked. Page-level checks handle authorization instead.
  if (pathname.startsWith('/veranstalter/') && pathname !== '/veranstalter/pending') {
    const isApproved = user.app_metadata?.is_approved_organizer === true
    if (isApproved === false && user.app_metadata?.is_approved_organizer !== undefined) {
      const url = request.nextUrl.clone()
      url.pathname = '/veranstalter/pending'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
