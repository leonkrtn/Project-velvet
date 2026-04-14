import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { TrauzeugePermissions } from '@/lib/types/roles'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createServiceClient(url, serviceKey)
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && authData.user) {
      const userId = authData.user.id
      const inviteCode = authData.user.user_metadata?.invite_code as string | undefined

      if (inviteCode) {
        // Invite-Code einlösen
        const admin = getServiceClient()

        // Code validieren
        const { data: codeRow } = await admin
          .from('invite_codes')
          .select('*')
          .eq('code', inviteCode)
          .eq('used', false)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()

        if (codeRow) {
          const role = codeRow.role as string
          const eventId = codeRow.event_id as string
          const metadata = codeRow.metadata as any

          // Event-Mitgliedschaft erstellen
          await admin.from('event_members').upsert(
            { event_id: eventId, user_id: userId, role },
            { onConflict: 'event_id,user_id', ignoreDuplicates: true }
          )

          // Trauzeuge: Permissions aus Invite-Metadata übernehmen
          if (role === 'trauzeuge' && metadata?.permissions) {
            const perms = metadata.permissions as Partial<TrauzeugePermissions>
            await admin.from('trauzeuge_permissions').upsert({
              event_id: eventId,
              user_id: userId,
              can_view_guests: perms.canViewGuests ?? true,
              can_edit_guests: perms.canEditGuests ?? false,
              can_view_seating: perms.canViewSeating ?? true,
              can_edit_seating: perms.canEditSeating ?? true,
              can_view_budget: perms.canViewBudget ?? false,
              can_view_catering: perms.canViewCatering ?? false,
              can_view_timeline: perms.canViewTimeline ?? true,
              can_edit_timeline: perms.canEditTimeline ?? false,
              can_view_vendors: perms.canViewVendors ?? false,
              can_manage_deko: perms.canManageDeko ?? true,
            }, { onConflict: 'event_id,user_id' })
          }

          // Dienstleister: user_dienstleister + event_dienstleister.user_id setzen
          if (role === 'dienstleister' && metadata?.event_dienstleister_id) {
            const edId = metadata.event_dienstleister_id as string

            // event_dienstleister Row abrufen um dienstleister_id zu bekommen
            const { data: edRow } = await admin
              .from('event_dienstleister')
              .select('dienstleister_id')
              .eq('id', edId)
              .maybeSingle()

            if (edRow) {
              // user_dienstleister verknüpfen
              await admin.from('user_dienstleister').upsert(
                { user_id: userId, dienstleister_id: edRow.dienstleister_id },
                { onConflict: 'user_id,dienstleister_id', ignoreDuplicates: true }
              )
              // event_dienstleister mit user_id + accepted_at updaten
              await admin.from('event_dienstleister').update({
                user_id: userId,
                accepted_at: new Date().toISOString(),
                status: 'aktiv',
              }).eq('id', edId)
            }
          }

          // Invite-Code als verwendet markieren
          await admin.from('invite_codes').update({
            used: true,
            used_by: userId,
          }).eq('id', codeRow.id)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error — redirect to login
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
