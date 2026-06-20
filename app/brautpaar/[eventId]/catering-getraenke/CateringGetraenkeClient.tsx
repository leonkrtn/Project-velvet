'use client'

import { useState } from 'react'
import CateringForm from '@/components/catering/CateringForm'
import GetraenkeTabContent from '@/components/tabs/GetraenkeTabContent'

interface EventData {
  id: string
  meal_options: string[] | null
  menu_type: string | null
  collect_allergies: boolean | null
  children_allowed: boolean
  children_note: string | null
}

type Tab = 'catering' | 'getraenke'

const TABS: { key: Tab; label: string }[] = [
  { key: 'catering',  label: 'Catering' },
  { key: 'getraenke', label: 'Getränke' },
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

      <div className="bp-step-tabs">
        {TABS.map((tab, idx) => (
          <button
            key={tab.key}
            className="bp-step-tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="bp-step-tab-num">{idx + 1}</span>
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
