// Server-only: baut OfferPdfData (inkl. Branding + Logo) aus einer
// vendor_offers-Zeile. Logo wird als Base64-Data-URI eingebettet; schlaegt der
// Abruf fehl, faellt das PDF sauber auf reines Textbranding zurueck.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requestDownloadUrl } from '@/lib/files/worker-client'
import type { OfferPdfData } from './offer-pdf'
import type { Answer } from './questionnaire'

/* eslint-disable @typescript-eslint/no-explicit-any */

async function logoDataUri(key: string | null): Promise<string | null> {
  if (!key) return null
  try {
    const url = await requestDownloadUrl(key)
    const res = await fetch(url)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || 'image/png'
    if (!ct.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:${ct};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export async function buildOfferPdfData(admin: SupabaseClient, offer: any): Promise<OfferPdfData> {
  const { data: v } = await admin
    .from('dienstleister_profiles')
    .select('name, company_name, street, zip, city, email, phone, website, logo_r2_key')
    .eq('id', offer.dienstleister_id)
    .maybeSingle()

  const vendor = (v ?? {}) as any
  const address = [vendor.street, [vendor.zip, vendor.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null

  const si = (offer.standard_info ?? {}) as any

  return {
    vendor: {
      companyName: vendor.company_name || vendor.name || 'Dienstleister',
      address,
      email: vendor.email ?? null,
      phone: vendor.phone ?? null,
      website: vendor.website ?? null,
    },
    logoDataUri: await logoDataUri(vendor.logo_r2_key ?? null),
    offer: {
      lineItems: Array.isArray(offer.line_items) ? offer.line_items : [],
      subtotal: Number(offer.subtotal ?? 0),
      taxMode: offer.tax_mode ?? 'regular',
      taxRate: Number(offer.tax_rate ?? 0),
      taxAmount: Number(offer.tax_amount ?? 0),
      total: Number(offer.total ?? 0),
      currency: offer.currency ?? 'EUR',
      validUntil: offer.valid_until ?? null,
      footerNote: offer.footer_note ?? '',
      vendorNotes: offer.vendor_notes ?? '',
    },
    standardInfo: {
      coupleName: si.coupleName ?? null,
      date: si.date ?? null,
      location: si.location ?? null,
      guestCount: si.guestCount ?? null,
    },
    answers: (Array.isArray(offer.answers) ? offer.answers : []) as Answer[],
    offerNumber: `ANG-${String(offer.request_id ?? offer.id ?? '').slice(0, 8).toUpperCase()}`,
  }
}
