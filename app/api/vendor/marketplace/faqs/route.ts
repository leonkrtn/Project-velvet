import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'

export async function GET() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { data } = await admin.from('marketplace_faqs').select('*').eq('dienstleister_id', vendorId).order('sort_order')
  return NextResponse.json({ faqs: data ?? [] })
}

// POST — neue FAQ. Body: { question, answer? }
export async function POST(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const question = (body.question as string)?.trim()
  if (!question) return NextResponse.json({ error: 'Frage erforderlich' }, { status: 400 })

  const { count } = await admin.from('marketplace_faqs').select('id', { count: 'exact', head: true }).eq('dienstleister_id', vendorId)
  const { data, error } = await admin.from('marketplace_faqs').insert({
    dienstleister_id: vendorId,
    question,
    answer: (body.answer as string)?.trim() || '',
    sort_order: count ?? 0,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id })
}
