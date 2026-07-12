import React from 'react'

// Segmentierte Auswahl oben auf den Registrierungsseiten. Die Solo-Brautpaar-
// Anmeldung steht bewusst zuerst; „Mit Einladungscode" ist die Alternative.
const TABS = [
  { key: 'brautpaar', label: 'Als Brautpaar', href: '/signup/brautpaar' },
  { key: 'code', label: 'Mit Einladungscode', href: '/signup' },
] as const

export default function SignupModeTabs({ active }: { active: 'brautpaar' | 'code' }) {
  return (
    <div className="bp-authx-tabs" role="tablist" aria-label="Registrierungsart">
      {TABS.map(t => (
        <a
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={active === t.key}
          aria-current={active === t.key ? 'page' : undefined}
          className={`bp-authx-tab${active === t.key ? ' is-active' : ''}`}
        >
          {t.label}
        </a>
      ))}
    </div>
  )
}
