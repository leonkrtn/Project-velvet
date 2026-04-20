import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import JoinClient from './JoinClient'

interface Props {
  searchParams: Promise<{ code?: string }>
}

export default async function VendorJoinPage({ searchParams }: Props) {
  const { code } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const next = code ? `/vendor/join?code=${code}` : '/vendor/join'
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  return <JoinClient initialCode={code ?? ''} />
}
