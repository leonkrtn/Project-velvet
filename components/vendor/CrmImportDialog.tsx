'use client'

import React, { useMemo, useState } from 'react'
import { X, Upload, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react'

// Zielfelder fuer das freie Spalten-Mapping (muessen mit der Import-Route uebereinstimmen).
const FIELDS: { key: string; label: string; required?: boolean; guess: string[] }[] = [
  { key: 'name', label: 'Name', required: true, guess: ['name'] },
  { key: 'email', label: 'E-Mail', guess: ['e-mail', 'email', 'mail'] },
  { key: 'phone', label: 'Telefon', guess: ['telefon', 'phone', 'tel', 'handy', 'mobil'] },
  { key: 'address_line1', label: 'Adresse (Straße)', guess: ['straße & hausnummer', 'adresse', 'address', 'straße', 'strasse'] },
  { key: 'address_line2', label: 'Adresse (PLZ & Ort)', guess: ['plz & ort', 'plz & stadt', 'adresszusatz', 'city'] },
  { key: 'home_street', label: 'Wohnstraße', guess: ['wohnstraße', 'home_street'] },
  { key: 'home_postal_code', label: 'Wohn-PLZ', guess: ['wohn-plz', 'home_postal_code'] },
  { key: 'home_city', label: 'Wohnort', guess: ['wohnort', 'home_city'] },
  { key: 'lifecycle_stage', label: 'Status', guess: ['status', 'stage', 'lifecycle'] },
  { key: 'source', label: 'Quelle', guess: ['quelle', 'source'] },
  { key: 'priority', label: 'Priorität', guess: ['priorität', 'prioritaet', 'priority'] },
  { key: 'wedding_date', label: 'Hochzeits-/Eventdatum', guess: ['hochzeitsdatum', 'wedding_date', 'datum', 'date'] },
  { key: 'birthday', label: 'Geburtstag', guess: ['geburtstag', 'birthday'] },
  { key: 'location', label: 'Veranstaltungsort', guess: ['veranstaltungsort', 'location', 'ort'] },
  { key: 'guest_count', label: 'Gästeanzahl', guess: ['gästeanzahl', 'gaesteanzahl', 'guest_count', 'gäste', 'gaeste'] },
  { key: 'deal_value', label: 'Umsatz / Wert', guess: ['umsatz', 'deal_value', 'wert', 'value'] },
  { key: 'notes', label: 'Notizen', guess: ['notizen', 'notes', 'anmerkungen'] },
]

function parseCSV(text: string): string[][] {
  const clean = text.startsWith('﻿') ? text.slice(1) : text
  const lines = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  // Trennzeichen erraten: Semikolon oder Komma (deutsche Exporte nutzen oft ;).
  const delim = (lines[0]?.split(';').length ?? 1) > (lines[0]?.split(',').length ?? 1) ? ';' : ','
  return lines.map(line => {
    const cells: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ
      } else if (ch === delim && !inQ) { cells.push(cur); cur = '' } else cur += ch
    }
    cells.push(cur)
    return cells.map(c => c.trim())
  })
}

const NONE = -1

export default function CrmImportDialog({ file, onClose, onImported }: {
  file: File
  onClose: () => void
  onImported: (count: number) => void
}) {
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Datei einmal parsen + Mapping erraten.
  React.useEffect(() => {
    let cancelled = false
    file.text().then(text => {
      if (cancelled) return
      const all = parseCSV(text)
      if (all.length < 2) { setErr('Die Datei enthält keine Datenzeilen.'); return }
      const headers = all[0]
      const rows = all.slice(1)
      const lower = headers.map(h => h.toLowerCase().trim())
      const guessed: Record<string, number> = {}
      for (const f of FIELDS) {
        const idx = lower.findIndex(h => f.guess.some(g => h === g))
          // exakter Treffer bevorzugt, sonst "enthält"
        const fallback = idx < 0 ? lower.findIndex(h => f.guess.some(g => h.includes(g))) : idx
        guessed[f.key] = fallback >= 0 ? fallback : NONE
      }
      setParsed({ headers, rows })
      setMapping(guessed)
    }).catch(() => setErr('Datei konnte nicht gelesen werden.'))
    return () => { cancelled = true }
  }, [file])

  const nameMapped = (mapping.name ?? NONE) >= 0
  const preview = useMemo(() => parsed?.rows.slice(0, 3) ?? [], [parsed])

  async function runImport() {
    if (!parsed || !nameMapped) { setErr('Bitte ordne mindestens die Spalte „Name" zu.'); return }
    setBusy(true); setErr('')
    const res = await fetch('/api/vendor/crm/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: parsed.rows, mapping }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErr(json.error ?? 'Import fehlgeschlagen'); return }
    onImported(json.imported ?? 0)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(15,15,15,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, width: 720, maxWidth: '100%', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <Upload size={18} style={{ color: 'var(--gold, #B89968)' }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>CSV-Import — Spalten zuordnen</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-dim)' }}>{file.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: 20 }}>
          {!parsed && !err && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: 13, padding: '20px 0' }}>
              <Loader2 size={16} className="bp-spin" /> Datei wird gelesen…
            </div>
          )}
          {err && <p style={{ color: 'var(--red, #C5221F)', fontSize: 13, margin: '0 0 14px' }}>{err}</p>}

          {parsed && (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '0 0 16px', lineHeight: 1.5 }}>
                Ordne deine CSV-Spalten den Forevr-Feldern zu. Wir haben passende Spalten bereits vorausgewählt — du kannst alles anpassen. <strong>{parsed.rows.length}</strong> Datenzeilen erkannt.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                {FIELDS.map(f => (
                  <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ flex: '0 0 42%', fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                      {f.label}{f.required && <span style={{ color: 'var(--red, #C5221F)' }}> *</span>}
                    </label>
                    <ArrowRight size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                    <select
                      value={mapping[f.key] ?? NONE}
                      onChange={e => setMapping(m => ({ ...m, [f.key]: parseInt(e.target.value, 10) }))}
                      style={{ flex: 1, minWidth: 0, padding: '7px 8px', fontSize: 12.5, border: `1px solid ${f.required && (mapping[f.key] ?? NONE) < 0 ? 'var(--red, #C5221F)' : 'var(--border)'}`, borderRadius: 7, background: '#fff', fontFamily: 'inherit', color: 'var(--text)' }}
                    >
                      <option value={NONE}>— nicht importieren —</option>
                      {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `Spalte ${i + 1}`}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Vorschau */}
              {preview.length > 0 && nameMapped && (
                <div style={{ marginTop: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', margin: '0 0 8px' }}>Vorschau</p>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          {FIELDS.filter(f => (mapping[f.key] ?? NONE) >= 0).map(f => (
                            <th key={f.key} style={{ textAlign: 'left', padding: '6px 8px', background: 'var(--bg)', color: 'var(--text-dim)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, ri) => (
                          <tr key={ri}>
                            {FIELDS.filter(f => (mapping[f.key] ?? NONE) >= 0).map(f => (
                              <td key={f.key} style={{ padding: '6px 8px', color: 'var(--text)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row[mapping[f.key]] ?? ''}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', flex: 1 }}>
            {parsed && !nameMapped && 'Mindestens „Name" muss zugeordnet sein.'}
          </span>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', fontFamily: 'inherit' }}>Abbrechen</button>
          <button onClick={runImport} disabled={!parsed || !nameMapped || busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !parsed || !nameMapped || busy ? 'default' : 'pointer', border: 'none', background: 'var(--gold, #B89968)', color: '#fff', fontFamily: 'inherit', opacity: !parsed || !nameMapped || busy ? 0.6 : 1 }}>
            {busy ? <Loader2 size={15} className="bp-spin" /> : <CheckCircle2 size={15} />} Importieren
          </button>
        </div>
      </div>
    </div>
  )
}
