// Server-only: Helfer fuer Angebots-Varianten (vendor_offer_variants).
// Varianten sind eine optionale Zusatzfunktion zu vendor_offers — der Standardfall
// bleibt ein Angebot ohne Varianten.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recomputeTotals, type LineItem } from './pricing'
import { sanitizeLineItems, num } from './offer-service'
import type { TaxMode } from './questionnaire'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface OfferVariant {
  id: string
  offer_id: string
  name: string
  line_items: LineItem[]
  subtotal: number
  tax_amount: number
  total: number
  sort_order: number
  is_selected: boolean
}

export async function listVariants(admin: SupabaseClient, offerId: string): Promise<OfferVariant[]> {
  const { data } = await admin
    .from('vendor_offer_variants')
    .select('*')
    .eq('offer_id', offerId)
    .order('sort_order', { ascending: true })
  return (data ?? []) as OfferVariant[]
}

/** Berechnet Summen einer Variante mit den Steuer-/Waehrungseinstellungen des Eltern-Angebots. */
export function computeVariantTotals(
  rawItems: unknown,
  offer: { tax_mode: string; tax_rate: number; currency: string },
): { lineItems: LineItem[]; subtotal: number; taxAmount: number; total: number } {
  const items = sanitizeLineItems(rawItems)
  const totals = recomputeTotals(items, {
    taxMode: offer.tax_mode as TaxMode,
    taxRate: num(offer.tax_rate),
    currency: offer.currency ?? 'EUR',
    validUntil: null,
    footerNote: '',
  })
  return { lineItems: totals.lineItems, subtotal: totals.subtotal, taxAmount: totals.taxAmount, total: totals.total }
}

/**
 * Liefert eine Kopie des Angebots, in der line_items + Summen durch die Variante
 * ersetzt sind — fuer das pro-Variante-PDF.
 */
export function applyVariantToOffer(offer: any, variant: OfferVariant): any {
  return {
    ...offer,
    line_items: variant.line_items,
    subtotal: variant.subtotal,
    tax_amount: variant.tax_amount,
    total: variant.total,
  }
}
