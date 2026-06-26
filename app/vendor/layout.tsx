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
          .select('name, company_name, category, logo_r2_key')
          .eq('id', link.dienstleister_id)
          .maybeSingle()
        if (vendor) {
          companyName = ((vendor.company_name as string) || (vendor.name as string) || '').trim()
          companyInitials = initials(companyName || (vendor.name as string) || '')
          category = (vendor.category as string) || ''
          if (vendor.logo_r2_key) {
            logoUrl = await requestDownloadUrl(vendor.logo_r2_key as string).catch(() => null)
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
