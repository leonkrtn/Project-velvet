import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function VendorDashboardPage({ params }: Props) {
  const { eventId } = await params
  redirect(`/vendor/dashboard/${eventId}/uebersicht`)
}
