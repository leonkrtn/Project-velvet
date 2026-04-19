import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function EventRootPage({ params }: Props) {
  const { eventId } = await params
  redirect(`/veranstalter/${eventId}/uebersicht`)
}
