import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ eventId: string }>
}

// Aufgaben und Notizen sind unter „Aufgaben & Notizen" zusammengefasst.
export default async function AufgabenRedirect({ params }: Props) {
  const { eventId } = await params
  redirect(`/brautpaar/${eventId}/aufgaben-notizen`)
}
