import PatisserieTabContent from '@/components/tabs/PatisserieTabContent'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function PatisseriePage({ params }: Props) {
  const { eventId } = await params
  return (
    <div className="bp-page">
      <PatisserieTabContent eventId={eventId} mode="brautpaar" />
    </div>
  )
}
