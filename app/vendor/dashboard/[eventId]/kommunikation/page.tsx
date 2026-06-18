import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import KommunikationClient from './KommunikationClient'

interface Props { params: Promise<{ eventId: string }> }

export default async function VendorKommunikationPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/vendor/dashboard/${eventId}/kommunikation`)

  return <KommunikationClient eventId={eventId} userId={user.id} />
}
