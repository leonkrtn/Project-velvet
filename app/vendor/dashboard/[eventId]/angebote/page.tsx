import AngeboteClient from './AngeboteClient'

export default async function VendorAngebotePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  return <AngeboteClient eventId={eventId} />
}
