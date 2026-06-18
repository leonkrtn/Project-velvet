import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureVendorConversation } from '@/lib/vendor/ensureChat'
import KommunikationClient from './KommunikationClient'

interface Props { params: Promise<{ eventId: string }> }

export default async function VendorKommunikationPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/vendor/dashboard/${eventId}/kommunikation`)

  // Guarantee a chat with the couple/organizer exists, no matter which join
  // path the vendor used. Best-effort — never block rendering on this.
  try {
    const admin = createAdminClient()
    await ensureVendorConversation(admin, eventId, user.id)
  } catch { /* ignore */ }

  return <KommunikationClient eventId={eventId} userId={user.id} />
}
