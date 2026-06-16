'use client'

import { useState } from 'react'
import { Paintbrush } from 'lucide-react'
import DesignStudioModal from './DesignStudioModal'

// Einstiegspunkt: Button öffnet das Design-Studio (Lightbox) für Anzeige + RSVP.
export default function DisplaySettingsLauncher({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bp-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: 'var(--bp-gold-pale)', color: 'var(--bp-gold-deep)', flexShrink: 0 }}>
          <Paintbrush size={20} />
        </span>
        <div>
          <h2 className="bp-section-title" style={{ margin: 0 }}>Anzeige &amp; RSVP gestalten</h2>
          <p className="bp-caption" style={{ margin: '2px 0 0', maxWidth: 460 }}>
            Farben, Schriften, Bilder und das RSVP-Formular eurer öffentlichen Einladungsseite – mit Live-Vorschau.
          </p>
        </div>
      </div>
      <button type="button" className="bp-btn bp-btn-primary" onClick={() => setOpen(true)}>
        Gestalten
      </button>
      {open && <DesignStudioModal eventId={eventId} onClose={() => setOpen(false)} />}
    </div>
  )
}
