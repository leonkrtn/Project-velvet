import BrautpaarHelpClient from './BrautpaarHelpClient'

// Layout/Middleware sichern den Zugriff aufs Brautpaar-Portal bereits ab —
// die Hilfe-Seite braucht keine eigenen Daten.
export default function BrautpaarHilfePage() {
  return <BrautpaarHelpClient />
}
