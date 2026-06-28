// Reine Preislogik fuer Auto-Angebote. Keine Seiteneffekte, kein DB-Zugriff —
// damit sowohl serverseitig (Angebot erzeugen) als auch fuer Client-Vorschau
// nutzbar. Quelle der Wahrheit nach Erzeugung sind die line_items; diese
// Funktion baut sie EINMAL aus den Antworten. Spaetere Dienstleister-Edits
// ueberschreiben die line_items (siehe recomputeTotals()).

import type { Answer, Questionnaire, TaxMode, PriceTier } from './questionnaire'

// Positionstypen im Angebots-Editor:
//   qty      — Menge x Einzelpreis (Standard)
//   flat     — Pauschale (Festpreis, Menge wird ignoriert)
//   discount — Nachlass/Rabatt (zaehlt negativ in die Summe)
//   optional — vom Brautpaar zu-/abwaehlbar (zaehlt nur wenn `selected`)
export type LineItemType = 'qty' | 'flat' | 'discount' | 'optional'

export interface LineItem {
  label: string
  qty: number
  unitPrice: number
  total: number
  /** Default 'qty', wenn nicht gesetzt (Abwaertskompatibilitaet). */
  type?: LineItemType
  /** Nur fuer type='optional': vom Brautpaar gewaehlt (Default true). */
  selected?: boolean
}

/** Effektiver Betrag, mit dem eine Position in die Summe eingeht. */
export function effectiveLineTotal(li: LineItem): number {
  const type = li.type ?? 'qty'
  const qty = num(li.qty)
  const unit = num(li.unitPrice)
  if (type === 'optional' && li.selected === false) return 0
  if (type === 'flat') return round2(unit)
  if (type === 'discount') return -Math.abs(round2(qty > 0 ? qty * unit : unit))
  return round2(qty * unit)
}

export interface OfferTotals {
  lineItems: LineItem[]
  subtotal: number
  taxMode: TaxMode
  taxRate: number
  taxAmount: number
  total: number
  currency: string
  validUntil: string | null
  footerNote: string
}

export interface StandardInfo {
  coupleName?: string | null
  date?: string | null
  guestCount?: number | null
  location?: string | null
  /** PLZ des Veranstaltungsorts — fuer Anfahrts-Zonen (best effort). */
  postalCode?: string | null
  eventType?: string | null
  budget?: number | null
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

function isWeekend(dateStr?: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

/** Sucht den Pro-Einheit-Preis einer Mengenstaffel fuer `qty`. null = keine Stufe passt. */
function tierUnitPrice(tiers: PriceTier[] | undefined, qty: number): number | null {
  if (!Array.isArray(tiers) || tiers.length === 0) return null
  for (const t of tiers) {
    const min = num(t.min)
    const max = t.max == null ? Infinity : num(t.max)
    if (qty >= min && qty <= max) return round2(num(t.unitPrice))
  }
  return null
}

/**
 * Prueft, ob `dateStr` in einen Saison-Bereich faellt. Unterstuetzt feste Daten
 * ('YYYY-MM-DD') und jaehrlich wiederkehrende Bereiche ('MM-DD', inkl. Jahreswechsel).
 */
function inSeason(dateStr: string | null | undefined, from: string, to: string): boolean {
  if (!dateStr || !from || !to) return false
  const recurring = from.length <= 5 || to.length <= 5
  if (recurring) {
    const md = dateStr.slice(5) // 'MM-DD'
    const f = from.slice(-5), t = to.slice(-5)
    return f <= t ? (md >= f && md <= t) : (md >= f || md <= t) // Bereich ueber den Jahreswechsel
  }
  return dateStr >= from && dateStr <= to
}

/** Berechnet Steuer + Gesamtsumme aus gegebenen line_items. */
export function recomputeTotals(
  lineItems: LineItem[],
  opts: { taxMode: TaxMode; taxRate: number; currency: string; validUntil: string | null; footerNote: string },
): OfferTotals {
  // Pro Position den effektiven Betrag (Typ-abhaengig) frisch berechnen und in
  // `total` zuruecklegen, damit die gespeicherten line_items konsistent sind.
  const normalized = lineItems.map(li => ({ ...li, total: effectiveLineTotal(li) }))
  const subtotal = round2(normalized.reduce((s, li) => s + num(li.total), 0))
  const taxRate = opts.taxMode === 'regular' ? num(opts.taxRate) : 0
  const taxAmount = round2(subtotal * (taxRate / 100))
  return {
    lineItems: normalized,
    subtotal,
    taxMode: opts.taxMode,
    taxRate,
    taxAmount,
    total: round2(subtotal + taxAmount),
    currency: opts.currency,
    validUntil: opts.validUntil,
    footerNote: opts.footerNote,
  }
}

/** Baut das initiale Auto-Angebot aus Fragebogen + Antworten + Eventdaten. */
export function computeOffer(
  q: Questionnaire,
  answers: Answer[],
  info: StandardInfo,
): OfferTotals {
  const items: LineItem[] = []
  const answerById = new Map(answers.map(a => [a.questionId, a]))

  // 1. Grundpreis
  if (num(q.base_price) > 0) {
    items.push({ label: 'Grundpreis', qty: 1, unitPrice: round2(num(q.base_price)), total: round2(num(q.base_price)) })
  }

  // 2. Pro-Gast-Pauschale — mit Mengenstaffel (guest_tiers) falls definiert.
  const guests = num(info.guestCount)
  if (guests > 0) {
    const tierUnit = tierUnitPrice(q.guest_tiers, guests)
    const unit = tierUnit != null ? tierUnit : round2(num(q.per_guest_price))
    if (unit > 0) {
      items.push({ label: `Pro Gast (${guests})`, qty: guests, unitPrice: unit, total: round2(unit * guests) })
    }
  }

  // 3. Frage-Positionen
  // Baut eine Position aus einem Einzelpreis. perGuest → Menge = Gaestezahl,
  // sonst Pauschale (Menge 1). optional → Brautpaar kann sie ab-/zuwaehlen.
  function priced(label: string, price: number, perGuest: boolean, optional: boolean): LineItem | null {
    if (price === 0) return null
    // perGuest: Menge = Gaestezahl (falls bekannt), sonst 1 — aber stets als
    // „pro Gast" kenntlich, damit der Dienstleister die Menge anpassen kann.
    const qty = perGuest ? (guests > 0 ? guests : 1) : 1
    const unit = round2(price)
    const li: LineItem = {
      label: perGuest ? `${label} (pro Gast${guests > 0 ? `, ${guests}` : ''})` : label,
      qty, unitPrice: unit, total: round2(unit * qty),
      type: optional ? 'optional' : 'qty',
    }
    if (optional) li.selected = true
    return li
  }

  for (const section of q.sections) {
    for (const question of section.questions) {
      const ans = answerById.get(question.id)
      if (!ans) continue
      const optional = question.pricing?.optional === true

      if (question.type === 'number') {
        const mode = question.pricing?.mode
        if (mode === 'per_unit') {
          const qty = num(ans.value)
          // Mengenstaffel der Frage hat Vorrang vor dem festen unitPrice.
          const tierUnit = tierUnitPrice(question.pricing?.tiers, qty)
          const unit = tierUnit != null ? tierUnit : num(question.pricing?.unitPrice)
          if (qty !== 0 && unit !== 0) {
            const unitLabel = question.pricing?.unitLabel?.trim()
            const li: LineItem = {
              label: unitLabel ? `${question.label} (${qty} ${unitLabel})` : question.label,
              qty, unitPrice: round2(unit), total: round2(unit * qty),
              type: optional ? 'optional' : 'qty',
            }
            if (optional) li.selected = true
            items.push(li)
          }
        }
      } else if (question.type === 'boolean') {
        const yes = ans.value === true || ans.value === 'true'
        if (yes) {
          const li = priced(question.label, num(question.pricing?.price), question.pricing?.perGuest === true, optional)
          if (li) items.push(li)
        }
      } else if (question.type === 'single') {
        const selected = question.options.find(o => o.id === ans.value)
        if (selected) {
          const li = priced(`${question.label}: ${selected.label}`, num(selected.price), selected.perGuest === true, optional)
          if (li) items.push(li)
        }
      } else if (question.type === 'multi') {
        const ids = Array.isArray(ans.value) ? (ans.value as string[]) : []
        for (const oid of ids) {
          const opt = question.options.find(o => o.id === oid)
          if (opt) {
            const li = priced(`${question.label}: ${opt.label}`, num(opt.price), opt.perGuest === true, optional)
            if (li) items.push(li)
          }
        }
      }
    }
  }

  // 4. Wochenend-Aufschlag (auf die Leistungs-Summe vor Zuschlaegen)
  const baseSum = items.reduce((s, li) => s + li.total, 0)
  const pct = num(q.weekend_surcharge_pct)
  if (pct > 0 && isWeekend(info.date)) {
    const surcharge = round2(baseSum * (pct / 100))
    if (surcharge !== 0) items.push({ label: `Wochenend-Aufschlag (${pct}%)`, qty: 1, unitPrice: surcharge, total: surcharge })
  }

  // 4b. Saison-/Datumsregeln — percent auf dieselbe Leistungs-Summe, flat als Pauschale.
  for (const rule of (q.season_rules ?? [])) {
    if (!inSeason(info.date, rule.from, rule.to)) continue
    if (rule.mode === 'percent') {
      const amount = round2(baseSum * (num(rule.value) / 100))
      if (amount !== 0) items.push({ label: rule.label || `Saison-Aufschlag (${num(rule.value)}%)`, qty: 1, unitPrice: amount, total: amount })
    } else {
      const amount = round2(num(rule.value))
      if (amount !== 0) items.push({ label: rule.label || 'Saison-Pauschale', qty: 1, unitPrice: amount, total: amount })
    }
  }

  // 4c. Anfahrt/Reisekosten — PLZ-Zone als optionale Position (km-Modus: manuell im Editor).
  if (q.travel_mode === 'zones' || q.travel_mode === 'both') {
    const plz = (info.postalCode ?? '').trim()
    if (plz) {
      const zone = (q.travel_zones ?? [])
        .filter(z => z.plzPrefix && plz.startsWith(String(z.plzPrefix).trim()))
        .sort((a, b) => String(b.plzPrefix).length - String(a.plzPrefix).length)[0] // laengstes Praefix gewinnt
      if (zone && num(zone.price) !== 0) {
        items.push({
          label: `Anfahrt: ${zone.label || zone.plzPrefix}`,
          qty: 1, unitPrice: round2(num(zone.price)), total: round2(num(zone.price)),
          type: 'optional', selected: true,
        })
      }
    }
  }

  // 5. Mindestbestellwert auffuellen
  const running = items.reduce((s, li) => s + li.total, 0)
  const minTotal = num(q.min_total)
  if (minTotal > 0 && running < minTotal) {
    const diff = round2(minTotal - running)
    items.push({ label: 'Anpassung Mindestbestellwert', qty: 1, unitPrice: diff, total: diff })
  }

  const validUntil = q.valid_days > 0
    ? new Date(Date.now() + q.valid_days * 86400000).toISOString().slice(0, 10)
    : null

  return recomputeTotals(items, {
    taxMode: q.tax_mode,
    taxRate: q.tax_rate,
    currency: q.currency,
    validUntil,
    footerNote: q.footer_note,
  })
}

export type DepositType = 'none' | 'percent' | 'fixed'

/** Berechnet Anzahlung + Restbetrag aus dem Gesamtbetrag. */
export function computeDeposit(total: number, depositType: DepositType, depositValue: number): { deposit: number; balance: number } {
  const t = round2(num(total))
  if (depositType === 'percent') {
    const dep = Math.min(t, round2(t * (num(depositValue) / 100)))
    return { deposit: dep, balance: round2(t - dep) }
  }
  if (depositType === 'fixed') {
    const dep = Math.min(t, round2(num(depositValue)))
    return { deposit: dep, balance: round2(t - dep) }
  }
  return { deposit: 0, balance: t }
}
