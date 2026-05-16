import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requestDownloadUrl } from '@/lib/files/worker-client'
import ProfilClient from './ProfilClient'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar_r2_key')
    .eq('id', user.id)
    .single()

  const p = profile as { name: string | null; avatar_r2_key?: string | null } | null

  // Generate presigned download URL for display (1h TTL)
  let avatarPresignedUrl: string | null = null
  if (p?.avatar_r2_key) {
    try {
      avatarPresignedUrl = await requestDownloadUrl(p.avatar_r2_key)
    } catch {
      // Non-fatal
    }
  }

  return (
    <Suspense>
      <ProfilClient
        userId={user.id}
        initialName={p?.name ?? ''}
        initialEmail={user.email ?? ''}
        initialAvatarUrl={avatarPresignedUrl}
      />
    </Suspense>
  )
}
