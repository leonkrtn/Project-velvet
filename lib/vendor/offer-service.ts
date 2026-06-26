// Server-only: gemeinsame Helfer fuer die Angebots-APIs (Laden, Sanitizing,
// Totals, Patch-Bau). Haelt die Route-Handler schlank.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveLineTotal, recomputeTotals, type LineItem, type LineItemType, type DepositType } from './pricing'
import type { TaxMode } from './questionnaire'

const LINE_TYPES: LineItemType[] = ['qty', 'flat', 'discount', 'optional']
const DEPOSIT_TYPES: DepositType[] = ['none', 'percent', 'fixed']

export function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

/** Normalisiert eingehende line_items inkl. Typ + optionaler Auswahl. */
export function sanitizeLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((li: Record<string, unknown>) => {
    const type = (LINE_TYPES.includes(li.type as LineItemType) ? li.type : 'qty') as LineItemType
    const item: LineItem = {
      label: (li.label as string)?.trim() || 'Position',
      qty: num(li.qty) || (type === 'flat' || type === 'discount' ? 1 : 0),
      unitPrice: num(li.unitPrice),
      total: 0,
      type,
    }
    if (type === 'optional') item.selected = li.selected !== false
    item.total = effectiveLineTotal(item)
    return item
  })
}

export interface ClientInfo {
  client_name?: string
  client_address_line1?: string
  client_address_line2?: string
  client_email?: string
  client_phone?: string
}

export interface OfferEditFields {
  title?: string
  lineItems?: unknown
  vendorNotes?: string
  validUntil?: string
  depositType?: unknown
  depositValue?: unknown
  depositDueDays?: unknown
  balanceDueNote?: string
  paymentTerms?: string
  agbText?: string
  agbRequired?: boolean
  clientInfo?: ClientInfo
}

/** Baut den DB-Patch fuer save/release aus den editierbaren Feldern. */
export function buildOfferPatch(body: OfferEditFields, offer: {
  tax_mode: string; tax_rate: number; currency: string; valid_until: string | null; footer_note: string
}): Record<string, unknown> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if ('lineItems' in body) {
    const items = sanitizeLineItems(body.lineItems)
    const totals = recomputeTotals(items, {
      taxMode: offer.tax_mode as TaxMode, taxRate: num(offer.tax_rate),
      currency: offer.currency ?? 'EUR', validUntil: offer.valid_until ?? null, footerNote: offer.footer_note ?? '',
    })
    patch.line_items = totals.lineItems
    patch.subtotal = totals.subtotal
    patch.tax_amount = totals.taxAmount
    patch.total = totals.total
  }
  if (typeof body.title === 'string') patch.title = body.title.trim() || 'Angebot'
  if ('vendorNotes' in body) patch.vendor_notes = String(body.vendorNotes ?? '')
  if ('validUntil' in body) patch.valid_until = (body.validUntil as string) || null
  if ('depositType' in body) patch.deposit_type = DEPOSIT_TYPES.includes(body.depositType as DepositType) ? body.depositType : 'none'
  if ('depositValue' in body) patch.deposit_value = num(body.depositValue)
  if ('depositDueDays' in body) patch.deposit_due_days = body.depositDueDays == null || body.depositDueDays === '' ? null : Math.round(num(body.depositDueDays))
  if ('balanceDueNote' in body) patch.balance_due_note = String(body.balanceDueNote ?? '')
  if ('paymentTerms' in body) patch.payment_terms = String(body.paymentTerms ?? '')
  if ('agbText' in body) patch.agb_text = String(body.agbText ?? '')
  if (typeof body.agbRequired === 'boolean') patch.agb_required = body.agbRequired
  if ('clientInfo' in body && body.clientInfo && typeof body.clientInfo === 'object') {
    patch.standard_info = body.clientInfo
  }

  return patch
}

export async function loadOwnedOffer(admin: SupabaseClient, offerId: string, vendorId: string) {
  const { data: offer } = await admin.from('vendor_offers').select('*').eq('id', offerId).maybeSingle()
  if (!offer || offer.dienstleister_id !== vendorId) return null
  return offer
}
