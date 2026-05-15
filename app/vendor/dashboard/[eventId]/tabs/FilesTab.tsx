'use client'
import FilesSection from '@/components/files/FilesSection'

interface Props {
  eventId: string
  userId: string
  canUpload: boolean
}

export default function FilesTab({ eventId, userId, canUpload }: Props) {
  return (
    <FilesSection
      eventId={eventId}
      module="files"
      canUpload={canUpload}
      userId={userId}
      userRole="dienstleister"
    />
  )
}
