'use client'

import { useState } from 'react'
import { UtensilsCrossed, GlassWater } from 'lucide-react'
import CateringForm, { type EventData } from '@/components/catering/CateringForm'
import GetraenkeTabContent from '@/components/tabs/GetraenkeTabContent'

type Tab = 'catering' | 'getraenke'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'catering',  label: 'Catering',  icon: <UtensilsCrossed size={16} /> },
  { key: 'getraenke', label: 'Getränke',  icon: <GlassWater size={16} /> },
]

interface Props {
  eventId: string
  initialEvent: EventData
  initialPlan: Record<string, unknown> | null
  confirmedGuestCount: number
  mealCounts: Record<string, number>
  allergyCounts: Record<string, number>
  getraenkeGuestCount: number
  initialTab: Tab
}

export default function CateringGetraenkeClient({
  eventId, initialEvent, initialPlan,
  confirmedGuestCount, mealCounts, allergyCounts, getraenkeGuestCount, initialTab,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Catering &amp; Getränke</h1>
      </div>

      <div className="bp-toggle" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className="bp-toggle-option"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ minHeight: 480 }}>
        {activeTab === 'catering' && (
          <CateringForm
            eventId={eventId}
            initialEvent={initialEvent}
            initialPlan={initialPlan}
            initialCosts={[]}
            confirmedGuestCount={confirmedGuestCount}
            mealCounts={mealCounts}
            allergyCounts={allergyCounts}
            hideCosts
            embedded
          />
        )}
        {activeTab === 'getraenke' && (
          <GetraenkeTabContent eventId={eventId} mode="brautpaar" guestCount={getraenkeGuestCount} embedded />
        )}
      </div>
    </div>
  )
}
