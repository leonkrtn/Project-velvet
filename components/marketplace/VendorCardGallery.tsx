'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Kleine, wiederverwendbare Bilder-Slider-Komponente fuer Marktplatz-Vorschaukarten.
// Zeigt mehrere Galerie-Bilder eines Anbieters direkt in der Karte (kein Lightbox-Klick
// noetig). Pfeile + Punkte navigieren clientseitig und stoppen die Event-Propagation,
// damit der umschliessende <Link> (Klick auf die Karte -> Detailseite) nicht ausgeloest
// wird. Bei nur einem (oder keinem) Bild werden keine Steuerelemente angezeigt.
export default function VendorCardGallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0)

  if (images.length === 0) return null

  const hasMultiple = images.length > 1
  const current = images[Math.min(index, images.length - 1)]

  function go(e: React.MouseEvent, dir: 1 | -1) {
    e.preventDefault()
    e.stopPropagation()
    setIndex(i => (i + dir + images.length) % images.length)
  }

  function goTo(e: React.MouseEvent, i: number) {
    e.preventDefault()
    e.stopPropagation()
    setIndex(i)
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current} alt={alt} />
      {hasMultiple && (
        <>
          <button
            type="button"
            aria-label="Vorheriges Bild"
            onClick={e => go(e, -1)}
            className="mp-gallery-arrow mp-gallery-arrow-left"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Nächstes Bild"
            onClick={e => go(e, 1)}
            className="mp-gallery-arrow mp-gallery-arrow-right"
          >
            <ChevronRight size={16} />
          </button>
          <div className="mp-gallery-dots" onClick={e => { e.preventDefault(); e.stopPropagation() }}>
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Bild ${i + 1} anzeigen`}
                onClick={e => goTo(e, i)}
                className="mp-gallery-dot"
                data-active={i === index}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
