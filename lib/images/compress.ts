// Client-seitige Bildkomprimierung vor dem Upload. Reduziert die Dateigröße
// von Handy-/Kamera-Fotos drastisch (Haupttreiber langsamer Uploads), ohne
// sichtbaren Qualitätsverlust. WebP-Ausgabe erhält Transparenz (wichtig für Logos).

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB (harte Grenze, vor Komprimierung geprüft)
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ACCEPTED_IMAGE_LABEL = 'JPG, PNG oder WebP'

interface CompressOptions {
  maxDim?: number   // längste Kante in px
  quality?: number  // 0..1
}

async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; cleanup: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file)
    return {
      width: bmp.width, height: bmp.height,
      draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
      cleanup: () => bmp.close(),
    }
  }
  // Fallback über <img> + Object-URL
  const url = URL.createObjectURL(file)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('decode failed'))
    el.src = url
  })
  return {
    width: img.naturalWidth, height: img.naturalHeight,
    draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    cleanup: () => URL.revokeObjectURL(url),
  }
}

/**
 * Verkleinert/komprimiert ein Bild. Gibt bei nicht unterstützten Typen oder
 * jedem Fehler die Originaldatei zurück (best effort — blockiert nie den Upload).
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const maxDim = opts.maxDim ?? 2000
  const quality = opts.quality ?? 0.82

  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return file
  if (typeof document === 'undefined') return file

  try {
    const src = await loadBitmap(file)
    const longest = Math.max(src.width, src.height)
    const scale = longest > maxDim ? maxDim / longest : 1
    const w = Math.max(1, Math.round(src.width * scale))
    const h = Math.max(1, Math.round(src.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { src.cleanup(); return file }
    src.draw(ctx, w, h)
    src.cleanup()

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
    if (!blob) return file
    // Nur übernehmen, wenn tatsächlich kleiner (bei bereits kleinen Bildern kann WebP größer sein).
    if (blob.size >= file.size && scale === 1) return file

    const base = file.name.replace(/\.[^.]+$/, '') || 'bild'
    return new File([blob], `${base}.webp`, { type: 'image/webp', lastModified: Date.now() })
  } catch {
    return file
  }
}
