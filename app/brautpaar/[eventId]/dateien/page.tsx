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

  if (!member || !['brautpaar', 'brautpaar_solo', 'veranstalter'].includes(member.role)) {
    redirect('/login')
  }

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Dateien</h1>
        <p className="bp-page-subtitle">Dokumente und Dateien für euer Event.</p>
      </div>
      <FilesSection
        eventId={eventId}
        canUpload={['brautpaar', 'brautpaar_solo', 'veranstalter'].includes(member.role)}
        userId={user.id}
        isVeranstalter={member.role === 'veranstalter' || member.role === 'brautpaar_solo'}
        userRole={member.role}
        hideTitle
      />
    </div>
  )
}
