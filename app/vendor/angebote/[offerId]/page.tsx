import OfferEditorFull from '@/components/vendor/OfferEditorFull'

export default async function StandaloneOfferEditorPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params
  return <OfferEditorFull eventId={null} offerId={offerId} />
}
