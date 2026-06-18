import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export interface VendorOwnerContext {
  userId: string
  /** dienstleister_profiles.id des verknüpften Marktplatz-Profils */
  vendorId: string
  admin: AdminClient
}

/**
 * Stellt sicher, dass der eingeloggte Nutzer ein eigenes Marktplatz-Vendor-
 * Profil besitzt (über user_dienstleister verknüpft). Gibt entweder den Kontext
 * oder eine fertige Fehler-Response zurück. Self-Service-APIs operieren immer
 * über den Admin-Client mit dieser Ownership-Prüfung.
 */
export async function requireVendorOwner(): Promise<
  | { ok: true; ctx: VendorOwnerContext }
  | { ok: false; res: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!link) {
    return { ok: false, res: NextResponse.json({ error: 'Kein Dienstleister-Profil verknüpft' }, { status: 404 }) }
  }

  return { ok: true, ctx: { userId: user.id, vendorId: link.dienstleister_id as string, admin } }
}

/** Vergewissert sich, dass eine Kind-Zeile (Paket/FAQ/Foto) zum eigenen Vendor gehört. */
export async function assertOwnsChild(
  admin: AdminClient,
  table: 'marketplace_packages' | 'marketplace_faqs' | 'marketplace_vendor_photos' | 'marketplace_availability',
  childId: string,
  vendorId: string,
): Promise<boolean> {
  const { data } = await admin.from(table).select('dienstleister_id').eq('id', childId).maybeSingle()
  return !!data && data.dienstleister_id === vendorId
}
