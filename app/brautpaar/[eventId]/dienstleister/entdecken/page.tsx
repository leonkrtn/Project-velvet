import MarktplatzClient from './MarktplatzClient'

export const dynamic = 'force-dynamic'

export default async function EntdeckenPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  return <MarktplatzClient eventId={eventId} />
}
