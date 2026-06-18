import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { requestDownloadUrl } from '@/lib/files/worker-client'
import { SENSITIVE_FIELDS, MARKETPLACE_CATEGORIES, PRICE_RANGES } from '@/lib/marketplace/types'

const INSTANT = ['description', 'email', 'phone', 'website', 'price_range', 'social_links', 'service_cities', 'service_radius_km'] as const

// GET — komplettes eigenes Profil inkl. Fotos, Pakete, FAQ, Verfügbarkeit.
export async function GET() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const [{ data: vendor }, { data: photoRows }, { data: packages }, { data: faqs }, { data: availability }] = await Promise.all([
    admin.from('dienstleister_profiles').select('*').eq('id', vendorId).single(),
    admin.from('marketplace_vendor_photos').select('id, r2_key, sort_order').eq('dienstleister_id', vendorId).order('sort_order'),
    admin.from('marketplace_packages').select('*').eq('dienstleister_id', vendorId).order('sort_order'),
    admin.from('marketplace_faqs').select('*').eq('dienstleister_id', vendorId).order('sort_order'),
    admin.from('marketplace_availability').select('id, day, status').eq('dienstleister_id', vendorId).order('day'),
  ])

  const photos = await Promise.all((photoRows ?? []).map(async p => ({
    id: p.id, sort_order: p.sort_order, url: await requestDownloadUrl(p.r2_key).catch(() => null),
  })))
  const logoUrl = vendor?.logo_r2_key ? await requestDownloadUrl(vendor.logo_r2_key).catch(() => null) : null

  return NextResponse.json({ vendor, logoUrl, photos, packages: packages ?? [], faqs: faqs ?? [], availability: availability ?? [] })
}

function sanitize(key: string, value: unknown): unknown {
  if (key === 'category') {
    return MARKETPLACE_CATEGORIES.some(c => c.key === value) ? value : 'sonstiges'
  }
  if (key === 'price_range') {
    return value && (PRICE_RANGES as readonly string[]).includes(value as string) ? value : null
  }
  if (key === 'service_cities') {
    return Array.isArray(value) ? value.map(v => String(v).trim()).filter(Boolean).slice(0, 30) : []
  }
  if (key === 'service_radius_km') {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 2000) : null
  }
  if (key === 'social_links') {
    if (value && typeof value === 'object') {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === 'string' && v.trim()) out[k] = v.trim()
      }
      return out
    }
    return {}
  }
  if (typeof value === 'string') return value.trim() || null
  return value
}

// PATCH — Profil bearbeiten. Sofort-Felder gehen live; sensible Felder
// (Name/Firma/Kategorie/Adresse/Logo) werden bei einem freigegebenen Profil
// in pending_changes zwischengespeichert (erneute Prüfung), ohne das
// Live-Listing zu verändern.
export async function PATCH(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const { data: current } = await admin
    .from('dienstleister_profiles')
    .select('moderation_status, pending_changes')
    .eq('id', vendorId)
    .single()
  if (!current) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })

  const isApproved = current.moderation_status === 'approved'

  const directPatch: Record<string, unknown> = {}
  const stagedPatch: Record<string, unknown> = { ...(current.pending_changes as Record<string, unknown> | null ?? {}) }

  for (const key of INSTANT) {
    if (key in body) directPatch[key] = sanitize(key, body[key])
  }
  for (const key of SENSITIVE_FIELDS) {
    if (!(key in body)) continue
    const val = sanitize(key, body[key])
    if (isApproved) stagedPatch[key] = val   // → erneute Prüfung
    else directPatch[key] = val              // noch nicht live → direkt übernehmen
  }

  if (isApproved && Object.keys(stagedPatch).length > 0) {
    directPatch.pending_changes = stagedPatch
  }

  if (Object.keys(directPatch).length === 0) {
    return NextResponse.json({ error: 'Keine Änderungen' }, { status: 400 })
  }

  const { error } = await admin.from('dienstleister_profiles').update(directPatch).eq('id', vendorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, hasPendingChanges: !!directPatch.pending_changes })
}
