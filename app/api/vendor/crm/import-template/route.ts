import { NextResponse } from 'next/server'

const HEADERS = [
  'Name', 'E-Mail', 'Telefon',
  'Straße & Hausnummer', 'PLZ & Ort',
  'Wohnstraße', 'Wohn-PLZ', 'Wohnort',
  'Status', 'Quelle', 'Veranstaltungstyp', 'Hochzeitsdatum', 'Geburtstag',
  'Veranstaltungsort', 'Gästeanzahl',
  'Umsatz', 'Priorität', 'Notizen',
]

const HINTS = [
  'Pflicht: Vor- und Nachname', 'email@beispiel.de', '+49 123 456789',
  'Musterstraße 1', '12345 Berlin',
  'Wohnstraße 5', '80331', 'München',
  'lead / anfrage / gebucht / ehemalig', 'empfehlung / marktplatz / website / messe / sonstige', 'hochzeit / firmenevent / privat / sonstige', 'JJJJ-MM-TT', 'JJJJ-MM-TT',
  'Schloss Neuschwanstein', '120',
  '3500', 'standard / vip / grosskunde', 'Freie Notiz',
]

const bom = '﻿'

export async function GET() {
  const csv = [HEADERS.join(','), HINTS.map(h => `"${h}"`).join(',')].join('\r\n')

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="crm-import-vorlage.csv"',
    },
  })
}
