import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface Props {
  children:  React.ReactNode
  params:    Promise<{ eventId: string }>
}

export default async function VendorDashboardLayout({ children, params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/vendor/dashboard/${eventId}`)

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'dienstleister') redirect('/vendor/join')

  return <>{children}</>
}
