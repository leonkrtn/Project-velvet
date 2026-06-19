// app/brautpaar/[eventId]/website/page.tsx — Editor der Hochzeitswebsite
import WebsiteEditorClient from './WebsiteEditorClient'
import './website.css'

export const dynamic = 'force-dynamic'

export default async function WebsitePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  return <WebsiteEditorClient eventId={eventId} />
}
