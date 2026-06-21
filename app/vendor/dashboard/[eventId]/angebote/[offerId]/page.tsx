import OfferEditorFull from '@/components/vendor/OfferEditorFull'

export default async function VendorOfferEditorPage({ params }: { params: Promise<{ eventId: string; offerId: string }> }) {
  const { eventId, offerId } = await params
  return <OfferEditorFull eventId={eventId} offerId={offerId} />
}
