import React from 'react'

type FootLink = { label: string; href: string }

/**
 * Einheitlicher, aufgeräumter Fuß für die Auth-Karten:
 * eine primäre „Anmelden"-Zeile und optional dezente Alternativ-Links
 * (statt mehrerer gleichwertiger „Frage? Link"-Zeilen).
 */
export default function AuthFooter({
  loginPrompt = true,
  registerPrompt = false,
  alts = [],
}: {
  loginPrompt?: boolean
  registerPrompt?: boolean
  alts?: FootLink[]
}) {
  return (
    <div className="bp-authx-foot">
      {loginPrompt && (
        <p className="bp-authx-foot-primary">
          Bereits registriert? <a href="/login" className="bp-auth-link">Anmelden</a>
        </p>
      )}
      {registerPrompt && (
        <p className="bp-authx-foot-primary">
          Noch kein Konto? <a href="/signup/brautpaar" className="bp-auth-link">Registrieren</a>
        </p>
      )}
      {alts.length > 0 && (
        <div className="bp-authx-foot-alts">
          {alts.map(a => (
            <a key={a.href} href={a.href} className="bp-authx-foot-alt">{a.label}</a>
          ))}
        </div>
      )}
    </div>
  )
}
