import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'

const KINDS = ['reminder', 'review_request', 'followup_offer', 'followup_lead'] as const
type Kind = typeof KINDS[number]

// Sinnvolle Standard-Regeln beim ersten Aufruf.
const DEFAULTS: { kind: Kind; offset_days: number; label: string }[] = [
  { kind: 'reminder', offset_days: 14, label: 'Finale Details & Gästezahl' },
  { kind: 'reminder', offset_days: 3, label: 'Letzte Abstimmung vor dem Event' },
  { kind: 'review_request', offset_days: 3, label: 'Bewertungsanfrage nach dem Event' },
  { kind: 'followup_offer', offset_days: 5, label: 'Offenes Angebot nachfassen' },
  { kind: 'followup_lead', offset_days: 7, label: 'Inaktive Leads erinnern' },
]

function num(v: unknown): number { const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10); return Number.isFinite(n) ? n : 0 }

// GET — eigene Automatisierungen (legt beim ersten Mal Defaults an).
export async function GET() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  let { data } = await admin.from('vendor_automations').select('*').eq('dienstleister_id', vendorId).order('kind').order('offset_days')
  if (!data || data.length === 0) {
    await admin.from('vendor_automations').insert(DEFAULTS.map(d => ({
      dienstleister_id: vendorId, kind: d.kind, event_type: 'all', offset_days: d.offset_days, label: d.label, enabled: true,
    })))
    const reload = await admin.from('vendor_automations').select('*').eq('dienstleister_id', vendorId).order('kind').order('offset_days')
    data = reload.data ?? []
  }
  return NextResponse.json({ automations: data })
}

// PUT — Regeln komplett ersetzen. Body: { automations: [{kind, event_type, offset_days, label, enabled}] }
export async function PUT(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const body = await req.json().catch(() => ({})) as { automations?: unknown }
  const list = Array.isArray(body.automations) ? body.automations : []

  const rows = list
    .map((a: Record<string, unknown>) => ({
      dienstleister_id: vendorId,
      kind: KINDS.includes(a.kind as Kind) ? a.kind as Kind : null,
      event_type: (a.event_type as string)?.trim() || 'all',
      offset_days: Math.max(0, Math.min(365, num(a.offset_days))),
      label: (a.label as string)?.trim() || '',
      enabled: a.enabled !== false,
    }))
    .filter(r => r.kind)

  await admin.from('vendor_automations').delete().eq('dienstleister_id', vendorId)
  if (rows.length) {
    const { error } = await admin.from('vendor_automations').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
