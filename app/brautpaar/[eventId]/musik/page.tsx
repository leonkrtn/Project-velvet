import MusikTabContent from '@/components/tabs/MusikTabContent'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function MusikPage({ params }: Props) {
  const { eventId } = await params
  return (
    <div className="bp-page">
      <MusikTabContent eventId={eventId} mode="brautpaar" />
    </div>
  )
}
