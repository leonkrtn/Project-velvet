export type ChangeArea = 'catering' | 'budget' | 'seating' | 'dienstleister' | 'guests' | 'timeline'
export type ChangeAction = 'create' | 'update' | 'delete'

export interface ChangeData {
  action: ChangeAction
  table: string
  recordId?: string
  description?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

export interface PendingChange {
  id: string
  eventId: string
  area: ChangeArea
  proposedBy: string
  proposerRole: string
  changeData: ChangeData
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewNote?: string
  createdAt: string
  resolvedAt?: string
}
