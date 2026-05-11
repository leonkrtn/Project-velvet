import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function BrautpaarRootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/brautpaar')

  // Find the brautpaar's event
  const { data: member } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('user_id', user.id)
    .in('role', ['brautpaar', 'veranstalter'])
    .order('joined_at', { ascending: false })
    .limit(1)
    .single()

  if (member?.event_id) {
    redirect(`/brautpaar/${member.event_id}/uebersicht`)
  }

  redirect('/login')
}
