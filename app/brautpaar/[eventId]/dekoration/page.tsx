import DekoTabContent from '@/components/tabs/DekoTabContent'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function DekorationPage({ params }: Props) {
  const { eventId } = await params
  return (
    <div className="bp-page">
      <DekoTabContent eventId={eventId} mode="brautpaar" />
    </div>
  )
}
