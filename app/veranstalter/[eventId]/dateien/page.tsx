import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FilesSection from '@/components/files/FilesSection'

interface Props { params: Promise<{ eventId: string }> }

export default async function VeranstalterDateienPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || member.role !== 'veranstalter') redirect('/veranstalter')

  return (
    <FilesSection
      eventId={eventId}
      canUpload
      userId={user.id}
      isVeranstalter
    />
  )
}
