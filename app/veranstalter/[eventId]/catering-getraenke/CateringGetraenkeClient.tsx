'use client'

import { useState } from 'react'
import { UtensilsCrossed, GlassWater } from 'lucide-react'
import CateringForm, { type EventData, type OrganizerCost } from '@/components/catering/CateringForm'
import GetraenkeTabContent from '@/components/tabs/GetraenkeTabContent'

type Tab = 'catering' | 'getraenke'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'catering',  label: 'Catering',  icon: <UtensilsCrossed size={15} /> },
  { key: 'getraenke', label: 'Getränke',  icon: <GlassWater size={15} /> },
]

interface Props {
  eventId: string
  initialEvent: EventData
  initialPlan: Record<string, unknown> | null
  initialCosts: OrganizerCost[]
  confirmedGuestCount: number
  mealCounts: Record<string, number>
  allergyCounts: Record<string, number>
  getraenkeGuestCount: number
  initialTab: Tab
}

export default function CateringGetraenkeClient({
  eventId, initialEvent, initialPlan, initialCosts,
  confirmedGuestCount, mealCounts, allergyCounts, getraenkeGuestCount, initialTab,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', margin: '0 0 6px' }}>
        Catering &amp; Getränke
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        Menükonzept, Service und Getränkeplanung an einem Ort.
      </p>

      {/* Segmented tab switcher */}
      <div style={{
        display: 'inline-flex', gap: 4, padding: 4, marginBottom: 24,
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px',
                borderRadius: 7, border: 'none', cursor: 'pointer',
                background: active ? 'var(--surface)' : 'transparent',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 14, fontWeight: active ? 600 : 450, fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </div>

      <div style={{ minHeight: 420 }}>
        {activeTab === 'catering' && (
          <CateringForm
            eventId={eventId}
            initialEvent={initialEvent}
            initialPlan={initialPlan}
            initialCosts={initialCosts}
            confirmedGuestCount={confirmedGuestCount}
            mealCounts={mealCounts}
            allergyCounts={allergyCounts}
            embedded
          />
        )}
        {activeTab === 'getraenke' && (
          <GetraenkeTabContent eventId={eventId} mode="veranstalter" guestCount={getraenkeGuestCount} embedded />
        )}
      </div>
    </div>
  )
}
