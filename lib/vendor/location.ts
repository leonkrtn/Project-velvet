// Auflösung des angezeigten Dienstleister-Orts mit Fallback auf die
// allgemeine Firmenadresse (Migration 0127).
//
// Reihenfolge: Marktplatz-Listing-Ort (street/zip/city) hat Vorrang. Ist dort
// nichts hinterlegt, wird die allgemeine Firmenadresse (company_street/
// company_zip/company_city) als Fallback verwendet — sowohl feldweise
// (für die Stadt allein) als auch für die volle Adresse.

export interface VendorLocationSource {
  street?: string | null
  zip?: string | null
  city?: string | null
  company_street?: string | null
  company_zip?: string | null
  company_city?: string | null
}

export interface ResolvedVendorLocation {
  street: string | null
  zip: string | null
  city: string | null
  /** true, wenn die allgemeine Firmenadresse als Fallback verwendet wurde (Marktplatz-Ort war leer) */
  isFallback: boolean
}

function nonEmpty(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t ? t : null
}

/**
 * Liefert den anzuzeigenden Ort eines Dienstleisters: Marktplatz-Listing-Ort
 * (street/zip/city), falls vorhanden — sonst Fallback auf die allgemeine
 * Firmenadresse (company_street/company_zip/company_city).
 *
 * Die Entscheidung fällt anhand der Stadt (city), da sie das Pflichtfeld im
 * Marktplatz-Listing ist: ist `city` gesetzt, gilt der Marktplatz-Block als
 * "hinterlegt" und wird komplett (inkl. street/zip) verwendet, auch wenn
 * einzelne Teilfelder leer sind. Ist `city` leer, wird komplett auf die
 * allgemeine Firmenadresse umgeschaltet.
 */
export function resolveVendorLocation(vendor: VendorLocationSource): ResolvedVendorLocation {
  const marketplaceCity = nonEmpty(vendor.city)
  if (marketplaceCity) {
    return {
      street: nonEmpty(vendor.street),
      zip: nonEmpty(vendor.zip),
      city: marketplaceCity,
      isFallback: false,
    }
  }

  const companyCity = nonEmpty(vendor.company_city)
  if (companyCity) {
    return {
      street: nonEmpty(vendor.company_street),
      zip: nonEmpty(vendor.company_zip),
      city: companyCity,
      isFallback: true,
    }
  }

  return { street: null, zip: null, city: null, isFallback: false }
}

/** Bequemer Zugriff, wenn nur der Stadtname benötigt wird (z.B. Karten, Badges). */
export function resolveVendorCity(vendor: VendorLocationSource): string | null {
  return resolveVendorLocation(vendor).city
}

/** Formatiert die aufgelöste Adresse als einzeiligen String, z.B. für Maps-Embeds. */
export function formatVendorAddress(vendor: VendorLocationSource): string | null {
  const loc = resolveVendorLocation(vendor)
  const parts = [loc.street, [loc.zip, loc.city].filter(Boolean).join(' ')].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}
