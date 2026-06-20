// Gemeinsame "Anfrage annehmen"-Logik: Event-Mitgliedschaft, event_dienstleister-
// Verknuepfung, Default-Berechtigungen und Eroeffnung des Chats. Wird von zwei
// Stellen aufgerufen:
//   1. PATCH /api/marketplace/requests/[id]  action:'accept' (Fallback-Anfragen ohne Angebot)
//   2. PATCH /api/vendor/offers/[requestId]  action:'release' (Angebot freigeben)
// Idempotent: kann gefahrlos mehrfach auf dieselbe Anfrage angewandt werden.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AcceptableRequest {
  id: string
  event_id: string
  dienstleister_id: string
  requested_by: string | null
  message?: string | null
}

/**
 * Nimmt eine Marktplatz-Anfrage im Namen des Dienstleister-Users an.
 * Gibt die (ggf. neu erstellte) conversation_id zurueck.
 */
export async function acceptMarketplaceRequest(
  admin: SupabaseClient,
  request: AcceptableRequest,
  vendorUserId: string,
): Promise<string | null> {
  const { data: vendorProfile } = await admin
    .from('dienstleister_profiles')
    .select('category, name, company_name')
    .eq('id', request.dienstleister_id)
    .maybeSingle()

  // 0. Vendor als Event-Mitglied eintragen — sonst greift der Dashboard-Guard.
  await admin.from('event_members').upsert({
    event_id: request.event_id,
    user_id: vendorUserId,
    role: 'dienstleister',
    invited_by: request.requested_by,
  }, { onConflict: 'event_id,user_id' })

  // 1. event_dienstleister verknuepfen (idempotent ueber UNIQUE(event_id, dienstleister_id))
  await admin.from('event_dienstleister').upsert({
    event_id: request.event_id,
    dienstleister_id: request.dienstleister_id,
    user_id: vendorUserId,
    category: vendorProfile?.category ?? 'sonstiges',
    status: 'akzeptiert',
    invited_by: request.requested_by,
    accepted_at: new Date().toISOString(),
  }, { onConflict: 'event_id,dienstleister_id' })

  // 2. Sinnvolle Default-Berechtigungen (Uebersicht lesen, Chat schreiben)
  await admin.from('dienstleister_permissions').upsert([
    { event_id: request.event_id, dienstleister_user_id: vendorUserId, tab_key: 'uebersicht', item_id: null, access: 'read' },
    { event_id: request.event_id, dienstleister_user_id: vendorUserId, tab_key: 'chats', item_id: null, access: 'write' },
  ], { onConflict: 'event_id,dienstleister_user_id,tab_key,item_id' })

  // 3. Chat eroeffnen, falls noch keiner existiert.
  const { data: reqRow } = await admin
    .from('marketplace_requests')
    .select('conversation_id')
    .eq('id', request.id)
    .maybeSingle()
  let conversationId: string | null = (reqRow?.conversation_id as string | null) ?? null

  if (!conversationId) {
    const otherUser = request.requested_by
    const vendorName = vendorProfile?.company_name || vendorProfile?.name || 'Dienstleister'
    const { data: conv } = await admin
      .from('conversations')
      .insert({ event_id: request.event_id, name: `Anfrage · ${vendorName}`, created_by: vendorUserId })
      .select('id')
      .single()
    if (conv) {
      conversationId = conv.id
      const { data: coupleMembers } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', request.event_id)
        .in('role', ['veranstalter', 'brautpaar', 'brautpaar_solo'])
      const ids = new Set<string>([vendorUserId])
      if (otherUser) ids.add(otherUser)
      for (const m of (coupleMembers ?? [])) if (m.user_id) ids.add(m.user_id as string)
      await admin.from('conversation_participants').upsert(
        Array.from(ids).map(uid => ({ conversation_id: conv.id, user_id: uid })),
        { onConflict: 'conversation_id,user_id' },
      )
      if (request.message) {
        await admin.from('messages').insert({
          conversation_id: conv.id, event_id: request.event_id,
          sender_id: otherUser ?? vendorUserId, content: request.message,
        })
      }
    }
  }

  await admin.from('marketplace_requests')
    .update({ status: 'accepted', responded_at: new Date().toISOString(), conversation_id: conversationId })
    .eq('id', request.id)

  return conversationId
}
