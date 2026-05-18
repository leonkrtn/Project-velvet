import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PdfEventData, PdfMode, PdfSection } from '@/components/pdf/PdfTypes'
import { createElement } from 'react'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { data: PdfEventData; mode: PdfMode; sections: PdfSection[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data, mode, sections } = body

  try {
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { default: VelvetPdfDocument } = await import('@/components/pdf/VelvetPdfDocument')

    const element = createElement(VelvetPdfDocument, { data, mode, sections })
    const buffer = await renderToBuffer(element as React.ReactElement)
    // Buffer extends Uint8Array which is valid BodyInit
    const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)

    return new NextResponse(uint8 as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
