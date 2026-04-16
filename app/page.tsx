'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    async function redirect() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      let isOrganizer = session.user.app_metadata?.is_approved_organizer === true
      if (!isOrganizer) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_approved_organizer')
          .eq('id', session.user.id)
          .single()
        isOrganizer = profile?.is_approved_organizer === true
      }
      if (isOrganizer) {
        router.replace('/veranstalter/events')
        return
      }

      const { data: memberships } = await supabase
        .from('event_members')
        .select('event_id')
        .eq('user_id', session.user.id)
        .limit(1)

      if (memberships && memberships.length > 0) {
        router.replace('/dashboard?event=' + memberships[0].event_id)
      } else {
        router.replace('/signup')
      }
    }

    redirect()
  }, [router])

  return null
}
