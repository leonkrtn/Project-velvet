import type { Metadata } from 'next'
import React from 'react'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'FOREVR | Dienstleister' }
import { createAdminClient } from '@/lib/supabase/admin'
import VendorSidebarShell from '@/components/vendor/VendorSidebarShell'
import { requestDownloadUrl } from '@/lib/files/worker-client'

function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean)
  if (w.length === 0) return '?'
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase()
  return (w[0][0] + w[w.length - 1][0]).toUpperCase()
}

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  let companyName = ''
  let companyInitials = '?'
  let category = ''
  let logoUrl: string | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const admin = createAdminClient()
      const { data: link } = await admin
        .from('user_dienstleister')
        .select('dienstleister_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (link) {
        const { data: vendor } = await admin
          .from('dienstleister_profiles')
          .select('name, company_name, category, logo_r2_key, pending_changes')
          .eq('id', link.dienstleister_id)
          .maybeSingle()
        if (vendor) {
          // Freigegebene Profile stagen Namens-/Kategorie-/Logo-Änderungen in
          // pending_changes (öffentliches Listing bleibt bis zur Prüfung alt).
          // Der interne Header soll aber sofort den neu eingegebenen Wert zeigen.
          const pending = (vendor.pending_changes as Record<string, unknown> | null) ?? {}
          const pendCompany = (pending.company_name as string | undefined)?.trim()
          const pendCategory = (pending.category as string | undefined)?.trim()
          const pendLogo = pending.logo_r2_key as string | undefined
          companyName = (pendCompany || (vendor.company_name as string) || (vendor.name as string) || '').trim()
          companyInitials = initials(companyName || (vendor.name as string) || '')
          category = pendCategory || (vendor.category as string) || ''
          const logoKey = pendLogo ?? (vendor.logo_r2_key as string | null)
          if (logoKey) {
            logoUrl = await requestDownloadUrl(logoKey).catch(() => null)
          }
        }
      }
    }
  } catch {
    // silent — shell renders without data
  }

  return (
    <VendorSidebarShell
      companyName={companyName}
      companyInitials={companyInitials}
      category={category}
      logoUrl={logoUrl ?? undefined}
    >
      {children}
    </VendorSidebarShell>
  )
}
