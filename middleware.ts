import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/signup/brautpaar', '/signup/veranstalter', '/signup/dienstleister', '/bewerbung', '/auth/callback', '/join', '/password-reset']

// Fallback-Lebensdauer für „angemeldet bleiben", falls die Frist im fv_pref-
// Cookie fehlt/unlesbar ist. Hält Auth-Cookies persistent (30 Tage).
const REMEMBER_DAYS_SECONDS = 30 * 24 * 60 * 60

type Membership = { event_id: string; role: string }

// Deterministische Portal-Auflösung mit fester Rollen-Priorität
// (brautpaar/brautpaar_solo → veranstalter → dienstleister).
// organizerKnownUnapproved = true, wenn der profiles-Check bereits fehlschlug:
// dann nie auf /veranstalter/events zeigen (sonst Redirect-Loop mit Layer 3),
// sondern auf die Warteseite /veranstalter/pending.
function resolvePortal(
  user: { app_metadata?: Record<string, unknown> },
  memberships: Membership[],
  organizerKnownUnapproved = false,
): string {
  if (!organizerKnownUnapproved && user.app_metadata?.is_approved_organizer === true) {
    return '/veranstalter/events'
  }
  if (user.app_metadata?.role === 'mitarbeiter') return '/mitarbeiter'
  const roles = memberships.map(m => m.role)
  if (roles.includes('brautpaar_solo') || roles.includes('brautpaar')) return '/brautpaar'
  if (roles.includes('veranstalter')) {
    return organizerKnownUnapproved ? '/veranstalter/pending' : '/veranstalter/events'
  }
  if (roles.includes('dienstleister')) return '/vendor/dashboard'
  return '/signup'
}

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
    pathname.startsWith('/einladung/') ||
    pathname.startsWith('/wedding/') ||
    pathname.startsWith('/api/')
  if (isPublic) return supabaseResponse

  // Layer 2: must be logged in
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Layer 2a: „Angemeldet bleiben" durchsetzen.
  // fv_pref hält die beim Login getroffene Wahl, fv_alive ist ein Session-Cookie
  // (vom Browser beim Schließen gelöscht). Siehe lib/auth-persistence.ts.
  //  • 'r:<expiry>' → ausloggen, sobald die 30-Tage-Frist überschritten ist.
  //  • 's'          → ausloggen, sobald die Browser-Sitzung beendet wurde
  //                   (fv_alive fehlt).
  //  • fehlt        → keine Erzwingung (Alt-Session / anderer Login-Weg).
  const pref = request.cookies.get('fv_pref')?.value
  const alive = request.cookies.get('fv_alive')?.value
  let policyLogout = false
  if (pref) {
    if (pref.startsWith('r:')) {
      const expiry = Number(pref.slice(2))
      if (expiry && Date.now() > expiry) policyLogout = true
    } else if (pref === 's' && !alive) {
      policyLogout = true
    }
  }
  if (policyLogout) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    const res = NextResponse.redirect(url)
    // Supabase-Auth-Cookies + eigene Marker entfernen → effektiver Logout.
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith('sb-')) res.cookies.set(c.name, '', { path: '/', maxAge: 0 })
    }
    res.cookies.set('fv_pref', '', { path: '/', maxAge: 0 })
    res.cookies.set('fv_alive', '', { path: '/', maxAge: 0 })
    return res
  }
  // Sitzung gültig: Marker auffrischen. fv_alive ohne max-age bleibt ein
  // Session-Cookie; fv_pref wird server-seitig mit gleichem Wert neu gesetzt
  // (frischt die Speicherdauer auf, u. a. gegen Safari/ITP-Cookie-Kappung).
  if (pref) {
    supabaseResponse.cookies.set('fv_alive', '1', { path: '/', sameSite: 'lax' })
    supabaseResponse.cookies.set('fv_pref', pref, { path: '/', maxAge: 60 * 24 * 60 * 60, sameSite: 'lax' })

    // Auth-Cookies an die gewählte Persistenz angleichen. @supabase/ssr schreibt
    // die sb-*-Cookies beim Login (Browser-Client) teils als Session-Cookies
    // (ohne max-age) → sie verschwinden beim Schließen des Browsers und man ist
    // trotz „30 Tage angemeldet bleiben" wieder ausgeloggt. Deshalb stempeln wir
    // sie hier server-seitig mit expliziter Lebensdauer neu (httpOnly bleibt aus,
    // damit der Browser-Client sie weiter lesen kann).
    const secure = request.nextUrl.protocol === 'https:'
    if (pref.startsWith('r:')) {
      const expiry = Number(pref.slice(2))
      // Absolute Frist: max-age = Restlaufzeit bis zum Ablauf (≤ 30 Tage).
      const maxAge = expiry
        ? Math.max(0, Math.floor((expiry - Date.now()) / 1000))
        : REMEMBER_DAYS_SECONDS
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith('sb-')) {
          supabaseResponse.cookies.set(c.name, c.value, { path: '/', sameSite: 'lax', secure, maxAge })
        }
      }
    } else if (pref === 's') {
      // Nur diese Sitzung: Auth-Cookies bewusst als Session-Cookies (ohne
      // max-age) setzen, damit der Browser sie beim Schließen selbst löscht.
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith('sb-')) {
          supabaseResponse.cookies.set(c.name, c.value, { path: '/', sameSite: 'lax', secure })
        }
      }
    }
  }

  // Layer 2b: /admin/* — only admins (profiles.is_admin)
  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile?.is_admin) {
      const { data: memberships } = await supabase
        .from('event_members')
        .select('event_id, role')
        .eq('user_id', user.id)
      return NextResponse.redirect(new URL(resolvePortal(user, memberships ?? []), request.url))
    }
    return supabaseResponse
  }

  // Layer 3: /veranstalter/* — only approved organizers allowed
  if (pathname.startsWith('/veranstalter/') && pathname !== '/veranstalter/pending') {
    // Fast path: mitarbeiter can never be a veranstalter
    if (user.app_metadata?.role === 'mitarbeiter') {
      return NextResponse.redirect(new URL('/mitarbeiter', request.url))
    }
    // Authoritative check via profiles table (works without app_metadata hook)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved_organizer')
      .eq('id', user.id)
      .single()
    if (!profile?.is_approved_organizer) {
      const { data: memberships } = await supabase
        .from('event_members')
        .select('event_id, role')
        .eq('user_id', user.id)
      return NextResponse.redirect(new URL(resolvePortal(user, memberships ?? [], true), request.url))
    }
  }

  // Layer 4: role guards for brautpaar, vendor, and mitarbeiter portals
  const isBrautpaarRoute = pathname.startsWith('/brautpaar')
  const isVendorRoute = pathname.startsWith('/vendor/dashboard')
  const isMitarbeiterRoute = pathname.startsWith('/mitarbeiter')

  if (isBrautpaarRoute || isVendorRoute || isMitarbeiterRoute) {
    const isMitarbeiter = user.app_metadata?.role === 'mitarbeiter'

    if (isMitarbeiterRoute) {
      if (!isMitarbeiter) {
        const { data: memberships } = await supabase.from('event_members').select('event_id, role').eq('user_id', user.id)
        return NextResponse.redirect(new URL(resolvePortal(user, memberships ?? []), request.url))
      }
      return supabaseResponse
    }

    const { data: memberships } = await supabase
      .from('event_members')
      .select('event_id, role')
      .eq('user_id', user.id)

    const roles = (memberships ?? []).map(m => m.role)

    if (isBrautpaarRoute && !roles.includes('brautpaar') && !roles.includes('brautpaar_solo')) {
      return NextResponse.redirect(new URL(resolvePortal(user, memberships ?? []), request.url))
    }
    if (isVendorRoute && !roles.includes('dienstleister')) {
      // Allow users with no event roles through to the vendor dashboard (new vendors with no events yet).
      // Only redirect if the user clearly belongs to another portal.
      const hasOtherPortalRole =
        roles.includes('brautpaar') ||
        roles.includes('brautpaar_solo') ||
        roles.includes('veranstalter') ||
        user.app_metadata?.role === 'mitarbeiter' ||
        user.app_metadata?.is_approved_organizer === true
      if (hasOtherPortalRole) {
        return NextResponse.redirect(new URL(resolvePortal(user, memberships ?? []), request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // manifest.json/robots/sitemap ausgenommen: der Browser fordert das
    // Manifest ohne Auth-Cookies an — ein Login-Redirect liefert sonst HTML
    // statt JSON ("manifest is not valid JSON data").
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
