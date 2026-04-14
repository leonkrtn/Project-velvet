'use client'
import { useEvent } from '@/lib/event-context'

export default function FrozenBanner() {
  const { isEventFrozen } = useEvent()
  if (!isEventFrozen) return null

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: '#1a1a2e', color: '#e2b96f',
      borderBottom: '1px solid #e2b96f33',
      padding: '10px 16px', textAlign: 'center',
      fontSize: 13, fontWeight: 600, letterSpacing: '0.02em',
    }}>
      Daten sind eingefroren — keine Änderungen möglich
    </div>
  )
}
