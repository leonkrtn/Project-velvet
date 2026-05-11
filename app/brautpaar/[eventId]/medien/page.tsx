import MediaTabContent from '@/components/tabs/MediaTabContent'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function MedienPage({ params }: Props) {
  const { eventId } = await params
  return (
    <div className="bp-page">
      <MediaTabContent eventId={eventId} mode="brautpaar" />
    </div>
  )
}
