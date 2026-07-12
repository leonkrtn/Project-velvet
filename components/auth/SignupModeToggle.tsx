'use client'

import React from 'react'

export type SignupMode = 'brautpaar' | 'code' | 'dienstleister'

// Zwei optisch getrennte Gruppen im selben Segmented-Design:
// [ Als Brautpaar | Brautpaar mit Einladungscode ]   [ Als Dienstleister ]
const GROUPS: { key: SignupMode; label: string }[][] = [
  [
    { key: 'brautpaar', label: 'Als Brautpaar' },
    { key: 'code', label: 'Brautpaar mit Einladungscode' },
  ],
  [
    { key: 'dienstleister', label: 'Als Dienstleister' },
  ],
]

export default function SignupModeToggle({
  mode, onChange,
}: {
  mode: SignupMode
  onChange: (m: SignupMode) => void
}) {
  return (
    <div className="bp-authx-toggle-row" role="tablist" aria-label="Registrierungsart">
      {GROUPS.map((group, gi) => (
        <div className="bp-authx-toggle-group" key={gi}>
          {group.map(item => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={mode === item.key}
              className={`bp-authx-toggle-btn${mode === item.key ? ' is-active' : ''}`}
              onClick={() => onChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
