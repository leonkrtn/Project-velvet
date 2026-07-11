// Geteilter Client-Helfer für Vendor-Bild-Uploads (Logo/Galerie) mit
// Komprimierung, Validierung und echtem Fortschritt (XHR). Wird vom
// Anbieter-Profil-Editor und vom Onboarding-Wizard genutzt.

import { compressImage, MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES, ACCEPTED_IMAGE_LABEL } from '@/lib/images/compress'

export type VendorImageKind = 'logo' | 'photo'

export class UploadError extends Error {}

function validate(file: File) {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new UploadError(`Dieses Dateiformat wird nicht unterstützt. Bitte ${ACCEPTED_IMAGE_LABEL} verwenden.`)
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError('Das Bild ist zu groß (max. 10 MB).')
  }
}

function xhrPut(url: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError('Upload fehlgeschlagen.')))
    xhr.onerror = () => reject(new UploadError('Upload fehlgeschlagen.'))
    xhr.send(file)
  })
}

/**
 * Validiert, komprimiert und lädt ein Vendor-Bild hoch. Gibt den R2-Key zurück.
 * `onProgress` liefert 0..100 während des PUT. Wirft `UploadError` mit
 * benutzerfreundlicher Meldung.
 */
export async function uploadVendorImage(
  file: File,
  kind: VendorImageKind,
  onProgress?: (pct: number) => void,
): Promise<string> {
  validate(file)
  const prepared = await compressImage(file).catch(() => file)

  const res = await fetch('/api/vendor/marketplace/upload', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, contentType: prepared.type }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new UploadError(d.error ?? 'Upload-URL konnte nicht erstellt werden.')
  }
  const { uploadUrl, key } = await res.json()
  await xhrPut(uploadUrl, prepared, onProgress)
  return key
}
