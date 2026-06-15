import { buildThemeCss, fontHrefFor, type DisplaySettings } from '@/lib/display-settings'

// Server-Komponente: injiziert das gescopte Theme-CSS (Klasse .bp-display-root)
// und ggf. den Google-Font-Link für die gewählte Überschriften-Schrift.
// Inhalt ist rein aus validierten Settings erzeugt (sicher).
export default function DisplayTheme({ settings }: { settings: DisplaySettings }) {
  const href = fontHrefFor(settings.headingFont)
  return (
    <>
      {href && <link rel="stylesheet" href={href} />}
      <style dangerouslySetInnerHTML={{ __html: buildThemeCss(settings) }} />
    </>
  )
}
