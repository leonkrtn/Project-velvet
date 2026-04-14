export interface AuditEntry {
  id: string
  eventId: string
  actorId: string
  actorName?: string
  actorRole: string
  action: string
  tableName: string
  recordId?: string
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
  createdAt: string
}
