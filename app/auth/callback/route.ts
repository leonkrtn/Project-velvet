import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // If caller provided explicit next (not default), honor it
  if (next !== '/') {
    return NextResponse.redirect(`${origin}${next}`)
  }

  // Role-based redirect
  const user = data.session.user

  // Check app_metadata first (requires custom_access_token_hook to be registered),
  // then fall back to profiles table directly
  let isOrganizer = user.app_metadata?.is_approved_organizer === true
  if (!isOrganizer) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved_organizer')
      .eq('id', user.id)
      .single()
    isOrganizer = profile?.is_approved_organizer === true
  }

  if (isOrganizer) {
    return NextResponse.redirect(`${origin}/veranstalter/events`)
  }

  const { data: memberships } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('user_id', user.id)
    .limit(1)

  if (memberships && memberships.length > 0) {
    return NextResponse.redirect(`${origin}/dashboard?event=${memberships[0].event_id}`)
  }

  return NextResponse.redirect(`${origin}/signup`)
}
