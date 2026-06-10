export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

export default function DekoKonfigurationRedirect() {
  redirect('/veranstalter/konfiguration')
}
