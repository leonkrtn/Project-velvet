import { createClient } from '@/lib/supabase/server'
import { loadCrmContacts } from '@/lib/vendor/crm-contacts'
import CrmClient, { type Contact } from './CrmClient'

export const dynamic = 'force-dynamic'

export default async function CrmPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const initialContacts = user ? await loadCrmContacts(user.id) : []

  return <CrmClient initialContacts={initialContacts as Contact[]} />
}
