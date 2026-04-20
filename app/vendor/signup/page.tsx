import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VendorSignupClient from './VendorSignupClient'

interface Props {
  searchParams: Promise<{ code?: string }>
}

export default async function VendorSignupPage({ searchParams }: Props) {
  const { code } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/vendor/dashboard')

  return <VendorSignupClient initialCode={code ?? ''} />
}
