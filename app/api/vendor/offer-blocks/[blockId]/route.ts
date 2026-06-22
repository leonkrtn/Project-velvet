import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'

// DELETE — eigenen Baustein loeschen.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { blockId } = await params
  const { error } = await admin
    .from('vendor_offer_blocks')
    .delete()
    .eq('id', blockId)
    .eq('dienstleister_id', vendorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
