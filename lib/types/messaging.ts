export interface Conversation {
  id: string
  eventId: string
  title?: string
  participantRoles: string[]  // leer = alle Rollen
  createdBy: string
  createdAt: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName?: string  // joined from profiles
  content: string
  createdAt: string
  editedAt?: string
}
