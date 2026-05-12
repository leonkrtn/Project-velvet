import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FilesSection from '@/components/files/FilesSection'

interface Props { params: Promise<{ eventId: string }> }

export default async function BrautpaarDateienPage({ params }: Props) {
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

  if (!member || (member.role !== 'brautpaar' && member.role !== 'veranstalter')) {
    redirect('/login')
  }

  return (
    <FilesSection
      eventId={eventId}
      canUpload={member.role === 'brautpaar' || member.role === 'veranstalter'}
      userId={user.id}
      isVeranstalter={member.role === 'veranstalter'}
    />
  )
}
